# Branch protection for `main`

Repository settings can't be committed, so this file plus [`branch-protection.ruleset.json`](branch-protection.ruleset.json) are their source of truth. If the settings are ever lost or the repo is forked, re-apply them from here. Any change to the settings updates both files in the same PR, with the API output proving it.

`main` is protected by **one repository ruleset** (`main`, id 28165975). Classic branch protection is **off**, so there's a single source of truth.

## Current settings (verified 2026-11-26)

```
$ gh api repos/Mmolokii/lockstep/rulesets/28165975 --jq '...'
{"bypass_actors":[],"enforcement":"active","name":"main","rules":[{"type":"deletion"},{"type":"non_fast_forward"},{"type":"required_linear_history"},{"approvals":0,"merge_methods":["squash"],"thread_resolution":true,"type":"pull_request"},{"checks":["Typecheck, lint, test, build","Conventional title and linked issue","Analyze (javascript-typescript)","Analyze (actions)","Dependency audit and authorisation","review","E2E (chromium)","E2E (firefox)","E2E (webkit)"],"strict":true,"type":"required_status_checks"}]}

$ gh api repos/Mmolokii/lockstep/branches/main/protection
{"message":"Branch not protected", ... "status":"404"}        # classic protection removed

$ gh api repos/Mmolokii/lockstep --jq '{squash: .allow_squash_merge, merge: .allow_merge_commit, rebase: .allow_rebase_merge, delete_branch: .delete_branch_on_merge}'
{"delete_branch":true,"merge":false,"rebase":false,"squash":true}
```

## What each rule does, and why

| Rule | Setting | Why |
|---|---|---|
| Require a pull request | On, **0 approvals** | No direct pushes to `main`. Zero approvals because GitHub never lets an author approve their own PR, so for a solo maintainer any non-zero count blocks every merge. Review is the next-day self-review in the [process](process/project-management.md#35-keeping-the-board-honest). Raise this to 1 when a second maintainer joins |
| Dismiss stale approvals on push | On | A reviewed diff is the diff that merges (matters once approvals are required) |
| Resolve review threads | On | CodeQL and review comments must be addressed. This is what blocked #1 until the action-pinning fix |
| Merge methods | **Squash only** (ruleset + repo setting) | One conventional commit per PR on `main` |
| Required status checks | The 9 checks below | A check that isn't required is decoration |
| Require branches to be up to date | **On** | Prevents "green alone, red together" merges. Costs one "Update branch" per PR, which is cheap with one contributor |
| Linear history | On | Matches squash-only; clean reverts; DORA can be measured from `git log` |
| Block force pushes and deletions | On | `main` is append-only |
| Bypass list | **Empty** | Applies to admins and the owner too. There's no bypass path at all (see the emergency procedure) |
| Delete head branch on merge | On (repo setting) | GitHub then retargets stacked PRs automatically. Deleting a base branch by hand is what auto-closed #106 |
| Signed commits | Off for now | Worth adding later; not worth blocking work on |

### Required checks

| Check | Workflow | What it gates |
|---|---|---|
| `Typecheck, lint, test, build` | ci.yml | Contract, typecheck, Biome, coverage tiers, deep property and fuzz runs, integration, verify, build, bundle budgets |
| `Conventional title and linked issue` | pr-hygiene.yml | PR title becomes the squash commit; every PR closes an issue |
| `Analyze (javascript-typescript)`, `Analyze (actions)` | security.yml | CodeQL security-extended |
| `Dependency audit and authorisation` | security.yml | `pnpm audit --audit-level high` + the viewer-rejected scenario |
| `review` | security.yml | Dependency review, failing on high |
| `E2E (chromium)`, `E2E (firefox)`, `E2E (webkit)` | e2e.yml | Multi-user Playwright suite (posts a notice until #29) |

Before adding a check here, confirm it has reported at least once. Requiring a check that never reports blocks every PR.

## Emergency procedure (no bypass)

There's no admin bypass, by design: an escape hatch that exists gets used. The emergency path is a **revert through a normal PR**:

1. On GitHub, open the merged PR → **Revert**. This creates a revert PR.
2. Its checks run like any other PR's. The revert restores a state that already passed every check, so it's expected to go green in one CI run (~3 minutes).
3. Merge it, then fix forward in a separate PR.
4. Record the incident: a postmortem for SEV1/SEV2 (`docs/postmortems/`), otherwise a line in `PROGRESS.md`.

If a required check itself is broken (for example a GitHub outage), fix or temporarily remove that check in a PR that says why, and restore it after. Every change to these settings is recorded in this file.

## Apply (for a fresh repo or a fork)

```bash
gh api -X POST repos/Mmolokii/lockstep/rulesets --input docs/branch-protection.ruleset.json
```

```bash
gh api -X PATCH repos/Mmolokii/lockstep -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false -F delete_branch_on_merge=true -f squash_merge_commit_title=PR_TITLE -f squash_merge_commit_message=COMMIT_MESSAGES
```

To update an existing ruleset, use `-X PUT repos/Mmolokii/lockstep/rulesets/<id>` with the same file.

## Decisions on the review draft (2026-11-26)

A ruleset-based runbook was proposed in review (#109). Here's what was adopted and what wasn't, and why:

| Draft item | Decision | Reason |
|---|---|---|
| Use a repository ruleset rather than classic protection | **Adopted** | GitHub's current mechanism. Bypass lists are explicit, and the rules are a single JSON document we can commit |
| Require branches to be up to date | **Adopted** | It reversed an earlier "off". The draft's reasoning is right, and the cost is small |
| Restrict deletions, block force pushes, linear history | Adopted (already in place) | — |
| Signed commits optional | Adopted | — |
| 1 required approval, code-owner review, approval of the most recent push | **Rejected for now** | An author can't approve their own PR, so with one maintainer all three deadlock every merge. They go on when a second maintainer joins |
| 11 per-stage checks (`install`, `typecheck`, `lint`, `unit-tests`, …) | **Rejected for now** | No workflow produces those names; requiring them would block every PR. Splitting `ci.yml` into parallel jobs would make them real but repeats setup in each job; worth doing if CI time passes ~10 minutes. Each stage is already a named step in the job log, and `ci:local` stops at the failing one |
| Admin bypass for emergencies, recorded afterwards | **Rejected** | It contradicts AGENTS.md never-do #14 and an empty bypass list. A revert PR gives the same speed without the escape hatch |
| "Conventional commits + Changesets assume a linear log" | Corrected | Changesets was dropped (System Overview reconciliation); release notes come from conventional commits. Linear history stands on its own merits |
