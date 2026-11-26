import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { runScenario, scenarioArbitrary } from "./harness.ts";
import { rgaReplica, yjsReplica } from "./replicas.ts";

const NUM_RUNS = Number(process.env.CONVERGENCE_RUNS ?? 2000);

function allEqual(texts: string[]): boolean {
  return texts.every((t) => t === texts[0]);
}

describe("convergence: every replica ends with the same text", () => {
  it(`toy RGA (${NUM_RUNS} random sessions)`, () => {
    fc.assert(
      fc.property(scenarioArbitrary, (scenario) => {
        const texts = runScenario(rgaReplica, scenario);
        expect(allEqual(texts), JSON.stringify(texts)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it(`Yjs (${NUM_RUNS} random sessions)`, () => {
    fc.assert(
      fc.property(scenarioArbitrary, (scenario) => {
        const texts = runScenario(yjsReplica, scenario);
        expect(allEqual(texts), JSON.stringify(texts)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("toy RGA leaves nothing buffered once every message is delivered", () => {
    fc.assert(
      fc.property(scenarioArbitrary, (scenario) => {
        const made: ReturnType<typeof rgaReplica>[] = [];
        runScenario((i) => {
          const r = rgaReplica(i);
          made.push(r);
          return r;
        }, scenario);
        for (const r of made) expect(r.doc.pendingCount).toBe(0);
      }),
      { numRuns: 500 },
    );
  });
});

describe("the harness catches a broken CRDT", () => {
  it("fails when replicas apply remote inserts at raw indices (no CRDT)", () => {
    // A naive "replica" that sends positions instead of ids. Concurrent edits
    // shift each other, so the property must find a divergent session.
    const naive = () => {
      let text = "";
      let out: Array<[number, string] | [number]> = [];
      const apply = (m: [number, string] | [number]) => {
        const [pos, ch] = m;
        const p = Math.min(pos, text.length);
        text =
          ch === undefined
            ? text.slice(0, p) + text.slice(p + 1)
            : text.slice(0, p) + ch + text.slice(p);
      };
      return {
        get length() {
          return text.length;
        },
        text: () => text,
        insert: (p: number, ch: string) => {
          apply([p, ch]);
          out.push([p, ch]);
        },
        delete: (p: number) => {
          apply([p]);
          out.push([p]);
        },
        takeOutgoing: () => {
          const o = out;
          out = [];
          return o;
        },
        receive: (ms: Array<[number, string] | [number]>) => ms.forEach(apply),
      };
    };
    const result = fc.check(
      fc.property(scenarioArbitrary, (scenario) => allEqual(runScenario(naive, scenario))),
      { numRuns: 500 },
    );
    expect(result.failed).toBe(true);
  });
});
