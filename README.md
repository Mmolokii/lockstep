# Lockstep

A real-time collaborative code editor in the browser: live cursors, offline editing that merges cleanly on reconnect, and version history.

Lockstep uses [Yjs](https://yjs.dev) as its CRDT and builds everything around it by hand: the sync server and wire protocol, persistence and compaction, per-message permissions, reconnection, horizontal scaling and observability. A built-in devtools panel shows what the sync layer is doing, and every performance number in these docs comes from a measured run.

> [!WARNING]
> **Under active development.** Lockstep isn't usable yet. Foundations, the CRDT lab and the delivery pipeline are in place; the editor and sync server are being built now (M2–M3). Progress: [PROGRESS.md](PROGRESS.md) · Board: [Lockstep project](https://github.com/users/Mmolokii/projects/5).

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
pnpm verify doctor
```

That checks Node, pnpm, Docker, Postgres, Redis and free ports. Then run the full CI gate locally:

```bash
pnpm ci:local
```

Contributors and AI agents: start with [AGENTS.md](AGENTS.md).

## Repository layout

| Path | What |
|---|---|
| `apps/web` | Next.js app |
| `e2e/` | Playwright end-to-end suite |
| `apps/sync` | WebSocket sync server _(M3)_ |
| `packages/protocol` | Wire protocol and close codes |
| `packages/crdt-lab` | A toy CRDT built from first principles, with convergence tests against it and Yjs |
| `infra/` | Docker Compose, Prometheus, Grafana |
| `docs/` | ADRs, prior art, protocol, runbook |

## License

[MIT](LICENSE)
