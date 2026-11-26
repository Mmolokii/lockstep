# Security policy

## Reporting a vulnerability

Please **don't** open a public issue. Report it privately through GitHub instead:
[Report a vulnerability](https://github.com/Mmolokii/lockstep/security/advisories/new).

Include what you found, how to reproduce it, and what an attacker could do with it. You'll get an acknowledgement within 7 days. Lockstep is a one-person project, so fixes are best-effort, but security issues come first.

## Supported versions

Only the latest `main` and the live deployment are supported.

## Scope

Of particular interest:

- Bypassing room permissions, for example a viewer getting an edit applied
- Room tokens leaking, being forged or being replayed
- Share-link tokens being guessable or recoverable
- Crashing a sync server with crafted input
- Reading another project's documents
- Message contents showing up in logs

Out of scope: denial of service through sheer traffic volume, and findings that need a compromised device.

## How Lockstep is built to be secure

- Permissions are checked when a socket connects **and on every message**.
- Room tokens are short-lived, signed, sent inside the socket rather than in the URL, and revocable immediately.
- Share-link tokens are stored hashed.
- Message size, document size and rate limits are enforced, and the protocol parser is fuzz-tested.
- A strict Content Security Policy is applied, and dependencies are scanned (Dependabot, dependency review, CodeQL).
- Message contents are never logged.

A running record of controls, and the pre-launch OWASP review, is in [docs/security-review.md](docs/security-review.md).
