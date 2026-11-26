import fc from "fast-check";

/**
 * The minimum a text CRDT replica must offer for the convergence harness.
 * `Msg` is whatever the implementation sends over the wire (ops, binary updates).
 */
export interface Replica<Msg> {
  readonly length: number;
  text(): string;
  insert(position: number, char: string): void;
  delete(position: number): void;
  /** Messages produced by local edits since the last call. */
  takeOutgoing(): Msg[];
  receive(messages: Msg[]): void;
}

export type ReplicaFactory<Msg> = (index: number) => Replica<Msg>;

/** One step of a simulated session. Fractions are scaled to the current document. */
export type Step =
  | { kind: "insert"; replica: number; at: number; char: string }
  | { kind: "delete"; replica: number; at: number }
  | { kind: "deliver"; replica: number; pick: number; duplicate: boolean };

const fraction = fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true });

export function stepArbitrary(replicas: number): fc.Arbitrary<Step> {
  const replica = fc.nat({ max: replicas - 1 });
  return fc.oneof(
    {
      weight: 4,
      arbitrary: fc.record({
        kind: fc.constant("insert" as const),
        replica,
        at: fraction,
        char: fc.constantFrom(..."abcxyz"),
      }),
    },
    {
      weight: 2,
      arbitrary: fc.record({ kind: fc.constant("delete" as const), replica, at: fraction }),
    },
    {
      weight: 4,
      arbitrary: fc.record({
        kind: fc.constant("deliver" as const),
        replica,
        pick: fraction,
        duplicate: fc.boolean(),
      }),
    },
  );
}

export interface Scenario {
  readonly replicas: number;
  readonly steps: readonly Step[];
  /** Order used to drain everything still in flight at the end. */
  readonly drainSeed: number;
}

export const scenarioArbitrary: fc.Arbitrary<Scenario> = fc
  .integer({ min: 2, max: 5 })
  .chain((replicas) =>
    fc.record({
      replicas: fc.constant(replicas),
      steps: fc.array(stepArbitrary(replicas), { minLength: 10, maxLength: 200, size: "max" }),
      drainSeed: fc.integer(),
    }),
  );

/** Small deterministic PRNG (mulberry32) so the final drain order is reproducible. */
function prng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Run a scenario: replicas edit concurrently while messages are delivered to
 * each replica one at a time, out of order and possibly duplicated. At the end
 * every in-flight message is delivered in a random order. Returns each
 * replica's final text; the caller asserts they are all equal.
 */
export function runScenario<Msg>(factory: ReplicaFactory<Msg>, scenario: Scenario): string[] {
  const replicas = Array.from({ length: scenario.replicas }, (_, i) => factory(i));
  // inFlight[i] holds messages sent to replica i and not yet delivered.
  const inFlight: Msg[][] = replicas.map(() => []);

  const broadcastFrom = (sender: number) => {
    const source = replicas[sender];
    if (source === undefined) return;
    const out = source.takeOutgoing();
    inFlight.forEach((queue, i) => {
      if (i !== sender) queue.push(...out);
    });
  };

  for (const step of scenario.steps) {
    const replica = replicas[step.replica];
    const queue = inFlight[step.replica];
    if (replica === undefined || queue === undefined) continue;
    if (step.kind === "insert") {
      replica.insert(Math.floor(step.at * (replica.length + 1)), step.char);
      broadcastFrom(step.replica);
    } else if (step.kind === "delete") {
      if (replica.length === 0) continue;
      replica.delete(Math.floor(step.at * replica.length));
      broadcastFrom(step.replica);
    } else {
      if (queue.length === 0) continue;
      const index = Math.floor(step.pick * queue.length);
      const message = queue[index] as Msg;
      if (!step.duplicate) queue.splice(index, 1);
      replica.receive([message]);
    }
  }

  const random = prng(scenario.drainSeed);
  replicas.forEach((replica, i) => {
    const queue = inFlight[i] ?? [];
    while (queue.length > 0) {
      const [message] = queue.splice(Math.floor(random() * queue.length), 1);
      replica.receive([message as Msg]);
    }
  });

  return replicas.map((r) => r.text());
}
