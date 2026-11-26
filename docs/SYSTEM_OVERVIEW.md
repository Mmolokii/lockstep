# Lockstep — System Overview

**A real-time collaborative code editor, built and run like a production system**

| | |
|---|---|
| **Owner** | Mmoloki Kgololosego |
| **Status** | Living document · companion to [`docs/BUILD_PROMPT.md`](BUILD_PROMPT.md) (the build sequence) and [`docs/process/project-management.md`](process/project-management.md) (how the work is run) |
| **Audience** | Me, reviewers, interviewers: anyone who wants to understand *what* Lockstep is and *how* it's engineered |

> **Reconciliation (2026-11-26).** This overview was drafted separately from the build prompt. Where they disagreed, it now follows the decisions in `BUILD_PROMPT.md` §0, plus four changes made while merging the two:
> 1. **Edits are acknowledged.** The server sends `ack { stateVector }`. "Synced" and "no acknowledged edit is lost" both mean edits covered by an ack (§3, §5).
> 2. **One writer per document** when several instances share a room, plus periodic state-vector reconciliation, because Redis pub/sub is at-most-once (§2, §3, §6).
> 3. **Readiness doesn't depend on shared dependencies.** If Redis or Postgres is down, every instance sees the same failure. Failing `/readyz` would pull *all* instances out of rotation and turn a partial degradation into a full outage. Instances stay ready, run degraded and raise alerts instead (§5). An ADR records this in M3.
> 4. **WebKit, not Safari.** Playwright tests WebKit as Safari's stand-in. **No Changesets:** Lockstep is an app, not published packages, so release notes are generated from conventional commits on tagged GitHub Releases (§4, §10, §11).

---

## Contents

