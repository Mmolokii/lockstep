// Learner-task checks for turbo.json (M0). Run with: pnpm check:pipeline
//
// These tests describe the task graph we want, not how to write it.
// See docs/adr/0002-internal-packages-as-typescript-source.md for why
// typecheck and test don't need a build first.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const path = `${root}turbo.json`;

function loadConfig() {
  assert.ok(existsSync(path), "turbo.json does not exist at the repo root yet");
  return JSON.parse(readFileSync(path, "utf8"));
}

function task(name) {
  const t = loadConfig().tasks?.[name];
  assert.ok(t, `turbo.json has no "${name}" task under "tasks"`);
  return t;
}

describe("turbo.json", () => {
  it("references the turbo JSON schema", () => {
    assert.equal(loadConfig().$schema, "https://turborepo.com/schema.json");
  });

  it("build runs after the package's workspace dependencies have built", () => {
    assert.ok(task("build").dependsOn?.includes("^build"), 'build should depend on "^build"');
  });

  it("build caches library and Next.js output, but not Next's own cache", () => {
    const outputs = task("build").outputs ?? [];
    for (const o of ["dist/**", ".next/**", "!.next/cache/**"]) {
      assert.ok(outputs.includes(o), `build.outputs should include "${o}"`);
    }
  });

  it("build declares every env var next.config.ts reads (strict env mode drops the rest)", () => {
    // Turbo's strict env mode hides undeclared variables from the task and leaves
    // them out of the cache key: LOCKSTEP_HTTPS was silently ignored (#114).
    // NODE_ENV is set by `next build` itself.
    const source = readFileSync(`${root}apps/web/next.config.ts`, "utf8");
    const read = [...source.matchAll(/process\.env\.([A-Z0-9_]+)/g)]
      .map((m) => m[1])
      .filter((name) => name !== "NODE_ENV");
    assert.ok(read.length > 0, "expected next.config.ts to read at least one env var");
    const declared = task("build").env ?? [];
    for (const name of read) {
      assert.ok(declared.includes(name), `turbo.json build.env should include "${name}"`);
    }
  });

  it("typecheck and test don't wait for builds (packages export TS source)", () => {
    for (const name of ["typecheck", "test"]) {
      const deps = task(name).dependsOn ?? [];
      assert.ok(
        !deps.includes("^build") && !deps.includes("build"),
        `${name} should not depend on build`,
      );
    }
  });

  it("test:coverage caches the coverage folder", () => {
    assert.ok(task("test:coverage").outputs?.includes("coverage/**"));
  });

  it("dev is a long-running task that is never cached", () => {
    const dev = task("dev");
    assert.equal(dev.cache, false, "dev.cache should be false");
    assert.equal(dev.persistent, true, "dev.persistent should be true");
  });

  it("is accepted by turbo itself", () => {
    const out = execFileSync(
      "pnpm",
      ["exec", "turbo", "run", "build", "typecheck", "test", "--dry=json"],
      {
        cwd: root,
        encoding: "utf8",
      },
    );
    const plan = JSON.parse(out);
    assert.ok(plan.tasks.some((t) => t.taskId === "@lockstep/protocol#typecheck"));
  });
});
