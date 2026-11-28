// ADR numbering rules (#122). Run with: pnpm check:pipeline
//
// Every "ADR NNNN" the docs cite must be a file in docs/adr/ or reserved in
// docs/adr/README.md; a reserved number must not already have a file; and
// every ADR file must appear in the README index. ADR 0009 was taken while
// still planned for #39 because nothing recorded reservations.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const root = new URL("..", import.meta.url).pathname;
const adrDir = `${root}docs/adr`;

const files = new Map(
  readdirSync(adrDir)
    .map((f) => f.match(/^(\d{4})-.+\.md$/))
    .filter((m) => m !== null && m[1] !== "0000")
    .map((m) => [m[1], m[0]]),
);

const readme = readFileSync(`${adrDir}/README.md`, "utf8");
const section = (title) => {
  const start = readme.indexOf(`## ${title}`);
  assert.ok(start >= 0, `docs/adr/README.md has no "## ${title}" section`);
  const next = readme.indexOf("\n## ", start + 1);
  return readme.slice(start, next === -1 ? undefined : next);
};
const reserved = new Set([...section("Reserved").matchAll(/^\| (\d{4}) \|/gm)].map((m) => m[1]));

// Tracked Markdown and source outside docs/adr and the build prompt (a historical spec).
const cited = execFileSync(
  "git",
  [
    "grep",
    "-n",
    "-o",
    "-E",
    "ADR [0-9]{4}",
    "--",
    ".",
    ":!docs/adr/**",
    ":!docs/BUILD_PROMPT.md",
    ":!pnpm-lock.yaml",
  ],
  {
    cwd: root,
    encoding: "utf8",
  },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .map((line) => {
    const [where, , match] = line.split(":");
    return { where, number: match.slice(4) };
  });

describe("ADR numbering", () => {
  it("every cited ADR exists or is reserved", () => {
    const unknown = cited.filter((c) => !files.has(c.number) && !reserved.has(c.number));
    assert.deepEqual(
      unknown.map((c) => `${c.where}: ADR ${c.number}`),
      [],
      "cite an existing ADR, or reserve the number in docs/adr/README.md",
    );
  });

  it("no reserved number is already taken by a file", () => {
    const taken = [...reserved].filter((n) => files.has(n));
    assert.deepEqual(taken, [], `reserved but already written: ${taken.map((n) => files.get(n))}`);
  });

  it("every ADR file is listed in the README index", () => {
    const index = section("Index");
    const missing = [...files.values()].filter((f) => !index.includes(`(${f})`));
    assert.deepEqual(missing, [], "add these to the index in docs/adr/README.md");
  });
});
