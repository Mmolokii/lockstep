# AGENTS.md

Instructions for AI coding agents (and humans) working in this repository. Read this before changing anything. The repo is public, and every commit, PR and issue is visible to reviewers.

Lockstep is a real-time collaborative code editor: Yjs as the CRDT, with the sync server, protocol, persistence, auth and scaling built by hand. Start with [DESIGN.md](DESIGN.md), the [System Overview](docs/SYSTEM_OVERVIEW.md) and [how work is run](docs/process/project-management.md).

## Setup (exact commands)

Requires Node 24 (`.nvmrc`), pnpm 12.23.0 (pinned in `packageManager`) and Docker.

```bash
pnpm install --frozen-lockfile
```

```bash
cp .env.example .env
```

```bash
pnpm infra:up
```

```bash
pnpm verify doctor
```

`verify doctor` must print `PASS doctor (exit 0)` before you go further. It checks Node and pnpm versions, Docker, a real Postgres handshake, a real Redis PING, and that ports 3000, 4444 and 9464 are free. Stop the stack with `pnpm infra:down`.

## Commands

| Task | Command |
|---|---|
| Typecheck everything | `pnpm typecheck` |
| Lint and format check (warnings are errors) | `pnpm lint` |
| Fix lint and formatting | `pnpm lint:fix` |
| Fast tests (unit, property, fuzz) | `pnpm test` |
| Fast tests with coverage thresholds | `pnpm test:coverage` |
| Property tests, deep run | `CONVERGENCE_RUNS=10000 pnpm test:property` |
| Fuzz tests, deep run | `FUZZ_RUNS=20000 pnpm test:fuzz` |
| Integration tests (needs `pnpm infra:up`) | `pnpm test:integration` |
| End-to-end tests (first run: `pnpm --filter @lockstep/e2e exec playwright install`) | `pnpm test:e2e` |
| Web app, dev server | `pnpm --filter @lockstep/web dev` |
| Build | `pnpm build` |
| Pipeline contract | `pnpm check:contract` |
| Turborepo graph, ci:local parser, migration and workflow rules | `pnpm check:pipeline` |
| Bundle budgets (after build) | `pnpm check:budgets` |
| Migration safety | `pnpm check:migrations --base origin/main` |
| Security checks (audit + authorisation scenario) | `pnpm security:local` |
| **The whole CI gate, locally** | `pnpm ci:local` |

The one CI step that can't run locally is CodeQL, which needs GitHub's analysis service. Everything else in `security.yml` runs through `pnpm security:local`.

Run one package's tests with `pnpm --filter @lockstep/<name> test`. Test files are named by kind: `*.test.ts` (unit), `*.property.test.ts`, `*.fuzz.test.ts`, `*.integration.test.ts`.

**Before opening a PR, `pnpm ci:local` must end with `✓ ci:local passed every CI step`.** It runs the exact `run:` lines from `.github/workflows/ci.yml`, in order, against docker compose.

## The verify CLI

`pnpm verify <command>` drives real processes and reports what it checked. Exit codes are a contract: **0 pass · 1 fail · 2 pending**.

