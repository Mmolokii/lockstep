import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Budget, checkBudgets } from "./budgets.ts";
import {
  type Contract,
  checkContract,
  loadContract,
  serviceImage,
  workspacePackages,
} from "./contract.ts";
import type { IssueLookup } from "./registry.ts";

const REAL_ROOT = new URL("../..", import.meta.url).pathname;
const open: IssueLookup = async () => "open";
const closed: IssueLookup = async () => "closed";
const failed = <T extends { ok: boolean; optional?: boolean | undefined }>(cs: T[]) =>
  cs.filter((c) => !c.ok && !c.optional);

let root: string;
const write = (path: string, content: string) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
};
const pkg = (path: string, scripts: Record<string, string>, vitest = "") => {
  write(`${path}/package.json`, JSON.stringify({ name: path, scripts }));
  if (vitest) write(`${path}/vitest.config.ts`, vitest);
};
const IMAGES =
  "services:\n  postgres:\n    image: postgres:18-alpine\n  redis:\n    image: redis:8-alpine\n";

const contract = (over: Partial<Contract> = {}): Contract => ({
  packages: { "packages/a": { coverage: "critical", scripts: ["test"] } },
  pending: [],
  sameImages: { workflow: "ci.yml", compose: "compose.yml", services: ["postgres", "redis"] },
  ...over,
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "contract-"));
  write("ci.yml", `jobs:\n  check:\n    ${IMAGES.replace(/\n/g, "\n    ")}`);
  write("compose.yml", IMAGES);
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("checkContract", () => {
  it("passes when every package meets its rule and images match", async () => {
    pkg("packages/a", { test: "vitest" }, "thresholds: criticalCoverage");
    expect(failed(await checkContract(root, contract(), open))).toEqual([]);
  });

  it("fails on a workspace package that isn't in the contract", async () => {
    pkg("packages/a", { test: "vitest" }, "criticalCoverage");
    pkg("packages/rogue", { test: "vitest" });
    expect(failed(await checkContract(root, contract(), open))[0]?.detail).toContain(
      "packages/rogue",
    );
  });

  it("fails when a required script is missing", async () => {
    pkg("packages/a", {}, "criticalCoverage");
    expect(failed(await checkContract(root, contract(), open))[0]?.detail).toBe("missing test");
  });

  it("fails when a critical package uses the standard coverage tier", async () => {
    pkg("packages/a", { test: "vitest" }, "thresholds: standardCoverage");
    expect(failed(await checkContract(root, contract(), open))[0]?.name).toContain(
      "coverage tier critical",
    );
  });

  it("ignores rules for packages that don't exist yet", async () => {
    const c = contract({
      packages: { "apps/sync": { coverage: "critical", scripts: ["test:integration"] } },
    });
    expect(failed(await checkContract(root, c, open))).toEqual([]);
  });

  it("enforces requiresPaths once the package exists", async () => {
    pkg("apps/web", { test: "vitest" }, "standardCoverage");
    const c = contract({
      packages: {
        "apps/web": {
          coverage: "standard",
          scripts: ["test"],
          requiresPaths: ["e2e/package.json"],
        },
      },
    });
    expect(failed(await checkContract(root, c, open))[0]?.detail).toContain("e2e/package.json");
  });

  it("allows a pending script while its issue is open, and fails once the issue closes", async () => {
    pkg("packages/a", { test: "vitest" }, "criticalCoverage");
    const c = contract({
      pending: [{ path: "packages/a", script: "test:fuzz", issue: 9, reason: "later" }],
    });
    expect(failed(await checkContract(root, c, open))).toEqual([]);
    expect(failed(await checkContract(root, c, closed))[0]?.detail).toContain("#9 is closed");
  });

  it("fails when a pending script now exists, so the entry gets promoted", async () => {
    pkg("packages/a", { test: "vitest", "test:fuzz": "vitest fuzz" }, "criticalCoverage");
    const c = contract({
      pending: [{ path: "packages/a", script: "test:fuzz", issue: 9, reason: "later" }],
    });
    expect(failed(await checkContract(root, c, open))[0]?.detail).toContain("move it into");
  });

  it("fails when CI and compose run different images", async () => {
    pkg("packages/a", { test: "vitest" }, "criticalCoverage");
    write("ci.yml", IMAGES.replace("redis:8-alpine", "redis:7"));
    const bad = failed(await checkContract(root, contract(), open));
    expect(bad.map((c) => c.name)).toEqual(["redis: CI service image matches docker compose"]);
  });

  it("the repository's own contract passes (issue lookups stubbed open)", async () => {
    expect(failed(await checkContract(REAL_ROOT, loadContract(REAL_ROOT), open))).toEqual([]);
    expect(workspacePackages(REAL_ROOT)).toEqual(
      expect.arrayContaining(["packages/protocol", "verify"]),
    );
  });
});

describe("serviceImage", () => {
  it("finds a service's image and stops at the next sibling", () => {
    expect(serviceImage(IMAGES, "redis")).toBe("redis:8-alpine");
    expect(
      serviceImage("services:\n  web:\n    build: .\n  db:\n    image: x\n", "web"),
    ).toBeNull();
    expect(serviceImage(IMAGES, "nope")).toBeNull();
  });
});

describe("checkBudgets", () => {
  const budget = (over: Partial<Budget> = {}): Budget => ({
    name: "b",
    glob: "dist/**/*.js",
    maxKB: 1,
    basis: "",
    ...over,
  });

  it("passes under budget and fails over it, reporting the measured size", async () => {
    write("dist/a.js", "x".repeat(500));
    expect(failed(await checkBudgets(root, [budget()], open))).toEqual([]);
    write("dist/b.js", Array.from({ length: 4000 }, (_, i) => i.toString(36)).join(""));
    const over = failed(await checkBudgets(root, [budget()], open));
    expect(over[0]?.detail).toMatch(/KB gzip across 2 files \(budget 1 KB\)/);
  });

  it("fails when nothing matches and no issue is pending", async () => {
    expect(failed(await checkBudgets(root, [budget()], open))[0]?.detail).toContain(
      "no files match",
    );
  });

  it("allows missing files while the pending issue is open, not after it closes", async () => {
    expect(failed(await checkBudgets(root, [budget({ pendingIssue: 3 })], open))).toEqual([]);
    expect(failed(await checkBudgets(root, [budget({ pendingIssue: 3 })], closed))).toHaveLength(1);
  });

  it("fails when files exist but the budget is still marked pending", async () => {
    write("dist/a.js", "x");
    expect(
      failed(await checkBudgets(root, [budget({ pendingIssue: 3 })], open))[0]?.detail,
    ).toContain("remove");
  });

  it("offline mode turns issue checks into optional skips", async () => {
    const checks = await checkBudgets(root, [budget({ pendingIssue: 3 })], null);
    expect(failed(checks)).toEqual([]);
    expect(checks[0]?.optional).toBe(true);
  });
});
