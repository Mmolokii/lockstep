// Tests for the ci.yml parser behind `pnpm ci:local`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseCheckJob } from "./ci-local.mjs";

const job = (steps) =>
  `jobs:\n  check:\n    env:\n      A: one\n      T: \${{ github.token }}\n    steps:\n${steps}\n  other:\n    steps:\n      - run: pnpm nope\n`;

describe("parseCheckJob", () => {
  it("returns run commands in order and only from the check job", () => {
    const { steps } = parseCheckJob(
      job("      - name: a\n        run: pnpm a\n      - run: pnpm b"),
    );
    assert.deepEqual(steps, ["pnpm a", "pnpm b"]);
  });

  it("keeps literal env values and drops GitHub expressions", () => {
    assert.deepEqual(parseCheckJob(job("      - run: pnpm a")).env, { A: "one" });
  });

  it("rejects multi-line run blocks, in both step forms", () => {
    assert.throws(() => parseCheckJob(job("      - run: |\n          echo hi")), /multi-line/);
    assert.throws(
      () => parseCheckJob(job("      - name: x\n        run: >\n          echo hi")),
      /multi-line/,
    );
  });

  it("skips a step marked by a preceding # ci-only comment, or an inline one", () => {
    const yaml = job(
      "      - run: pnpm a\n      # ci-only\n      - name: b\n        run: pnpm b\n      - run: pnpm c # ci-only\n      - run: pnpm d",
    );
    assert.deepEqual(parseCheckJob(yaml).steps, ["pnpm a", "pnpm d"]);
  });

  it("fails clearly when there is no check job", () => {
    assert.throws(() => parseCheckJob("jobs:\n  build:\n    steps: []\n"), /no `check` job/);
  });

  it("parses the real ci.yml: install first, every step a pnpm command", () => {
    const { steps, env } = parseCheckJob(
      readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
    );
    assert.equal(steps[0], "pnpm install --frozen-lockfile");
    assert.ok(steps.length >= 10);
    for (const s of steps) assert.match(s, /^([A-Z_]+=\S+ )*pnpm /, s);
    assert.ok(env.DATABASE_URL && env.REDIS_URL);
  });
});
