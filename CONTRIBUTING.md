# Contributing

Thanks for your interest. Lockstep is a portfolio project, but issues and PRs are welcome.

**Start with [AGENTS.md](AGENTS.md)**: the exact setup, test and lint commands, the verify CLI, what tooling enforces, and the never-do list. It applies to humans and AI agents alike.

## Setup

```bash
pnpm install
```

```bash
pnpm infra:up
```

Node 24 (see `.nvmrc`) and Docker are required.

## Before you open a PR

```bash
pnpm ci:local
```

It runs every CI step, in CI's order, against the local docker compose stack, and must pass.

## Conventions

How work is planned and tracked (issues, labels, the board, Definition of Done): [docs/process/project-management.md](docs/process/project-management.md).

- **Issues first:** anything over 30 minutes starts as an issue. PRs must close an issue (`Closes #123`) or be labelled `no-issue`.
- **PR titles:** conventional commits, because they become the squash-merge commit.

- **Branches:** `feat/<issue>-slug`, `fix/<issue>-slug`, `chore/…`, `docs/…`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `perf:`, `ci:`.
- **TypeScript:** strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `erasableSyntaxOnly` (so no `enum` or `namespace`). No `any` without a comment explaining why.
- **Formatting and lint:** Biome (`pnpm lint:fix`).
- **Decisions:** anything a reviewer might ask "why?" about gets an ADR in `docs/adr/`, copied from the template.
- **Dependencies:** every new runtime dependency needs a one-line justification and an alternative considered in the PR description.
- **Numbers:** performance claims must come from a command you ran, with its output and the machine spec.
- **Privacy:** never log document or message contents.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
