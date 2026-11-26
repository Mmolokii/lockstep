import { compareIds, type Id, idKey } from "./ids.ts";

/** Insert `char` immediately after the character `origin` (null = document start). */
export interface InsertOp {
  readonly type: "insert";
  readonly id: Id;
  readonly origin: Id | null;
  readonly char: string;
}

/** Mark the character `target` as deleted. */
export interface DeleteOp {
  readonly type: "delete";
  readonly target: Id;
}

export type Op = InsertOp | DeleteOp;

interface Node {
  readonly id: Id;
  readonly char: string;
  deleted: boolean;
}

/**
 * A Replicated Growable Array (RGA) for plain text.
 *
 * - Every character has a unique id and is inserted *after* another character's
 *   id, never at a numeric index, so concurrent edits can't shift each other.
 * - Deletes leave a tombstone, because a concurrent insert may still use the
 *   deleted character as its origin.
 * - Remote ops are applied idempotently (duplicates are ignored) and causally:
 *   an op whose origin or target hasn't arrived yet waits in a buffer.
 *
 * Positions are O(n) lookups over a flat array. That's fine for a learning
 * model, and it's one of the reasons production uses Yjs (see ADR 0003).
 */
export class Rga {
  readonly replica: string;
  #clock = 0;
  readonly #nodes: Node[] = [];
  readonly #byId = new Map<string, Node>();
  #pending: Op[] = [];

  constructor(replica: string) {
    if (replica.length === 0) throw new Error("replica id must not be empty");
    this.replica = replica;
  }

  /** Number of visible (non-deleted) characters. */
  get length(): number {
    let n = 0;
    for (const node of this.#nodes) if (!node.deleted) n++;
    return n;
  }

  /** Ops received but not yet applicable because a dependency is missing. */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** Number of stored nodes including tombstones. */
  get storedCount(): number {
    return this.#nodes.length;
  }

  toString(): string {
    let s = "";
    for (const node of this.#nodes) if (!node.deleted) s += node.char;
    return s;
  }

  /** Insert one character at a visible position and return the op to broadcast. */
  insert(position: number, char: string): InsertOp {
    if (char.length !== 1) throw new RangeError("insert expects exactly one character");
    const length = this.length;
    if (!Number.isInteger(position) || position < 0 || position > length) {
      throw new RangeError(`insert position ${position} out of range 0..${length}`);
    }
    const origin = position === 0 ? null : this.#visibleNodeAt(position - 1).id;
    this.#clock += 1;
    const op: InsertOp = {
      type: "insert",
      id: { counter: this.#clock, replica: this.replica },
      origin,
      char,
    };
    this.#integrateInsert(op);
    return op;
  }

  /** Delete the character at a visible position and return the op to broadcast. */
  delete(position: number): DeleteOp {
    const length = this.length;
    if (!Number.isInteger(position) || position < 0 || position >= length) {
      throw new RangeError(`delete position ${position} out of range 0..${length - 1}`);
    }
    const node = this.#visibleNodeAt(position);
    node.deleted = true;
    return { type: "delete", target: node.id };
  }

  /**
   * Apply remote ops in any order, any number of times. Ops whose dependencies
   * haven't arrived are buffered and retried whenever something new applies.
   */
  merge(ops: Iterable<Op>): void {
    for (const op of ops) this.#pending.push(op);
    let progressed = true;
    while (progressed) {
      progressed = false;
      const stillWaiting: Op[] = [];
      for (const op of this.#pending) {
        if (this.#tryApply(op)) progressed = true;
        else stillWaiting.push(op);
      }
      this.#pending = stillWaiting;
    }
  }

  /** Returns true if the op was applied or is a duplicate, false if it must wait. */
  #tryApply(op: Op): boolean {
    if (op.type === "insert") {
      if (this.#byId.has(idKey(op.id))) return true; // duplicate delivery
      if (op.origin !== null && !this.#byId.has(idKey(op.origin))) return false;
      this.#clock = Math.max(this.#clock, op.id.counter);
      this.#integrateInsert(op);
      return true;
    }
    const target = this.#byId.get(idKey(op.target));
    if (target === undefined) return false;
    target.deleted = true; // idempotent
    return true;
  }

  /**
   * Place a new node to the right of its origin. Nodes already there with a
   * greater id were inserted concurrently (or later, after something with a
   * greater id) and take precedence, so skip past all of them. Because
   * counters are Lamport clocks, anything inserted after a greater-id sibling
   * also has a greater id, so one comparison skips whole subtrees correctly.
   */
  #integrateInsert(op: InsertOp): void {
    let i = op.origin === null ? 0 : this.#indexOf(op.origin) + 1;
    while (i < this.#nodes.length) {
      const next = this.#nodes[i];
      if (next === undefined || compareIds(next.id, op.id) < 0) break;
      i++;
    }
    const node: Node = { id: op.id, char: op.char, deleted: false };
    this.#nodes.splice(i, 0, node);
    this.#byId.set(idKey(op.id), node);
  }

  #indexOf(id: Id): number {
    const node = this.#byId.get(idKey(id));
    const index = node === undefined ? -1 : this.#nodes.indexOf(node);
    if (index === -1) throw new Error(`unknown id ${idKey(id)}`);
    return index;
  }

  #visibleNodeAt(position: number): Node {
    let seen = 0;
    for (const node of this.#nodes) {
      if (node.deleted) continue;
      if (seen === position) return node;
      seen++;
    }
    throw new RangeError(`no visible character at ${position}`);
  }
}
