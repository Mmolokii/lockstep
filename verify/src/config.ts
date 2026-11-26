/**
 * Configuration shared by every verify command. Values come from the
 * environment (a root `.env` is loaded if present), with defaults that match
 * infra/docker-compose.yml and .env.example.
 */
export interface Config {
  readonly postgres: { readonly host: string; readonly port: number };
  readonly redis: { readonly host: string; readonly port: number };
  readonly ports: Readonly<Record<string, number>>;
  readonly repo: string;
}

function hostPort(url: string | undefined, fallback: { host: string; port: number }) {
  if (!url) return fallback;
  const u = new URL(url);
  return { host: u.hostname || fallback.host, port: Number(u.port) || fallback.port };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    postgres: hostPort(env.DATABASE_URL, { host: "127.0.0.1", port: 5432 }),
    redis: hostPort(env.REDIS_URL, { host: "127.0.0.1", port: 6379 }),
    ports: {
      "web (WEB_PORT)": Number(env.WEB_PORT ?? 3000),
      "sync (SYNC_PORT)": Number(env.SYNC_PORT ?? 4444),
      "sync metrics (SYNC_METRICS_PORT)": Number(env.SYNC_METRICS_PORT ?? 9464),
    },
    repo: env.GITHUB_REPOSITORY ?? "Mmolokii/lockstep",
  };
}
