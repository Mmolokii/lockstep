# Build prompt: Lockstep — a real-time collaborative code editor

> **How to use this file**
> 1. Fill in the **Project settings** block below.
> 2. Create an empty GitHub repo, clone it via your SSH alias, and save this file as `docs/BUILD_PROMPT.md`.
> 3. Open Claude Code in the repo root and say: *"Read docs/BUILD_PROMPT.md and follow it. Start with the 'First session' section."*
> 4. Work one milestone at a time. Each milestone ends with a PR you review and merge.

---

## Project settings (fill these in first)

```yaml
display_name: Lockstep
github_repo: "git@github-personal:Mmolokii/lockstep.git"   # public repo
domain: "TBD in M8 — candidates: lockstepcode.dev, uselockstep.dev (lockstep.dev/.app/.live/.sh are taken)"
web_host: Vercel                 # Next.js app
sync_host: Fly.io                # long-lived WebSocket processes (see ADR in M8)
database: "Neon Postgres"        # branching gives each PR a throwaway database
redis: "Decide in M7 (local: Redis in Docker Compose). Beware per-command pricing for pub/sub fan-out."
author: "Mmoloki Kgololosego"
license: MIT
min_node: 24                     # current LTS; Node 22 reaches EOL April 2027
```

---

## 0. Amendments agreed in the first session (2026-11-26)

These override anything below that disagrees with them. Each is also folded into the relevant section.

