# Runbook

> Operational procedures. Sections marked _not operational yet_ become real as their milestone lands. Each procedure is tested once before it's marked operational (DoD). Every alert added later links to a section here.

## Local stack

**Start / stop / status**

```bash
pnpm infra:up
```

```bash
pnpm infra:down
```

```bash
docker compose -f infra/docker-compose.yml ps
```

**Reset all local data** (Postgres, Redis, Prometheus and Grafana volumes). This is destructive and local only:

```bash
docker compose -f infra/docker-compose.yml down --volumes
```

**Is my environment healthy?** `pnpm verify doctor`. Each failing line says what to fix.

| URL | Service | Login |
|---|---|---|
| http://localhost:3001 | Grafana | admin / admin (local only) |
| http://localhost:9090 | Prometheus | — |

## CI failed on my PR

1. Find the failing step's name in the PR checks. Every `ci.yml` step is a single `pnpm` command.
2. Reproduce everything locally with `pnpm ci:local`. It runs the same commands in the same order against docker compose, and stops at the first failure.
3. Match the step to a cause:

| Failing step | Usually means |
|---|---|
| Pipeline contract | A new package isn't in `.github/pipeline-contract.json`, a required script is missing, the wrong coverage tier is used, or a pending item's issue was closed |
| Biome | A lint warning. `pnpm lint:fix`, then fix whatever remains by hand |
| Coverage thresholds | Tests don't cover new code. Add tests; never lower the threshold |
| Verify scenarios / registry | An active scenario failed against the real stack, or a pending scenario's issue was closed |
| Bundle budgets | Built output grew past `bundle-budgets.json`. Find what grew before considering a budget change (its own PR, with a reason) |
| Conventional title and linked issue | PR title isn't `type(scope): …`, or the body doesn't say `Closes #n` |
| Dependency audit | A high or critical advisory. Update the dependency, or document a reviewed exception |

## Deploy · _not operational yet (M3.5: #50, #52)_

Merging to `main` runs `deploy.yml`: expand-only migration check → staging → smoke → production. Deploys stay off until the repository variable `DEPLOY_ENABLED=true` is set.

## Roll back · _not operational yet (M3.5)_

- **Web:** promote the previous deployment in Vercel (instant).
- **Sync:** redeploy the previous image with `flyctl deploy --image <previous>`.
- **Migrations are never rolled back.** They're expand-only (`check-migrations`), so old code runs against the new schema.

## Drain a sync instance · _not operational yet (M3: #38; M3.5: #53)_

SIGTERM triggers a drain: stop accepting connections, flush every room, close clients with **1012** (they reconnect elsewhere), and exit within the time budget.

## Restore the database · _not operational yet (M8)_

Neon point-in-time restore, tested once and timed (RTO target: under 1 hour). Record the actual RPO of the chosen plan here.

## Rotate room-token signing keys · _not operational yet (M5: #72)_

Add the new key with a new `kid` to the sync servers' accepted public keys, then switch `web` to sign with it. Remove the old key after the 5-minute token lifetime has passed.

## Alerts · _none yet (M7)_

Each alert gets a section: what it means, what to check first, and how to mitigate.
