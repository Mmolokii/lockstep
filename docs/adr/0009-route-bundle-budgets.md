# 0009. Budget what each route downloads; keep the chunk total as a backstop

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M2 (#116)

## Context

The bundle budget (#96) summed the gzip size of every client chunk and capped it at 350 KB, the ADR 0004 editor measurement plus room for Next.js and React. That works while every chunk loads on every page. It stopped working when the editor arrived (#27): the editor loads only on its own route, and each of its 14 language grammars is a separate chunk that's fetched only when a file in that language is opened.

Measured with the editor wired in (Chromium, Apple M4, gzip -9 of the built files):

| What | gzip |
|---|---:|
| `/` downloads | 131.5 KB |
| `/scratch` downloads (editor and TypeScript grammar ready) | 328.9 KB |
| Sum of all 24 chunks | 585 KB |

The sum fails the 350 KB budget although no page downloads more than 329 KB. Raising the number alone would hide a real regression, such as the editor leaking into the home page, behind a larger total.

## Options considered

1. **Raise the total to about 650 KB.** Simple, but it measures nothing a user experiences. The editor could move into the home page and the total wouldn't change.
2. **Infer per-route chunks from Next's build manifests.** No browser is needed, but the manifests don't list dynamic imports, which is exactly what we need to count, and their format is internal to Next.
3. **Measure each route in a real browser.** Playwright loads the production build, records every script the page fetches until it's ready, and gzips those built files. This is what a user downloads.

## Decision

Option 3 for user-facing budgets, plus option 1 as a backstop.

- **Route budgets** live in `bundle-budgets.json` under `routes` (path, a "ready" selector, max KB, basis). They're enforced by `e2e/tests/budgets.spec.ts` in Chromium, inside the required `E2E (chromium)` check. Sizes come from the built files, so they don't depend on the server's compression.
- **The chunk total** stays in `check-budgets` as a backstop against heavy additions anywhere, re-based to 650 KB from the 585 KB measured.
- A new route ships with its budget in the same PR. Adding a budget is tightening, so it doesn't need its own PR. Raising one still does (AGENTS.md never-do #9).

## Consequences

- A route budget catches the editor or a grammar leaking into a page that shouldn't load it, which a total can't.
- Route budgets need a production build and a browser, so they run in e2e, not in `ci:local`'s fast steps. `pnpm test:e2e` runs them locally.
- "Ready" is a selector per route. A route whose ready selector appears before its lazy code loads would under-count. Each route's selector must mean the page is usable (for the editor, `.cm-content`).
- Grammars beyond the one a page opens aren't budgeted per route. The backstop bounds them in total.
