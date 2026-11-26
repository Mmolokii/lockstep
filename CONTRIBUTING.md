# Contributing

Thanks for your interest. Lockstep is a portfolio project, but issues and PRs are welcome.

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
pnpm typecheck && pnpm lint && pnpm test
```

All three must pass. CI runs the same commands.

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
