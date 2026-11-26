import { globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { IssueLookup } from "./registry.ts";
import type { Check } from "./report.ts";

export interface Budget {
  readonly name: string;
  readonly glob: string;
  readonly maxKB: number;
  /** Set while the files don't exist yet: the issue that will create them. */
  readonly pendingIssue?: number;
  readonly basis: string;
}

export function loadBudgets(root: string): Budget[] {
  return (
    JSON.parse(readFileSync(join(root, "bundle-budgets.json"), "utf8")) as { budgets: Budget[] }
  ).budgets;
}

export function gzipKB(root: string, files: readonly string[]): number {
  const bytes = files.reduce(
    (sum, f) => sum + gzipSync(readFileSync(join(root, f)), { level: 9 }).length,
    0,
  );
  return Math.round((bytes / 1024) * 10) / 10;
}

export async function checkBudgets(
  root: string,
  budgets: readonly Budget[],
  lookup: IssueLookup | null,
): Promise<Check[]> {
  const checks: Check[] = [];
  for (const b of budgets) {
    const files = globSync(b.glob, { cwd: root });
    if (files.length === 0) {
      if (b.pendingIssue === undefined) {
        checks.push({
          name: b.name,
          ok: false,
          detail: `no files match ${b.glob}. Run \`pnpm build\` first, or fix the glob`,
        });
        continue;
      }
      if (lookup === null) {
        checks.push({
          name: b.name,
          ok: false,
          optional: true,
          detail: `pending #${b.pendingIssue}; issue state not checked (--offline)`,
        });
        continue;
      }
      try {
        const state = await lookup(b.pendingIssue);
        checks.push({
          name: b.name,
          ok: state === "open",
          detail:
            state === "open"
              ? `pending: nothing built yet; becomes enforced when #${b.pendingIssue} lands`
              : `#${b.pendingIssue} is closed but nothing matches ${b.glob}`,
        });
      } catch (err) {
        checks.push({ name: b.name, ok: false, detail: (err as Error).message });
      }
      continue;
    }
    if (b.pendingIssue !== undefined) {
      checks.push({
        name: b.name,
        ok: false,
        detail: `files exist now: remove "pendingIssue" from bundle-budgets.json`,
      });
      continue;
    }
    const kb = gzipKB(root, files);
    checks.push({
      name: b.name,
      ok: kb <= b.maxKB,
      detail: `${kb} KB gzip across ${files.length} files (budget ${b.maxKB} KB)`,
    });
  }
  return checks;
}
