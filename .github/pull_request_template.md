Closes #

## What

<!-- One or two sentences. -->

## Why

<!-- The problem, or the milestone item it delivers. Link the RFC or ADR. -->

## How it was tested

<!-- Commands and their output, screenshots or recordings. Numbers need the machine spec. -->

## Risk and rollback

<!-- What could break, who would notice, and how to undo it (revert, flag, redeploy previous image). -->

## Definition of Done

**Code and tests**
- [ ] Acceptance criteria met and covered by tests
- [ ] Property or fuzz tests updated (CRDT, protocol or parser changes)
- [ ] Bug fix includes a test that failed before the fix
- [ ] Coverage thresholds pass

**Operability** (server-side changes)
- [ ] Metrics and structured logs for new paths; no message contents logged
- [ ] Failure behaviour defined and tested
- [ ] Runbook section for any new alert or procedure

**Security** (required if labelled `security-sensitive`)
- [ ] AuthZ checked server-side for every new operation
- [ ] All input validated; no secrets or tokens in logs, URLs or errors

**Docs**
- [ ] DESIGN / protocol / runbook updated where behaviour changed
- [ ] ADR merged for any decision (`needs-adr`)
- [ ] Tech debt taken is logged as an issue

**Not applicable:** <!-- list the items above that don't apply, so unticked boxes are explained -->
