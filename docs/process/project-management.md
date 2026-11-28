# How Lockstep is run

> The operating manual for planning, tracking and finishing work on Lockstep. **Board:** [github.com/users/Mmolokii/projects/5](https://github.com/users/Mmolokii/projects/5). GitHub Issues and Projects are the system of record, and `PROGRESS.md` carries the narrative. If this document and the board disagree, fix one of them the same day.

**Contents**

1. [The map: workstreams → milestones](#1-the-map-workstreams--milestones)
2. [GitHub setup](#2-github-setup)
3. [Working process](#3-working-process)
4. [Prioritisation](#4-prioritisation)
5. [Phase 1 backlog](#5-phase-1-backlog)
6. [Operating rules](#6-operating-rules)

---

## 1. The map: workstreams → milestones

### Three levels, and nothing else

| Level | GitHub object | Lifetime | Rule |
|---|---|---|---|
| **Epic** (workstream) | Issue labelled `type:epic`, with its work as **sub-issues** | Whole project | Describes an outcome and owns a cross-cutting concern. Never "done" by a single PR. |
| **Milestone** (delivery phase) | GitHub **milestone** with a due date and exit criteria | 1–3 weeks | A demoable or verifiable increment. Closed only when its exit criteria are met. |
| **Issue** (story or task) | Issue, sub-issue of exactly one epic, assigned to exactly one milestone | ≤ 2 days of work | INVEST: independent, negotiable, valuable, estimable, **small**, testable. |

Epics cut across milestones, and milestones cut across epics. An issue sits at one intersection. Example: "per-message authorisation" belongs to epic **E5 Access control** and milestone **M5**.

### Workstreams (epics)

Product features are kept apart from reliability, security, observability, platform and process work, so the non-feature work is visible and can't quietly be skipped.

| # | Epic | Kind | Owns (cross-cutting) | Code and docs it owns |
|---|---|---|---|---|
| E1 | Collaborative editor | Product | Editor UX, accessibility | `packages/editor`, `apps/web` editor views |
| E2 | Sync protocol | Cross-cutting | **The wire contract**: message formats, close codes, versioning | `packages/protocol`, `docs/protocol.md` |
| E3 | Sync server | Product / core | Rooms, sync, limits, lifecycle | `apps/sync` |
| E4 | Sync client | Product / core | Connection state, reconnection, truthful status | `packages/sync-client` |
| E5 | Identity and access control | Security | **Auth and authorisation everywhere** (web API and sockets), share links, revocation, audit | `apps/web` auth/API, sync auth path |
| E6 | Persistence and durability | Cross-cutting | **Storage, schema, migrations**, the durability guarantee | `packages/db`, sync persistence |
| E7 | Collaboration UX | Product | Presence, cursors, follow mode, file tree, status, devtools | `packages/editor`, `apps/web` |
| E8 | Version history and export | Product | Snapshots, diff, restore, zip | sync and web history paths |
| E9 | Horizontal scaling | Cross-cutting | Multi-instance correctness (fan-out, writer lock, reconciliation) | sync scaling layer |
| E10 | Observability | Cross-cutting | Metrics, logs, traces, dashboards, alerts, SLOs | `infra/grafana`, telemetry modules |
| E11 | Reliability and resilience | Cross-cutting | **Failure modes**, drain, chaos tests, error budgets | `loadtest/chaos`, runbook |
| E12 | Security and privacy | Cross-cutting | Threat model, web hardening, supply chain, POPIA, security review | `SECURITY.md`, `docs/security-review.md` |
| E13 | Platform, CI/CD and environments | Platform | Deploys, environments, secrets, IaC, releases | `.github/workflows`, `infra/` |
| E14 | Performance and capacity | Cross-cutting | Latency budget, load tests, capacity numbers | `loadtest/`, `docs/load-test-report.md` |
| E15 | Engineering process and docs | Process | This document, DORA, runbook structure, templates | `docs/process`, `docs/runbook.md` |
| E16 | Launch and portfolio | Product | Demo room, video, README, real users, metrics | `README.md`, `docs/metrics.md` |
| — | ~~E0 Foundations and CRDT lab~~ | — | Done (M0 #1, M1 #2) | — |

**Owning a cross-cutting concern** means two things. Any issue that touches the concern gets that epic's area label as well as its own. And the epic's DoD checklist applies to it. For example, any PR that changes a message format must update `docs/protocol.md` and pass the fuzz suite, whichever epic it belongs to.

### Milestones and phases

| Phase | Milestone | Exit criteria (the milestone closes only when all are true) |
|---|---|---|
| **Done** | M0 · Foundations | CI green, infra up. *(#1)* |
| **Done** | M1 · CRDT lab | Convergence for toy RGA and Yjs, ADR 0003. *(#2)* |
| **Phase 1: credible core** | M2 · Local-first editor | Two tabs edit live, a reload keeps content, Playwright proves both |
| | M3 · Sync server v1 | Two browsers on different machines edit through the server and survive a server restart; fuzz suite passes; "synced" driven by acks |
| | M3.5 · First deploy | Two people on different networks edit through the deployed server; a deploy mid-session loses nothing |
| | M4 · Persistence | Documents survive a full restart; the crash-before-flush test passes; Postgres-down behaviour tested |
| | M5 · Access control | Viewer read-only enforced by the server (raw-message tests); revocation disconnects immediately; staging exists |
| | M6a · Collaboration core | Cursors, presence, file tree, honest status; multi-user e2e (Chromium, Firefox, WebKit) green in CI |
| **Phase 2: production v1** | M6b · Collaboration complete | Follow mode, devtools panel, version history and restore, zip, Edge, axe |
| | M7 · Scale and observability | Two instances serve one room; chaos test loses zero acked edits; dashboard and SLO alerts; load-test report with real numbers |
| | M8 · Production launch | Production on 2+ machines; backup restore tested; security review done; demo room; docs complete; v1.0.0 tagged |
| **Phase 3: later** | M9 · Extras | GitHub import, inline comments, TS IntelliSense, multi-region design doc |

Milestone names in GitHub follow `M<n> · <Outcome>` exactly as above, with the exit criteria pasted into the milestone description.

---

## 2. GitHub setup

### 2.1 Labels: classification only

**Labels classify what an issue *is*. Project fields track *where it stands*.** Priority, size and status change constantly and need sorting and grouping, which Project fields do well and labels do badly. Keeping them out of labels means there's only one place to look and nothing to keep in sync.

The source of truth is [`.github/labels.json`](../../.github/labels.json), applied by [`labels.yml`](../../.github/workflows/labels.yml) on every change to `main`. Don't create labels by hand.

**Type: exactly one per issue.**

| Label | Use for |
|---|---|
| `type:epic` | Workstream parent issues only |
| `type:feature` | User-visible capability (a story) |
| `type:bug` | Behaviour that contradicts the spec, docs or tests |
| `type:reliability` | Failure handling, limits, drain, chaos, resilience |
| `type:security` | AuthN/Z, hardening, threat-model items, supply chain |
| `type:observability` | Metrics, logs, traces, dashboards, alerts |
| `type:infra` | CI/CD, environments, deploys, build |
| `type:perf` | Latency, throughput, capacity, load tests |
| `type:docs` | ADRs, RFCs, runbook, protocol docs, README |
| `type:spike` | Timeboxed investigation whose output is a decision, not code |
| `type:tech-debt` | A known shortcut being paid down |
| `type:chore` | Maintenance with no behaviour change (deps, tooling) |

**Area: one or more.** These mirror the code, so filtering by area finds everything that touches a module.

`area:editor` · `area:web` · `area:sync-server` · `area:sync-client` · `area:protocol` · `area:persistence` · `area:auth` · `area:collab-ux` · `area:history` · `area:scaling` · `area:observability` · `area:ci-cd` · `area:infra` · `area:docs` · `area:process`

**Flags: rare, and each one triggers a specific obligation.**

| Label | Means | Obligation |
|---|---|---|
| `protocol-change` | Alters bytes on the wire or close-code semantics | Update `docs/protocol.md`, fuzz suite, compatibility note |
| `schema-change` | Alters the database schema | Expand → migrate → contract plan in the PR |
| `needs-adr` | A decision is embedded in this work | ADR merged before or with the PR |
| `needs-rfc` | Too large or cross-cutting to design in a PR | RFC merged before implementation starts |
| `security-sensitive` | Touches authN/Z, tokens, secrets, input parsing | Security checklist in the PR is mandatory |
| `user-decision` | Needs a decision only the owner can make (spend, accounts, domain) | Can't move past Ready until decided |
| `no-issue` | PR intentionally has no linked issue (typo fix, Dependabot) | Exempts it from the linked-issue check |
| `dependencies` | Dependency updates (Dependabot uses this) | — |

GitHub's default labels (`bug`, `enhancement`, `question`, …) are removed, except `good first issue` and `help wanted`, which GitHub surfaces to contributors. Close reasons replace `duplicate`, `invalid` and `wontfix`: close as **not planned** with a one-line reason.

### 2.2 The Project: fields

One Project, "Lockstep", owned by the user account and linked to the repo.

| Field | Type | Values | Notes |
|---|---|---|---|
| **Status** | Single select | `Backlog` · `Ready` · `In Progress` · `In Review` · `Blocked` · `Done` | Definitions in §3.5. The only status system. |
| **Priority** | Single select | `P0` · `P1` · `P2` · `P3` | P0: drop everything (broken main, data loss, security). P1: required for the current milestone's exit criteria. P2: should do this phase. P3: nice to have; parked. |
| **Size** | Single select | `XS` (≤2 h) · `S` (≤½ day) · `M` (1–2 days) · `L` (3–5 days) | **L can't enter Ready**: split it. Anything bigger than L is an epic. |
| **Cycle** | Iteration | 1-week cycles starting Monday | Linear-style cycles. An item is "committed" only when it's in the current cycle. |
| **Risk** | Single select | `High` · `Medium` · `Low` | High: an unknown that could invalidate the design (do it early or spike it). |
| **Phase** | Single select | `1 · Core` · `2 · v1` · `3 · Later` | Used by the roadmap view. Milestones give the finer grain. |
| Parent issue, Sub-issue progress, Milestone, Labels, Linked PRs | Built-in | — | Turn them on in table views |

### 2.3 The Project: views

Six views. Each one answers a single question. Views, filters and visible fields are created through the API. Grouping, sorting and roadmap date fields can only be set in the GitHub UI.

| View | Layout | Filter / grouping / sort | Question it answers |
|---|---|---|---|
| **1. Cycle** | Board, columns = Status | `cycle:@current`, group by nothing, sort Priority | What am I doing this week, and is anything stuck? |
| **2. Triage** | Table | `status:Backlog`, missing Priority or Size first, sort Priority | What hasn't been looked at, and what's next to make Ready? |
| **3. Milestone** | Table | `milestone:` current, group by Status, show sub-issue progress | Will this milestone's exit criteria be met? |
| **4. Roadmap** | Roadmap | `label:type:epic`, dates from milestones, group by Phase | Where are we across the whole project? |
| **5. Non-feature work** | Table | `label:type:reliability,type:security,type:observability,type:tech-debt,type:perf`, group by type, not Done | Is the invisible work being done or quietly skipped? |
| **6. Bugs** | Table | `label:type:bug -status:Done`, sort Priority | What's broken? |

### 2.4 Project automation

Turn these on in **Project → Workflows** (built in, no code):

| Workflow | Setting |
|---|---|
| Auto-add to project | Repo `Mmolokii/lockstep`, filter `is:issue,pr is:open` |
| Item added to project | Status → `Backlog` |
| Item reopened | Status → `Backlog` |
| Item closed | Status → `Done` |
| Pull request merged | Status → `Done` |
| Code changes requested | Status → `In Progress` |
| Auto-archive items | `is:closed updated:<@today-30d` |

Repo-side automation lives in GitHub Actions and is limited to checks that enforce rules:

| Workflow | What it enforces |
|---|---|
| `labels.yml` | Labels match `.github/labels.json` (creates and updates; never deletes silently) |
| `pr-hygiene.yml` | PR title is a conventional commit, and the PR closes an issue (`Closes #n`), unless the PR is labelled `no-issue` or opened by a bot |
| `ci.yml`, `codeql.yml`, `dependency-review.yml` | Already in place |

There's deliberately **no** stale-bot (a solo backlog shouldn't close itself) and no auto-assignment (there's one assignee).

### 2.5 Templates

| Template | When |
|---|---|
| [Epic](../../.github/ISSUE_TEMPLATE/1-epic.yml) | Creating a workstream (rare) |
| [Feature](../../.github/ISSUE_TEMPLATE/2-feature.yml) | User-visible capability: user story, acceptance criteria, non-functional checks |
| [Bug](../../.github/ISSUE_TEMPLATE/3-bug.yml) | Something contradicts the spec, docs or tests |
| [Reliability / Infra](../../.github/ISSUE_TEMPLATE/4-reliability-infra.yml) | Failure modes, limits, deploys, CI, environments, observability, security hardening |
| [Docs / ADR / RFC](../../.github/ISSUE_TEMPLATE/5-docs-adr.yml) | Writing a decision, design or operational document |
| [Spike](../../.github/ISSUE_TEMPLATE/6-spike.yml) | Answering a question within a timebox |
| [Tech debt](../../.github/ISSUE_TEMPLATE/7-tech-debt.yml) | Recording a shortcut with its cost and payoff |
| [PR template](../../.github/pull_request_template.md) | Every PR |
| [RFC template](../rfcs/0000-template.md), [ADR template](../adr/0000-template.md), [Postmortem template](../postmortems/0000-template.md) | Docs that issues produce |

### 2.6 Spikes, tech debt and nice-to-haves

- **Spikes** are timeboxed (XS–M), always produce a written output (an ADR, RFC section, or comment with a recommendation), and are closed by that output, not by code. Code written in a spike is thrown away or rewritten under a normal issue.
- **Tech debt** is logged *when the shortcut is taken*, in the same PR that takes it, as a `type:tech-debt` issue. It says what was skipped, the cost of leaving it, and the trigger that makes it urgent. Every cycle reserves **~20%** for debt and non-feature work. `PROGRESS.md` lists open debt by title. A `TODO` in code must reference an issue number (`TODO(#123): …`).
- **Nice-to-haves** go in as **P3** with Phase `3 · Later`, and they stay out of milestones. They aren't deleted, but they never displace P1 work. Review them once a month: promote, or close as not planned.

---

## 3. Working process

### 3.1 Starting a new area

When starting an epic or a milestone's chunk of one:

1. **Find the unknowns.** List what could invalidate the design. Each serious one becomes a **spike** (Risk: High), done first.
2. **Design.** If the work is more than about a week, changes the wire protocol, the schema or the auth model, or spans several packages, write an **RFC** (`needs-rfc`) and merge it before implementation issues become Ready. Smaller decisions get an **ADR**.
3. **Slice vertically.** Break the work into issues that each deliver something testable end to end, not "build the layer" tasks. The first slice is a **walking skeleton**: the thinnest path through every component, exercised by a test. For example, M3 starts with "one client connects, syncs an empty doc, receives an ack" before limits or reconnection.
4. **Write acceptance criteria** as observable behaviour ("Given a viewer token, when the client sends a sync update, then the socket closes with 4403 and the room's state vector is unchanged").
5. **Size and make Ready.** Each issue is ≤ M and meets the Definition of Ready. L issues are split.
6. **Wire up the non-feature work.** For each new server path, add or confirm issues for metrics/logs, limits, failure handling and docs. These are sub-issues of the relevant cross-cutting epic, in the same milestone, not "later".

### 3.2 Definition of Ready

An issue can move to **Ready** only when it has:

- [ ] Type and area labels, a parent epic, and a milestone
- [ ] Priority, Size (≤ M) and Risk set
- [ ] Acceptance criteria someone else could verify
- [ ] Dependencies linked ("Blocked by #n") and either done or not blocking
- [ ] No open `needs-rfc` / `user-decision` flag

### 3.3 Definition of Done

An issue is **Done** only when its PR is merged to `main` with all of the following true. The PR template carries this checklist.

**Code and tests**
- [ ] Acceptance criteria demonstrably met, by tests where possible
- [ ] Unit tests for logic; integration tests for anything crossing a process or socket boundary
- [ ] Property or fuzz tests for CRDT, protocol and parser changes
- [ ] Coverage thresholds pass (90% protocol, sync-client, sync; 80% elsewhere)
- [ ] Typecheck, lint, CI and pr-hygiene green
- [ ] A bug fix includes a test that failed before the fix

**Operability** (server-side changes)
- [ ] New paths emit metrics and structured logs with IDs, and **never message contents**
- [ ] Failure behaviour defined and tested (timeouts, limits, what the client sees)
- [ ] A new alert or operational procedure has a runbook section in the same PR

**Security**
- [ ] AuthZ checked server-side for any new operation; input validated
- [ ] `security-sensitive` PRs complete the security checklist

**Docs**
- [ ] `DESIGN.md`, `docs/protocol.md` or the runbook updated where behaviour changed
- [ ] ADR merged if a decision was made (`needs-adr`)
- [ ] Tech debt taken is logged as an issue

**Delivery**
- [ ] Deployed to staging and smoke-tested *(from M5, when staging exists)*
- [ ] `PROGRESS.md` updated when a milestone's state changes

A **milestone** is Done when its exit criteria are met, its PR(s) are merged, `PROGRESS.md` is updated, and a short retro note (what went well, what didn't, one change) is added to `PROGRESS.md`.

### 3.4 Where ADRs, RFCs, runbooks and reports fit

| Artifact | Created by | Lives in | Gate |
|---|---|---|---|
| **Spike output** | A `type:spike` issue | Issue comment, then ADR or RFC | Spike closes only with a written recommendation |
| **RFC** | A `type:docs` issue labelled `needs-rfc` | `docs/rfcs/NNNN-title.md` | Merged before implementation issues become Ready |
| **ADR** | Any issue labelled `needs-adr`, or a docs issue | `docs/adr/NNNN-title.md` | Merged with or before the code that embodies it |
| **Runbook section** | Any issue adding an alert or operational procedure | `docs/runbook.md` | Same PR as the alert or procedure |
| **Load-test report** | `type:perf` issues | `docs/load-test-report.md`, numbers copied to `docs/metrics.md` | Raw command output and instance spec included; no number without both |
| **Postmortem** | Any SEV1/SEV2, or a failed chaos drill | `docs/postmortems/YYYY-MM-DD-title.md` | Action items filed as issues and linked |

RFC and ADR numbers are allocated when the file is created (next free number). An RFC that's accepted usually produces one or more ADRs recording its key decisions.

### 3.5 Keeping the board honest

| Status | Means exactly | Entry rule | Exit rule |
|---|---|---|---|
| **Backlog** | Captured, not yet refined | Anything | Meets DoR → Ready |
| **Ready** | Could start right now | DoR met | Branch created → In Progress |
| **In Progress** | Actively being worked: a branch exists and it was touched in the last working day | **WIP limit 1** (2 only if the other is waiting on CI or review) | PR open and green → In Review |
| **In Review** | PR open, CI green, waiting for the next-day self-review or for feedback | PR exists | Merged → Done (automatic) |
| **Blocked** | Can't progress because of something **outside your control right now** | A comment naming the blocker and the unblock condition | Blocker cleared → back to its previous status |
| **Done** | Merged to `main` (and deployed, once CD exists) | Automatic on merge or close | — |

Rules that keep it honest:

- **"Hard" isn't Blocked.** Blocked means waiting on someone or something else: an account, a decision, a third-party outage. "I'm stuck on the design" means it's In Progress, or it needs a spike.
- **Stale In Progress gets moved back.** Untouched for 3 working days, it goes back to Ready with a comment saying why. The board shows what's true, not what you intended.
- **Self-review the next day.** A PR goes to In Review and is reviewed the following day with fresh eyes, against the PR checklist. Same-day merges are allowed only for `XS` chores and P0 fixes.
- **No work without an issue.** Anything over 30 minutes gets an issue first. Smaller things go in as `no-issue` PRs.
- **Scope changes are visible.** If an issue grows past its size, split it: finish the original scope and file the rest. Don't silently enlarge it.

### 3.6 Cadence

| When | Duration | What |
|---|---|---|
| **Each working session** | 2 min | Update Status on what you touched. Leave a one-line comment on anything In Progress you're stopping. |
| **Monday: cycle planning** | 30 min | Close last cycle. Pull Ready items into the cycle up to **~70% of expected hours** (leave slack). At least ~20% non-feature work (debt, reliability, security, observability). Check the milestone's exit criteria are still reachable. |
| **Friday: cycle review** | 30 min | Demo to yourself what merged (record a short clip when it's visual). Update `PROGRESS.md`. Move stale items. Record DORA numbers once deploys exist. |
| **Milestone close** | 45 min | Verify the exit criteria with evidence. Write the retro note. Re-plan the next milestone's issues (§3.1). |
| **Monthly** | 60 min | Roadmap review: re-rank epics, review P3s (promote or close), check the error budget and costs, review the tech-debt list. |

---

## 4. Prioritisation

### 4.1 Framework

Two lenses, applied in order:

1. **MoSCoW decides scope** for v1. *Must* items define the credible core and production v1. Nothing *Could* or *Won't* enters a Phase 1 or 2 milestone.
2. **Risk → Impact → Effort orders the work** within Must:
   - **Risk first.** Anything that could invalidate the architecture (protocol shape, ack semantics, persistence model, auth model, WebSockets through Fly's proxy) is done as early as possible, as a spike if needed. Finding out in M7 that the design doesn't work is the most expensive outcome there is.
   - **Then impact.** Prefer work that makes the system demoable end to end (vertical slices) over polishing one layer.
   - **Then effort.** Among equals, do the smaller one first to keep the flow going.

### 4.2 MoSCoW for v1

| | Scope |
|---|---|
| **Must** (v1 isn't credible without it) | Local-first editing; sync server with acks, limits, backpressure, heartbeats, drain; reconnecting client with honest status; persistence with batching, compaction and crash recovery; GitHub auth, projects, share links, per-message authZ, revocation; cursors, presence and file tree; multi-user e2e; deployed with CI/CD; metrics, logs, Sentry; two-instance scaling with writer lock; chaos test; load-test report; runbook; security review; backup restore tested |
| **Should** (v1 is weaker without it) | Follow mode; devtools panel with offline and latency controls; version history and per-file restore; zip download; audit log; OpenTelemetry traces; SLO burn alerts; staging plus preview environments; demo room; SBOM; axe checks; DORA tracking |
| **Could** (only if ahead of plan) | Bundle-size budgets in CI; feature flags; OAuth on preview deploys; Edge in the e2e matrix; Grafana Cloud instead of self-hosted |
| **Won't (v1)** | GitHub import, comments, IntelliSense (M9); multi-region (design doc only); code execution; voice/video; SSO; billing; atomic project restore |

### 4.3 The next 8 weeks

Assumes about **15–20 focused hours a week**. If real velocity differs, the order holds and the dates move. Cut from the bottom of each week, never from the top.

| Week | Goal | Work (priority order) | Why this order |
|---|---|---|---|
| **1** | Board live, editor runs | Merge M1 (#2) · apply GitHub setup (labels, milestones, project, epics, issues) · **M2**: Next.js shell, editor package, IndexedDB, BroadcastChannel, Playwright skeleton | Gets the tracking system in place while the work is still small. The editor makes every later milestone demoable. |
| **2** | Protocol and walking skeleton | **RFC 0001 protocol v1** · protocol encode/decode + fuzz · sync server walking skeleton (connect → two-step sync → ack) · sync-client state machine | The protocol and ack semantics are the highest-risk design decisions. Settle them on paper, then prove them with the thinnest end-to-end path. |
| **3** | Server hardening | Limits, rate limit, backpressure, heartbeats, drain, health semantics (ADR) · reconnection policy · logs and baseline metrics · integration suite | Reliability and observability arrive with the server, not after it. |
| **4** | **First deploy** | Hosting ADR · Fly sync + Vercel web · `deploy.yml` · verify WebSockets and drain through Fly's proxy · Sentry · billing alerts · runbook v0 | Second-highest risk: proxies, TLS and idle timeouts. Start DORA tracking. *Needs your accounts and spend decision.* |
| **5** | Durability | RFC 0002 persistence · db package + migrations in CI · write path · load path · compaction · crash-before-flush test · Postgres-down behaviour | Makes "no acknowledged edit is lost" true, and proves it with tests. |
| **6** | Access control I | RFC 0003 auth model + STRIDE v1 · GitHub OAuth · projects and members · room tokens (EdDSA) · socket auth | Security model designed as a whole before any piece is built. |
| **7** | Access control II | Per-message authZ (incl. step 2) + raw-message tests · share links (hashed) · revocation · web hardening (CSP, CSRF, Zod) · project-deletion cascade · staging environment | Completes the "viewer can't change a character" guarantee. |
| **8** | **Credible core** | File tree · cursors and presence · honest status indicator · multi-user Playwright in CI · README clip | End of Phase 1: a deployed, authenticated, durable, collaborative editor with tests proving the hard guarantees. |

**Process is introduced when it's first needed, not all up front:** labels, board and templates now; staging and DoD's "deployed to staging" at M5; DORA from the first deploy; SLOs, dashboards and alerts at M7; releases and SBOM at M8.

---

## 5. Phase 1 backlog

The issues for M2 through M6a. Each becomes a GitHub issue with the listed labels and fields, as a sub-issue of its epic. Sizes over M are already split. IDs (`M2-03`) are planning keys; GitHub assigns the real numbers.

Columns: **Type** · **Area** · **P**riority · **S**ize · **R**isk.

### Setup

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| PM-01 | Apply GitHub project setup | E15 | chore | process | P1 | S | L | Labels synced from `labels.json`; default labels removed; milestones M2–M9 with exit criteria; Project with the fields, views and workflows in §2 |
| PM-02 | Create epics and Phase 1 issues | E15 | chore | process | P1 | S | L | E1–E16 exist; every issue below exists as a sub-issue with labels, milestone and fields |

### M2 · Local-first editor

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M2-01 | ADR 0004: CodeMirror 6 over Monaco | E1 | docs | editor, docs | P1 | XS | L | Bundle size measured for both; mobile, binding and extensibility compared |
| M2-02 | ADR 0005: one Y.Doc per file plus a tree doc | E6 | docs | persistence, docs | P1 | XS | M | Memory, lazy loading and the cross-file atomicity trade-off recorded |
| M2-03 | `apps/web` shell: Next.js App Router, Tailwind, baseline security headers | E1 | feature | web | P1 | M | L | `pnpm dev` serves a page; `pnpm build` passes in CI; CSP header present |
| M2-04 | `packages/editor`: CodeMirror 6 + Yjs binding, ~10 languages, light/dark, keyboard shortcuts | E1 | feature | editor | P1 | M | M | Typing updates the Y.Text; language chosen by extension; theme toggle; keyboard-only use works |
| M2-05 | Offline persistence with `y-indexeddb` | E1 | feature | editor | P1 | S | L | Reloading keeps content; works with the network disabled |
| M2-06 | Cross-tab sync via BroadcastChannel | E1 | feature | editor | P1 | S | L | Two tabs edit the same file live |
| M2-07 | Playwright harness and first e2e: two tabs + reload | E11 | infra | ci-cd, editor | P1 | S | M | Runs locally and in CI on Chromium; proves the M2 exit criteria |

### M3 · Sync server v1

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M3-01 | RFC 0001: wire protocol v1 (sync, awareness, control incl. `ack`, close codes, versioning) | E2 | docs | protocol | P1 | S | **H** | Merged; every message and field defined; compatibility policy stated. `needs-rfc` |
| M3-02 | Protocol encode/decode with `lib0`, plus `docs/protocol.md` | E2 | feature | protocol | P1 | M | M | Round-trip tests for every message; 90% coverage. `protocol-change` |
| M3-03 | Protocol fuzz suite | E2 | reliability | protocol | P1 | S | M | Random and truncated bytes yield typed errors, never uncaught exceptions; thousands of runs in CI |
| M3-04 | Sync server walking skeleton: connect → two-step sync → broadcast → `ack` | E3 | feature | sync-server | P1 | M | **H** | Integration test: two clients converge; a late joiner gets the full state; ack state vector covers sent updates |
| M3-05 | Awareness relay and cleanup on disconnect | E3 | feature | sync-server | P1 | S | L | Peers see presence join/leave; stale awareness removed on close |
| M3-06 | Limits: message size, document size, token-bucket rate limit | E11 | reliability | sync-server | P1 | M | M | Each limit configurable; violations close with 4413 / 4429; tests per limit |
| M3-07 | Backpressure on `bufferedAmount` | E11 | reliability | sync-server | P1 | S | M | A slow-consumer test shows disconnect at threshold, and memory stays bounded |
| M3-08 | Server heartbeats and dead-connection reaping | E11 | reliability | sync-server | P1 | S | L | Half-open sockets are closed within the configured interval |
| M3-09 | Graceful drain on SIGTERM (close 1012 within budget) | E11 | reliability | sync-server | P1 | S | M | Test: SIGTERM stops accepting, closes clients with 1012, exits within budget |
| M3-10 | Health endpoints + ADR 0012: readiness ignores shared dependencies | E11 | reliability | sync-server | P1 | S | M | `/healthz`, `/readyz` (false only when draining); ADR merged. `needs-adr` |
| M3-11 | Structured JSON logs with connection IDs, no contents | E10 | observability | sync-server, observability | P1 | S | L | A test asserts no payload bytes appear in logs |
| M3-12 | Prometheus `/metrics` baseline | E10 | observability | sync-server, observability | P1 | M | L | Connections, rooms, messages and bytes by type, rejects by reason, event-loop lag; scraped by local Prometheus |
| M3-13 | sync-client state machine with honest status and pending count | E4 | feature | sync-client | P1 | M | M | `synced` only after an ack covers local updates; unit tests with a fake socket |
| M3-14 | sync-client reconnection policy | E4 | reliability | sync-client | P1 | M | M | Close-code table implemented; full-jitter capped backoff; online/offline events; fake-timer tests |
| M3-15 | sync-client heartbeat and half-open detection | E4 | reliability | sync-client | P1 | S | L | A missed pong triggers reconnect |
| M3-16 | sync-client demo hooks: `simulateOffline`, artificial latency | E4 | feature | sync-client | P2 | S | L | Hooks change behaviour as specified; covered by tests |
| M3-17 | Wire the editor to sync-client (server becomes the primary path) | E1 | feature | editor, sync-client | P1 | S | L | Two browsers on different machines edit together via the server |
| M3-18 | Sync server bundle (esbuild) and Dockerfile (non-root) | E13 | infra | infra | P1 | S | L | Image builds in CI; runs in Docker Compose; Prometheus scrapes it |
| M3-19 | Integration test: clients survive a server restart | E11 | reliability | sync-server, sync-client | P1 | S | M | Restart mid-session; clients reconnect and converge (in-memory state comes back from clients) |

### M3.5 · First deploy

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M35-01 | ADR 0010: hosting (why sync isn't serverless; Fly region; cost estimate) | E13 | docs | infra, docs | P1 | S | M | Merged; region and machine size chosen. `user-decision` (accounts, spend) |
| M35-02 | Deploy sync to Fly: `fly.toml`, health checks, WebSocket idle timeouts | E13 | infra | infra | P1 | M | **H** | `wss://` reachable; health checks gate rollout |
| M35-03 | Deploy web to Vercel with env config and preview deploys | E13 | infra | infra, web | P1 | S | L | Production and preview URLs work |
| M35-04 | `deploy.yml`: deploy on merge to main, rolling sync deploys, short-lived credentials | E13 | infra | ci-cd | P1 | M | M | A merge to main deploys both apps; no long-lived deploy keys where OIDC exists |
| M35-05 | Verify drain and reconnection through Fly's proxy | E11 | reliability | sync-server, infra | P1 | S | **H** | A deploy during a live two-person session loses no acked edit (recorded evidence) |
| M35-06 | Sentry for web and sync, with releases tagged | E10 | observability | observability | P1 | S | L | A test error appears in Sentry with the release |
| M35-07 | Billing alerts and cost tracking in `docs/metrics.md` | E13 | infra | infra | P1 | XS | L | Alerts set on every provider; monthly cost recorded |
| M35-08 | Runbook v0: deploy, roll back, drain | E15 | docs | docs | P1 | S | L | Each procedure tested once |
| M35-09 | Start DORA tracking in `docs/metrics.md` | E15 | docs | process | P2 | XS | L | Deploys, lead time and failures logged from the first deploy |

### M4 · Persistence

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M4-01 | RFC 0002: persistence (log, batching, snapshots, compaction, writer-lock shape, Postgres-down behaviour) | E6 | docs | persistence | P1 | S | **H** | Merged. `needs-rfc` |
| M4-02 | `packages/db`: Drizzle schema and migrations; Postgres service in CI | E6 | infra | persistence, ci-cd | P1 | M | L | Migrations run in CI before tests; forward-only. `schema-change` |
| M4-03 | Write path: per-room batching by interval and size | E6 | feature | persistence, sync-server | P1 | M | M | Updates flushed within the interval; one transaction per batch |
| M4-04 | Load path: snapshot plus tail | E6 | feature | persistence, sync-server | P1 | S | L | A loaded document equals the in-memory state before restart |
| M4-05 | Compaction in one transaction; delete only after commit | E6 | feature | persistence | P1 | M | M | Load after compaction equals load before; a crash mid-compaction loses nothing |
| M4-06 | Room eviction after idle, with flush | E11 | reliability | sync-server | P1 | S | L | Idle rooms are flushed and freed; metric shows the room count dropping |
| M4-07 | Drain flushes every room within budget | E11 | reliability | sync-server | P1 | S | M | SIGTERM test: nothing acked is lost |
| M4-08 | Postgres-unavailable behaviour: bounded buffer, refuse new rooms, alert metric | E11 | reliability | persistence, sync-server | P1 | M | M | Test with Postgres stopped: open rooms keep working, new rooms refused, flush on recovery |
| M4-09 | Crash-before-flush recovery test | E11 | reliability | persistence, sync-client | P1 | M | M | Kill -9 before flush; the client's reconnect restores the state; asserted in a test |
| M4-10 | Persistence metrics: flush latency, backlog, compaction duration | E10 | observability | observability | P1 | S | L | Exposed and scraped |
| M4-11 | Accept ADR 0008 (update log, batching, durability trade-off) | E6 | docs | persistence, docs | P1 | XS | L | Status moved to Accepted after RFC 0002 |

### M5 · Access control

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M5-01 | RFC 0003: auth and access model + STRIDE threat model v1 | E5 | docs | auth | P1 | M | **H** | Merged: tokens, roles, share links, revocation channel, audit scope. `needs-rfc` `security-sensitive` |
| M5-02 | GitHub OAuth with better-auth; sessions in Postgres | E5 | feature | auth, web | P1 | M | M | Sign in and out works; cookies `HttpOnly`, `Secure`, `SameSite` |
| M5-03 | Projects and members; dashboard | E5 | feature | web | P1 | M | L | Create, list and open projects; membership enforced server-side |
| M5-04 | Room token endpoint with EdDSA signing; accept ADR 0006 | E5 | security | auth | P1 | M | M | 5-minute token with room and role; the sync server needs only the public key; key rotation documented. `needs-adr` |
| M5-05 | Socket auth: `auth` within 5 s, verify signature, expiry, room and role | E5 | security | sync-server, auth | P1 | S | M | Tests for missing, expired, wrong-room and forged tokens → 4401 / 4403 |
| M5-06 | Per-message authorisation incl. sync step 2; raw-message viewer tests | E5 | security | sync-server, auth | P1 | M | **H** | Raw viewer update and step-2 messages are rejected (4403) and never applied |
| M5-07 | sync-client token fetch and refresh before expiry; 4401 recovery | E4 | feature | sync-client | P1 | S | L | Long session crosses token expiry without user impact |
| M5-08 | Share links: 128-bit tokens, hashed, expiry, revoke | E5 | security | auth, web | P1 | M | M | Viewer and editor links work; only hashes stored; revoked links refused |
| M5-09 | Pushed revocation: removing a member or link closes their sockets with 4403 | E5 | security | auth, sync-server | P1 | M | M | Test: revoke → socket closed within 1 s |
| M5-10 | Web hardening: strict CSP, CSRF, Zod validation, file-path validation | E12 | security | web | P1 | M | M | Headers verified in tests; invalid paths rejected |
| M5-11 | Project deletion removes every document, update, snapshot and version | E12 | security | persistence | P1 | S | L | Test asserts no rows remain |
| M5-12 | Audit log for membership, sharing and restore actions | E12 | security | auth, persistence | P2 | S | L | Entries carry actor, action, target and time |
| M5-13 | Staging environment (separate DB, sync app, OAuth app) | E13 | infra | infra | P1 | M | M | Merges deploy to staging first; smoke test gates production |
| M5-14 | Spike: GitHub OAuth on per-PR preview deploys | E13 | spike | infra, auth | P3 | S | M | Written recommendation |

### M6a · Collaboration core

| ID | Title | Epic | Type | Area | P | S | R | Acceptance criteria |
|---|---|---|---|---|---|---|---|---|
| M6-01 | ADR 0011: file-tree conflict rules (rename vs delete, concurrent moves) | E7 | docs | collab-ux, docs | P1 | S | M | Deterministic rules with examples. `needs-adr` |
| M6-02 | Collaborative file tree: create and delete | E7 | feature | collab-ux | P1 | M | M | Two users see tree changes live; paths validated |
| M6-03 | Collaborative file tree: rename and move per ADR 0011 | E7 | feature | collab-ux | P1 | M | M | Property test of concurrent rename/delete matches ADR 0011 |
| M6-04 | Remote cursors and selections with names and colours; idle fade | E7 | feature | collab-ux | P1 | M | L | Colour plus name (never colour alone) |
| M6-05 | Presence bar with screen-reader labels | E7 | feature | collab-ux | P1 | S | L | axe has no violations on the component |
| M6-06 | Sync status indicator driven by sync-client state | E7 | feature | collab-ux | P1 | S | L | Shows synced, saving, offline (N), reconnecting, error; matches the ack-based truth in tests |
| M6-07 | Multi-user Playwright suite: concurrent edit, offline merge, viewer read-only | E11 | reliability | ci-cd | P1 | M | M | Chromium, Firefox, WebKit; uses `context.setOffline` |
| M6-08 | `e2e.yml`: run the suite against Docker Compose on every PR | E13 | infra | ci-cd | P1 | S | L | Required check on `main` |
| M6-09 | README demo clip of the credible core | E16 | docs | docs | P2 | S | L | 30–60 s clip at the top of the README |

### Phase 2 and 3 (epic-level until their milestone starts)

These are refined into issues at the start of their milestone (§3.1), not before. Writing them in detail now would be waste, because the design will have moved.

- **M6b · Collaboration complete:** follow mode; devtools panel (state, room, role, pending, size, state vector, peers, message log, offline toggle, latency slider); version history (auto and on demand), diff, per-file restore; zip download; Edge in the e2e matrix; axe in CI.
- **M7 · Scale and observability:** RFC 0004 multi-instance design; Redis pub/sub fan-out; writer lock; state-vector reconciliation; two sync instances in Compose; OpenTelemetry traces with trace ID in `auth`; Grafana dashboards as code; SLO recording rules and burn alerts; k6 scripts and propagation-latency harness; chaos script (kill an instance, Redis outage, Postgres outage); `docs/load-test-report.md`.
- **M8 · Production launch:** production on 2+ machines; backups and a tested restore; OWASP review in `docs/security-review.md`; privacy notice (POPIA) and account deletion; SBOM on release; v1.0.0 tag and generated release notes; demo room (seeded, rate-limited, reset nightly); uptime monitoring; complete runbook, protocol and design docs; demo video; resume bullets; first three real users with feedback recorded.
- **M9 · Extras:** GitHub import; inline comments (relative positions); TS IntelliSense in a worker; multi-region design doc; feature flags; bundle-size budgets.

---

## 6. Operating rules

1. **The board is the truth.** If it isn't on the board, it isn't happening. If the board is wrong, fixing it is the next task.
2. **One thing in progress.** Finish before starting. WIP limit 1, or 2 when one is waiting on CI.
3. **No issue, no work.** Anything over 30 minutes starts as an issue with acceptance criteria.
4. **Every issue is ≤ 2 days.** If it's bigger, it isn't understood yet: split it or spike it.
5. **Riskiest first.** Spike the unknowns before building on them.
6. **Design is written down.** RFCs for anything cross-cutting, ADRs for every "why?", both reviewed in PRs.
7. **Non-feature work ships with the feature.** Metrics, limits, failure handling, security checks and docs are part of Done, not follow-ups.
8. **~20% of every cycle is debt, reliability and security work.** Protect it.
9. **Debt is logged when it's taken**, with its cost and the trigger that makes it urgent.
10. **No number without a command, its output and the machine it ran on.**
11. **Milestones close on evidence**, never on dates. Dates move; exit criteria don't.
12. **Next-day self-review** for anything bigger than XS. Read the diff as if someone else wrote it.
13. **Labels classify; fields track.** Never encode status, priority or size in labels.
14. **Process arrives when it's needed.** Add a process step only when its absence has cost something, and record why in this document.
15. **Change this document by PR.** The operating model is code: versioned, reviewed and explained.
