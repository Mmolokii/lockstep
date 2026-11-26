/** One thing a command checked, and whether it held. */
export interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
  /** A failed optional check is reported as a warning and doesn't fail the command. */
  readonly optional?: boolean;
}

export type Outcome = "pass" | "fail" | "pending";

/**
 * Exit codes are part of the CLI contract (see AGENTS.md):
 * 0 = every required check passed, 1 = a required check failed,
 * 2 = the scenario is registered but not implemented yet.
 */
export const ExitCode = { pass: 0, fail: 1, pending: 2 } as const satisfies Record<Outcome, number>;

export function outcomeOf(checks: readonly Check[]): Outcome {
  return checks.every((c) => c.ok || c.optional) ? "pass" : "fail";
}

export function formatCheck(c: Check): string {
  const mark = c.ok ? "✓" : c.optional ? "!" : "✗";
  return `  ${mark} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`;
}

export function formatOutcome(command: string, outcome: Outcome): string {
  const label = { pass: "PASS", fail: "FAIL", pending: "PENDING" }[outcome];
  return `${label} ${command} (exit ${ExitCode[outcome]})`;
}