| Command | Purpose |
|---|---|
| `doctor` | Environment check |
| `list` | Every scenario, its status and tracking issue |
| `sync-two-clients` | Two clients, concurrent same-line edits, identical state *(pending: #100)* |
| `offline-merge` | Offline edits merge cleanly on reconnect *(pending: #101)* |
| `viewer-rejected` | A viewer's raw edit closes with 4403 *(pending: #103)* |
| `malformed-message` | Fuzzed frames never crash the server *(pending: #102)* |
| `smoke` | Deployed environment answers end to end *(pending: #52)* |
| `all` | Every active scenario |
| `--seed <n>` | Replay a scenario run with the same random choices (the seed is printed on every run) |
| `check-registry`, `check-contract`, `check-budgets` | Rule checks used by CI (`--offline` skips GitHub lookups locally) |

A scenario is **pending** until the components it drives exist. When you implement the feature behind a pending scenario, implement its `run` in `verify/src/scenarios.ts` against real processes and mark it `active` in the same PR. CI fails if the tracking issue closes while the scenario is still pending. [docs/feature-map.md](docs/feature-map.md) maps every v1 feature to its scenario.

The runner checks preconditions, releases everything a scenario registers (pass, fail or throw) and owns the seed. Rules for writing a scenario's `run`, such as port 0, Node's built-in `WebSocket`, real signed tokens and no unasserted steps, are in [verify/README.md](verify/README.md).

## Where things live

| Path | What |
|---|---|
| `apps/web` | Next.js app (App Router, Tailwind); baseline security headers in `src/lib/security-headers.ts` |
| `apps/sync` | WebSocket sync server *(arriving in M3)* |
| `e2e/` | Playwright suite on Chromium, Firefox and WebKit, against the production build |
| `packages/protocol` | Wire format and close codes: the contract between client and server |
| `packages/editor` | CodeMirror 6 bound to a Y.Text: languages (lazy), themes, keyboard map |
| `packages/crdt-lab` | Toy CRDT and convergence harness (never imported by the app) |
| `verify/` | Verification CLI |
| `infra/` | Docker Compose, Prometheus, Grafana |
| `scripts/` | Pipeline scripts and their tests |
| `docs/adr/`, `docs/rfcs/` | Decisions and designs |
| `.github/pipeline-contract.json` | What every package must provide |
| `bundle-budgets.json` | Size budgets for built output |

## Enforced by tooling (you'll hit these if you try)

| Rule | Enforced by |
|---|---|
| Strict TypeScript; no `enum` or `namespace` | `tsconfig.base.json` (`strict`, `erasableSyntaxOnly`, …) |
| No `any`; no lint warnings | Biome (`noExplicitAny`, `--error-on-warnings`) |
| 90% coverage on protocol, sync-client, sync; 80% elsewhere | `vitest.shared.ts` tiers + `check-contract` |
| Every package listed with required scripts; sync has integration tests; web has e2e | `check-contract` |
| CI tests against the same Postgres and Redis images as local | `check-contract` |
| Pending work names an open issue | `check-registry`, `check-contract`, `check-budgets` |
| Bundles stay within budget: per route (what a page downloads) and in total | `e2e/tests/budgets.spec.ts` (Chromium), `check-budgets` ([ADR 0009](docs/adr/0009-route-bundle-budgets.md)) |
| Migrations are expand-only | `check-migrations` (deploy gate) |
| Actions pinned to SHAs; no untrusted data interpolated into `run:`; least-privilege permissions | `scripts/workflows.test.mjs` |
| CI and local run the same steps | `ci:local` parses `ci.yml` |
| Conventional PR titles; PRs close an issue | `pr-hygiene.yml` |
| No direct pushes to `main`; 9 required checks, up to date; linear history; squash only; no bypass, admins included | Repository ruleset ([docs/branch-protection.md](docs/branch-protection.md)) |
| Scenarios clean up, check preconditions and use a replayable seed | The verify runner (`verify/src/runner.ts`) |
| No committed secrets | GitHub secret scanning with push protection |

## Never do

These can't be fully enforced by tooling yet, so they're rules. Breaking one is a bug, even if CI is green.

**Correctness and data**
1. **Never log document or message contents**, room tokens, share-link tokens or session cookies. Log IDs, types and sizes only.
2. **Never put a token in a URL** (query string or path). Tokens travel in the first socket message or in headers.
3. **Never trust the client's role or state.** Authorise on the server, on every message, including sync step 2.
4. **Never restore a version by rewinding history.** A restore is a new update that others receive normally.
5. **Never show "synced" without a server `ack`** covering the local updates.
6. **Never change bytes on the wire** without the `protocol-change` label, an updated `docs/protocol.md`, and fuzz coverage for the new message.

**Honesty**
7. **Never fabricate a number.** Every latency, throughput, size or coverage figure comes from a command you ran, with its output and the machine spec.
8. **Never mark a verify scenario active with a stub.** Active scenarios drive the real sync server, real sockets and real storage.
9. **Never weaken a gate to get green.** That includes lowering a coverage threshold, raising a budget, deleting or skipping a test, adding `--passWithNoTests`, moving a rule to `pending`, or loosening branch protection. If a gate is wrong, change it in its own PR that explains why, with an ADR if it's a decision.
10. **Never hide a failing exit code**, for example `cmd | tail` or `|| true`. Check `$?` or let the command fail.

**Process**
11. **Never start work without an issue.** Anything over 30 minutes needs one, with acceptance criteria, on the board.
12. **Never add a runtime dependency without justifying it** in the PR: one line on why, and the alternative considered.
13. **Never edit the decision of an accepted ADR.** Write a new ADR that supersedes it.
14. **Never push to `main`, force-push a shared branch, or merge with `--admin`.** There's no bypass. In an emergency, revert through a PR ([docs/branch-protection.md](docs/branch-protection.md#emergency-procedure-no-bypass)).
17. **Never use `Math.random` in a verify scenario**, and never write a step that can't fail. Use `ctx.random`, and assert something observable.
15. **Never commit `.env` or any secret**, and **never add AI attribution** (`Co-Authored-By`, "Generated with") to commits or PRs.
16. **Never close an issue whose acceptance criteria aren't demonstrably met.** Close it through the PR that meets them.

## How to deliver a change

1. Pick a Ready issue on the [board](https://github.com/users/Mmolokii/projects/5) and move it to In Progress.
2. Create a branch: `feat/<issue>-slug`, `fix/<issue>-slug`, `ci/…`, `docs/…`.
3. Make small conventional commits (`feat(sync-server): …`).
4. Run `pnpm ci:local` and make sure it passes.
5. Open the PR with the template filled in, including `Closes #<issue>`, how it was tested (real output), and risk and rollback.
6. Make sure the PR meets the Definition of Done in [docs/process/project-management.md](docs/process/project-management.md#33-definition-of-done).
