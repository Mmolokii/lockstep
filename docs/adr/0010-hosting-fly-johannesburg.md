# 0010. Host the sync server on Fly.io in Johannesburg; web on Vercel; Postgres on Neon (Frankfurt)

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M3.5 (#49)

## Context

Lockstep has two deployables with very different shapes:

- **web** (Next.js) does request/response work: auth, projects, room tokens and the UI. It's stateless.
- **sync** holds WebSockets for hours, keeps each room's Y.Doc in memory, and must drain gracefully on deploy (close 1012, flush, exit).

Serverless functions (Vercel, Lambda) are request-scoped and can't hold a socket or in-memory room state between requests. That's why sync is a separate long-running app (System Overview §2).

Constraints:
- Rolling deploys gated by health checks, with a configurable shutdown timeout for the drain.
- A private network between sync instances and Redis.
- Low running cost for a portfolio project.
- Likely first users in South Africa (tutoring, study groups, pair-programming practice), and POPIA in scope.

## Options considered

Prices are from each provider's published pricing on 2026-11-26. They aren't measured bills.

### Sync server

| Option | Fits long-lived sockets | Rolling deploy + drain | Africa region | Notes |
|---|---|---|---|---|
| **Fly.io** | Yes (long-running machines) | Yes: health-check-gated rolling deploys, `kill_signal` / `kill_timeout` | **Yes, `jnb`** | No free tier. Smallest machine ~$2.86/mo in `jnb` (regional multiplier 1.303) vs ~$2.19 in Ashburn |
| Render | Yes on paid plans | Yes | No | Free instances sleep after ~15 min idle, which drops every socket. Paid from $7/mo per instance |
| Railway | Yes | Yes | No | Metered pricing; no advantage over Fly for this workload |
| Hetzner / bare VPS | Yes | Hand-built | No South African location | Cheapest compute, but the rolling-deploy and drain story M3.5 exists to demonstrate would be bespoke |
| Cloudflare Durable Objects | Yes | Platform-managed | Edge | Replaces the hand-built sync server, which defeats the project's thesis |

### Region

**Johannesburg (`jnb`):**
- Users in South Africa see each other's edits in tens of milliseconds.
- Opening a document reads from Neon in Frankfurt (no African Neon region), adding roughly half a second on a cold room load.
- Writes are batched every ~500 ms in the background (ADR 0008).
- Compute costs 1.3×.

**Frankfurt (`fra`):**
- Everything co-located, and cheapest.
- Best for European and US reviewers.
- South African users would see remote edits noticeably later, on the order of 150–200 ms.

### Redis (pub/sub and revocation events)

- **Upstash pay-as-you-go:** $0.20 per 100K commands after 500K a month free. Fan-out is billed per command. At an illustrative 100 publishes a second (20 editors, 5 updates a second each), that's ~8.6M commands a day, about $17 a day. This is arithmetic on the list price, not a measurement.
- **Redis 8 on a small Fly machine** next to the sync servers: a flat ~$3/mo, the private network, and the same `redis:8-alpine` image the pipeline contract checks against docker compose. Pub/sub and revocation channels are ephemeral, so no persistence is needed.

### Postgres

- **Neon:** a free plan (1 GB per project), and branching for staging and previews. Nearest region to South Africa is Frankfurt (AWS eu-central-1); there's no African region.
- **Fly Managed Postgres:** from ~$38/mo, with no Johannesburg region.

## Decision

- **sync:** Fly.io, primary region **`jnb`**. `shared-cpu-1x` machines with **512 MB** to start: Node, `ws` and in-memory Y.Docs are tight in 256 MB. One machine at M3.5, two from M8. The M7 load test confirms or changes the size.
- **Redis:** Redis 8 on a Fly machine in `jnb`, on the private network, not exposed publicly.
- **web:** Vercel Hobby (portfolio, non-commercial). Move to Pro if it ever becomes commercial.
- **Postgres:** Neon, Frankfurt (AWS eu-central-1). Production and staging are separate projects or branches.
- **Errors:** Sentry developer plan.

## Consequences

- **Cold room load pays one round trip to Frankfurt** (load = snapshot + tail, ADR 0008); keystrokes never do. Room eviction after idle (#63) should be generous, so rooms in active use stay in memory.
- **Fly has no OIDC**, so CI deploys use a scoped deploy token with an expiry, held in GitHub Environment secrets and rotated when it expires (System Overview §7).
- **Data at rest is in Frankfurt** whichever sync region is used, so the region choice doesn't change residency. The privacy notice (M8) states it.
- **Expected running cost at list prices:** ~$6/mo plus bandwidth at M3.5 (one sync machine plus Redis), more at M8 with two sync machines. Real bills go in `docs/metrics.md`; billing alerts are set on every provider.
- **Reversible:** moving sync to another Fly region is a redeploy. Only Neon's region is fixed at project creation.
- **Revisit if** most real usage turns out to come from outside southern Africa (move to `fra`, co-locating with Neon), or if M7 shows a need for multiple regions (System Overview §6).
- **Accounts are created just in time:** Vercel when `apps/web` exists (M2), Fly and Sentry at M3.5, Neon at M4.
