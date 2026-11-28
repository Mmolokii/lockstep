# Feature map

Every v1 feature: how a user reaches it, how to drive it without a browser, its status, and the traps that catch people (and agents). Update this file in the same PR that changes a feature.

**Status key:** ⚪ not built · 🟡 in progress · ✅ built and verified. **Verify:** `pnpm verify <scenario>` (exit 0 pass · 1 fail · 2 pending). Where a feature is browser-only, the Playwright test name is given instead.

## Collaboration core

| Feature | How a user reaches it | Drive it | Status | Known traps |
|---|---|---|---|---|
| **Concurrent editing converges** | Two people open the same file and type | `verify sync-two-clients` *(pending #100)* | ⚪ M3 | Same-line concurrent inserts are where naive implementations diverge; the scenario targets exactly that. Interleaving at character level is correct CRDT behaviour, not a bug. |
| **Offline editing and merge** | Lose the network (or press "Simulate offline"), keep typing, reconnect | `verify offline-merge` *(pending #101)* | ⚪ M3 | IndexedDB is per origin: `localhost:3000` and `127.0.0.1:3000` are different stores. Private windows (notably WebKit) may evict IndexedDB. "Simulate offline" stops the socket, not local persistence. |
| **Honest sync status** | Status indicator in the editor header | Shown in every scenario's output; e2e `status never lies` *(#88)* | ⚪ M3/M6a | "Synced" requires a server `ack` covering local updates. "Saving" is normal for ~500 ms after typing (batched writes). A green dot without an ack is a bug. |
| **Viewer is read-only (server-enforced)** | Open a viewer share link | `verify viewer-rejected` *(pending #103)* | ⚪ M5 | The editor UI being read-only proves nothing; the server must reject raw `update` **and non-empty sync step 2** messages with 4403. A viewer with stale offline edits triggers step 2. |
| **Malformed input never crashes the server** | Not user-facing | `verify malformed-message` *(pending #102)* | ⚪ M3 | A text frame is malformed (4400). Oversized frames are 4413, not 4400. |
| **Cross-tab sync without a server** | Same file in two tabs (`/scratch`) | e2e `cross-tab.spec.ts`; unit `tab-sync.test.ts`; exit test `m2-exit.spec.ts` | ✅ M2 | BroadcastChannel only works within one origin and one browser profile: `localhost` and `127.0.0.1` are separate, and so are private windows. Messages never leave the browser. |

## Identity, projects, sharing

| Feature | How a user reaches it | Drive it | Status | Known traps |
|---|---|---|---|---|
| Sign in with GitHub | "Sign in" on the landing page | e2e *(M5)* | ⚪ M5 | One GitHub OAuth app allows one callback URL. Preview deploys need their own approach (#82). |
| Projects and members | Dashboard → New project | e2e *(M5)* | ⚪ M5 | Membership is checked server-side on every API call, not only in the UI. |
| Share links (editor / viewer) | Project → Share | e2e *(M5)*; `verify viewer-rejected` | ⚪ M5 | Tokens are stored hashed, so a lost link can't be "looked up", only revoked and reissued. |
| Revoke access | Share → Revoke, or remove a member | e2e *(M5)*; test in #77 | ⚪ M5 | Revocation is pushed: the socket closes with 4403 immediately. Waiting for the 5-minute token to expire is the bug this prevents. |

## Editing experience

| Feature | How a user reaches it | Drive it | Status | Known traps |
|---|---|---|---|---|
| Code editor (~10 languages, themes, shortcuts) | `/scratch` (files from M6a) | `packages/editor` unit tests; e2e `scratch.spec.ts` | ✅ M2 | Language is chosen by file extension; unknown extensions are plain text. Each grammar is a lazy chunk: offline before it has loaded, the file shows as plain text. Escape then Tab leaves the editor. |
| Local persistence (reload, offline) | `/scratch`: type, reload, or go offline | e2e `scratch.spec.ts` (reload; offline edit then reload) | ✅ M2 | Stored per origin and per browser profile (IndexedDB). An offline *reload* needs a service worker, which isn't planned for v1; editing in an already-open page works offline. |
| Collaborative file tree | Sidebar: new, rename, move, delete | e2e *(M6a)*; property test (#85) | ⚪ M6a | Content is keyed by file ID, not path: a rename touches only the tree doc. Rename-versus-delete races follow ADR 0011. |
| Live cursors and selections | Visible when others are in the file | e2e *(M6a)* | ⚪ M6a | Every cursor shows colour **and** name; never colour alone (accessibility). |
| Presence bar | Avatars in the header | e2e + axe *(M6a)* | ⚪ M6a | Awareness is ephemeral and never persisted; a reload drops and re-adds presence. |
| Follow mode | Click a collaborator's avatar | e2e *(M6b)* | ⚪ M6b | Any local navigation ends follow mode, by design. |

## History and export

| Feature | How a user reaches it | Drive it | Status | Known traps |
|---|---|---|---|---|
| Version history and diff | History panel | e2e *(M6b)* | ⚪ M6b | Yjs garbage-collects deleted content, so versions are explicit snapshots, not replays of the log (ADR 0003). |
| Restore a version | History → Restore (per file) | e2e *(M6b)* | ⚪ M6b | Restore is a **new** update applied on top, never a rewind. It's per file; restoring a whole project isn't atomic. |
| Download as zip | Project menu → Download | e2e *(M6b)* | ⚪ M6b | Built from current document state, not from the last snapshot. |

## Reviewer demo controls

| Feature | How a user reaches it | Drive it | Status | Known traps |
|---|---|---|---|---|
| Simulate offline | Devtools panel toggle | `sync-client.simulateOffline()` (#45) | ⚪ M3/M6b | Closes the socket and blocks reconnects; local edits and IndexedDB keep working. |
| Added-latency slider (0–2,000 ms) | Devtools panel | `sync-client.setArtificialLatency()` (#45) | ⚪ M3/M6b | Applied client-side to both directions. It doesn't change server metrics, so don't benchmark with it on. |
| Sync devtools panel | Keyboard shortcut | e2e *(M6b)* | ⚪ M6b | Shows message types and sizes, **never contents**. |

## Operations

| Feature | How it's reached | Drive it | Status | Known traps |
|---|---|---|---|---|
| Environment check | — | `verify doctor` | ✅ | Port checks fail if a dev server is already running. That's correct, not flaky. |
| Deployed environment works | After each deploy | `verify smoke` *(pending #52)* | ⚪ M3.5 | Deploys fail while smoke is pending; that's the gate working. |
| Zero-downtime deploys | Merge to `main` | Drill in #53 | ⚪ M3.5 | Drain closes with 1012 and clients reconnect with jitter. A 1006 during a deploy means the drain didn't run. |
| Horizontal scaling | — | Chaos test *(M7)* | ⚪ M7 | Pub/sub is at-most-once; state-vector reconciliation repairs drift (ADR 0007). |
