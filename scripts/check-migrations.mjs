// Expand-only migration check (deploy gate).
//
// Migrations deploy before the code that uses them, and old code keeps running
// during a rolling deploy, so a migration must never break the previous release.
// That means expand only: add tables, nullable columns, columns with defaults,
// indexes. Destructive or incompatible changes (the "contract" half of
// expand -> migrate -> contract) need an explicit marker naming the issue that
// tracks them, and they ship in a later release than the code that stopped
// using the old shape.
//
// Usage:
//   pnpm check:migrations                 # every migration file
//   pnpm check:migrations --base <ref>    # only files changed since <ref>
import { execFileSync } from "node:child_process";
import { existsSync, globSync, readFileSync } from "node:fs";

export const MIGRATIONS_GLOB = "packages/db/migrations/**/*.sql";
export const CONTRACT_MARKER = /^--\s*lockstep:contract-step\s+#(\d+)\b/m;

/** Each rule matches statements that would break the previous release. */
export const RULES = [
  { id: "drop-table", re: /\bDROP\s+TABLE\b/i, why: "old code still reads the table" },
  { id: "drop-column", re: /\bDROP\s+COLUMN\b/i, why: "old code still reads the column" },
  {
    id: "rename",
    re: /\bRENAME\s+(COLUMN\s+|CONSTRAINT\s+)?\S+\s+TO\b|\bRENAME\s+TO\b/i,
    why: "old code uses the old name",
  },
  {
    id: "alter-type",
    re: /\bALTER\s+COLUMN\s+\S+\s+(SET\s+DATA\s+)?TYPE\b/i,
    why: "type changes can break old reads and writes",
  },
  {
    id: "set-not-null",
    re: /\bALTER\s+COLUMN\s+\S+\s+SET\s+NOT\s+NULL\b/i,
    why: "old code may insert NULLs",
  },
  {
    id: "add-not-null-without-default",
    re: /\bADD\s+(COLUMN\s+)?(IF\s+NOT\s+EXISTS\s+)?\S+\s+[^,;]*\bNOT\s+NULL\b(?![^,;]*\bDEFAULT\b)/i,
    why: "old code's inserts omit the column",
  },
  { id: "truncate", re: /\bTRUNCATE\b/i, why: "destroys data" },
  { id: "drop-schema", re: /\bDROP\s+SCHEMA\b/i, why: "destroys data" },
];

/** Strips -- line comments and block comments so rules don't fire on commentary. */
export function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
}

/** Returns { ok, contractIssue, violations: [{id, why, statement}] } for one migration's SQL. */
export function analyse(sql) {
  const marker = sql.match(CONTRACT_MARKER);
  const statements = stripComments(sql)
    .split(";")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const violations = [];
  for (const statement of statements) {
    for (const rule of RULES) {
      if (rule.re.test(statement)) violations.push({ id: rule.id, why: rule.why, statement });
    }
  }
  const contractIssue = marker ? Number(marker[1]) : null;
  return { ok: violations.length === 0 || contractIssue !== null, contractIssue, violations };
}

function changedSince(base) {
  const out = execFileSync("git", ["diff", "--name-only", "--diff-filter=AM", `${base}...HEAD`], {
    encoding: "utf8",
  });
  return out
    .split("\n")
    .filter((f) => f?.endsWith(".sql") && f.startsWith("packages/db/migrations/"));
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  const root = new URL("..", import.meta.url).pathname;
  process.chdir(root);
  const baseIdx = process.argv.indexOf("--base");
  const base = baseIdx !== -1 ? process.argv[baseIdx + 1] : null;
  const files = base ? changedSince(base) : globSync(MIGRATIONS_GLOB).sort();
  const scope = base ? `changed since ${base}` : `matching ${MIGRATIONS_GLOB}`;
  console.log(`check-migrations: ${files.length} migration file(s) ${scope}`);
  if (!existsSync("packages/db/migrations"))
    console.log("  (packages/db/migrations doesn't exist yet: it arrives with #59)");

  let failed = 0;
  for (const file of files) {
    const result = analyse(readFileSync(file, "utf8"));
    if (result.violations.length === 0) {
      console.log(`  ✓ ${file}: expand-only`);
    } else if (result.ok) {
      console.log(`  ! ${file}: contract step approved by #${result.contractIssue}`);
      for (const v of result.violations) console.log(`      ${v.id}: ${v.statement.slice(0, 100)}`);
    } else {
      failed++;
      console.log(`  ✗ ${file}: not backward-compatible`);
      for (const v of result.violations)
        console.log(`      ${v.id} (${v.why}): ${v.statement.slice(0, 100)}`);
      console.log(
        "      Split it: expand now, contract in a later release. If this is that later release,",
      );
      console.log(
        "      add `-- lockstep:contract-step #<issue>` naming the issue that tracks the contract step.",
      );
    }
  }
  console.log(failed ? `FAIL check-migrations (${failed} file(s))` : "PASS check-migrations");
  process.exit(failed ? 1 : 0);
}
