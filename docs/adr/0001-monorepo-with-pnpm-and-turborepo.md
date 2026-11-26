# 0001. Use a pnpm + Turborepo monorepo

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M0

## Context

Lockstep has two deployable apps (`web` on Vercel, `sync` on Fly) and several packages they share: the wire protocol, the sync client, the database schema. The protocol in particular must stay identical on both ends of the socket: a client and server that disagree about a message format is a correctness bug, not a style issue. We need one place where a change to `protocol` is typechecked and tested against everything that uses it, in one PR.

## Options considered

### Separate repositories, publish packages to npm

Each app and package has its own repo and versions. **Pros:** strong boundaries. **Cons:** a protocol change takes three PRs and a publish. Version skew between client and server becomes possible. Far too much ceremony for one developer.

### npm or Yarn workspaces, no task runner

**Pros:** built in, fewer tools. **Cons:** npm's flat `node_modules` lets a package import dependencies it never declared ("phantom dependencies"), which then break in production. There's also no task graph or caching, so CI reruns everything on every change.

### Nx

**Pros:** powerful task graph, generators, affected-project detection. **Cons:** much more configuration and its own plugin ecosystem. More than this repo needs.

### pnpm workspaces + Turborepo

**Pros:** pnpm's strict, symlinked `node_modules` only lets a package import what it declares. `workspace:*` links local packages. One lockfile. Turborepo adds a small task graph (`dependsOn: ["^build"]`) and caches task outputs by content hash. **Cons:** two tools to learn. Turbo's caching is only as correct as its declared inputs and outputs.

## Decision

pnpm workspaces for package management and Turborepo for running tasks.

## Consequences

- A protocol change and every consumer's fix land in one PR, checked by one CI run.
- Every package must declare its own dependencies. pnpm will fail loudly otherwise, and that's the point.
- `turbo.json` must declare task outputs accurately, or the cache will replay stale results. `scripts/check-pipeline.test.mjs` checks the intended shape.
- Remote caching (Vercel) is left off for now. Turn it on if CI time becomes a problem.
