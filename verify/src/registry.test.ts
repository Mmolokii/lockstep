import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "./config.ts";
import { checkRegistry, githubIssueLookup, type IssueLookup } from "./registry.ts";
import { ExitCode, formatCheck, formatOutcome, outcomeOf } from "./report.ts";
import { findScenario, type Scenario, scenarios } from "./scenarios.ts";

const ROOT = new URL("../..", import.meta.url).pathname;
const open: IssueLookup = async () => "open";
const closed: IssueLookup = async () => "closed";

const pending = (over: Partial<Scenario> = {}): Scenario => ({
  name: "demo",
  summary: "demo",
  asserts: ["a"],
  requires: ["packages/protocol"],
  issue: 1,
  status: "pending",
  ...over,
});

const failed = <T extends { ok: boolean; optional?: boolean | undefined }>(checks: T[]) =>
  checks.filter((c) => !c.ok && !c.optional);

describe("checkRegistry", () => {
  it("accepts a pending scenario whose issue is open", async () => {
    expect(failed(await checkRegistry([pending()], ROOT, open))).toEqual([]);
  });

  it("rejects a pending scenario whose issue is closed", async () => {
    const bad = failed(await checkRegistry([pending()], ROOT, closed));
    expect(bad).toHaveLength(1);
    expect(bad[0]?.name).toContain("tracking issue #1");
  });

  it("fails, rather than passing silently, when the issue can't be looked up", async () => {
    const broken: IssueLookup = async () => {
      throw new Error("network down");
    };
    expect(failed(await checkRegistry([pending()], ROOT, broken))).toHaveLength(1);
  });

  it("marks the issue check as an optional skip in offline mode", async () => {
    const checks = await checkRegistry([pending()], ROOT, null);
    expect(failed(checks)).toEqual([]);
    expect(checks.some((c) => c.optional && c.detail.includes("--offline"))).toBe(true);
  });

  it("rejects a pending scenario that already has a run function", async () => {
    const s = pending({ run: async () => [] });
    expect(failed(await checkRegistry([s], ROOT, open))).toHaveLength(1);
  });

  it("rejects an active scenario without a run function", async () => {
    const s = pending({ status: "active" });
    expect(failed(await checkRegistry([s], ROOT, open))[0]?.name).toContain("has a run function");
  });

  it("rejects an active scenario whose components don't exist", async () => {
    const s = pending({ status: "active", run: async () => [], requires: ["apps/does-not-exist"] });
    expect(failed(await checkRegistry([s], ROOT, open))[0]?.detail).toContain(
      "apps/does-not-exist",
    );
  });

  it("rejects duplicate scenario names", async () => {
    expect(
      failed(await checkRegistry([pending(), pending({ issue: 2 })], ROOT, open))[0]?.name,
    ).toContain("unique");
  });

  it("the real registry is valid when every tracking issue is open", async () => {
    expect(failed(await checkRegistry(scenarios, ROOT, open))).toEqual([]);
  });
});

describe("scenarios", () => {
  it("registers the four required scenarios, each with assertions", () => {
    for (const name of [
      "sync-two-clients",
      "offline-merge",
      "viewer-rejected",
      "malformed-message",
    ]) {
      const s = findScenario(name);
      expect(s, name).toBeDefined();
      expect(s?.asserts.length).toBeGreaterThan(2);
    }
    expect(findScenario("nope")).toBeUndefined();
  });
});

describe("report", () => {
  it("fails on a required failure and ignores optional ones", () => {
    expect(outcomeOf([{ name: "a", ok: true, detail: "" }])).toBe("pass");
    expect(outcomeOf([{ name: "a", ok: false, detail: "", optional: true }])).toBe("pass");
    expect(outcomeOf([{ name: "a", ok: false, detail: "" }])).toBe("fail");
  });

  it("maps outcomes to stable exit codes and readable lines", () => {
    expect(ExitCode).toEqual({ pass: 0, fail: 1, pending: 2 });
    expect(formatOutcome("doctor", "pending")).toBe("PENDING doctor (exit 2)");
    expect(formatCheck({ name: "Redis", ok: false, detail: "down" })).toBe("  ✗ Redis — down");
    expect(formatCheck({ name: "Docker", ok: false, detail: "", optional: true })).toBe(
      "  ! Docker",
    );
  });
});

describe("loadConfig", () => {
  it("reads hosts and ports from URLs, with compose defaults", () => {
    const c = loadConfig({ DATABASE_URL: "postgres://u:p@db.local:6543/x", SYNC_PORT: "5555" });
    expect(c.postgres).toEqual({ host: "db.local", port: 6543 });
    expect(c.redis).toEqual({ host: "127.0.0.1", port: 6379 });
    expect(Object.values(c.ports)).toContain(5555);
  });
});

describe("githubIssueLookup", () => {
  it("returns the issue state and sends the token when one is set", async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ state: "closed" }), { status: 200 });
    });
    try {
      expect(await githubIssueLookup("o/r", "t0ken")(7)).toBe("closed");
      expect(calls[0]?.url).toBe("https://api.github.com/repos/o/r/issues/7");
      expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
        "Bearer t0ken",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("works without a token and throws on an HTTP error", async () => {
    vi.stubGlobal("fetch", async (_url: string, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      expect(headers.authorization).toBeUndefined();
      return new Response("not found", { status: 404 });
    });
    try {
      await expect(githubIssueLookup("o/r", "")(7)).rejects.toThrow("GitHub returned 404");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
