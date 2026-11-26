import type { Config } from "./config.ts";
import { type Check, type Outcome, outcomeOf } from "./report.ts";
import type { Scenario, ScenarioContext } from "./scenarios.ts";
import { withTeardown } from "./teardown.ts";

/** mulberry32: a small, fast PRNG. Same seed, same sequence, so failing runs can be replayed. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RunDeps {
  readonly config: Config;
  readonly seed: number;
  /** Preconditions (doctor's Postgres, Redis and Node checks). Any required failure stops the run before it starts. */
  readonly preflight: () => Promise<Check[]>;
}

export interface RunResult {
  readonly outcome: Outcome;
  readonly checks: readonly Check[];
}

/**
 * The only way a scenario runs. The runner, not the scenario, guarantees:
 * 1. preconditions are checked first, so a down database fails as a precondition rather than a confusing timeout;
 * 2. every registered resource is released, whether the scenario passed, failed or threw;
 * 3. all randomness comes from one printed seed, so any failure can be replayed exactly.
 */
export async function executeScenario(s: Scenario, deps: RunDeps): Promise<RunResult> {
  if (s.status === "pending" || !s.run) return { outcome: "pending", checks: [] };

  const pre = (await deps.preflight()).map((c) => ({ ...c, name: `precondition: ${c.name}` }));
  if (outcomeOf(pre) === "fail") return { outcome: "fail", checks: pre };

  const run = s.run;
  const checks = await withTeardown((teardown) => {
    const ctx: ScenarioContext = {
      config: deps.config,
      teardown,
      seed: deps.seed,
      random: seededRandom(deps.seed),
    };
    return run(ctx);
  });
  return { outcome: outcomeOf(checks), checks };
}
