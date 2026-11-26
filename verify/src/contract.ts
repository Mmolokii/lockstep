import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { IssueLookup } from "./registry.ts";
import type { Check } from "./report.ts";

interface PackageRule {
  readonly coverage: "critical" | "standard" | "none";
  readonly scripts: readonly string[];
  readonly requiresPaths?: readonly string[];
}

export interface Contract {
  readonly packages: Readonly<Record<string, PackageRule>>;
  readonly pending: readonly { path: string; script: string; issue: number; reason: string }[];
  readonly sameImages: { workflow: string; compose: string; services: readonly string[] };
}

export function loadContract(root: string): Contract {
  return JSON.parse(readFileSync(join(root, ".github/pipeline-contract.json"), "utf8")) as Contract;
}

/** Every directory that is (or will be) a workspace package: apps/*, packages/*, verify, e2e. */
export function workspacePackages(root: string): string[] {
  const found: string[] = [];
  for (const parent of ["apps", "packages"]) {
    const dir = join(root, parent);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory() && existsSync(join(dir, name.name, "package.json")))
        found.push(`${parent}/${name.name}`);
    }
  }
  for (const top of ["verify", "e2e"])
    if (existsSync(join(root, top, "package.json"))) found.push(top);
  return found.sort();
}

function scriptsOf(root: string, path: string): Record<string, string> {
  return (JSON.parse(readFileSync(join(root, path, "package.json"), "utf8")).scripts ??
    {}) as Record<string, string>;
}

/**
 * Finds the image of a named service in a YAML file without a YAML parser:
 * the first `image:` line after a line that is exactly `<name>:` (any indent).
 */
export function serviceImage(yaml: string, service: string): string | null {
  const lines = yaml.split("\n");
  const start = lines.findIndex((l) => l.trim() === `${service}:`);
  if (start === -1) return null;
  const indent = lines[start]?.match(/^\s*/)?.[0].length ?? 0;
  for (const line of lines.slice(start + 1)) {
    const lineIndent = line.match(/^\s*/)?.[0].length ?? 0;
    if (line.trim() && lineIndent <= indent) break;
    const m = line.match(/^\s*image:\s*["']?([^"'\s]+)/);
    if (m?.[1]) return m[1];
  }
  return null;
}

export async function checkContract(
  root: string,
  contract: Contract,
  lookup: IssueLookup | null,
): Promise<Check[]> {
  const checks: Check[] = [];

  const unlisted = workspacePackages(root).filter((p) => !(p in contract.packages));
  checks.push({
    name: "Every workspace package is in the pipeline contract",
    ok: unlisted.length === 0,
    detail: unlisted.length ? `add ${unlisted.join(", ")} to .github/pipeline-contract.json` : "",
  });

  for (const [path, rule] of Object.entries(contract.packages)) {
    if (!existsSync(join(root, path, "package.json"))) continue;
    const scripts = scriptsOf(root, path);
    const missing = rule.scripts.filter((s) => !(s in scripts));
    checks.push({
      name: `${path}: required scripts`,
      ok: missing.length === 0,
      detail: missing.length ? `missing ${missing.join(", ")}` : rule.scripts.join(", "),
    });

    if (rule.coverage !== "none") {
      const configPath = join(root, path, "vitest.config.ts");
      const config = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
      const tier = rule.coverage === "critical" ? "criticalCoverage" : "standardCoverage";
      const ok =
        config.includes(tier) ||
        (rule.coverage === "standard" && config.includes("criticalCoverage"));
      checks.push({
        name: `${path}: coverage tier ${rule.coverage}`,
        ok,
        detail: ok
          ? `uses ${tier} from vitest.shared.ts`
          : `vitest.config.ts must use ${tier} from vitest.shared.ts`,
      });
    }

    for (const required of rule.requiresPaths ?? []) {
      const ok = existsSync(join(root, required));
      checks.push({
        name: `${path}: requires ${required}`,
        ok,
        detail: ok ? "" : `${path} exists, so ${required} must exist too`,
      });
    }
  }

  for (const p of contract.pending) {
    const label = `${p.path}: pending ${p.script} (#${p.issue})`;
    if (!existsSync(join(root, p.path, "package.json"))) continue;
    if (p.script in scriptsOf(root, p.path)) {
      checks.push({
        name: label,
        ok: false,
        detail: `the script exists now: move it into the package's required scripts and drop the pending entry`,
      });
      continue;
    }
    if (lookup === null) {
      checks.push({
        name: label,
        ok: false,
        optional: true,
        detail: "issue state not checked (--offline)",
      });
      continue;
    }
    try {
      const state = await lookup(p.issue);
      checks.push({
        name: label,
        ok: state === "open",
        detail:
          state === "open" ? p.reason : `#${p.issue} is closed but ${p.script} still doesn't exist`,
      });
    } catch (err) {
      checks.push({ name: label, ok: false, detail: (err as Error).message });
    }
  }

  const { workflow, compose, services } = contract.sameImages;
  const workflowText = existsSync(join(root, workflow))
    ? readFileSync(join(root, workflow), "utf8")
    : "";
  const composeText = readFileSync(join(root, compose), "utf8");
  for (const service of services) {
    const ci = serviceImage(workflowText, service);
    const local = serviceImage(composeText, service);
    checks.push({
      name: `${service}: CI service image matches docker compose`,
      ok: ci !== null && ci === local,
      detail: `ci=${ci ?? "missing"} compose=${local ?? "missing"}`,
    });
  }

  return checks;
}
