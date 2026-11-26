# Progress

_Last updated: 2026-11-26_

## Milestones

| Milestone | Status |
|---|---|
| M0 · Foundations | 🟡 In progress (`chore/m0-foundations`) |
| M1 · CRDT lab | ⚪ Not started |
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

**Learner tasks (open)**
- [ ] Write `turbo.json` so that `pnpm check:pipeline` passes (7 checks)
- [ ] Write Lockstep's three positioning bullets in `docs/prior-art.md`

**Remaining after the learner tasks**
- Open the M0 PR, get CI green, merge
- Turn on branch protection for `main` (require CI), private vulnerability reporting, secret scanning push protection

## Known issues

- Root `pnpm typecheck` / `test` / `build` fail until `turbo.json` exists (learner task).
- CI doesn't run Postgres or Redis service containers yet. They're added in M4, when tests first need them.

## Decisions pending

- Domain (M8). Candidates: `lockstepcode.dev`, `uselockstep.dev`
- Redis provider (M7)
- Bundling the sync server for production: esbuild (M3)

## User feedback

_None yet. Target: at least 3 real sessions before v1._
