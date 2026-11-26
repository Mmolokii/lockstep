import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";
import { executeScenario, seededRandom } from "./runner.ts";
import type { Scenario, ScenarioContext } from "./scenarios.ts";

const config = loadConfig({});
const healthy = async () => [{ name: "Postgres", ok: true, detail: "" }];
const active = (run?: NonNullable<Scenario["run"]>): Scenario => ({
  name: "fake",
  summary: "fake",
  asserts: ["a"],
  requires: [],
  issue: 1,
  status: "active",
  ...(run ? { run } : {}),
});

describe("executeScenario", () => {
  it("returns pending without running anything for a pending scenario", async () => {
    const s: Scenario = { ...active(), status: "pending" };
    expect(await executeScenario(s, { config, seed: 1, preflight: healthy })).toEqual({
      outcome: "pending",
      checks: [],
    });
  });

  it("runs an active scenario and releases what it registered", async () => {
    let released = false;
    const s = active(async ({ teardown }) => {
      teardown.add("server", null, () => {
        released = true;
      });
      return [{ name: "converged", ok: true, detail: "" }];
    });
    const r = await executeScenario(s, { config, seed: 1, preflight: healthy });
    expect(r.outcome).toBe("pass");
    expect(released).toBe(true);
  });

  it("fails on a precondition without calling run", async () => {
    let called = false;
    const s = active(async () => {
      called = true;
      return [];
    });
    const r = await executeScenario(s, {
      config,
      seed: 1,
      preflight: async () => [{ name: "Redis", ok: false, detail: "ECONNREFUSED" }],
    });
    expect(called).toBe(false);
    expect(r.outcome).toBe("fail");
    expect(r.checks[0]?.name).toBe("precondition: Redis");
  });

  it("still releases resources when the scenario throws, and reports the error", async () => {
    let released = false;
    const s = active(async ({ teardown }) => {
      teardown.add("socket", null, () => {
        released = true;
      });
      throw new Error("no ack within 5 s");
    });
    const r = await executeScenario(s, { config, seed: 1, preflight: healthy });
    expect(released).toBe(true);
    expect(r).toEqual({
      outcome: "fail",
      checks: [{ name: "scenario threw", ok: false, detail: "no ack within 5 s" }],
    });
  });

  it("gives the scenario a random generator derived from the seed", async () => {
    const seen: number[][] = [];
    const s = active(async ({ random, seed }: ScenarioContext) => {
      seen.push([seed, random(), random()]);
      return [];
    });
    await executeScenario(s, { config, seed: 42, preflight: healthy });
    await executeScenario(s, { config, seed: 42, preflight: healthy });
    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0]?.[0]).toBe(42);
  });
});

describe("seededRandom", () => {
  it("is deterministic per seed, differs across seeds, and stays in [0, 1)", () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    const c = seededRandom(8);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs[0]).not.toBe(c());
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
