import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Check } from "./report.ts";
import type { Scenario } from "./scenarios.ts";

export type IssueState = "open" | "closed";
export type IssueLookup = (issue: number) => Promise<IssueState>;

/** Looks up an issue on GitHub. Uses GITHUB_TOKEN when set; the repo is public, so it works without one too. */
export function githubIssueLookup(repo: string, token = process.env.GITHUB_TOKEN): IssueLookup {
  return async (issue) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/issues/${issue}`, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "lockstep-verify",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) throw new Error(`GitHub returned ${res.status} for issue #${issue}`);
    const body = (await res.json()) as { state: IssueState };
    return body.state;
  };
}

/**
 * Rules that keep the registry honest. Each returns a Check, so failures print
 * exactly which rule broke and how to fix it.
 */
export async function checkRegistry(
  list: readonly Scenario[],
  root: string,
  lookup: IssueLookup | null,
): Promise<Check[]> {
  const checks: Check[] = [];
  const names = list.map((s) => s.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  checks.push({
    name: "Scenario names are unique",
    ok: dupes.length === 0,
    detail: dupes.join(", "),
  });

  for (const s of list) {
    if (s.status === "active") {
      checks.push({
        name: `${s.name}: active scenario has a run function`,
        ok: typeof s.run === "function",
        detail: typeof s.run === "function" ? "" : "add `run` or set status back to pending",
      });
      const missing = s.requires.filter((p) => !existsSync(join(root, p)));
      checks.push({
        name: `${s.name}: required components exist`,
        ok: missing.length === 0,
        detail: missing.length ? `missing ${missing.join(", ")}` : s.requires.join(", "),
      });
      continue;
    }

    checks.push({
      name: `${s.name}: pending scenario has no run function`,
      ok: s.run === undefined,
      detail: s.run === undefined ? "" : "it has a run function, so mark it active",
    });

    if (lookup === null) {
      checks.push({
        name: `${s.name}: tracking issue #${s.issue} still open`,
        ok: false,
        optional: true,
        detail: "skipped (--offline). CI always runs this check",
      });
      continue;
    }
    try {
      const state = await lookup(s.issue);
      checks.push({
        name: `${s.name}: tracking issue #${s.issue} still open`,
        ok: state === "open",
        detail:
          state === "open"
            ? "pending is allowed while the issue is open"
            : `#${s.issue} is closed but the scenario is still pending. Implement \`run\` and mark it active, or reopen #${s.issue}`,
      });
    } catch (err) {
      checks.push({
        name: `${s.name}: tracking issue #${s.issue} still open`,
        ok: false,
        detail: `${(err as Error).message}. Re-run with network access, or pass --offline locally`,
      });
    }
  }
  return checks;
}
