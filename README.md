# Lockstep

A real-time collaborative code editor in the browser: live cursors, offline editing that merges cleanly on reconnect, and version history.

Lockstep uses [Yjs](https://yjs.dev) as its CRDT and builds everything around it by hand: the sync server and wire protocol, persistence and compaction, per-message permissions, reconnection, horizontal scaling and observability. A built-in devtools panel shows what the sync layer is doing, and every performance number in these docs comes from a measured run.

> **Status:** early development (M0, foundations). See [PROGRESS.md](PROGRESS.md).

## Architecture

```
 Browser (CodeMirror + Y.Doc + IndexedDB)
        │ WebSocket (binary)
        ▼
 sync servers (Node) ◀── Redis pub/sub ──▶ sync servers
        │
        ▼
 Postgres: update log + snapshots     web (Next.js): auth, projects, room tokens
```

More detail in [DESIGN.md](DESIGN.md). Decisions and their reasoning are in [docs/adr/](docs/adr/).

## Run locally

Requires Node 24 (see `.nvmrc`), pnpm and Docker.

```bash
pnpm install
```

```bash
pnpm infra:up
```

This starts Postgres (5432), Redis (6379), Prometheus (9090) and Grafana (3001), all bound to localhost.

```bash
pnpm test
```

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Next.js app _(M2)_ |
| `apps/sync` | WebSocket sync server _(M3)_ |
| `packages/protocol` | Wire protocol and close codes |
| `packages/crdt-lab` | A toy CRDT built from first principles, with convergence tests against it and Yjs |
| `infra/` | Docker Compose, Prometheus, Grafana |
| `docs/` | ADRs, prior art, protocol, runbook |

## License

[MIT](LICENSE)
