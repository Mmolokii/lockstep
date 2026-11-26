# 0003. Use Yjs as the CRDT

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M1

## Context

Lockstep needs concurrent edits from several people to converge, editing to keep working offline, and edits to merge on reconnect. That rules out "last write wins" on whole files. There are two families of algorithms for this: operational transformation (OT) and conflict-free replicated data types (CRDTs). Within CRDTs, we can use a library or write our own. M1 built a toy CRDT (`packages/crdt-lab`) to make this choice from evidence rather than reputation.

## Options considered

### Operational transformation (OT)

Clients send index-based operations. A central server orders them and transforms each operation against the ones it raced with. Replit and the original CodeSandbox Live use OT (see [prior art](../prior-art.md)).

- **Pros:** compact operations, no per-character metadata, decades of production use (Google Docs).
- **Cons:** correctness depends on the server ordering every operation, so offline editing means a long rebase against everything that happened meanwhile, and peer-to-peer is effectively impossible. Transformation functions are notoriously hard to get right: many published OT algorithms were later shown to be incorrect.

### Write our own CRDT

`crdt-lab` implements RGA in about 200 lines. It passes the convergence property for 20,000 random sessions (2–5 replicas, 10–200 steps, out-of-order and duplicated delivery). So correctness is achievable. Production readiness is not. Measured on the same workloads (`pnpm --filter @lockstep/crdt-lab bench`):

Machine: Apple M4, 10 cores, 16 GB RAM; Node v24.22.0; Yjs 13.6.33; median of 5 runs.

| Workload | Implementation | Time (ms) | Wire size (bytes) | Stored items |
|---|---|---:|---:|---:|
| type 10000 chars | toy RGA | 117.2 | 1,047,762 | 10,000 |
| type 10000 chars | Yjs | 11.5 | 10,015 | 1 |
| 10000 random inserts | toy RGA | 79.1 | 1,044,760 | 10,000 |
| 10000 random inserts | Yjs | 17.1 | 168,439 | 9,998 |
| type 10000 then delete all | toy RGA | 218.4 | 1,626,656 | 10,000 |
| type 10000 then delete all | Yjs | 22.9 | 24 | 1 |

"Wire size" is what a newly joining peer must receive: every op as JSON for the toy, `encodeStateAsUpdate` for Yjs. JSON flatters Yjs somewhat. A binary encoding of the toy's ops would be perhaps 5–10× smaller, but it would still grow with every keystroke and every deletion, forever.

The gaps all come from things the toy lacks:

- **Run merging.** Yjs stores a run of consecutive characters typed by one client as a single item. 10,000 typed characters are 1 item and 10 KB, against 10,000 nodes for the toy.
- **Garbage collection.** Deleted content is discarded and adjacent deleted items are merged. Typing 10,000 characters and deleting them all leaves 24 bytes. The toy keeps 10,000 tombstones permanently.
- **Indexing.** The toy finds positions with linear scans (O(n) per op). Yjs caches search markers, so editing near the previous position is cheap.
- **A binary format and state vectors.** Yjs encodes compactly with `lib0`, and "what am I missing?" is a state-vector diff, which is exactly what our two-step sync protocol needs (M3).
- **Rich types and an ecosystem.** Maps (for the file tree), arrays, relative positions (for cursors and future comments), undo manager, awareness protocol, and a maintained CodeMirror binding.

### Automerge

A strong CRDT with full history and a Rust core. It has fewer editor bindings than Yjs, and its JavaScript and Rust sync stacks aren't wire-compatible yet ([prior art](../prior-art.md)). Its history-first design also costs more memory than we need.

### Yjs

YATA-based CRDT with all of the above. It's used in production by many collaborative editors.

## Decision

Use **Yjs** for document state. Build everything around it ourselves (sync server, protocol handling, persistence, auth, scaling), as the project thesis says. Keep `crdt-lab` as a reference implementation and test bed. It's never imported by the app.

## Consequences

- We get convergence, offline merge and compact updates without maintaining a CRDT.
- Correctness of document state now depends on Yjs. The convergence harness runs against Yjs in CI, so a regression in a Yjs upgrade would be caught.
- We inherit Yjs's model: one `clientID` per session, state vectors, and binary updates that are opaque to the server. The server can merge and persist updates but can't easily inspect their contents, which suits our "never log contents" rule.
- Garbage collection discards deleted content. Version history (M6) must therefore store explicit snapshots (`doc_versions`) rather than rely on reconstructing old states from the update log.
- If Yjs were ever abandoned, the harness and the `Replica` interface in `crdt-lab` give us a ready way to qualify a replacement.
