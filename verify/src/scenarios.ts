import type { Config } from "./config.ts";
import type { Check } from "./report.ts";

/**
 * An end-to-end behaviour the system must have, driven against real processes.
 *
 * A scenario is either:
 * - `active`: it has a `run` function, and CI requires it to pass, or
 * - `pending`: the components it drives don't exist yet. It names the issue
 *   that will make it active. `verify check-registry` fails if that issue is
 *   closed while the scenario is still pending, so "done" can't happen without
 *   the scenario passing.
 */
export interface Scenario {
  readonly name: string;
  readonly summary: string;
  /** What the scenario asserts, in order. Printed on every run, including pending ones. */
  readonly asserts: readonly string[];
  /** Workspace paths the scenario drives. */
  readonly requires: readonly string[];
  /** Issue that implements this scenario. */
  readonly issue: number;
  readonly status: "active" | "pending";
  readonly run?: (config: Config) => Promise<Check[]>;
}

export const scenarios: readonly Scenario[] = [
  {
    name: "sync-two-clients",
    summary: "Two scripted clients edit the same line concurrently and converge",
    asserts: [
      "A real sync server starts on SYNC_PORT and reports ready",
      "Clients A and B connect to the same room and complete the two-step sync",
      "A and B insert different text at the same position of the same line, concurrently",
      "Both clients end with byte-identical document state",
      "Each client receives an `ack` whose state vector covers its own updates",
    ],
    requires: ["apps/sync", "packages/sync-client", "packages/protocol"],
    issue: 100,
    status: "pending",
  },
  {
    name: "offline-merge",
    summary: "A client edits while offline, reconnects, and merges without conflict",
    asserts: [
      "Clients A and B are synced in one room",
      "A goes offline (socket closed, client keeps editing)",
      "A and B both edit while A is offline",
      "A reconnects; the handshake exchanges only the missing updates",
      "Both clients converge, no edit is lost, and A's status returns to `synced`",
    ],
    requires: ["apps/sync", "packages/sync-client", "packages/protocol"],
    issue: 101,
    status: "pending",
  },
  {
    name: "viewer-rejected",
    summary: "A viewer's raw edit closes the socket with 4403 and changes nothing",
    asserts: [
      "A viewer connects with a valid viewer room token",
      "The viewer sends a raw sync `update` message",
      "The server closes the socket with code 4403",
      "A viewer sending a non-empty sync step 2 is also closed with 4403",
      "The room's state vector is unchanged afterwards",
    ],
    requires: ["apps/sync", "apps/web", "packages/protocol"],
    issue: 103,
    status: "pending",
  },
  {
    name: "malformed-message",
    summary: "Fuzzed and truncated frames never crash the server",
    asserts: [
      "A healthy client is connected and synced",
      "A second socket sends random, truncated and oversized frames",
      "Each offending socket is closed with 4400 (or 4413 for oversized frames)",
      "The server process stays up and /healthz keeps answering",
      "The healthy client can still edit and receive acks throughout",
    ],
    requires: ["apps/sync", "packages/protocol"],
    issue: 102,
    status: "pending",
  },
];

export function findScenario(name: string): Scenario | undefined {
  return scenarios.find((s) => s.name === name);
}
