import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyse } from "./check-migrations.mjs";

const ids = (sql) => analyse(sql).violations.map((v) => v.id);

describe("expand-only migrations pass", () => {
  for (const [name, sql] of [
    ["create table", "CREATE TABLE doc_versions (id uuid PRIMARY KEY, label text);"],
    ["nullable column", "ALTER TABLE documents ADD COLUMN archived_at timestamptz;"],
    [
      "NOT NULL with default",
      "ALTER TABLE documents ADD COLUMN kind text NOT NULL DEFAULT 'file';",
    ],
    ["index", "CREATE INDEX CONCURRENTLY doc_updates_doc ON doc_updates (doc_id, seq);"],
    [
      "drop only inside a comment",
      "-- we will DROP COLUMN legacy later\nALTER TABLE t ADD COLUMN x int; /* RENAME TO y */",
    ],
    ["drop index (not data)", "DROP INDEX IF EXISTS old_idx;"],
  ]) {
    it(name, () => assert.deepEqual(ids(sql), []));
  }
});

describe("destructive or incompatible migrations fail", () => {
  for (const [name, sql, id] of [
    ["drop table", "DROP TABLE share_links;", "drop-table"],
    ["drop column", "ALTER TABLE documents DROP COLUMN kind;", "drop-column"],
    ["rename column", "ALTER TABLE documents RENAME COLUMN kind TO type;", "rename"],
    ["rename table", "ALTER TABLE documents RENAME TO docs;", "rename"],
    ["type change", "ALTER TABLE doc_updates ALTER COLUMN client_id TYPE text;", "alter-type"],
    [
      "set data type",
      "ALTER TABLE doc_updates ALTER COLUMN client_id SET DATA TYPE text;",
      "alter-type",
    ],
    ["set not null", "ALTER TABLE documents ALTER COLUMN project_id SET NOT NULL;", "set-not-null"],
    [
      "add NOT NULL without default",
      "ALTER TABLE documents ADD COLUMN owner uuid NOT NULL;",
      "add-not-null-without-default",
    ],
    ["truncate", "TRUNCATE doc_updates;", "truncate"],
    ["lowercase still caught", "alter table documents drop column kind;", "drop-column"],
  ]) {
    it(name, () => {
      const r = analyse(sql);
      assert.equal(r.ok, false);
      assert.ok(ids(sql).includes(id), `${id} not in ${ids(sql)}`);
    });
  }

  it("reports every offending statement in a multi-statement file", () => {
    assert.deepEqual(ids("CREATE TABLE a (id int); DROP TABLE b; ALTER TABLE c DROP COLUMN d;"), [
      "drop-table",
      "drop-column",
    ]);
  });
});

describe("contract steps", () => {
  it("are allowed with a marker naming the tracking issue", () => {
    const r = analyse("-- lockstep:contract-step #123\nALTER TABLE documents DROP COLUMN legacy;");
    assert.equal(r.ok, true);
    assert.equal(r.contractIssue, 123);
    assert.equal(r.violations.length, 1);
  });

  it("aren't allowed with a marker that has no issue number", () => {
    assert.equal(analyse("-- lockstep:contract-step\nDROP TABLE x;").ok, false);
  });
});
