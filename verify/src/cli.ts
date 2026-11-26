#!/usr/bin/env node
// Lockstep verification CLI. Run from the repo root: pnpm verify <command>
// Exit codes: 0 pass, 1 fail, 2 pending (scenario registered, not implemented yet).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkBudgets, loadBudgets } from "./budgets.ts";
import { loadConfig } from "./config.ts";
import { checkContract, loadContract } from "./contract.ts";
import { doctor } from "./doctor.ts";
import { checkRegistry, githubIssueLookup } from "./registry.ts";
import {
  type Check,
  ExitCode,
  formatCheck,
  formatOutcome,
  type Outcome,
  outcomeOf,
} from "./report.ts";
import { findScenario, type Scenario, scenarios } from "./scenarios.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const USAGE = `Usage: pnpm verify <command> [options]

Commands:
  doctor                 Check the local environment (Node, pnpm, Docker, Postgres, Redis, free ports)
  list                   List every scenario with its status and tracking issue
  <scenario>             Run one scenario (${scenarios.map((s) => s.name).join(", ")})
  all                    Run every active scenario; report pending ones
  check-registry         Validate the scenario registry (pending scenarios must have open issues)
  check-contract         Enforce .github/pipeline-contract.json (scripts, coverage tiers, CI/compose images)
  check-budgets          Enforce bundle-budgets.json against built output (run after pnpm build)

Options:
  --offline              check-*: skip GitHub issue-state lookups (local only; CI never skips)
  --allow-pending        <scenario>: exit 0 instead of 2 when pending, with a CI notice. Only safe
                         where check-registry also runs (it fails if the tracking issue is closed)

Exit codes: 0 pass · 1 fail · 2 pending`;

function print(title: string, checks: readonly Check[]): void {
  console.log(title);
  for (const c of checks) console.log(formatCheck(c));
}

async function runScenario(s: Scenario): Promise<Outcome> {
  console.log(`\n${s.name}: ${s.summary}`);
  console.log(`  tracking issue: #${s.issue}`);
  console.log("  asserts:");
  for (const [i, a] of s.asserts.entries()) console.log(`    ${i + 1}. ${a}`);
  if (s.status === "pending" || !s.run) {
    const present = s.requires.map(
      (p) => `${p} ${existsSync(join(ROOT, p)) ? "✓" : "✗ (not built yet)"}`,
    );
    console.log(`  requires: ${present.join(", ")}`);
    console.log(`  status: pending. Becomes active when #${s.issue} lands.`);
    return "pending";
  }
  const checks = await s.run(loadConfig());
  print("  checked:", checks);
  return outcomeOf(checks);
}

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  const offline = rest.includes("--offline");
  const allowPending = rest.includes("--allow-pending");
  if (existsSync(join(ROOT, ".env"))) process.loadEnvFile(join(ROOT, ".env"));

  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    return command ? ExitCode.pass : ExitCode.fail;
  }

  if (command === "doctor") {
    const checks = await doctor(loadConfig(), ROOT);
    print("verify doctor", checks);
    const outcome = outcomeOf(checks);
    console.log(formatOutcome("doctor", outcome));
    return ExitCode[outcome];
  }

  if (command === "list") {
    for (const s of scenarios)
      console.log(`${s.status.padEnd(8)} ${s.name.padEnd(18)} #${s.issue}  ${s.summary}`);
    return ExitCode.pass;
  }

  if (command === "check-registry") {
    const lookup = offline ? null : githubIssueLookup(loadConfig().repo);
    const checks = await checkRegistry(scenarios, ROOT, lookup);
    print("verify check-registry", checks);
    const outcome = outcomeOf(checks);
    console.log(formatOutcome("check-registry", outcome));
    return ExitCode[outcome];
  }

  const gated: Record<string, () => Promise<Check[]>> = {
    "check-contract": async () =>
      checkContract(
        ROOT,
        loadContract(ROOT),
        offline ? null : githubIssueLookup(loadConfig().repo),
      ),
    "check-budgets": async () =>
      checkBudgets(ROOT, loadBudgets(ROOT), offline ? null : githubIssueLookup(loadConfig().repo)),
  };
  const gate = gated[command];
  if (gate) {
    const checks = await gate();
    print(`verify ${command}`, checks);
    const outcome = outcomeOf(checks);
    console.log(formatOutcome(command, outcome));
    return ExitCode[outcome];
  }

  if (command === "all") {
    const results = new Map<string, Outcome>();
    for (const s of scenarios) results.set(s.name, await runScenario(s));
    const counts = { pass: 0, fail: 0, pending: 0 };
    for (const o of results.values()) counts[o]++;
    console.log(
      `\nverify all: ${counts.pass} passed, ${counts.fail} failed, ${counts.pending} pending`,
    );
    // Pending scenarios don't fail `all`: check-registry is what stops them staying pending.
    return counts.fail > 0 ? ExitCode.fail : ExitCode.pass;
  }

  const scenario = findScenario(command);
  if (!scenario) {
    console.error(`Unknown command: ${command}\n\n${USAGE}`);
    return ExitCode.fail;
  }
  const outcome = await runScenario(scenario);
  console.log(formatOutcome(scenario.name, outcome));
  if (outcome === "pending" && allowPending) {
    // GitHub Actions renders this as a visible annotation on the run.
    console.log(
      `::notice title=verify ${scenario.name} is pending::Tracked in #${scenario.issue}; enforced by check-registry.`,
    );
    return ExitCode.pass;
  }
  return ExitCode[outcome];
}

process.exitCode = await main(process.argv.slice(2));
