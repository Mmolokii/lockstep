# 0006. Authenticate sockets with short-lived room tokens sent in the first message

- **Status:** Proposed. To be accepted or revised by RFC 0003 (#69) before #72 and #73 are implemented.
- **Date:** 2026-11-26
- **Milestone:** M5

## Context

`web` (Vercel) and `sync` (Fly) run on different hosts, and possibly different domains. The sync server must know who is connecting, which room they want, and their role (editor or viewer), without calling `web` or the database on every connection. It must also be possible to revoke access mid-session.

## Options considered

### Session cookie on the WebSocket upgrade

- **Pros:** no extra token.
- **Cons:** needs the same parent domain, or third-party cookies. The sync server would need the session store, and so database access on every connect. It's exposed to cross-site WebSocket hijacking unless `Origin` is checked carefully.

### Token in the URL query string (`wss://…?token=`)

- **Pros:** simple, and works everywhere.
- **Cons:** URLs end up in proxy logs, load-balancer logs, browser history and error reports. A leaked log line would grant room access.

### Short-lived signed token, sent as the first message after the upgrade

`web` checks membership and issues a token with a lifetime of about 5 minutes, binding the user, the document (room) and the role. The client sends it in an `auth` message. The server verifies it locally.

- **Pros:** works across domains, nothing sensitive appears in URLs, and the sync server needs no database access to authenticate.
- **Cons:** the server must hold unauthenticated sockets briefly (we cap this at 5 s), and the client must refresh tokens.

## Decision (proposed)

**Short-lived, asymmetrically signed (EdDSA / Ed25519) tokens, sent in the first message.**
- `web` holds the private key. Sync servers hold only the public key, so a compromised sync server can't mint tokens.
- Claims: `sub` (user), `doc`, `role`, `exp`, `jti`, `kid` (key ID for rotation).
- No `auth` within 5 s → close with 4401. A bad signature or an expired token → 4401. Wrong room → 4403.
- The role is enforced **on every message**, not only at connect. Viewers can't send updates or a non-empty sync step 2 (#74, #103).
- Revocation is pushed to sync servers (Redis channel), which close affected sockets with 4403 immediately. We don't wait for tokens to expire.

## Consequences

- Key rotation needs a documented procedure (runbook) and `kid` support. Sync servers accept the current key and the previous one.
- The 5-minute lifetime bounds how long a stolen token is useful, but revocation is the real control.
- `sync-client` must refresh tokens before they expire and handle 4401 by refreshing (#75).
- Open questions for the RFC: token format (JWT vs PASETO), whether `jti` replay protection is needed given the short lifetime, and multiplexed rooms per socket (see ADR 0005).
