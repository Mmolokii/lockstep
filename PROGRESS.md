# Progress

_Last updated: 2026-11-26_ · **Build mode** from M1 on: no learner tasks

## Milestones

| Milestone | Status |
|---|---|
| M0 · Foundations | 🟡 In review ([#1](https://github.com/Mmolokii/lockstep/pull/1)) |
| M1 · CRDT lab | 🟡 In review (`feat/m1-crdt-lab`) |
| M2 · Editor, local-first | ⚪ Not started |
| M3 · Sync server v1 | ⚪ Not started |
| M3.5 · Early deploy | ⚪ Not started |
| M4 · Persistence | ⚪ Not started |
| M5 · Auth, projects, permissions | ⚪ Not started |
| M6 · Collaboration UX | ⚪ Not started |
| M7 · Scale and observability | ⚪ Not started |
| M8 · Deploy, release, docs | ⚪ Not started |

## M0 status

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

**Remaining**
- Merge the M0 PR once CI is green

## M1 status

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

## Decisions pending

- Domain (M8). Candidates: `lockstepcode.dev`, `uselockstep.dev`
- Redis provider (M7)
- Bundling the sync server for production: esbuild (M3)

## User feedback

_None yet. Target: at least 3 real sessions before v1._
