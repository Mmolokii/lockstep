# 0008. Persist documents as an append-only update log with periodic snapshots

- **Status:** Proposed. To be accepted or revised by RFC 0002 (#58) before M4 implementation. Covers the durability trade-off planned in #68.
- **Date:** 2026-11-26
- **Milestone:** M4

## Context

Yjs produces a stream of small binary updates, often a few bytes per keystroke. We must store documents durably and load them quickly, and no acknowledged edit may be lost. Writes are frequent and tiny; reads happen once per room load.

## Options considered

### Save the full document state on every change

- **Pros:** loading is a single read.
- **Cons:** write amplification grows with document size. A 1 MB document rewritten on every keystroke is untenable.

### Append-only update log only

- **Pros:** cheap appends that preserve every change.
- **Cons:** load time grows forever, because loading replays every update since creation.

### Update log plus periodic snapshot compaction

Append updates to `doc_updates`. When more than N updates have built up since the last snapshot, merge them into a new `doc_snapshots` row inside one transaction, and delete the merged updates only after the snapshot commits.

- **Pros:** cheap writes and bounded load time (snapshot plus tail).
- **Cons:** a background compaction process to build and test.

## Decision (proposed)

**Update log plus snapshots, with writes batched per room.**

- Updates are batched per room and flushed every ~500 ms or when a size threshold is reached, one transaction per batch.
- Load path: the latest snapshot plus every update with `seq > upto_seq`, merged.
- Compaction runs only on the document's writer (ADR 0007). Snapshot and delete happen in one transaction.

### The durability trade-off

Batching means an update can be acknowledged to the client (`ack`) up to ~500 ms before it's in Postgres. We accept this because of the CRDT safety net: the client keeps every update in IndexedDB, and on reconnect the two-step sync sends the server anything it's missing. A server crash inside the batch window therefore loses no edit that the *client* holds.

What could be lost is an update whose client also lost its local state (cleared storage, a different device) inside the same window. We accept that narrow case for v1 and record it here.

## Consequences

- "No acknowledged edit is lost" relies on clients resupplying state, so the chaos test (M7) and the crash-before-flush test (#66) must prove it.
- The flush interval is a tunable trade-off between write volume and exposure. It's exposed as a metric and configuration.
- If Postgres is unavailable, batches are buffered in memory up to a limit, then new rooms are refused (#65).
- If the narrow loss case became unacceptable, the fix is to acknowledge only after the flush (higher latency to "synced"), or to use a write-ahead log on local disk.
