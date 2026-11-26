import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";
import { type CommandRunner, doctor } from "./doctor.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
// Unit tests never shell out to real pnpm or Docker: `docker info` alone can take seconds on CI runners.
const fakeCommands: CommandRunner = (cmd) =>
  cmd === "pnpm" ? "12.23.0" : cmd === "docker" ? "29.0.0" : null;
const cli = (...args: string[]) =>
  spawnSync(process.execPath, ["verify/src/cli.ts", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
  });

describe("verify CLI exit codes", () => {
  it("list exits 0 and shows every scenario", () => {
    const r = cli("list");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("sync-two-clients");
    expect(r.stdout).toContain("#103");
  });

  it("a pending scenario exits 2 and prints what it will check", () => {
    const r = cli("viewer-rejected");
    expect(r.status).toBe(2);
    expect(r.stdout).toContain("closes the socket with code 4403");
    expect(r.stdout).toContain("PENDING viewer-rejected (exit 2)");
  });

  it("all exits 0 when nothing active fails, and counts pending scenarios", () => {
    const r = cli("all");
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/0 failed, 5 pending/);
  });

  it("--allow-pending turns pending into exit 0 with a visible notice", () => {
    const r = cli("viewer-rejected", "--allow-pending");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("::notice title=verify viewer-rejected is pending::");
  });

  it("an unknown command exits 1", () => {
    expect(cli("nonsense").status).toBe(1);
  });

  it("no command prints usage and exits 1; help exits 0", () => {
    expect(cli().status).toBe(1);
    expect(cli("help").status).toBe(0);
  });

  it("check-registry --offline exits 0 for the current registry", () => {
    const r = cli("check-registry", "--offline");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("skipped (--offline)");
  });
});

describe("doctor", () => {
  it("passes every required check against fake Postgres and Redis with free ports", async () => {
    const listen = (reply: string) =>
      new Promise<{ port: number; close: () => void }>((resolve) => {
        const s = createServer((sock) => sock.once("data", () => sock.write(reply)));
        s.listen(0, "127.0.0.1", () => {
          const a = s.address();
          resolve({ port: typeof a === "object" && a ? a.port : 0, close: () => s.close() });
        });
      });
    const pg = await listen("N");
    const redis = await listen("+PONG\r\n");
    try {
      const config = {
        ...loadConfig({}),
        postgres: { host: "127.0.0.1", port: pg.port },
        redis: { host: "127.0.0.1", port: redis.port },
        ports: { "test port": 0 },
      };
      const checks = await doctor(config, ROOT, fakeCommands);
      const failedRequired = checks.filter((c) => !c.ok && !c.optional);
      expect(failedRequired, JSON.stringify(failedRequired)).toEqual([]);
      expect(checks.map((c) => c.name)).toEqual(
        expect.arrayContaining(["Node version", "Postgres", "Redis"]),
      );
    } finally {
      pg.close();
      redis.close();
    }
  });

  it("treats a missing Docker as optional but a missing pnpm as required", async () => {
    const config = {
      ...loadConfig({}),
      postgres: { host: "127.0.0.1", port: 1 },
      redis: { host: "127.0.0.1", port: 1 },
      ports: {},
    };
    const checks = await doctor(config, ROOT, () => null);
    expect(checks.find((c) => c.name === "Docker daemon")?.optional).toBe(true);
    expect(checks.find((c) => c.name === "pnpm version")).toMatchObject({
      ok: false,
      optional: false,
    });
  });

  it("fails when Postgres and Redis are unreachable", async () => {
    const config = {
      ...loadConfig({}),
      postgres: { host: "127.0.0.1", port: 1 },
      redis: { host: "127.0.0.1", port: 1 },
      ports: {},
    };
    const failedNames = (await doctor(config, ROOT, fakeCommands))
      .filter((c) => !c.ok && !c.optional)
      .map((c) => c.name);
    expect(failedNames).toEqual(expect.arrayContaining(["Postgres", "Redis"]));
  });
});
