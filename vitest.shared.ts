// Coverage tiers shared by every package's vitest.config.ts.
// The pipeline contract (.github/pipeline-contract.json) says which tier each
// package must import, and `pnpm verify check-contract` enforces it.

/** protocol, sync-client and the sync server: the code that decides correctness on the wire. */
export const criticalCoverage = { lines: 90, functions: 90, branches: 90, statements: 90 };

/** Everything else. */
export const standardCoverage = { lines: 80, functions: 80, branches: 80, statements: 80 };

/** Integration tests run separately (they need Postgres and Redis); fast suites exclude them. */
export const integrationGlob = "src/**/*.integration.test.ts";
