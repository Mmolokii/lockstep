// Runs the CI gate locally: the exact `run:` commands of the `check` job in
// .github/workflows/ci.yml, in order, against the docker compose stack.
// Reading ci.yml (rather than keeping a second list) means local and CI can't drift.
//
// Usage: pnpm ci:local [--dry-run]
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url).pathname;
const dryRun = process.argv.includes("--dry-run");

/** Extracts env and single-line run commands from the `check` job. Exported shape is tested. */
export function parseCheckJob(yaml) {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => /^ {2}check:\s*$/.test(l));
  if (start === -1) throw new Error("ci.yml has no `check` job");
  const end = lines.findIndex((l, i) => i > start && /^ {2}\S/.test(l));
  const job = lines.slice(start + 1, end === -1 ? undefined : end);

  const env = {};
  const envStart = job.findIndex((l) => /^ {4}env:\s*$/.test(l));
  if (envStart !== -1) {
    for (const line of job.slice(envStart + 1)) {
      const m = line.match(/^ {6}([A-Z_][A-Z0-9_]*):\s*(.+)$/);
      if (!m) break;
      if (!m[2].includes("${{")) env[m[1]] = m[2].trim();
    }
  }

  const steps = [];
  let markNext = false; // a `# ci-only` comment line marks the step that follows it
  let ciOnly = false;
  for (const line of job) {
    if (/^\s*#\s*ci-only\b/.test(line)) {
      markNext = true;
      continue;
    }
    if (/^ {6}- /.test(line)) {
      ciOnly = markNext;
      markNext = false;
    }
    const m = line.match(/^\s+(?:- )?run:\s*(.*)$/);
    if (!m) continue;
    const cmd = m[1].replace(/\s+#\s*ci-only\b.*$/, "").trim();
    if (cmd === "" || cmd.startsWith("|") || cmd.startsWith(">")) {
      throw new Error(
        `multi-line run: blocks aren't allowed in the check job (ci:local can't mirror them): ${line.trim()}`,
      );
    }
    if (!ciOnly && !/#\s*ci-only\b/.test(m[1])) steps.push(cmd);
  }
  return { env, steps };
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  const { env, steps } = parseCheckJob(readFileSync(`${root}.github/workflows/ci.yml`, "utf8"));
  const all = ["pnpm infra:up", ...steps];
  console.log(`ci:local: ${all.length} steps from .github/workflows/ci.yml (check job)\n`);
  for (const [i, cmd] of all.entries()) {
    console.log(`\n▶ [${i + 1}/${all.length}] ${cmd}`);
    if (dryRun) continue;
    try {
      execSync(cmd, { cwd: root, stdio: "inherit", env: { ...process.env, ...env } });
    } catch {
      console.error(`\n✗ ci:local failed at step ${i + 1}: ${cmd}`);
      process.exit(1);
    }
  }
  console.log(
    dryRun ? "\nci:local dry run: nothing executed" : "\n✓ ci:local passed every CI step",
  );
}
