# Branch protection for `main`

Repository settings can't be committed, so this file is their source of truth. Whenever the settings change, update this file in the same PR, and include the API output proving the change.

## Current settings (verified 2026-11-26)

```
$ gh api repos/Mmolokii/lockstep/branches/main/protection --jq '{checks: [.required_status_checks.checks[].context], strict: .required_status_checks.strict, admins: .enforce_admins.enabled, linear: .required_linear_history.enabled, pr_reviews: .required_pull_request_reviews, force: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, conversations: .required_conversation_resolution.enabled}'
{"admins":true,"checks":["Typecheck, lint, test, build","Conventional title and linked issue"],"conversations":true,"deletions":false,"force":false,"linear":false,"pr_reviews":null,"strict":false}
```

## Target settings

| Setting | Target | Why |
|---|---|---|
| Require a pull request before merging | **On**, 0 approvals | Forbids direct pushes. A solo maintainer can't approve their own PR, so 0 approvals; the next-day self-review is a process rule |
| Required status checks | All of the checks below | Nothing reaches `main` without every gate passing |
| Require branches to be up to date | Off | Squash merges plus fast CI make it unnecessary for one contributor; revisit when there are more |
| Require linear history | **On** | Matches squash-only merging; history reads as one commit per PR |
| Require conversation resolution | On | CodeQL and review comments must be addressed |
| Include administrators | **On** | No `--admin` bypass, including the owner |
| Allow force pushes / deletions | Off | `main` is append-only |
| Merge methods (repo setting) | **Squash only**; delete branch on merge | One conventional commit per PR; no stale branches |

### Required checks

| Check | Workflow | Notes |
|---|---|---|
| `Typecheck, lint, test, build` | ci.yml | The full PR gate |
| `Conventional title and linked issue` | pr-hygiene.yml | |
| `Analyze (javascript-typescript)` | security.yml | CodeQL |
| `Analyze (actions)` | security.yml | CodeQL for workflows |
| `Dependency audit and authorisation` | security.yml | `pnpm audit` + viewer-rejected scenario |
| `review` | security.yml | Dependency review (PR events only) |
| `E2E (chromium)`, `E2E (firefox)`, `E2E (webkit)` | e2e.yml | Always report a status; post a notice until the suite exists (#29) |

Add a check here only after it has run on `main` at least once. GitHub only offers checks it has seen, and requiring a check that never reports blocks every PR.

## Apply

Run these after the workflow PRs (#105, #106, #107) have merged and each check has reported once:

```bash
gh api -X PUT repos/Mmolokii/lockstep/branches/main/protection --input docs/branch-protection.json
```

```bash
gh api -X PATCH repos/Mmolokii/lockstep -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false -F delete_branch_on_merge=true
```

Then re-run the verification command above and paste the output into "Current settings".
