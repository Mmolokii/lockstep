/**
 * Teardown for verify scenarios. Every resource a scenario starts (server
 * process, socket, temp directory) is registered here the moment it exists,
 * and `run` releases all of them in reverse order, whether the scenario passed,
 * failed or threw. A failing teardown is reported as a failed check, never
 * swallowed, so a leaked process can't hide behind a green run.
 *
 * Adopted from the review draft of the verify CLI (rule 4: "tear down
 * everything it started, even on failure").
 */
import type { Check } from "./report.ts";

export type Cleanup = () => void | Promise<void>;

export class Teardown {
  readonly #stack: { label: string; fn: Cleanup }[] = [];

  /** Register a resource's cleanup. Returns the value, so `const ws = t.add("socket", open(), (s) => s.close())` reads naturally. */
  add<T>(label: string, value: T, release: (value: T) => void | Promise<void>): T {
    this.#stack.push({ label, fn: () => release(value) });
    return value;
  }

  get size(): number {
    return this.#stack.length;
  }

  /** Release everything in reverse order. Returns one check per cleanup that failed. */
  async releaseAll(): Promise<Check[]> {
    const failures: Check[] = [];
    while (this.#stack.length > 0) {
      const { label, fn } = this.#stack.pop() as { label: string; fn: Cleanup };
      try {
        await fn();
      } catch (err) {
        failures.push({ name: `teardown: ${label}`, ok: false, detail: (err as Error).message });
      }
    }
    return failures;
  }
}

/**
 * Runs a scenario body with a Teardown and guarantees release. If the body
 * throws, the error becomes a failed check, followed by any teardown failures.
 */
export async function withTeardown(body: (t: Teardown) => Promise<Check[]>): Promise<Check[]> {
  const t = new Teardown();
  let checks: Check[];
  try {
    checks = await body(t);
  } catch (err) {
    checks = [{ name: "scenario threw", ok: false, detail: (err as Error).message }];
  }
  return [...checks, ...(await t.releaseAll())];
}
