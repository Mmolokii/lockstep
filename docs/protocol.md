# Lockstep wire protocol (v1)

> **Status: draft.** This is the starting design for [RFC 0001](https://github.com/Mmolokii/lockstep/issues/30), which finalises it before the sync server is implemented. Close codes are already stable: they're defined in `packages/protocol/src/close-codes.ts` and covered by tests. Any change to this document needs the `protocol-change` label.

## Transport

- One WebSocket per room (document). Multiplexing several rooms over one socket is an open question for RFC 0001 (see [ADR 0005](adr/0005-one-ydoc-per-file-plus-tree-doc.md)).
- Binary frames only. A text frame closes the connection with **4400**.
- The URL identifies the room and nothing else: `wss://<sync-host>/rooms/<docId>`. **Tokens never appear in the URL** ([ADR 0006](adr/0006-room-token-auth-for-sockets.md)).

## Encoding

Every message is one binary frame, encoded with [`lib0`](https://github.com/dmonad/lib0) (the encoding Yjs uses):

```
message  := varUint(type) payload
```

| Notation | Meaning |
|---|---|
| `varUint` | Unsigned LEB128 integer (`encoding.writeVarUint`) |
| `varUint8Array` | `varUint(length)` followed by that many bytes |
| `varString` | UTF-8 bytes as a `varUint8Array` |

Types 0 and 1 match `y-protocols`, so standard Yjs encoders and decoders handle them. Types 2 and up are Lockstep's own control messages.

## Message types

| Type | Name | Direction | Payload |
|---:|---|---|---|
| 0 | **sync** | both | `varUint(subtype)` then a subtype payload (below) |
| 1 | **awareness** | both | `varUint8Array(awarenessUpdate)`: `y-protocols/awareness` encoding |
| 2 | **auth** | client → server | `varString(roomToken)` `varString(traceId)` (traceId may be empty) |
| 3 | **auth-ok** | server → client | `varUint(protocolVersion)` `varString(role)` (`editor` or `viewer`) |
| 4 | **ack** | server → client | `varUint8Array(stateVector)`: the room's state vector after applying this client's updates |
| 5 | **error** | server → client | `varUint(code)` `varString(message)`: a non-fatal error; fatal errors close the socket instead |
| 6 | **ping** | both | `varUint(nonce)` |
| 7 | **pong** | both | `varUint(nonce)`, echoing the ping |
| 8 | **doc-meta** | server → client | `varUint(docBytes)` `varUint(version)` |

### Sync subtypes (type 0)

| Subtype | Name | Payload | Meaning |
|---:|---|---|---|
| 0 | step 1 | `varUint8Array(stateVector)` | "Here's what I have; send me what I'm missing" |
| 1 | step 2 | `varUint8Array(update)` | The updates the other side was missing |
| 2 | update | `varUint8Array(update)` | A new incremental update |

## Connection lifecycle

```
client                                   server
  │── WebSocket upgrade (no token) ────────▶│  socket accepted, unauthenticated
  │── auth(token, traceId) ────────────────▶│  must arrive within 5 s, else close 4401
  │                                          │  verify signature, expiry, room, role
  │◀──────────────────────── auth-ok(v, role)│
  │◀──────────────── sync step1(server SV) ──│  server asks what the client has
  │── sync step1(client SV) ───────────────▶│
  │◀────────────── sync step2(missing) ──────│  client catches up
  │── sync step2(missing) ─────────────────▶│  editors only (see authorisation)
  │◀──────────────────────────── ack(SV) ────│  client may now show "synced"
  │◀═══════ update / awareness / ping ══════▶│  steady state; every update is acked
```

- The client shows **synced** only once the latest `ack` state vector covers every local update it has sent.
- Either side sends `ping` every ~20 s. Missing a `pong` within the timeout means the connection is dead.

## Authorisation (checked on every message)

| Message | Editor | Viewer |
|---|---|---|
| sync step 1 | allowed | allowed |
| sync step 2 with an **empty** update | allowed | allowed |
| sync step 2 with content | allowed | **close 4403**, not applied |
| sync update | allowed | **close 4403**, not applied |
| awareness | allowed (own client ID only) | allowed (own client ID only) |
| auth after auth-ok | close 4400 | close 4400 |
| anything before auth-ok, other than auth | close 4401 | close 4401 |

Revoking access pushes an event to every sync server, which closes the affected sockets with **4403** immediately.

## Close codes

Stable. Defined in `packages/protocol/src/close-codes.ts`.

| Code | Name | Meaning | Client behaviour |
|---:|---|---|---|
| 1000 | Normal | Normal close | Don't reconnect |
| **1012** | ServiceRestart | Server is restarting (deploy or drain) | **Reconnect immediately, with jitter** |
| **4400** | MalformedMessage | Malformed, truncated or unknown message, or a text frame | **Don't reconnect; report a bug** |
| 4401 | InvalidToken | Missing, expired or invalid token, or auth timeout | Refresh the token, then reconnect |
| **4403** | Forbidden | Not allowed in this room, a viewer sent an edit, or access was revoked | **Don't reconnect; show "access removed"** |
| 4404 | RoomNotFound | Room doesn't exist | Don't reconnect |
| 4413 | TooLarge | Message or document exceeds its limit | Don't reconnect; show an error |
| 4429 | RateLimited | Rate limit exceeded | Reconnect with longer backoff |

## Limits

Configurable, and enforced with tests in M3 (#35). Defaults are set in RFC 0001.

| Limit | Variable | Exceeded → |
|---|---|---|
| Maximum message size | `SYNC_MAX_MESSAGE_BYTES` | 4413 |
| Maximum document size | `SYNC_MAX_DOC_BYTES` | 4413 |
| Update rate (token bucket) | `SYNC_RATE_PER_SEC`, `SYNC_RATE_BURST` | 4429 |
| Auth deadline | 5 s | 4401 |
| Slow consumer (`bufferedAmount`) | `SYNC_MAX_BUFFERED_BYTES` | disconnected; resyncs on reconnect |

## Versioning

`auth-ok` carries `protocolVersion` (1 for this draft). Compatibility rules (additive changes, unknown-type handling, deprecation) are an open question for RFC 0001.

## Verification

- `pnpm verify malformed-message`: fuzzed frames → 4400, and the server survives (#102)
- `pnpm verify viewer-rejected`: viewer update and step 2 → 4403, state unchanged (#103)
- Protocol fuzz suite: `pnpm test:fuzz` (#32)
