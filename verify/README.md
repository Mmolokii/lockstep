# @lockstep/verify

Named, deterministic checks that drive real processes. Usage and exit codes are in [AGENTS.md](../AGENTS.md#the-verify-cli). This file covers how scenarios are built.

## How a scenario runs

Only the runner (`src/runner.ts`) runs scenarios, and it guarantees three things a scenario can't opt out of:

1. **Preconditions first.** Doctor's Node, Postgres and Redis checks run before `run` is called. A down database fails as `precondition: Redis`, not as a confusing timeout halfway through.
2. **Teardown always.** `run` gets a `Teardown`. Every process, socket and temp directory is registered the moment it exists, and the runner releases all of them in reverse order, whether the scenario passed, failed or threw. A cleanup that fails is reported as a failed check, so a leaked server can't hide behind a green run.
3. **One seed.** All randomness comes from `ctx.random`, derived from a seed printed on every run. Replay any failure with `pnpm verify <scenario> --seed <n>`.

## Writing `run`

- Start your own sync server on **port 0** (OS-assigned) and register it with `ctx.teardown`. Never depend on a server that happens to be running, or on fixed ports.
- Connect with **Node's built-in `WebSocket`** (no `ws` dependency needed on Node 24) and the real encoders from `@lockstep/protocol`. Hand-write frames only when testing malformed input on purpose.
- Authenticate with **real signed room tokens** from a key pair generated per run. Placeholder tokens like `room:user:role` would test an auth path that production doesn't have.
- **Every step asserts something observable.** A step that returns success without checking anything isn't a check.
- **Wait on events** (a message, a close code, `/healthz`) with a timeout. Never wait on a fixed sleep alone.
- Mark the scenario `active` in the same PR that implements it. `check-registry` fails if its tracking issue closes while it's still pending.

## Decisions on the review draft (2026-11-26)

A standalone `verify/cli.mjs` was proposed in review (#109). The existing CLI stays, and these ideas were adopted from the draft:

| Draft idea | Decision | Where |
|---|---|---|
| "Tear down everything it started, even on failure" | **Adopted, enforced by the runner** | `src/teardown.ts`, `src/runner.ts` |
| "Check its own preconditions (doctor first)" | **Adopted, enforced by the runner** | `preflight` in `src/doctor.ts` |
| Isolated ports for test instances | **Adopted** as port 0 per scenario | Rules above |
| A step helper that turns thrown errors into failed checks | Adopted | `withTeardown` reports a throw as a failed check |
| `list` / `--help` output | Already present | `pnpm verify help` |

These parts of the draft were rejected:

| Draft item | Why |
|---|---|
| Exit codes 0/1 only | Unimplemented scenarios would have to either fail CI forever or pass while checking nothing. The draft's TODO steps (`"both docs converge"`, `"document unchanged"`, `"healthz 200"`, `"ports free"`) return success without asserting, so they'd report **PASS** for behaviour that doesn't exist. Exit code 2 (pending), plus `check-registry`, makes that state visible and temporary |
| Placeholder tokens (`${room}:alice:editor`, raw `ws.send(token)`) | Contradicts ADR 0006 and the protocol's `auth` message; viewer-rejected would pass against a fake auth path |
| malformed-message requiring the connection to stay open | The protocol requires malformed frames to close the socket with 4400. Asserting "still open" would pass a server that silently ignores garbage |
| `Math.random()` payloads | Not reproducible. Replaced by the seeded `ctx.random` |
| Doctor probing a running sync server on `ws://localhost:8787` | Doctor runs before anything is started; scenarios start their own server. The repo's port is `SYNC_PORT` (4444), not 8787 |
| `ws` as a new dependency | Node 24 ships a WebSocket client |
| `docker compose ps` without parsing the output | Always passes. Doctor speaks the Postgres and Redis protocols instead |
