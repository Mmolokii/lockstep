# Progress

_Last updated: 2026-11-26_ · **Build mode** from M1 on: no learner tasks

> Narrative status. The [Lockstep board](https://github.com/users/Mmolokii/projects/5) is the system of record for individual issues. How work is run: [docs/process/project-management.md](docs/process/project-management.md).

## Milestones

| Milestone | Status |
|---|---|
| M0 · Foundations | ✅ Done ([#1](https://github.com/Mmolokii/lockstep/pull/1)) |
| M1 · CRDT lab | ✅ Done ([#2](https://github.com/Mmolokii/lockstep/pull/2)) |
| M2 · Local-first editor | 🔵 Next: Cycle 1 (from 2026-11-30) |
| M3 · Sync server v1 | ⚪ Not started |
| M3.5 · First deploy | ⚪ Not started |
| M4 · Persistence | ⚪ Not started |
| M5 · Access control | ⚪ Not started |
| M6a · Collaboration core | ⚪ Not started |
| M6b · Collaboration complete | ⚪ Not started |
| M7 · Scale and observability | ⚪ Not started |
| M8 · Production launch | ⚪ Not started |
| M9 · Extras | ⚪ Not started |

## M0 status (done)

**Done**
- Spec reviewed. Amendments agreed and recorded in `docs/BUILD_PROMPT.md` §0
- Public repo `Mmolokii/lockstep` created
- pnpm workspace, strict shared tsconfig (TS 7), Biome, Vitest, placeholder `@lockstep/protocol`
- CI (typecheck, lint, tests with coverage, build), CodeQL, dependency review, Dependabot
- Issue and PR templates, CODEOWNERS, SECURITY, CONTRIBUTING, code of conduct, MIT license
- Docker Compose: Postgres 18, Redis 8, Prometheus, Grafana, all verified healthy locally
- `DESIGN.md` v1, ADR template, ADRs 0001–0002, `docs/prior-art.md`

- `turbo.json` task graph (all 7 pipeline checks pass, and repeat runs hit the cache)
- Positioning bullets in `docs/prior-art.md`
- Branch protection on `main` (requires CI), private vulnerability reporting, secret scanning push protection

- Merged in #1. All GitHub Actions are pinned to commit SHAs (CodeQL alert)

## M1 status (done)

**Done**
- `packages/crdt-lab`: RGA text CRDT (Lamport ids, origin-based inserts, tombstones, dedupe, causal buffering)
- Convergence harness shared by RGA and Yjs: 2–5 replicas, 10–200 steps, out-of-order and duplicated delivery
- 2,000 runs per implementation in CI. A 20,000-run sweep passed for both (Apple M4, 44 s)
- A deliberately naive replica proves the property detects divergence
- Benchmark toy vs Yjs, with results in ADR 0003 (Yjs ~4–10× faster; typing then deleting 10k chars leaves 24 bytes vs 1.6 MB)
- ADR 0003: use Yjs as the CRDT

## Known issues

- CI doesn't run Postgres or Redis service containers yet. They're added in M4, when tests first need them.
- `pnpm build` runs no tasks yet. No package has a build script until the apps arrive (M2, M3).

## Delivery pipeline (Cycle 1): merged

- **#104**: ADRs 0004–0008 (CodeMirror 6 on measured bundle size; 0006–0008 Proposed pending RFCs)
- **#105**: `pnpm verify` with doctor and the scenario registry
- **#107**: staged CI gate, pipeline contract, coverage tiers, bundle budgets, `ci:local`, security, e2e and deploy workflows (includes #106, auto-closed when its base branch was deleted)
- **#108**: AGENTS.md, protocol draft, runbook, feature map, report placeholders
- `main` is protected by a repository ruleset: 9 required checks, up to date, squash only, no bypass. Verified with the API in [docs/branch-protection.md](docs/branch-protection.md)
- **#109** (in review): adopts the useful parts of the review drafts (teardown, preconditions and seeds enforced by the verify runner) and records what was rejected

**Open decisions for you:** hosting provider and accounts for M3.5 (#49), which turns deploys on.

## Tech debt register

Open `type:tech-debt` issues, by title. Each one is logged in the PR that takes the shortcut.

_None yet._

## Decisions pending

- Domain (M8). Candidates: `lockstepcode.dev`, `uselockstep.dev`
- Redis provider (M7)
- Bundling the sync server for production: esbuild (M3)

## User feedback

_None yet. Target: at least 3 real sessions before v1._
