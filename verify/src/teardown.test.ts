import { describe, expect, it } from "vitest";
import { Teardown, withTeardown } from "./teardown.ts";

describe("Teardown", () => {
  it("releases resources in reverse order of registration", async () => {
    const order: string[] = [];
    const t = new Teardown();
    t.add("server", "s", () => void order.push("server"));
    t.add("socket", "w", () => void order.push("socket"));
    expect(t.size).toBe(2);
    expect(await t.releaseAll()).toEqual([]);
    expect(order).toEqual(["socket", "server"]);
    expect(t.size).toBe(0);
  });

  it("returns the registered value so it can be used inline", () => {
    const t = new Teardown();
    expect(t.add("x", 42, () => {})).toBe(42);
  });

  it("keeps releasing after a cleanup fails, and reports the failure", async () => {
    const released: string[] = [];
    const t = new Teardown();
    t.add("a", 1, () => void released.push("a"));
    t.add("b", 2, () => {
      throw new Error("kill failed");
    });
    const failures = await t.releaseAll();
    expect(released).toEqual(["a"]);
    expect(failures).toEqual([{ name: "teardown: b", ok: false, detail: "kill failed" }]);
  });
});

describe("withTeardown", () => {
  it("releases everything after a passing body", async () => {
    let closed = false;
    const checks = await withTeardown(async (t) => {
      t.add("socket", null, async () => {
        closed = true;
      });
      return [{ name: "converged", ok: true, detail: "" }];
    });
    expect(closed).toBe(true);
    expect(checks).toEqual([{ name: "converged", ok: true, detail: "" }]);
  });

  it("releases everything and reports the error when the body throws", async () => {
    let closed = false;
    const checks = await withTeardown(async (t) => {
      t.add("server", null, () => {
        closed = true;
      });
      throw new Error("server never became ready");
    });
    expect(closed).toBe(true);
    expect(checks).toEqual([
      { name: "scenario threw", ok: false, detail: "server never became ready" },
    ]);
  });
});
