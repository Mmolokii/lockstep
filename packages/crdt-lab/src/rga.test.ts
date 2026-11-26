import { describe, expect, it } from "vitest";
import { compareIds, idKey } from "./ids.ts";
import { type Op, Rga } from "./rga.ts";

function type(doc: Rga, text: string, at = doc.length): Op[] {
  return [...text].map((ch, i) => doc.insert(at + i, ch));
}

describe("ids", () => {
  it("orders by counter, then replica", () => {
    expect(compareIds({ counter: 1, replica: "b" }, { counter: 2, replica: "a" })).toBeLessThan(0);
    expect(compareIds({ counter: 2, replica: "a" }, { counter: 2, replica: "b" })).toBeLessThan(0);
    expect(compareIds({ counter: 2, replica: "b" }, { counter: 2, replica: "a" })).toBeGreaterThan(
      0,
    );
    expect(compareIds({ counter: 2, replica: "a" }, { counter: 2, replica: "a" })).toBe(0);
    expect(idKey({ counter: 3, replica: "x" })).toBe("3@x");
  });
});

describe("Rga local editing", () => {
  it("inserts and deletes at visible positions", () => {
    const doc = new Rga("a");
    type(doc, "helo");
    doc.insert(3, "l");
    expect(doc.toString()).toBe("hello");
    doc.delete(0);
    expect(doc.toString()).toBe("ello");
    expect(doc.length).toBe(4);
    expect(doc.storedCount).toBe(5); // the deleted "h" is a tombstone
  });

  it("rejects out-of-range positions and multi-character inserts", () => {
    const doc = new Rga("a");
    expect(() => doc.insert(1, "x")).toThrow(RangeError);
    expect(() => doc.insert(-1, "x")).toThrow(RangeError);
    expect(() => doc.insert(0.5, "x")).toThrow(RangeError);
    expect(() => doc.insert(0, "xy")).toThrow(RangeError);
    expect(() => doc.delete(0)).toThrow(RangeError);
    expect(() => new Rga("")).toThrow();
  });
});

describe("Rga merging", () => {
  it("replicates a sequence of ops to another replica", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    b.merge(type(a, "abc"));
    expect(b.toString()).toBe("abc");
  });

  it("resolves concurrent inserts at the same position identically on both sides", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    b.merge(type(a, "ac"));
    const fromA = a.insert(1, "X");
    const fromB = b.insert(1, "Y");
    a.merge([fromB]);
    b.merge([fromA]);
    expect(a.toString()).toBe(b.toString());
    // Same counter, so the tie breaks on replica id: "b" > "a" sits closer to the origin.
    expect(a.toString()).toBe("aYXc");
  });

  it("keeps each replica's concurrent run of typing together", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    const opsA = type(a, "hi");
    const opsB = type(b, "yo");
    a.merge(opsB);
    b.merge(opsA);
    expect(a.toString()).toBe(b.toString());
    expect(["hiyo", "yohi"]).toContain(a.toString());
  });

  it("applies an insert whose origin was concurrently deleted", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    b.merge(type(a, "abc"));
    const del = a.delete(1); // a deletes "b"
    const ins = b.insert(2, "X"); // b inserts after "b"
    a.merge([ins]);
    b.merge([del]);
    expect(a.toString()).toBe("aXc");
    expect(b.toString()).toBe("aXc");
  });

  it("buffers ops that arrive before their dependencies", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    const ops = type(a, "abc");
    ops.push(a.delete(0));
    b.merge([...ops].reverse());
    expect(b.toString()).toBe("bc");
    expect(b.pendingCount).toBe(0);
  });

  it("holds an op until its dependency arrives in a later merge", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    const [first, second] = type(a, "ab");
    if (first === undefined || second === undefined) throw new Error("expected two ops");
    b.merge([second]);
    expect(b.toString()).toBe("");
    expect(b.pendingCount).toBe(1);
    b.merge([first]);
    expect(b.toString()).toBe("ab");
    expect(b.pendingCount).toBe(0);
  });

  it("ignores duplicate deliveries", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    const ops = type(a, "ab");
    ops.push(a.delete(0));
    b.merge(ops);
    b.merge(ops);
    expect(b.toString()).toBe("b");
    expect(b.storedCount).toBe(2);
  });

  it("advances its Lamport clock past ops it receives", () => {
    const a = new Rga("a");
    const b = new Rga("b");
    b.merge(type(a, "abc")); // a's clock is now 3
    const op = b.insert(3, "d");
    expect(op.type === "insert" && op.id.counter).toBe(4);
  });
});
