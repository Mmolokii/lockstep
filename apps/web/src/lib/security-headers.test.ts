import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers.ts";

const directive = (csp: string, name: string) =>
  csp
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ") ?? [];

describe("contentSecurityPolicy", () => {
  it("never allows eval in production", () => {
    expect(
      directive(contentSecurityPolicy({ dev: false, https: true }), "script-src"),
    ).not.toContain("'unsafe-eval'");
  });

  it("upgrades insecure requests only when served over HTTPS", () => {
    // Over plain HTTP the directive makes WebKit fetch scripts over HTTPS and fail (found by e2e).
    expect(contentSecurityPolicy({ dev: false, https: true })).toMatch(
      /upgrade-insecure-requests$/,
    );
    expect(contentSecurityPolicy({ dev: false, https: false })).not.toContain(
      "upgrade-insecure-requests",
    );
  });

  it("allows eval and ws: only in development (React Refresh)", () => {
    const csp = contentSecurityPolicy({ dev: true, https: false });
    expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
    expect(directive(csp, "connect-src")).toContain("ws:");
    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  it("locks down framing, plugins, base URI and form targets", () => {
    const csp = contentSecurityPolicy({ dev: false, https: false });
    expect(directive(csp, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(csp, "object-src")).toEqual(["'none'"]);
    expect(directive(csp, "base-uri")).toEqual(["'self'"]);
    expect(directive(csp, "form-action")).toEqual(["'self'"]);
  });

  it("only allows connections to self plus explicitly configured sync origins", () => {
    const csp = contentSecurityPolicy({
      dev: false,
      https: false,
      connectSrc: ["wss://sync.example"],
    });
    expect(directive(csp, "connect-src")).toEqual(["'self'", "wss://sync.example"]);
  });
});

describe("securityHeaders", () => {
  it("adds HSTS only over HTTPS", () => {
    const keys = (https: boolean) => securityHeaders({ dev: false, https }).map((h) => h.key);
    expect(keys(true)).toContain("Strict-Transport-Security");
    expect(keys(false)).not.toContain("Strict-Transport-Security");
  });

  it("sends the full baseline set", () => {
    const keys = securityHeaders({ dev: false, https: false }).map((h) => h.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Cross-Origin-Opener-Policy",
      "Permissions-Policy",
    ]);
  });
});