1. **Server acknowledgements.** y-protocols has no acknowledgement for updates, so "synced" can't be shown truthfully with it alone. The protocol gains an `ack { stateVector }` control message. The client shows "synced" only when the server's acknowledged state vector covers every local update. "Acknowledged edit" in the chaos test means exactly this.
2. **Single writer per document under pub/sub.** When several instances hold the same room, only one (holding a Postgres advisory lock or Redis lease) writes updates and runs compaction. Because Redis pub/sub is at-most-once, instances periodically exchange state vectors to repair drift. The M7 scaling ADR must also weigh room-affinity routing, which avoids both problems.
3. **Viewers and sync step 2.** Per-message authorisation covers sync step 2 as well as `update`, because step 2 carries updates (e.g. a viewer's stale offline edits in IndexedDB).
4. **Immediate revocation.** Revoking a share link or membership publishes a revocation event that sync servers act on at once, closing affected sockets with 4403. Waiting for a 5-minute room token to expire is not enough.
5. **Restore scope.** Restore works per file: diff old text against current text and apply the result as `Y.Text` edits (map diff for the file tree). Project-wide restore is not atomic; v1 either omits it or says so in the UI.
6. **Browser wording.** Playwright covers Chromium, Firefox, WebKit (a stand-in for Safari, not Safari itself) and Edge via its install channel. We don't claim "latest two versions".
7. **Deploy early, and a cut line.** A basic Fly deploy of the sync server lands right after M3 (milestone **M3.5**), to surface proxy, TLS and idle-timeout problems early. The demoable core is **M0–M5 + minimal M6 + deploy**; everything else is built on top of that.
8. **Latency definition.** p95 propagation is measured with headless harness clients in the same region as the sync server. Reports state separately whether CodeMirror render time is included.
9. **Node 24**, a **public** repo (so branch protection works on a free plan), **Neon** for Postgres, Redis provider decided in M7.

---

## 1. Your role

You are a senior full-stack and distributed-systems engineer and my pair-programming mentor. Together we are building **Lockstep**: a browser-based, real-time collaborative code editor where several people edit the same project at once, with live cursors, offline editing that merges cleanly when you reconnect, and version history.

This is a portfolio project for a graduate software-engineering job search, so it has two equal goals:

1. **Production quality.** Built, tested, deployed, observed and documented the way a real multiplayer product is: horizontal scaling, measured latency, chaos-tested recovery, secure by default.
2. **I must understand every line.** Interviewers will ask about conflict resolution, reconnection, scaling WebSockets and durability. Optimise for my understanding, not just for speed.

**The engineering thesis:** we use **Yjs** as the CRDT (writing a production CRDT from scratch is a research project), but we build **everything around it ourselves**: the sync server and protocol handling, persistence and compaction, auth and per-message permissions, reconnection, horizontal scaling and observability. That's where the hard, interview-worthy problems are. We do *not* use hosted or off-the-shelf sync backends (y-websocket server, Hocuspocus, Liveblocks, PartyKit, y-sweet). Read them for ideas, but don't depend on them.

---

## 2. Working agreement (read before every session)

### Pair mode (the default)

For every milestone:

1. **Explain first.** Before writing code, explain the 2–4 concepts this milestone depends on (e.g. "what a state vector is and why sync needs two steps"), briefly and concretely.
2. **Plan, then wait.** Propose the plan: files, interfaces, data model, tests, dependencies, open decisions. **Stop and wait for my approval** before implementing.
3. **Learner tasks.** In each milestone, pick 1–2 pieces of core logic (not boilerplate) and assign them to me. Describe the task, write the failing tests for it, then stop. Do not write the implementation. Review my code when I'm done, like a strict but kind senior engineer.
4. **Implement the rest** in small, reviewable commits.
5. **Close the milestone** with: a PR, an update to `PROGRESS.md`, and 3 interview-style questions about the milestone's decisions for me to answer.

If I say **"build mode"**, skip steps 1, 3 and 5 for that milestone.

### Rules

- **Never fabricate numbers.** Latency, throughput, connection counts, memory and coverage must come from commands you actually ran, with output shown and the machine or instance spec stated. If you can't measure something, say so.
- **Ask before adding a dependency.** Every runtime dependency needs a one-line justification and an alternative considered.
- **Record decisions.** Any choice an interviewer could ask "why?" about gets an ADR in `docs/adr/NNNN-title.md` (context, options, decision, consequences).
- **Run things.** After changes, run typecheck, lint and tests, and show the result. Don't claim something works without running it.
- **Stop at milestone boundaries.** Never start the next milestone without my go-ahead.
- **Keep `PROGRESS.md` current:** what's done, what's next, known issues, decisions pending.

### Git

- One branch per milestone (or smaller): `feat/m3-sync-server`, `chore/m0-foundations`, etc.
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `perf:`, `ci:`.
- **Do not add any AI attribution to commits or PRs.** No `Co-Authored-By` lines, no "Generated with" footers.
- PRs are opened with `gh pr create`, with a description covering: what, why, how it was tested, and screenshots, recordings or terminal output where relevant.
- `main` is protected: merge only when CI is green.

---

## 3. Product specification

### Problem

Sharing code live is still clumsy: screen-sharing is one-way, pasting into chat loses context, and the existing tools are tied to one editor or one vendor. More interesting from an engineering point of view: making several people's simultaneous edits converge correctly, survive dropped connections and offline periods, and scale across servers is a genuinely hard distributed-systems problem.

### What Lockstep does (v1)

- **Sign in with GitHub**, create projects, and invite people with a share link (editor or viewer role).
- **Projects with a file tree:** create, rename, move and delete files and folders, all collaboratively.
- **A code editor** with syntax highlighting for about 10 common languages, light and dark themes, and standard keyboard shortcuts.
- **Live collaboration:** everyone's cursors and selections with names and colours, a presence list, and **follow mode** (your view follows a collaborator's cursor).
- **Offline editing:** keep typing with no connection; edits merge cleanly on reconnect. A sync status indicator always shows the true state.
- **Version history:** automatic snapshots, browse past versions, see a diff, and restore one per file (as a new change, so collaborators aren't disrupted).
- **Download** a project as a zip.
- **Demo controls** (for reviewers): a **"Simulate offline"** toggle and an **added-latency slider** (0–2,000 ms), plus a **sync devtools panel** showing connection state, pending local updates, document size and connected peers.

### Who it's for

Pairs and small teams doing pair programming, interviews, teaching (e.g. a tutor and students) and quick code reviews.

### Prior art (required reading before Milestone 0 ends)

Research and summarise in `docs/prior-art.md`: VS Code Live Share, Zed's collaboration, Replit multiplayer, CodeSandbox, and the infrastructure behind them (Yjs and its providers, Automerge, Hocuspocus, Liveblocks, PartyKit). For each: what it does well and what trade-offs it makes. Then write Lockstep's **positioning in 3 bullets**. Be honest: Lockstep's value is mainly as an engineering showcase, so the bullets should say what we do *differently or more transparently* (e.g. the devtools panel, measured latency, open architecture docs).

### Non-goals (v1)

- Running code, terminals or containers (sandboxing untrusted code is its own security project)
- IntelliSense or language servers per language
- Voice or video
- Pushing to Git (download only; GitHub import is an optional milestone)
- AI features
- Enterprise SSO, billing
- Atomic project-wide restore

---

## 4. Architecture

### Monorepo layout (pnpm workspaces + Turborepo)

```
/
├─ apps/
│  ├─ web/                 # Next.js: auth, dashboard, project pages, editor UI
│  └─ sync/                # Node WebSocket sync server (long-lived processes)
├─ packages/
│  ├─ protocol/            # message encoding/decoding, close codes, shared types
│  ├─ editor/              # React editor component + Yjs bindings + awareness UI
│  ├─ sync-client/         # connection manager: auth, reconnection, offline, status events
│  ├─ db/                  # Drizzle schema, migrations, queries
│  └─ crdt-lab/            # M1 learning package: a toy CRDT with convergence tests
├─ infra/
│  ├─ docker-compose.yml   # Postgres, Redis, 2× sync instances, Prometheus, Grafana
│  ├─ grafana/             # dashboards as code
│  └─ fly/                 # deploy config
├─ loadtest/               # k6 WebSocket scripts + chaos scripts
├─ docs/
│  ├─ adr/
│  ├─ protocol.md          # wire protocol, message types, close codes
│  ├─ prior-art.md
│  └─ BUILD_PROMPT.md      # this file
├─ DESIGN.md
└─ PROGRESS.md
```

### System overview

```
 Browser A                        Browser B
 ┌──────────────────────┐         ┌──────────────────────┐
 │ Editor (CodeMirror)  │         │ Editor (CodeMirror)  │
 │   ↕ Y.Doc per file   │         │   ↕ Y.Doc per file   │
 │ IndexedDB (offline)  │         │ IndexedDB (offline)  │
 │ sync-client          │         │ sync-client          │
 └─────────┬────────────┘         └──────────┬───────────┘
           │ WebSocket (binary)              │
   ┌───────▼────────┐  Redis pub/sub  ┌──────▼─────────┐
   │ sync instance 1│◀───────────────▶│ sync instance 2│
   │ rooms in memory│                 │ rooms in memory│
   └───────┬────────┘                 └──────┬─────────┘
           └──────────────┬──────────────────┘
                          ▼  (single writer per doc)
              Postgres: update log + snapshots
                          ▲
   ┌──────────────────────┴───┐
   │ web (Next.js): auth,     │──issues short-lived room tokens
   │ projects, sharing, API   │──publishes revocation events
   └──────────────────────────┘
```

### Key design decisions (each gets an ADR; these are the starting positions)

| Decision | Starting position | Interview angle |
|---|---|---|
| CRDT | Yjs | Why not OT (operational transformation)? Why not write our own CRDT? |
| Editor | CodeMirror 6 (vs Monaco) | Bundle size, mobile support, binding quality, extensibility |
| Document granularity | One Y.Doc per file, plus one project Y.Doc for the file tree | Lazy loading, memory per room, cross-file atomicity trade-off |
| Sync transport | Own WebSocket server on `ws` | Why not serverless (Vercel) for WebSockets? |
| Wire protocol | `y-protocols` sync + awareness messages, plus our own control messages (incl. `ack`) | Two-step sync, state vectors, why "synced" needs an ack |
| Horizontal scaling | Redis pub/sub fan-out between instances, single writer per doc, periodic state-vector reconciliation | vs room-affinity routing (consistent hashing); memory implications; at-most-once delivery |
| Persistence | Append-only update log + periodic snapshot compaction | Durability vs write amplification; how clients help recovery |
| Auth on sockets | Short-lived room tokens issued by `web`, sent in the first message (never in the URL), plus pushed revocation | Why tokens in URLs leak (logs, proxies); why expiry alone is too slow |
| Permissions | Checked at connect **and per message** (viewers can't send updates or non-empty sync step 2) | Why connect-time checks alone aren't enough |

---

## 5. Functional specification

### 5.1 `crdt-lab` (M1, the learning milestone)

Implement a small **sequence CRDT for plain text** (e.g. a simplified RGA or Logoot-style approach) from scratch, in about 300–500 lines:

- `insert(position, char)`, `delete(position)`, `merge(remoteOps)`, `toString()`
- **Property-based convergence tests** with `fast-check`: generate N simulated replicas, apply random concurrent operations, deliver them in random orders, possibly duplicated, and assert that all replicas converge to the same string.
- Run the same convergence harness against Yjs, to show the property holds there too.
- An ADR explaining why production uses Yjs anyway: performance, garbage collection, rich types, a mature ecosystem.

This package is never used by the app. It exists so I can explain CRDTs from first principles in interviews.

### 5.2 `protocol`

- Binary message format (`lib0` encoding, which Yjs uses):
  - **Sync:** step 1 (state vector), step 2 (missing updates), update
  - **Awareness:** cursor, selection, user info, follow state
  - **Control (ours):** `auth`, `auth-ok`, `ack` (server's state vector after applying client updates), `error`, `ping`/`pong`, `doc-meta` (size, version)
- Every message type and field is documented in `docs/protocol.md`.
- **Close codes** (documented, stable):

| Code | Meaning | Client behaviour |
|---|---|---|
| 1000 | Normal close | Don't reconnect |
| 1012 | Service restarting (deploy or drain) | Reconnect immediately, with jitter |
| 4400 | Malformed message | Don't reconnect; report a bug |
| 4401 | Missing or invalid token | Refresh the token, then reconnect |
| 4403 | Not allowed in this room (incl. revoked access) | Don't reconnect; show "access removed" |
| 4404 | Room not found | Don't reconnect |
| 4413 | Message or document too large | Don't reconnect; show an error |
| 4429 | Rate limited | Reconnect with longer backoff |

- **Fuzz tests:** malformed and truncated binary messages must produce a 4400 close, never a server crash.

### 5.3 `sync-client`

A framework-agnostic connection manager that the editor uses:

- Connects, authenticates with a room token (fetched from `web`, refreshed before expiry), runs the two-step sync, then streams updates.
- **Reconnection:** exponential backoff with full jitter, capped; reacts to `online`/`offline` browser events and to close codes as in the table above.
- **Offline:** local edits keep applying to the Y.Doc and persist to IndexedDB (`y-indexeddb`). On reconnect, the sync handshake exchanges only what's missing in each direction.
- **Heartbeat:** ping every ~20 s; treat a missed pong as a dead connection (half-open TCP connections are real).
- **Status events:** `connecting | syncing | synced | offline | error`, plus a count of pending local updates. **"Synced" must be true**: only shown once the server's `ack` state vector covers every local update.
- **Demo hooks:** `simulateOffline(boolean)` and `setArtificialLatency(ms)` for the devtools panel.
- Tests: unit tests with a fake socket, covering every close code and the backoff schedule (with fake timers).

### 5.4 `sync` server

- Node + `ws`. Rooms are keyed by document ID, and each active room holds a Y.Doc in memory.
- **Connection lifecycle:** accept the upgrade, then require an `auth` message within 5 s or close with 4401. Verify the room token (signature, expiry, room, role). Load the room (snapshot plus later updates from Postgres) if it isn't already in memory. Run sync. Join awareness.
- **Per-message authorisation:** viewers may send sync step 1 and awareness messages, but **an update message, or a sync step 2 carrying updates, from a viewer is rejected** (4403) and never applied.
- **Revocation:** subscribe to revocation events from `web`; close affected connections with 4403 immediately.
- **Acknowledgements:** after applying a client's updates, send `ack` with the room's state vector.
- **Limits:** maximum message size, maximum document size, and a per-connection token-bucket rate limit (e.g. N updates per second with burst). All configurable, all enforced with tests.
- **Backpressure:** watch `ws.bufferedAmount`; if a slow client falls too far behind, disconnect it (it'll re-sync on reconnect) rather than letting memory grow without limit.
- **Room eviction:** after the last client leaves, flush to storage and evict the room after an idle timeout.
- **Graceful shutdown:** on SIGTERM, stop accepting connections, flush every room, close clients with 1012, then exit, within a time budget.
- **Health endpoints:** `/healthz` (process alive) and `/readyz` (connected to Postgres and Redis, not draining).
- Tests: in-process integration tests with real WebSocket clients: two clients converge, a late joiner gets the full state, a viewer's update (and non-empty step 2) is rejected, limits trigger the right close codes, graceful shutdown loses nothing.

### 5.5 Persistence (`db` + sync server)

```sql
documents(id uuid pk, project_id uuid, kind text check (kind in ('tree','file')), created_at)
doc_updates(doc_id uuid, seq bigserial, update bytea, client_id bigint, created_at, primary key (doc_id, seq))
doc_snapshots(doc_id uuid, upto_seq bigint, state bytea, created_at, primary key (doc_id, upto_seq))
doc_versions(id uuid pk, doc_id uuid, label text, snapshot bytea, created_by uuid, created_at)
```

- **Write path:** batch incoming updates per room and flush on a short interval (e.g. 500 ms) or when a size threshold is reached. Only the instance holding the document's writer lock writes. Write an ADR on the durability trade-off. Note the CRDT safety net: if a server crashes before flushing, the clients still hold the state, and the next sync handshake sends it back. **Prove this with the chaos test in M7.**
- **Load path:** the latest snapshot plus every update after `upto_seq`, merged.
- **Compaction:** when a document has more than N updates since its last snapshot, merge them (`Y.mergeUpdates` / encode state) into a new snapshot inside a transaction. Old updates are deleted only after the snapshot commits. Only the writer-lock holder compacts.
- **Version history:** automatic named versions on idle (e.g. 2 minutes without edits) and on demand. **Restore** (per file) diffs the old text against the current text and applies the result as a *new* update, never by rewinding history.
- Tests: crash between write and compaction loses nothing; load after compaction equals load before; restore produces a document equal to the old version for every connected client.

### 5.6 `web` app (Next.js)

- **Auth:** better-auth with GitHub OAuth. Sessions in Postgres.
- **Data model:** `projects`, `project_members(project_id, user_id, role)`, `share_links(id, project_id, role, token_hash, expires_at, revoked_at)`. Share-link tokens are **stored hashed**, like passwords.
- **Room tokens:** `POST /api/rooms/:docId/token` checks membership and returns a short-lived (e.g. 5-minute) signed token with the room and role. Write an ADR on the signing approach (e.g. EdDSA keys, so sync servers only need the public key).
- **Revocation:** revoking a link or removing a member publishes a revocation event to the sync servers.
- **Pages:** sign in, dashboard (projects), project view (file tree + editor + presence + history panel), share dialog, settings.
- **Security:** CSRF protection on mutations, strict Content Security Policy, every user-controlled string (names, file paths) escaped. File paths validated (no `..`, length limits).
- **Download as zip:** generated from current document states.

### 5.7 `editor` package and collaboration UX

- CodeMirror 6 with the Yjs binding (`y-codemirror.next`), syntax highlighting, themes.
- **Awareness:** remote cursors and selections in each user's colour, with name labels that fade when idle. A presence bar with avatars. Clicking an avatar starts **follow mode** (scrolls and switches files with them). Any local navigation ends follow mode.
- **File tree:** backed by the project Y.Doc (a `Y.Map` of path to file metadata), with collaborative create, rename, move and delete. Concurrent rename-versus-delete conflicts must resolve predictably; write the rules in an ADR.
- **Sync status indicator:** synced, saving, offline (N pending changes), reconnecting, error. Never lies.
- **Devtools panel** (toggle with a keyboard shortcut): connection state, room, role, pending updates, document size in bytes, state vector, peers, recent messages (types and sizes, never contents), plus the "Simulate offline" toggle and the latency slider.
- **Accessibility:** full keyboard use, visible focus, screen-reader labels for presence and status, colour plus name for every cursor (never colour alone).

### 5.8 Optional (M9)

- Import a public GitHub repo (size-limited) as a new project
- Inline comments anchored to code ranges (Yjs relative positions)
- TypeScript IntelliSense via a web worker, for `.ts` files only

---

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| **Correctness** | All replicas converge (property-tested). No acknowledged edit (covered by a server `ack`) is ever lost (chaos-tested). "Synced" is never shown when it isn't true. |
| **Latency** | p95 edit propagation (keystroke on client A until it's visible on client B) **under 100 ms** within one region, with 20 editors in a room. Measured with headless harness clients in the same region as the sync server, reported with instance specs and whether render time is included. |
| **Capacity** | Measure and report how many concurrent connections and active rooms one sync instance handles at a stated size (e.g. 1 vCPU / 1 GB) before p95 exceeds budget. Report what's measured, not targets. |
| **Editor performance** | Typing stays smooth (no dropped frames) in a 5,000-line file with 10 remote cursors. A 1 MB document loads in under 1 s on a mid-range laptop. |
| **Security** | AuthZ at connect and per message; pushed revocation; hashed share tokens; tokens never in URLs; rate limits and size limits; strict CSP; dependency scanning; `SECURITY.md`. |
| **Privacy** | Message contents never logged. Deleting a project deletes all its documents, updates, snapshots and versions. |
| **Reliability** | The server never crashes on malformed input (fuzzed). Graceful drain on deploy, with zero lost edits. |
| **Observability** | Traces, metrics and structured logs from day one of the sync server (see section 7). |
| **Browser support** | Chromium, Firefox, WebKit and Edge (via channel), tested with Playwright. WebKit stands in for Safari. |

---

## 7. Engineering standards

- **TypeScript:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. No `any` without a comment explaining why.
- **Lint and format:** Biome.
- **Testing:**
  - Vitest for unit and integration tests, with coverage targets of **90% for `protocol`, `sync-client` and `sync`**, and 80% elsewhere (measured)
  - Property-based convergence tests (`fast-check`)
  - Protocol fuzz tests
  - **Playwright multi-user e2e:** two or three browser contexts editing the same file at once; one goes offline (`context.setOffline(true)`), edits, comes back, and all contexts converge; a viewer can't type; follow mode works
  - **k6 WebSocket load tests** in `loadtest/`: ramp connections and rooms, measure propagation latency and error rates
  - **Chaos tests:** a script that kills a sync instance mid-session (Docker Compose locally, a machine restart on Fly) and asserts that clients reconnect to the other instance with no lost edits
- **Observability:**
  - OpenTelemetry traces across web, the token API, the sync connection and persistence
  - Prometheus metrics: active connections, active rooms, messages per second by type, update bytes, flush latency, compaction duration, propagation latency histogram, rejected messages by reason, reconnects
  - A Grafana dashboard committed as code
  - Structured JSON logs with request and connection IDs, never message contents
  - Sentry for errors in web and sync
- **CI (GitHub Actions):**
  - `ci.yml`: install → typecheck → lint → unit and integration tests (with Postgres and Redis service containers) → build
  - `e2e.yml`: the Playwright multi-user suite against the Docker Compose stack
  - `load.yml`: a short k6 smoke run on PRs touching `sync` or `protocol`; full runs on demand
  - `codeql.yml`
  - `deploy.yml`: on merge to `main`, run migrations, deploy web to Vercel and sync to Fly with rolling restarts (1012 drain)
- **Database migrations:** Drizzle, forward-only, run in CI before deploy. Backups enabled on the managed database, and the restore procedure tested once and documented.

---

## 8. Documentation

- `README.md`: a 60–90-second demo video at the top (two windows editing, offline, reconnect, merge), a one-sentence pitch, live demo link, architecture diagram, how to run locally (`docker compose up` plus `pnpm dev`)
- `DESIGN.md`: architecture, data flow, the life of a keystroke from key press to every other screen, scaling model, failure modes and recovery, links to ADRs
- `docs/protocol.md`: the wire protocol and close codes
- `docs/runbook.md`: deploy, roll back, drain an instance, restore the database, read the Grafana dashboard, common alerts
- `docs/load-test-report.md`: the real numbers, the instance specs, the methodology, and what the bottleneck turned out to be
- `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, issue and PR templates

---

## 9. Milestones

Each milestone is one or more PRs. Times are rough estimates at a learner's pace. **Total: about 150–190 hours** (likely optimistic; M6 and M7 are larger than they look).

**Cut line:** the demoable core is **M0–M5 + minimal M6 (cursors, presence, sync status) + deploy**. Everything after that builds on a working, deployed product.

### M0 · Foundations (~8–10 h)
- Monorepo (pnpm, Turborepo), shared tsconfig, Biome, Vitest, CI, branch protection, templates
- Docker Compose with Postgres, Redis, Prometheus and Grafana
- `DESIGN.md` (first version), `PROGRESS.md`, ADR template, `docs/prior-art.md` with positioning
- **Done when:** CI is green and `docker compose up` brings up the infrastructure locally.

### M1 · CRDT lab (~12–15 h)
- Everything in 5.1
- *Suggested learner task:* the merge or integration function of the toy CRDT
- **Done when:** the convergence property passes for thousands of random runs on both the toy CRDT and Yjs, and I can explain why it works.

### M2 · The editor, local-first (~10–12 h)
- Next.js shell, CodeMirror 6 with Yjs, IndexedDB persistence
- Two browser tabs syncing through `BroadcastChannel`, with no server yet
- **Done when:** two tabs edit the same file live, and a reload keeps the content.

### M3 · Sync server v1 (~20 h)
- `protocol`, `sync-client` and `sync` from 5.2–5.4, without persistence or auth yet (in-memory rooms)
- Reconnection, heartbeats, close codes, `ack`, limits, backpressure, fuzz tests
- *Suggested learner task:* the client's reconnection policy (close code → action, backoff with jitter)
- **Done when:** two browsers on different machines edit together through the server, survive a server restart, and the fuzz tests pass.

### M3.5 · Early deploy (~4–6 h)
- Sync server on Fly (one machine), web on Vercel, behind TLS
- Verify WebSocket upgrades, idle timeouts and drain (1012) through Fly's proxy
- **Done when:** two people on different networks edit together through the deployed server.

### M4 · Persistence (~12–15 h)
- Everything in 5.5 except version history: update log, batching, load path, compaction
- *Suggested learner task:* the compaction transaction
- **Done when:** documents survive a full restart of everything, and the crash-before-flush recovery test passes.

### M5 · Auth, projects and permissions (~15 h)
- 5.6: better-auth with GitHub, projects, members, hashed share links, room tokens, per-message authorisation (incl. sync step 2), pushed revocation, rate limits
- *Suggested learner task:* the per-message authorisation check in the sync server
- **Done when:** a viewer link gives read-only access enforced **by the server** (proven by a test that sends raw update and step 2 messages as a viewer), and revoking a link disconnects that user immediately.

### M6 · Collaboration UX (~15–20 h)
- 5.7: cursors, selections, presence, follow mode, collaborative file tree, sync status, devtools panel with offline and latency controls
- Version history and per-file restore (5.5)
- Playwright multi-user e2e suite
- **Done when:** the e2e suite covers concurrent editing, offline merge, viewer read-only and follow mode on Chromium, Firefox, WebKit and Edge.

### M7 · Scale and observability (~15–20 h)
- Redis pub/sub between two or more sync instances, single writer per document, periodic state-vector reconciliation (ADR weighs room-affinity routing)
- OpenTelemetry, Prometheus metrics, the Grafana dashboard, Sentry
- k6 load tests, the propagation-latency harness, the chaos test
- `docs/load-test-report.md` with real numbers
- **Done when:** two instances serve the same room (users connected to different instances see each other's edits), killing an instance loses zero acknowledged edits, and the report has measured numbers with specs.

### M8 · Deploy, release and docs (~12–15 h)
- ADR on hosting (why the sync server isn't serverless)
- Production deploy: web on Vercel, two or more sync machines on Fly, managed Postgres and Redis, secrets, rolling deploys with drain, backups with a tested restore, uptime monitoring
- Choose and register the domain
- A public demo room: seeded, rate-limited, reset nightly
- README demo video, `DESIGN.md`, runbook, protocol docs
- **Done when:** the live URL works for people on different networks, a deploy during an active session loses nothing, and the docs are complete.

### M9 · Optional extras
- 5.8: GitHub import, comments, TypeScript IntelliSense

---

## 10. Portfolio deliverables

When M8 ships, help me produce:

- **Demo video (60–90 s):** two windows side by side, live cursors and follow mode, "Simulate offline" on both, conflicting edits made while offline, reconnect, a clean merge, then a version-history restore. End on the Grafana dashboard during a load test.
- **Real metrics only:** the propagation latency p95, connections per instance, the chaos-test result, and any real usage, recorded in `docs/metrics.md` with dates.
- **Technical post** (outline it with me, but I write it): "What happens to your keystroke in a collaborative editor". Cover CRDTs from first principles (using the M1 lab), the two-step sync, reconnection, scaling with pub/sub, and the chaos test.
- **Resume bullet** (draft three options I can choose from), following problem → technology → measured result.
- **Getting first users:** tutoring sessions, study groups and pair-programming practice are natural fits. List honest places to share it (relevant subreddits, Discord communities, dev.to, the Show HN guidelines) and what feedback to ask for.

---

## 11. Definition of done for v1 (production-ready checklist)

- [ ] Milestones M0–M8 merged, with CI green
- [ ] Convergence property tests, protocol fuzz tests and the Playwright multi-user suite all pass
- [ ] Viewer read-only enforced server-side, proven by a raw-message test (update and sync step 2)
- [ ] Revocation disconnects immediately, proven by a test
- [ ] Chaos test: killing an instance mid-session loses zero acknowledged edits (shown with output)
- [ ] Load-test report with measured p95 propagation latency, capacity per instance and instance specs
- [ ] Grafana dashboard and runbook complete; backup restore tested once
- [ ] Live deployment with a public demo room; a deploy during an active session loses nothing
- [ ] README demo video, `DESIGN.md`, protocol docs and ADRs complete
- [ ] `SECURITY.md`, `CONTRIBUTING.md` and the code of conduct in place
- [ ] At least 3 people other than me have used it in a real session, with their feedback recorded in `PROGRESS.md`

---

## 12. First session

1. Read this whole file. List any part of the spec that's unclear, contradictory or that you'd push back on as a senior engineer (e.g. a latency budget you think is unrealistic), and tell me before starting.
2. Confirm the **Project settings** are filled in. Check the domain idea and suggest alternatives if needed.
3. Check the git remote uses the SSH alias in `github_repo`, and that `gh auth status` shows the right account.
4. Begin **M0** in pair mode: explain the concepts (pnpm workspaces, Turborepo pipelines, why the sync server is a separate long-running app), propose the plan, and wait for my approval.

*(Completed 2026-11-26; outcomes recorded in §0.)*
