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

- **Branches:** `feat/…`, `fix/…`, `chore/…`, `docs/…`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `perf:`, `ci:`.
- **TypeScript:** strict, with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax` and `erasableSyntaxOnly` (so no `enum` or `namespace`). No `any` without a comment explaining why.
- **Formatting and lint:** Biome (`pnpm lint:fix`).
- **Decisions:** anything a reviewer might ask "why?" about gets an ADR in `docs/adr/`, copied from the template.
- **Dependencies:** every new runtime dependency needs a one-line justification and an alternative considered in the PR description.
- **Numbers:** performance claims must come from a command you ran, with its output and the machine spec.
- **Privacy:** never log document or message contents.

## Code of conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).
