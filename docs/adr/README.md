# Architecture decision records

One file per decision: `NNNN-short-title.md`, from [0000-template.md](0000-template.md). An accepted ADR's decision is never edited; a new ADR supersedes it (AGENTS.md never-do #13).

## Numbering

Numbers are assigned in order. **Before taking a number, check the reserved list below.** A plan or issue that refers to an ADR that hasn't been written yet reserves its number here, in the same PR. `scripts/adr-index.test.mjs` fails if the docs cite an ADR number that's neither a file nor reserved, or if a reserved number already has a file.

## Reserved

| Number | For | Issue |
|---|---|---|
| 0011 | File-tree conflict rules (rename vs delete, concurrent moves) | #83 |
| 0012 | Health endpoints: readiness ignores shared dependencies | #39 |

0009 was planned for readiness (#39) but was taken by route bundle budgets (#117) before this list existed, so readiness moved to 0012 (#122).

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-monorepo-with-pnpm-and-turborepo.md) | Monorepo with pnpm and Turborepo | Accepted |
| [0002](0002-internal-packages-as-typescript-source.md) | Internal packages export TypeScript source | Accepted |
| [0003](0003-use-yjs-as-the-crdt.md) | Use Yjs as the CRDT | Accepted |
| [0004](0004-codemirror-6-over-monaco.md) | CodeMirror 6 over Monaco | Accepted |
| [0005](0005-one-ydoc-per-file-plus-tree-doc.md) | One Y.Doc per file plus a tree doc | Accepted |
| [0006](0006-room-token-auth-for-sockets.md) | Room-token auth for sockets | Proposed |
| [0007](0007-redis-pubsub-fan-out-with-single-writer.md) | Redis pub/sub fan-out with a single writer | Proposed |
| [0008](0008-update-log-persistence-with-snapshots.md) | Update-log persistence with snapshots | Proposed |
| [0009](0009-route-bundle-budgets.md) | Budget what each route downloads | Accepted |
| [0010](0010-hosting-fly-johannesburg.md) | Fly.io in Johannesburg; Vercel; Neon in Frankfurt | Accepted |
