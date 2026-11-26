# Lockstep design

> First version (M0). This describes the intended design. Sections marked _planned_ describe things not built yet. Each milestone updates this file as the design turns into code.

## Goals

1. Several people edit the same project at once, and every replica converges to the same state.
2. Editing keeps working offline, and edits merge cleanly on reconnect.
3. No acknowledged edit is ever lost, even if a server crashes.
4. The system scales across several sync servers, and we can measure and explain its behaviour.

## Components

```
 Browser                                   Servers
 ┌───────────────────────────┐
 │ editor (CodeMirror 6)     │
 │   ↕ y-codemirror binding  │
 │ Y.Doc per file + tree doc │
 │   ↕ y-indexeddb (offline) │
 │ sync-client ──────────────┼── WebSocket ──▶ sync (Node, ws) ×N ──▶ Postgres
 │   ↑ room token            │                    ↕ Redis pub/sub
 └───┼───────────────────────┘                    ↑ revocations
     └──── HTTPS ────────────────────────▶ web (Next.js) ──▶ Postgres
```

| Component | Responsibility | Runs on |
|---|---|---|
| `apps/web` | Auth (GitHub), projects, members, share links, room tokens, UI | Vercel |
| `apps/sync` | Rooms, sync protocol, per-message authorisation, persistence, fan-out | Fly.io (long-lived processes) |
| `packages/protocol` | Message encoding, close codes, shared types | Both ends of the socket |
| `packages/sync-client` | Connection, auth, reconnection, offline, truthful status | Browser |
| `packages/editor` | CodeMirror + Yjs binding, cursors, presence, devtools | Browser |
| `packages/db` | Drizzle schema and migrations | web and sync |

## Document model

- One **Y.Doc per file** (a `Y.Text`), plus one **project Y.Doc** holding the file tree as a `Y.Map` of path to metadata.
- Why per file: a room only loads what someone has open, so memory per room stays bounded. The cost is that changes across several files aren't atomic. _ADR planned (M2)._

## The life of a keystroke (_planned_, filled in as M2–M7 land)

1. CodeMirror applies the keystroke locally. The Yjs binding turns it into a Y.Text insert, and the local Y.Doc emits an update of a few bytes.
2. `y-indexeddb` persists the update, so it survives a reload even when offline.
3. `sync-client` sends it as a sync `update` message, or queues it while offline.
4. The sync server checks the connection's role (viewers are rejected), applies the update to the room's Y.Doc, broadcasts it to the room's other clients, publishes it to other instances through Redis, queues it for the batched Postgres write, and sends an `ack` with its state vector.
5. Other clients apply it, and the binding updates their editors.
6. The client shows "synced" once the `ack` covers all of its local updates.

## Wire protocol (_planned_, M3)

`y-protocols` sync (step 1, step 2, update) and awareness messages, plus our own control messages: `auth`, `auth-ok`, `ack`, `error`, `ping`/`pong`, `doc-meta`. Stable close codes are listed in [docs/protocol.md](docs/protocol.md) _(M3)_ and in `packages/protocol/src/close-codes.ts`.

## Persistence (_planned_, M4)

Append-only `doc_updates` log, batched every ~500 ms, plus periodic snapshot compaction into `doc_snapshots`. Loading a document means the latest snapshot plus every update after it. Only one instance writes each document. If a server crashes before flushing, the clients still hold the state and send it back during the next sync handshake.

## Security model (_planned_, M5)

- The browser gets a short-lived room token (EdDSA-signed, about 5 minutes) from `web` and sends it in the first WebSocket message, never in the URL.
- The sync server checks permissions at connect **and on every message**. Viewers can't send updates or a non-empty sync step 2.
- Revocations are pushed to sync servers, which close affected sockets immediately with 4403.
- Share-link tokens are stored hashed. Message contents are never logged.

## Scaling (_planned_, M7)

Several sync instances serve the same room, fanning out updates through Redis pub/sub. A per-document writer lock prevents duplicate writes and racing compactions. Periodic state-vector exchange repairs any drift from pub/sub's at-most-once delivery. Room-affinity routing is the alternative to be weighed in an ADR.

## Failure modes (_planned_, filled in by M7)

| Failure | Expected behaviour |
|---|---|
| Client goes offline | Keeps editing locally; syncs the difference on reconnect |
| Sync instance crashes | Clients reconnect (with jitter) to another instance; unflushed updates come back from clients |
| Deploy | Instances drain: close with 1012, flush, exit; clients reconnect immediately |
| Redis unavailable | _To be designed in M7_ |
| Postgres unavailable | `/readyz` fails; _behaviour to be designed in M4_ |

## Decisions

See [docs/adr/](docs/adr/).

- [0001 Monorepo with pnpm and Turborepo](docs/adr/0001-monorepo-with-pnpm-and-turborepo.md)
- [0002 Internal packages export TypeScript source](docs/adr/0002-internal-packages-as-typescript-source.md)
- [0003 Use Yjs as the CRDT](docs/adr/0003-use-yjs-as-the-crdt.md)
