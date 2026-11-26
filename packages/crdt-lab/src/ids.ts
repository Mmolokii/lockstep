/**
 * A globally unique, immutable identifier for one inserted character.
 *
 * `counter` is a Lamport clock value: before generating an op, a replica sets
 * its clock to one more than the largest counter it has seen. So if replica B
 * had already seen op X when it created op Y, then Y.counter > X.counter.
 * `replica` breaks ties between concurrent ops that drew the same counter.
 */
export interface Id {
  readonly counter: number;
  readonly replica: string;
}

/**
 * Total order over ids: by counter, then by replica. Every replica computes
 * the same order, which is what makes concurrent inserts resolve identically
 * everywhere. Returns a negative number if a < b, positive if a > b, 0 if equal.
 */
export function compareIds(a: Id, b: Id): number {
  if (a.counter !== b.counter) return a.counter - b.counter;
  if (a.replica === b.replica) return 0;
  return a.replica < b.replica ? -1 : 1;
}

/** A string key for using ids in a Map. */
export function idKey(id: Id): string {
  return `${id.counter}@${id.replica}`;
}
