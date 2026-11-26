# 0002. Internal packages export TypeScript source, not build output

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M0

## Context

Workspace packages (`protocol`, `sync-client`, `editor`, `db`) are used by `apps/web` (Next.js) and `apps/sync` (Node). Each package either points its `exports` at compiled `dist/` output, or at its `src/*.ts` files directly and lets the consumer handle the TypeScript.

## Options considered

### Build each package to `dist/`

**Pros:** each package is a self-contained unit, the same as a published npm package. **Cons:** every change needs a rebuild before consumers see it, which means watch processes in dev. "Go to definition" opens `.d.ts` files instead of code. `typecheck` and `test` have to wait for upstream builds.

### Export TypeScript source ("just-in-time" packages)

`"exports": { ".": "./src/index.ts" }`. **Pros:** no build step in development. Edits show up immediately in both apps. "Go to definition" opens the real code. `typecheck` and `test` can run in parallel without waiting for builds. **Cons:** every consumer must be able to handle TypeScript.

## Decision

Export TypeScript source. Consumers handle it as follows:

- **`apps/web`**: Next.js compiles workspace packages through `transpilePackages`.
- **`apps/sync`**: Node 24 runs `.ts` files natively by stripping the types. Verified on Node v24.22.0: `node -e "import { CloseCode } from './src/index.ts'"` runs without a build step. For production we'll bundle with esbuild (decided in M3) so the container ships one file.
- **Tests**: Vitest handles TypeScript itself.

To keep native type stripping possible, `tsconfig.base.json` sets `erasableSyntaxOnly`, which forbids TypeScript-only runtime syntax (`enum`, `namespace`, parameter properties). That's why `CloseCode` is an `as const` object rather than an `enum`. Imports use explicit `.ts` extensions (`allowImportingTsExtensions`), which Node requires.

## Consequences

- No `build` step is needed for packages. Only the apps build.
- `typecheck` and `test` don't depend on `^build` in `turbo.json`.
- Packages can't be published to npm as they are. If one ever needs to be, it gets its own build at that point.
- If Node's type stripping causes problems (for example, a dependency that needs real transpilation), `apps/sync` falls back to running through esbuild in dev too.
