/**
 * Baseline security headers for every response.
 *
 * The CSP here is a baseline for M2: Next.js injects inline bootstrap scripts,
 * so `script-src` still allows 'unsafe-inline'. The strict, nonce-based CSP
 * (no 'unsafe-inline') arrives with web hardening in M5 (#78). Everything
 * else is already locked down: no framing, no plugins, no foreign forms,
 * no cross-origin connections except our own WebSocket endpoints.
 */
export interface HeaderOptions {
  /** Development needs 'unsafe-eval' for React Refresh; production never gets it. */
  readonly dev: boolean;
  /**
   * True only when the site is served over HTTPS (Vercel sets VERCEL=1).
   * Adds `upgrade-insecure-requests` and HSTS. Sending them over plain HTTP
   * breaks the page: WebKit upgrades every script request to HTTPS and fails,
   * so local production builds and e2e runs would load without JavaScript.
   */
  readonly https: boolean;
  /** Origins the client may open WebSockets to (the sync server), e.g. "wss://sync.example". */
  readonly connectSrc?: readonly string[];
}

export function contentSecurityPolicy({ dev, https, connectSrc = [] }: HeaderOptions): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...connectSrc, ...(dev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");
  return https ? `${policy}; upgrade-insecure-requests` : policy;
}

export function securityHeaders(options: HeaderOptions): { key: string; value: string }[] {
  const hsts = options.https
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : [];
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    },
    ...hsts,
  ];
}
