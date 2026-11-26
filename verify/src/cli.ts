#!/usr/bin/env node
// Lockstep verification CLI. Run from the repo root: pnpm verify <command>
// Exit codes: 0 pass, 1 fail, 2 pending (scenario registered, not implemented yet).
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
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

Options:
  --offline              check-registry: skip the GitHub issue-state lookup (local only; CI never skips)

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
  return ExitCode[outcome];
}

process.exitCode = await main(process.argv.slice(2));
