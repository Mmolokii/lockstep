// Mechanical rules for every GitHub Actions workflow in the repo.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const dir = new URL("../.github/workflows/", import.meta.url);
const workflows = readdirSync(dir)
  .filter((f) => f.endsWith(".yml"))
  .map((name) => ({ name, text: readFileSync(new URL(name, dir), "utf8") }));

// Event fields an outsider controls (PR title/body, branch names, commit messages, comments).
const UNTRUSTED =
  /\$\{\{\s*github\.(event\.(pull_request|issue|comment|review|head_commit|commits|pages|workflow_run)\b|head_ref)/;

describe("workflows", () => {
  it("exist", () => assert.ok(workflows.length >= 5));

  for (const { name, text } of workflows) {
    it(`${name}: every action is pinned to a full commit SHA`, () => {
      for (const line of text.split("\n")) {
        const m = line.match(/uses:\s*([^\s#]+)/);
        if (!m || m[1].startsWith("./")) continue;
        assert.match(
          m[1],
          /@[0-9a-f]{40}$/,
          `${name}: ${m[1]} must be pinned to a SHA (Dependabot keeps it updated)`,
        );
      }
    });

    it(`${name}: no untrusted event data is interpolated into a run script`, () => {
      // Untrusted values must go through env: and be read as "$VAR" in the script.
      let inRun = false;
      let runIndent = 0;
      for (const line of text.split("\n")) {
        const indent = line.match(/^\s*/)[0].length;
        const run = line.match(/^(\s*)(?:- )?run:\s*(.*)$/);
        if (run) {
          inRun = run[2].startsWith("|") || run[2].startsWith(">");
          runIndent = indent;
          assert.doesNotMatch(run[2], UNTRUSTED, `${name}: ${line.trim()}`);
          continue;
        }
        if (inRun && line.trim() && indent <= runIndent) inRun = false;
        if (inRun) assert.doesNotMatch(line, UNTRUSTED, `${name}: ${line.trim()}`);
      }
    });

    it(`${name}: declares top-level permissions`, () => {
      assert.match(
        text,
        /^permissions:/m,
        `${name} must set least-privilege permissions at the top level`,
      );
    });
  }

  it("the injection rule actually catches an interpolated PR title", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal GitHub expression is the test input
    assert.match("run: echo ${{ github.event.pull_request.title }}", UNTRUSTED);
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal GitHub expression is the test input
    assert.doesNotMatch("run: echo ${{ matrix.browser }}", UNTRUSTED);
  });
});
