# Progress

_Last updated: 2026-11-26_ · **Build mode** from M1 on: no learner tasks

> Narrative status. The [Lockstep board](https://github.com/users/Mmolokii/projects/5) is the system of record for individual issues. How work is run: [docs/process/project-management.md](docs/process/project-management.md).

## Milestones

| Milestone | Status |
|---|---|
| M0 · Foundations | ✅ Done ([#1](https://github.com/Mmolokii/lockstep/pull/1)) |
| M1 · CRDT lab | ✅ Done ([#2](https://github.com/Mmolokii/lockstep/pull/2)) |
| M2 · Local-first editor | 🟡 In progress |
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

## M2 status (in progress)

**Done**
- **#112** (closes #25): Next.js 16 shell with baseline security headers; Playwright on Chromium, Firefox and WebKit against the production build; web bundle budget enforced (170 KB of 350 KB gzip). The e2e suite caught `upgrade-insecure-requests` blanking WebKit over plain HTTP on its first run
- **#113** (closes #26): `packages/editor`, CodeMirror 6 bound to a Y.Text. 14 languages, each a lazy chunk; light and dark themes; Yjs-scoped undo; keyboard-only use
- **#115** (closes #114): Turbo strict env mode was dropping `LOCKSTEP_HTTPS` from the build; the Vercel skip rule now builds whenever it can't tell. Production is live at https://lockstep-ebon.vercel.app with the full header set (checked from the Cape Town edge)
- **#117** (closes #116, in review): route budgets measured in Chromium ([ADR 0009](docs/adr/0009-route-bundle-budgets.md)). `/` 131.5 KB of 150; `/scratch` 328.9 KB of 350; all chunks 585 KB of a 650 KB backstop
- **#27** (in review): `/scratch` editor persisted to IndexedDB (y-indexeddb); reload and offline editing covered by e2e

**Next:** #28 cross-tab sync (BroadcastChannel), #29 the M2 exit e2e (two tabs plus reload)

## Known issues

_None._

## Delivery pipeline (Cycle 1): merged

- **#104**: ADRs 0004–0008 (CodeMirror 6 on measured bundle size; 0006–0008 Proposed pending RFCs)
- **#105**: `pnpm verify` with doctor and the scenario registry
- **#107**: staged CI gate, pipeline contract, coverage tiers, bundle budgets, `ci:local`, security, e2e and deploy workflows (includes #106, auto-closed when its base branch was deleted)
- **#108**: AGENTS.md, protocol draft, runbook, feature map, report placeholders
- `main` is protected by a repository ruleset: 9 required checks, up to date, squash only, no bypass. Verified with the API in [docs/branch-protection.md](docs/branch-protection.md)
- **#110** (closes #109): adopts the useful parts of the review drafts (teardown, preconditions and seeds enforced by the verify runner) and records what was rejected

**Hosting decided** ([ADR 0010](docs/adr/0010-hosting-fly-johannesburg.md)): Fly.io in Johannesburg for sync and Redis, Vercel for web, Neon in Frankfurt. Accounts are created just in time: Vercel with `apps/web` (M2), Fly and Sentry at M3.5, Neon at M4.

## Tech debt register

Open `type:tech-debt` issues, by title. Each one is logged in the PR that takes the shortcut.

_None yet._

## Decisions pending

- Domain (M8). Candidates: `lockstepcode.dev`, `uselockstep.dev`
- Bundling the sync server for production: esbuild (M3)

## User feedback

_None yet. Target: at least 3 real sessions before v1._