1. [What Lockstep is](#1-what-lockstep-is)
2. [Architecture at a glance](#2-architecture-at-a-glance)
3. [The life of a keystroke](#3-the-life-of-a-keystroke)
4. [Technology stack](#4-technology-stack)
5. [Reliability: SLOs, error budgets and failure modes](#5-reliability-slos-error-budgets-and-failure-modes)
6. [Scaling model](#6-scaling-model)
7. [Security](#7-security)
8. [Data management and privacy](#8-data-management-and-privacy)
9. [Environments](#9-environments)
10. [CI/CD and release engineering](#10-cicd-and-release-engineering)
11. [Testing strategy](#11-testing-strategy)
12. [Observability](#12-observability)
13. [Incident management](#13-incident-management)
14. [Engineering process and code quality](#14-engineering-process-and-code-quality)
15. [Documentation system](#15-documentation-system)
16. [Measuring engineering health: DORA metrics](#16-measuring-engineering-health-dora-metrics)
17. [Cost management](#17-cost-management)
18. [Right-sizing: what a solo project does vs a large team](#18-right-sizing-what-a-solo-project-does-vs-a-large-team)
19. [Glossary](#19-glossary)

---

## 1. What Lockstep is

Lockstep is a browser-based code editor where several people edit the same project at the same time. You see each other's cursors live, you can keep typing while offline, and everything merges cleanly when you reconnect.

### Core features (v1)

- GitHub sign-in, projects, and share links with **editor** or **viewer** roles
- A collaborative file tree and a syntax-highlighted code editor
- Live cursors, selections and presence, plus **follow mode**
- **Offline editing** with automatic, conflict-free merging
- **Version history** with diff and per-file restore
- Download a project as a zip
- **Reviewer demo controls:** "Simulate offline", an added-latency slider, and a sync devtools panel

### Why it's a serious engineering project

Making the editor itself is the easy part. The hard part is the distributed system underneath:

| Hard problem | What it really means |
|---|---|
| **Convergence** | Two people edit the same line at the same moment. Every screen must end up identical, with nobody's work lost. |
| **Offline and reconnection** | A laptop goes offline for an hour and keeps editing. When it comes back, only the missing changes are exchanged in each direction. |
| **Durability** | A server crashes halfway through saving. No acknowledged edit is lost. |
| **Horizontal scaling** | Two users in the same room are connected to *different* servers, and still see each other instantly. |
| **Security** | A viewer who crafts raw WebSocket messages still can't change a single character. |
| **Operability** | Deploying a new version during a live session disconnects nobody's work. |

### Engineering principle

> Use a proven CRDT library (**Yjs**) for the maths of merging. Build **everything around it** ourselves: the sync server, protocol handling, persistence, auth, scaling and observability. That's where the real-world engineering lives.

---

## 2. Architecture at a glance

```
┌──────────────────────────── Browser ────────────────────────────┐
│  Next.js UI ── CodeMirror 6 editor ── Y.Doc (one per file)       │
│                         │                                        │
│  sync-client: auth · reconnection · heartbeats · status         │
│  IndexedDB: local copy of every open document (offline)          │
└──────────────┬──────────────────────────────────┬────────────────┘
               │ HTTPS                             │ WebSocket (binary)
               ▼                                   ▼
┌─────────────────────────┐        ┌──────────────────────────────────┐
│ web (Next.js on Vercel) │        │ sync servers (Node on Fly.io, 2+)│
│ · GitHub OAuth sessions │ token  │ · rooms held in memory           │
│ · projects, members     │──────▶ │ · per-message authorisation      │
│ · share links           │ (signed│ · rate and size limits           │
│ · issues room tokens    │  JWT)  │ · acks · single writer per doc   │
│ · publishes revocations │        │ · batching writes to Postgres    │
└────────────┬────────────┘        └────┬──────────────────┬──────────┘
             │                          │  Redis pub/sub   │
             │                          └──────────────────┘
             ▼                                   ▼
        ┌──────────────────────────────────────────────┐
        │ Postgres: users · projects · update log ·    │
        │ snapshots · versions                         │
        └──────────────────────────────────────────────┘

     Prometheus + Grafana (metrics) · OpenTelemetry (traces) · Sentry (errors)
```

### Components

| Component | Responsibility | Why it's separate |
|---|---|---|
| **web** | Auth, projects, sharing, issuing room tokens, the UI | Request/response work that suits serverless hosting |
| **sync** | Long-lived WebSockets, rooms, merging, persistence | WebSockets need long-running processes, which serverless platforms don't provide |
| **protocol** | Message formats and close codes | One source of truth shared by client and server |
| **sync-client** | Connection lifecycle in the browser | Keeps the UI independent of networking details |
| **Postgres** | Durable storage | Relational data plus the append-only update log |
| **Redis** | Pub/sub between sync instances, revocation events | Lets a room span several servers |

### Key architectural decisions

Each of these gets an Architecture Decision Record (ADR) in `docs/adr/`.

| Decision | Choice | Main alternative | Why |
|---|---|---|---|
| Merge algorithm | CRDT (Yjs), [ADR 0003](adr/0003-use-yjs-as-the-crdt.md) | Operational transformation (OT) | No central server needed to order edits; works offline by design |
| Editor | CodeMirror 6 | Monaco | Smaller bundle, mobile support, modular, good Yjs binding |
| Document granularity | One Y.Doc per file + one for the file tree | One giant doc per project | Load only the files in use; smaller rooms in memory |
| Socket auth | Short-lived signed token in the first message | Cookie on upgrade, or token in the URL | Works across domains; URLs leak into logs |
| Scaling | Redis pub/sub fan-out, single writer per document, periodic reconciliation | Route each room to one server (consistent hashing) | Any server can take any client; the writer lock prevents duplicate writes |
| Persistence | Update log + periodic snapshots | Save the whole document on every change | Cheap writes, fast loads, compaction keeps it bounded |

---

## 3. The life of a keystroke

What happens when Alice types `x` and Bob sees it:

1. **Local first.** CodeMirror applies the change to Alice's screen instantly. Typing never waits on the network.
2. **CRDT update.** The Yjs binding turns the change into a small binary *update* with a unique ID, and writes it to IndexedDB.
3. **Send.** `sync-client` sends the update over the WebSocket. If offline, it queues it, and the status shows "Offline · 1 pending change".
4. **Authorise.** Alice's sync server checks that her role allows edits. A viewer's update, or a viewer's sync step 2 carrying updates, would be rejected here and the connection closed with code `4403`.
5. **Apply, acknowledge and fan out.** The server applies the update to the room's Y.Doc in memory, sends Alice an `ack` with its state vector, sends the update to every client in the room on this server, and publishes it to Redis.
6. **Cross-server.** Bob is connected to a different sync server. It receives the update from Redis, applies it, and sends it to Bob.
7. **Bob's screen.** Bob's Y.Doc merges the update. Even if Bob typed on the same line in the same instant, the CRDT guarantees both screens end up identical.
8. **Persist.** The instance holding the document's writer lock batches the update with others and writes them to Postgres within about 500 ms.
9. **Compaction (later).** Once enough updates pile up, the writer merges them into a snapshot so loading stays fast.

**Budget:** step 1 to step 7 under 100 ms (p95) within one region, measured by headless harness clients in the server's region.

**Safety net:** if a server crashes between steps 5 and 8, nothing is lost. Alice's browser still has the update, and when she reconnects, the two-step sync handshake sends the server whatever it's missing. Alice's status only shows "synced" once an `ack` covers her edits.

---

## 4. Technology stack

| Layer | Technology |
|---|---|
| Language | TypeScript (strict) everywhere |
| Frontend | Next.js (App Router), React, CodeMirror 6, Tailwind |
| Collaboration | Yjs, y-protocols, y-codemirror.next, y-indexeddb |
| Realtime server | Node.js + `ws` |
| Auth | better-auth (GitHub OAuth), signed short-lived room tokens |
| Data | PostgreSQL + Drizzle ORM, Redis (pub/sub) |
| Validation | Zod at every API boundary |
| Hosting | Vercel (web), Fly.io in Johannesburg (sync + Redis 8), Neon Postgres in Frankfurt ([ADR 0010](adr/0010-hosting-fly-johannesburg.md)) |
| Observability | OpenTelemetry, Prometheus, Grafana, Sentry, structured JSON logs |
| Testing | Vitest, fast-check, Playwright, k6 |
| Tooling | pnpm workspaces, Turborepo, Biome |
| CI/CD | GitHub Actions, CodeQL, Dependabot, tagged GitHub Releases with generated notes |
| Local dev | Docker Compose (Postgres, Redis, 2 sync instances, Prometheus, Grafana) |

The system follows the **Twelve-Factor App** principles: configuration in environment variables, stateless web processes, backing services (Postgres, Redis) treated as attached resources, logs as event streams, and identical builds across environments.

---

## 5. Reliability: SLOs, error budgets and failure modes

### Service Level Objectives

An **SLI** (indicator) is what you measure. An **SLO** (objective) is the target. The **error budget** is how much failure the target allows.

| SLI | SLO (monthly) | How it's measured |
|---|---|---|
| Sync availability: successful WebSocket connections ÷ attempts | **99.5%** | Prometheus counters |
| Edit propagation latency, A → B | **p95 under 100 ms** within a region | A latency harness that timestamps edits |
| Durability: acknowledged edits lost | **Zero** | Chaos tests + reconciliation checks |
| Web availability: successful page and API responses | **99.5%** | Uptime monitor + Vercel metrics |

**Error budget:** 99.5% availability allows about **3.6 hours of downtime a month** (720 h × 0.5%). While budget remains, ship features. When it's burnt, stop and work on reliability. That's the same trade-off rule large engineering teams use.

### Failure modes and recovery

| Failure | What users experience | How the system recovers |
|---|---|---|
| A sync instance crashes | A brief "Reconnecting…" | Clients reconnect to another instance with backoff and jitter; the handshake restores any edits not yet saved |
| Deploying a new sync version | Nothing noticeable | Rolling deploy: each instance drains, closes clients with `1012`, and they reconnect elsewhere |
| Redis is down | Users on different servers stop seeing each other; users on the same server still collaborate | Instances stay ready (Redis is shared, so failing readiness would drain every instance) and run degraded; a dependency alert fires; instances reconcile state vectors when Redis returns |
| Postgres is down | Editing continues in open rooms; the "saving" indicator stays on | Writes are buffered in memory up to a limit, then new rooms are refused to protect existing ones; flushed on recovery |
| A user's network drops | "Offline · N pending changes" | Edits persist in IndexedDB and sync on reconnect |
| A slow client falls behind | That client is disconnected and re-syncs | Backpressure protects server memory |
| A malformed or malicious message | The sender is disconnected (`4400`) | Fuzz-tested parsing; the server never crashes |
| A viewer tries to edit with raw messages | Rejected (`4403`) | Permissions are checked on every message, including sync step 2 |
| Access is revoked mid-session | Disconnected with "access removed" (`4403`) | Revocation events are pushed to sync servers immediately |
| Database corruption or accidental deletion | Restore from backup | Point-in-time recovery if the plan supports it; the procedure is tested and in the runbook |

### Resilience patterns used

- **Exponential backoff with jitter** on every reconnect and retry, so clients don't stampede a recovering server
- **Heartbeats** to detect half-open connections
- **Backpressure** and **load shedding** under overload
- **Graceful shutdown and connection draining**
- **Bulkheads:** per-connection rate limits and per-document size limits, so one bad actor can't sink a server
- **Idempotent writes:** applying the same CRDT update twice changes nothing, so retries are always safe

---

## 6. Scaling model

### How it scales

- **web** scales automatically on Vercel; it's stateless.
- **sync** scales horizontally: add more instances. Each instance holds only the rooms its clients are in. Redis pub/sub carries updates between instances, so any client can connect to any server. Exactly one instance (the holder of the document's writer lock) persists and compacts each document.

### Capacity planning

Capacity numbers come from **load tests, never guesses**. The k6 report records:

- Connections per instance before p95 latency exceeds 100 ms
- Memory per active room and per connection
- Messages per second per instance
- **The bottleneck** (CPU, memory, event-loop lag, Redis or Postgres) and what would fix it

### When the design would change

| Signal | Next step |
|---|---|
| Redis fan-out traffic dominates | Route each room to one instance (consistent hashing), so most updates never leave the server |
| Very large documents | Lazy-load files, cap document size, compact more aggressively |
| Users in many regions | Regional sync clusters, with rooms pinned to the region of their first user |

Writing down *when* you'd change a design is a senior-engineer habit. It shows you understand the trade-offs, not just the current choice.

---

## 7. Security

### Threat model (STRIDE)

Assets to protect: **document contents** (which may include secrets people paste into code), sessions, room tokens, share links, and service availability.

| Threat | Example | Mitigation |
|---|---|---|
| **S**poofing | Connecting to a room as someone else | Signed, short-lived room tokens tied to user, room and role; GitHub OAuth for identity |
| **T**ampering | A viewer sends raw update messages | Per-message authorisation on the server; never trust the client |
| **R**epudiation | "I didn't delete that file" | Audit log of membership, sharing and restore actions with user and timestamp |
| **I**nformation disclosure | Guessing share links; message contents in logs | 128-bit random link tokens stored hashed; contents never logged; TLS everywhere |
| **D**enial of service | Flooding updates; huge documents | Rate limits, message and document size caps, backpressure, connection limits |
| **E**levation of privilege | A viewer promoting themselves | Roles checked server-side on every API call and message; role changes audited |

### Application security controls

- **Authentication:** GitHub OAuth through better-auth; secure, `HttpOnly`, `SameSite` session cookies
- **Authorisation:** checked in the API layer and in the sync server, at connect *and* per message
- **Tokens:** room tokens expire in minutes, are signed with asymmetric keys (sync servers hold only the public key), and are never put in URLs
- **Share links:** high-entropy, hashed at rest, expirable, revocable; revoking one disconnects live sessions
- **Input validation:** every API input validated with Zod; file paths checked (no `..`, length limits)
- **Web hardening:** strict Content Security Policy, CSRF protection, output escaping, security headers
- **OWASP Top 10:** reviewed against the current list before launch, with findings recorded in `docs/security-review.md`

### Supply-chain and platform security

| Control | Purpose |
|---|---|
| Committed lockfile + `pnpm install --frozen-lockfile` in CI | Builds use exactly the reviewed dependencies |
| Dependabot | Automatic dependency update PRs |
| CodeQL code scanning | Finds vulnerable patterns in our code |
| GitHub secret scanning + push protection | Blocks committed credentials |
| GitHub Actions pinned to commit SHAs, minimal `GITHUB_TOKEN` permissions | Limits the damage of a compromised action |
| OIDC from CI to cloud providers wherever supported; where it isn't (Fly.io), scoped deploy tokens with an expiry, held in GitHub Environment secrets | No long-lived, broad deploy keys |
| SBOM generated on release (e.g. CycloneDX) | A record of exactly what shipped |
| A repository ruleset: required checks, PR required, linear history, squash only, no bypass ([branch-protection.md](branch-protection.md)) | Nothing reaches `main` untested |
| `SECURITY.md` | Tells people how to report vulnerabilities privately |

### Secrets management

- Local: `.env` files, gitignored, with a committed `.env.example`
- CI: GitHub Actions secrets, scoped to environments
- Production: the hosting platforms' secret stores (Vercel, Fly), never in the repo or images
- Key rotation for the token-signing keys documented in the runbook

---

## 8. Data management and privacy

### What's stored

| Data | Where | Retention |
|---|---|---|
| Account (GitHub ID, name, avatar, email) | Postgres | Until the account is deleted |
| Projects, members, share links | Postgres | Until deleted |
| Document updates and snapshots | Postgres | Updates compacted into snapshots; all deleted with the project |
| Versions | Postgres | Until deleted, or a configured cap per document |
| Audit log | Postgres | Retention to be set with the privacy notice |
| Logs | Logging platform | Short retention (e.g. 14–30 days); never contain document contents |

### Backups and disaster recovery

- **RPO** (how much data could be lost): as low as the managed database plan allows, ideally minutes via point-in-time recovery. Document the *actual* figure for the chosen plan. Clients holding documents locally reduce real-world loss further.
- **RTO** (how long recovery takes): target under 1 hour.
- The restore procedure is **tested at least once** and written in the runbook. An untested backup isn't a backup.

### Privacy

- **Data minimisation:** collect only what's needed to run the product.
- **Deletion:** deleting a project or account removes all related data, including documents, updates, snapshots and versions.
- **South Africa's POPIA** (Protection of Personal Information Act) applies to personal information of South African users. Publish a short privacy notice that says what's collected, why, and how to request deletion. Get proper advice before any commercial use.

---

## 9. Environments

| Environment | Purpose | Web | Sync | Data |
|---|---|---|---|---|
| **Local** | Development | `pnpm dev` | 2 instances in Docker Compose | Local Postgres and Redis containers |
| **Preview** | Review every PR | Vercel preview deploy per PR | Shared staging sync | Staging database (seeded test data) |
| **Staging** | Final check before production | Staging deploy | 1–2 small instances | Separate database, never production data |
| **Production** | Real users | Vercel production | 2+ instances | Managed Postgres with backups |

Rules: **production data never leaves production**; every environment is configured entirely by environment variables; staging mirrors production's shape at a smaller size. GitHub OAuth on per-PR preview URLs needs its own design (a spike in M5).

---

## 10. CI/CD and release engineering

### Branching

**Trunk-based development:** short-lived branches, small PRs, merged to `main` frequently behind green checks. `main` is always deployable.

### Pipelines

```
PR opened ──▶ ci.yml ──────────▶ typecheck · lint · unit + integration (Postgres/Redis services) · build
          ├─▶ pr-hygiene.yml ──▶ conventional title · linked issue
          ├─▶ e2e.yml ─────────▶ Playwright multi-user suite against Docker Compose
          ├─▶ load.yml ────────▶ k6 smoke test (PRs touching sync/protocol)
          ├─▶ codeql.yml ──────▶ security scanning
          └─▶ Vercel preview ──▶ link posted on the PR

Merge to main ──▶ deploy.yml
                    1. run database migrations (backward-compatible only)
                    2. deploy sync to staging → smoke tests
                    3. deploy web to staging → smoke tests
                    4. promote to production (sync: rolling with drain; web: atomic)
                    5. post-deploy smoke test + watch error rate and SLO dashboards
```

### Deployment strategies

| Concern | Approach |
|---|---|
| **Zero-downtime sync deploys** | Rolling restart: health checks gate each new instance; old instances drain with close code `1012` |
| **Web deploys** | Vercel's atomic deploys with instant rollback |
| **Database migrations** | **Expand → migrate → contract:** add new columns or tables first (compatible with old code), deploy code that uses them, then remove old ones in a later release. Never a breaking migration in the same deploy as the code that needs it. |
| **Risky features** | Behind **feature flags** so they can be switched off without a deploy |
| **Rollback** | Web: one click. Sync: redeploy the previous image. Migrations are designed so rollback never requires undoing a schema change. |
| **Versioning** | Semantic version tags, GitHub Releases with notes generated from conventional commits |

---

## 11. Testing strategy

| Level | What it covers | Tools | Gate |
|---|---|---|---|
| **Static** | Types, lint, formatting | TypeScript, Biome | Every PR |
| **Unit** | Protocol encoding, reconnection policy, permission checks, compaction logic | Vitest | Every PR; coverage 90% on protocol, sync-client and sync |
| **Property-based** | CRDT convergence under random concurrent edits and message orders | fast-check | Every PR |
| **Fuzz** | Malformed and truncated binary messages never crash the server | fast-check / custom fuzzer | Every PR |
| **Integration** | Real WebSocket clients against a real server, Postgres and Redis | Vitest + service containers | Every PR |
| **End-to-end** | 2–3 browsers editing together, offline merge, viewer read-only, follow mode | Playwright (Chromium, Firefox, WebKit, Edge) | Every PR |
| **Load** | Connections, rooms, propagation latency, saturation point | k6 | Smoke per PR; full on demand |
| **Chaos** | Kill an instance mid-session; Redis or Postgres outages | Scripts against Docker Compose and staging | Before each release |
| **Security** | Code scanning, dependency audit, a raw-message authorisation test | CodeQL, `pnpm audit`, integration tests | Every PR |
| **Accessibility** | Keyboard use, labels, contrast | axe via Playwright | Every PR |

**Principle:** each bug fixed gets a test that would have caught it.

---

## 12. Observability

### The three pillars

| Pillar | Lockstep implementation |
|---|---|
| **Metrics** | Prometheus: connections, rooms, messages per second by type, update bytes, flush latency, compaction time, propagation-latency histogram, rejected messages by reason, reconnects, event-loop lag, memory |
| **Logs** | Structured JSON with request and connection IDs and severity. **Never document contents.** |
| **Traces** | OpenTelemetry across the web API, token issuing, sync connection and persistence. A trace ID is passed in the socket's auth message so one connection can be followed end to end. |

### The four golden signals for the sync server

| Signal | Metric |
|---|---|
| **Latency** | Edit propagation p50, p95, p99; flush latency |
| **Traffic** | Active connections, messages per second |
| **Errors** | Failed connections, rejected messages, close codes by type |
| **Saturation** | Event-loop lag, memory, buffered bytes per socket, Postgres connection pool |

### Dashboards and alerts

- The Grafana dashboard is **committed as code**, so it's reviewed and versioned like everything else.
- **Alert on symptoms users feel, not every cause:** SLO burn rate, propagation p95 over budget, connection success below target, persistence backlog growing, a shared dependency (Redis, Postgres) unreachable.
- Every alert links to a runbook section that says what to check first.
- Errors go to Sentry, with releases tagged so you can see which deploy introduced them.

---

## 13. Incident management

Even a one-person project benefits from practising this. It's exactly what interviewers ask about.

| Severity | Definition | Response |
|---|---|---|
| **SEV1** | Data loss, or nobody can edit | Drop everything; post status updates; postmortem required |
| **SEV2** | Major feature broken or SLO burning fast | Fix same day; postmortem required |
| **SEV3** | Minor degradation | Fix in normal work |

**Process:** detect (alert) → triage (severity) → mitigate (roll back first, investigate second) → resolve → **blameless postmortem**.

**Postmortem template** ([`docs/postmortems/0000-template.md`](postmortems/0000-template.md), copied to `docs/postmortems/YYYY-MM-DD-title.md`): summary, impact, timeline, root cause, what went well, what went badly, action items with owners and dates. Blameless means the question is "what let this happen?", not "who did it?".

---

## 14. Engineering process and code quality

| Practice | How it's done |
|---|---|
| **Design before code** | Significant features start with a short design doc (an RFC) in `docs/rfcs/`; decisions recorded as ADRs |
| **Small PRs** | Aim for under ~400 changed lines; one concern per PR |
| **Code review** | PR template: what, why, how tested, risk, rollback plan. Solo, review your own PR the next day with fresh eyes, against a checklist. |
| **Conventional commits** | `feat:`, `fix:`, `perf:` and so on, so release notes write themselves |
| **Branch protection** | Required status checks; no direct pushes to `main` |
| **CODEOWNERS** | Declares ownership (useful once contributors arrive) |
| **Definition of done** | See [project management](process/project-management.md#definition-of-done) |
| **Tech debt register** | Known shortcuts tracked as `type:tech-debt` issues, summarised in `PROGRESS.md` |
| **Performance budgets** | Latency and bundle-size budgets checked in CI |
| **Accessibility** | Keyboard-first, screen-reader labels, never colour alone |

---

## 15. Documentation system

| Document | Answers |
|---|---|
| `README.md` | What is it, can I see it, how do I run it? (demo video at the top) |
| `DESIGN.md` | How does it work, and why is it built this way? |
| `docs/adr/` | Why was each key decision made, and what were the alternatives? |
| `docs/rfcs/` | How were larger features designed before being built? |
| `docs/protocol.md` | What exactly goes over the wire, and what do the close codes mean? |
| `docs/runbook.md` | How do I deploy, roll back, drain, restore, and respond to each alert? |
| `docs/load-test-report.md` | What are the real performance numbers, and where's the bottleneck? |
| `docs/security-review.md` | What was checked, what was found, what was fixed? |
| `docs/postmortems/` | What went wrong, and what changed because of it? |
| `docs/process/project-management.md` | How is the work planned, tracked and finished? |
| `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` | Community and disclosure basics |

Documentation lives **in the repo** and is reviewed in PRs, so it changes with the code instead of going stale.

---

## 16. Measuring engineering health: DORA metrics

The four DORA metrics are the industry standard for how well a team delivers software. Tracking them on a personal project is unusual, and it makes a strong interview story.

| Metric | Meaning | Target for Lockstep |
|---|---|---|
| **Deployment frequency** | How often production is deployed | Several times a week during active development |
| **Lead time for changes** | Commit to running in production | Under a day |
| **Change failure rate** | % of deploys causing an incident or rollback | Under 15% |
| **Time to restore** | How quickly service recovers from a failure | Under 1 hour |

Measure them from GitHub and deploy history, starting with the first deploy (M3.5), and record them in `docs/metrics.md`.

---

## 17. Cost management

- Stay on **free or hobby tiers** where possible: Vercel, Neon, Upstash, Grafana Cloud's free tier, Sentry's developer plan. Fly.io sync machines are the main likely cost, kept small (and stopped in staging when idle).
- Set **billing alerts** on every provider.
- The public demo room is rate-limited and resets nightly, so it can't run up storage or bandwidth.
- Record the monthly cost in `docs/metrics.md`. "I ran a multi-region-ready realtime system for R___ a month" is a good line in itself.

---

## 18. Right-sizing: what a solo project does vs a large team

Big companies run all of these practices at scale. For a solo portfolio project, the goal is to **implement the ones that matter, and show you understand the rest**.

| Practice | Lockstep does it fully | Lockstep does a lightweight version | Large company |
|---|---|---|---|
| Tests, CI, branch protection | ✅ | | Same |
| ADRs, design docs | ✅ | | Same, plus formal review meetings |
| SLOs and error budgets | | ✅ Defined, measured, on a dashboard | Org-wide policy, paging |
| Observability | ✅ Metrics, logs, traces, dashboard | | Dedicated platform teams |
| Chaos testing | | ✅ Scripted failure drills | Continuous automated chaos |
| Incident management | | ✅ Runbook, postmortem template, practice drill | 24/7 on-call rotations |
| Infrastructure as code | | ✅ Fly config + Docker Compose in the repo | Terraform or Pulumi for everything |
| Security | ✅ Threat model, scanning, authZ tests | | Pen tests, bug bounty, security team |
| Multi-region | | 📝 Documented as a future design | Active-active across regions |
| Compliance | | 📝 Privacy notice, deletion | Formal audits (SOC 2, ISO 27001) |

✅ built and working · 📝 designed and documented, not built

---

## 19. Glossary

| Term | Meaning |
|---|---|
| **CRDT** | Conflict-free Replicated Data Type: a data structure where copies edited independently always merge to the same result |
| **OT** | Operational Transformation: the older approach (used by Google Docs) that rewrites concurrent edits through a central server |
| **Y.Doc** | A Yjs document: the shared data structure each client and server holds |
| **State vector** | A compact summary of which updates a copy has seen, used to work out what's missing |
| **Two-step sync** | Each side sends its state vector, then the other replies with only the missing updates |
| **Ack** | Lockstep's control message telling a client which of its updates the server has applied; the basis of "synced" |
| **Awareness** | Ephemeral presence data: cursors, selections, names. Not saved. |
| **Fan-out** | Sending one message to many recipients |
| **Backpressure** | Slowing or disconnecting a consumer that can't keep up, to protect the system |
| **SLI / SLO / SLA** | Indicator (what you measure) / objective (your target) / agreement (a promise to customers, with consequences) |
| **Error budget** | The amount of failure an SLO allows; spent on shipping, earned back by reliability work |
| **RPO / RTO** | Recovery Point Objective (max data loss) / Recovery Time Objective (max downtime) |
| **Expand–contract** | Changing a database schema in backward-compatible steps across releases |
| **Blameless postmortem** | An incident review focused on system causes, not individual fault |
| **DORA metrics** | Four measures of software delivery performance |
| **STRIDE** | A threat-modelling checklist: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege |
| **SBOM** | Software Bill of Materials: a list of every dependency in a release |
| **OIDC (in CI)** | Lets CI prove its identity to a cloud provider without storing long-lived secrets |
