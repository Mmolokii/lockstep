# Load-test report

> **No measurements yet.** This report fills in during M7. Until then it contains **no numbers**, because every figure here must come from a run whose command, raw output and instance spec are included.

## What this report will contain

| Question | Measured how |
|---|---|
| p50/p95/p99 edit propagation, client A → client B, with 20 editors in a room | Propagation-latency harness: headless clients in the same region as the sync server; states whether render time is included |
| Connections per instance before p95 exceeds 100 ms | k6 ramp (`loadtest/`) against one sync instance of a stated size |
| Active rooms per instance, and memory per room and per connection | k6 + Prometheus memory metrics |
| Messages per second per instance | k6 + `sync_messages_total` |
| Cross-instance cost (Redis fan-out, duplicated Y.Docs) | Two instances, rooms split across them |
| **The bottleneck** (CPU, memory, event-loop lag, Redis or Postgres) and what would fix it | Saturation metrics at the knee of the curve |

## Template for each run

```
Date:
Commit:
Instance: (provider, region, vCPU, RAM)
Load generator: (machine, region)
Command:
Raw output: (attached or linked)
Result:
Interpretation:
```

Related: the [System Overview §6](SYSTEM_OVERVIEW.md#6-scaling-model) and [ADR 0007](adr/0007-redis-pubsub-fan-out-with-single-writer.md).
