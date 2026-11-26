# 0004. Use CodeMirror 6 as the editor

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M2 (#23)

## Context

Lockstep needs an in-browser code editor that:
- binds cleanly to a Y.Text, including remote cursors and selections
- highlights about 10 languages
- loads fast enough for a share link opened on a phone or a slow connection
- works with a strict Content Security Policy

The two realistic choices are CodeMirror 6 and Monaco, the editor inside VS Code.

## Options considered

### CodeMirror 6

A modular editor built from small packages, where you assemble only the extensions you need. The Yjs binding, `y-codemirror.next`, is maintained by the Yjs author and supports remote cursors and selections through Yjs awareness. It's designed for mobile and touch input.

### Monaco

VS Code's editor, packaged for the browser. It ships rich language features (IntelliSense for TypeScript and JSON, a diff editor, a minimap) and needs web workers for language services. The Yjs binding, `y-monaco`, is community-maintained.

### Measured bundle cost

I bundled a minimal editor bound to a Y.Text with each option, using esbuild 0.28.2 (minified, ESM, code splitting) on an Apple M4. The "initial" columns follow static imports from the entry point, so they count everything that must download before the editor works.

| Bundle | Initial JS (min) | Initial JS (gzip) | Lazy JS (gzip) | CSS (gzip) |
|---|---:|---:|---:|---:|
| CodeMirror 6 6.0.2 + JS and Python modes + `yjs` + `y-codemirror.next` 0.3.6 | 615 KB | 209 KB | 0 KB | 0 KB |
| Monaco 0.58.0 + basic languages + `yjs` + `y-monaco` 0.1.6 | 2,746 KB | 708 KB | 162 KB | 169 KB |
| Monaco editor worker (required) | 338 KB | 100 KB | — | — |

Before the editor is usable, Monaco needs about **977 KB** gzipped (JS + CSS + worker) against CodeMirror's **209 KB**, roughly 4.7×. The CodeMirror figure includes Yjs, which Lockstep needs anyway.

Integration findings from the same exercise:

- **`y-monaco` lags Monaco.** Monaco 0.58 changed its package export paths. `y-monaco` 0.1.6 still imports the old path and wouldn't resolve without a bundler alias. It also needs `y-protocols` installed separately. `y-codemirror.next` worked as installed.
- **Monaco needs workers.** That means extra build configuration and a CSP `worker-src` allowance. CodeMirror runs on the main thread with no workers.

## Decision

Use **CodeMirror 6** with `y-codemirror.next`.

## Consequences

- Smaller first load, mobile support, and a binding maintained alongside Yjs.
- There's no built-in IntelliSense. TypeScript IntelliSense (M9) will need a TypeScript worker plus a CodeMirror extension, which is more work than Monaco's built-in support. It's an optional feature, so the trade is worth it.
- There's no built-in diff editor. Version-history diffs (M6b) use `@codemirror/merge`.
- The bundle-size budget in CI (#96) starts from these numbers.
- We'd revisit this if IntelliSense became a core feature rather than an optional one.

Reproduce: [assets/0004-editor-bundle](assets/0004-editor-bundle/README.md).
