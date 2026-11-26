# @lockstep/crdt-lab

A toy sequence CRDT for plain text (RGA), plus a property-based harness that checks convergence for it **and for Yjs**. The app never imports this package. It exists to show from first principles why collaborative text converges, and to give evidence for [ADR 0003](../../docs/adr/0003-use-yjs-as-the-crdt.md).

## The algorithm (RGA)

Every character has a permanent id `(counter, replica)`, where `counter` is a Lamport clock. An insert means "put this character **after the character with id X**", never "at index 5". Ids are totally ordered: by counter, then by replica.

**Integrating an insert:** start just right of the origin, then skip every node whose id is **greater** than the new one, and stop at the first smaller one.

### Worked example

Replicas A and B both hold `ac`, where `a = (1,A)` and `c = (2,A)`. At the same moment:

- A inserts `X` after `a`, with id `(3,A)`.
- B inserts `Y` after `a`, with id `(3,B)`.

Same counter, so the tie breaks on replica: `(3,B) > (3,A)`.

- **On A**, `Y` arrives. Starting after `a`, the next node is `X (3,A)`, which is smaller than `(3,B)`, so stop and insert there: `aYXc`.
- **On B**, `X` arrives. Starting after `a`, the next node is `Y (3,B)`, which is greater than `(3,A)`, so skip it. The next is `c (2,A)`, which is smaller, so stop: `aYXc`.

Both replicas get `aYXc` without talking to each other again.

**Why skipping by id is enough:** anything inserted after a greater-id sibling was created by a replica that had already seen that sibling, so its Lamport counter is greater still. One comparison therefore skips the sibling together with everything that hangs off it.

**Deletes** mark a node as a tombstone and keep it, because a concurrent insert may name it as its origin. See the test "applies an insert whose origin was concurrently deleted".

**Delivery:** duplicates are ignored by id. An op whose origin or target hasn't arrived waits in a buffer and is retried after each successful apply. Together, these make the result independent of delivery order.

## The convergence property

`src/harness.ts` simulates 2–5 replicas over 10–200 random steps. Each step is a local insert, a local delete, or the delivery of one in-flight message to a replica, picked out of order and optionally duplicated. At the end, everything still in flight is delivered in a random order, and every replica must hold the same text. [fast-check](https://fast-check.dev) generates the sessions and shrinks any failure to a minimal one.

The same property runs against Yjs through `src/replicas.ts`. A deliberately broken replica (raw index positions, no CRDT) is included to prove the property actually detects divergence.

```bash
pnpm --filter @lockstep/crdt-lab test
```

```bash
CONVERGENCE_RUNS=20000 pnpm --filter @lockstep/crdt-lab exec vitest run src/convergence.test.ts
```

The default is 2,000 runs per implementation. A 20,000-run sweep passed for both on 2026-11-26 (Apple M4, Node v24.22.0, 44 s).

## Benchmark

```bash
pnpm --filter @lockstep/crdt-lab bench
```

Results and their interpretation are in [ADR 0003](../../docs/adr/0003-use-yjs-as-the-crdt.md).

## Limitations (on purpose)

- O(n) position lookups
- No run merging and no garbage collection
- JSON ops, no binary encoding
- No state vectors
- Plain text only
