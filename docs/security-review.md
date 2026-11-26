# Security review

> **Not reviewed yet.** The full OWASP Top 10 review happens before launch (M8). This file records what's in place today, and the structure the review will follow. Report vulnerabilities privately: see [SECURITY.md](../SECURITY.md).

## Controls in place now

| Control | Status | Where |
|---|---|---|
| CodeQL (security-extended) on every PR and weekly | ✅ | `security.yml` |
| Dependency review on PRs (fail on high) | ✅ | `security.yml` |
| `pnpm audit --audit-level high` on every PR | ✅ | `security.yml` |
| Secret scanning with push protection | ✅ | Repository settings |
| Dependabot alerts and update PRs | ✅ | `.github/dependabot.yml` |
| Actions pinned to SHAs; no untrusted data in `run:`; least-privilege permissions | ✅ | `scripts/workflows.test.mjs` |
| Branch protection (required checks, admins included) | ✅ | [branch-protection.md](branch-protection.md) |
| Raw-message authorisation test (viewer → 4403) | ⏳ pending #103 | `pnpm verify viewer-rejected` |
| Per-message authZ, room tokens, revocation | ⏳ M5 | ADR 0006, #72–#77 |
| Strict CSP, CSRF, input validation | ⏳ M5 | #78 |
| STRIDE threat model | ⏳ M5 | RFC 0003 (#69) |

## Review structure (M8)

For each OWASP Top 10 category: what applies to Lockstep, how it's mitigated, how that was verified (test, tool or manual check), findings, and fixes with issue links.

| Category | Applies? | Mitigation | Verified by | Findings |
|---|---|---|---|---|
| A01 Broken access control | | | | |
| A02 Cryptographic failures | | | | |
| A03 Injection | | | | |
| A04 Insecure design | | | | |
| A05 Security misconfiguration | | | | |
| A06 Vulnerable and outdated components | | | | |
| A07 Identification and authentication failures | | | | |
| A08 Software and data integrity failures | | | | |
| A09 Security logging and monitoring failures | | | | |
| A10 Server-side request forgery | | | | |

Use the OWASP list current at review time, and note its version here.
