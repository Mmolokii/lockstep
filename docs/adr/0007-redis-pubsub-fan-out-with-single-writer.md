# 0007. Scale sync servers with Redis pub/sub fan-out and a single writer per document

- **Status:** Proposed. To be accepted or revised by the M7 multi-instance RFC before implementation.
- **Date:** 2026-11-26
- **Milestone:** M7

## Context

One sync instance is a single point of failure and has a capacity ceiling. With two or more instances, users in the same room may land on different instances and must still see each other's edits within the latency budget (p95 under 100 ms). Deploys and crashes move clients between instances.

## Options considered

### Redis pub/sub fan-out

Each instance holding a room subscribes to that room's channel. An update applied on one instance is published, and other instances apply it and forward it to their clients.

- **Pros:** any instance can serve any client, so no routing layer is needed and reconnecting after a crash is trivial.
- **Cons:** every instance holding a room keeps its own Y.Doc in memory. Pub/sub is **at-most-once**: messages published while a subscriber is disconnected are lost. Every instance would also try to persist the same updates.

### Room-affinity routing (consistent hashing)

A router sends every connection for a room to the instance that owns it.

- **Pros:** one Y.Doc per room, no cross-instance traffic, and a natural single writer.
- **Cons:** needs a routing layer that understands room IDs, which Fly's proxy doesn't do out of the box. Rebalancing when instances join or leave moves rooms and drops connections. A crashed owner means a failover protocol.

### Redis Streams instead of pub/sub

- **Pros:** at-least-once delivery, with replay from a position.
- **Cons:** more moving parts (consumer groups, trimming), and the CRDT already makes delivery idempotent.

## Decision (proposed)

**Redis pub/sub fan-out, plus two mechanisms that fix its weaknesses:**

1. **Single writer per document.** One instance holds a writer lease for each document (a Postgres advisory lock or a Redis lease with fencing). Only the lease holder writes to `doc_updates` and runs compaction. Other instances apply updates in memory only.
2. **Periodic state-vector reconciliation.** Instances holding the same room exchange state vectors on a timer and after reconnecting to Redis, then send each other the missing updates. This repairs anything pub/sub dropped. Yjs makes it cheap, because applying a duplicate update is a no-op.

## Consequences

- Memory cost: a room open on N instances uses N copies of its document. The load test (M7) must measure this.
- The writer lease needs fencing, so a stalled former owner can't write after losing the lease.
- Redis becomes a shared dependency. Its failure degrades cross-instance collaboration but must not drain the instances (see the System Overview reconciliation and the readiness ADR, M3).
- When to switch to room affinity: if Redis traffic or duplicated memory dominates the load-test profile, revisit this decision with the measured numbers.
