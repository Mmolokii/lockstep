// Toy RGA vs Yjs on the same workloads. Run with: pnpm --filter @lockstep/crdt-lab bench
// Each workload runs RUNS times; the median is reported. Numbers are only
// meaningful alongside the machine spec printed at the top.
import { cpus, totalmem } from "node:os";
import * as Y from "yjs";
import { type Op, Rga } from "./rga.ts";

const N = Number(process.env.BENCH_N ?? 10_000);
const RUNS = Number(process.env.BENCH_RUNS ?? 5);

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? Number.NaN;
}

function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

/** Deterministic positions so both implementations get identical workloads. */
function positions(seed: number): () => number {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

interface Result {
  workload: string;
  impl: string;
  ms: number;
  wireBytes: number;
  storedItems: number;
}

const results: Result[] = [];

function benchRga(workload: string, edit: (doc: Rga, ops: Op[]) => void) {
  const times: number[] = [];
  let wireBytes = 0;
  let storedItems = 0;
  for (let r = 0; r < RUNS; r++) {
    const doc = new Rga("a");
    const ops: Op[] = [];
    times.push(time(() => edit(doc, ops)));
    // Wire cost: what a peer joining now would have to receive (every op, JSON-encoded).
    wireBytes = Buffer.byteLength(JSON.stringify(ops));
    storedItems = doc.storedCount;
  }
  results.push({ workload, impl: "toy RGA", ms: median(times), wireBytes, storedItems });
}

function benchYjs(workload: string, edit: (text: Y.Text) => void) {
  const times: number[] = [];
  let wireBytes = 0;
  let storedItems = 0;
  for (let r = 0; r < RUNS; r++) {
    const doc = new Y.Doc();
    const text = doc.getText("t");
    times.push(time(() => edit(text)));
    wireBytes = Y.encodeStateAsUpdate(doc).byteLength;
    // Yjs merges adjacent characters from one client into a single Item.
    let items = 0;
    for (const structs of doc.store.clients.values()) items += structs.length;
    storedItems = items;
  }
  results.push({ workload, impl: "Yjs", ms: median(times), wireBytes, storedItems });
}

// 1. Typing: N characters appended in order.
benchRga(`type ${N} chars`, (doc, ops) => {
  for (let i = 0; i < N; i++) ops.push(doc.insert(i, "x"));
});
benchYjs(`type ${N} chars`, (text) => {
  for (let i = 0; i < N; i++) text.insert(i, "x");
});

// 2. Random edits: N characters inserted at random positions.
benchRga(`${N} random inserts`, (doc, ops) => {
  const rand = positions(42);
  for (let i = 0; i < N; i++) ops.push(doc.insert(Math.floor(rand() * (i + 1)), "x"));
});
benchYjs(`${N} random inserts`, (text) => {
  const rand = positions(42);
  for (let i = 0; i < N; i++) text.insert(Math.floor(rand() * (i + 1)), "x");
});

// 3. Type N characters, then delete them all (tombstone cost).
benchRga(`type ${N} then delete all`, (doc, ops) => {
  for (let i = 0; i < N; i++) ops.push(doc.insert(i, "x"));
  for (let i = N - 1; i >= 0; i--) ops.push(doc.delete(i));
});
benchYjs(`type ${N} then delete all`, (text) => {
  for (let i = 0; i < N; i++) text.insert(i, "x");
  for (let i = N - 1; i >= 0; i--) text.delete(i, 1);
});

const cpu = cpus()[0]?.model ?? "unknown CPU";
console.log(
  `Machine: ${cpu}, ${cpus().length} cores, ${Math.round(totalmem() / 2 ** 30)} GB RAM; Node ${process.version}; median of ${RUNS} runs\n`,
);
console.log("| Workload | Implementation | Time (ms) | Wire size (bytes) | Stored items |");
console.log("|---|---|---:|---:|---:|");
for (const r of results) {
  console.log(
    `| ${r.workload} | ${r.impl} | ${r.ms.toFixed(1)} | ${r.wireBytes.toLocaleString("en-US")} | ${r.storedItems.toLocaleString("en-US")} |`,
  );
}
