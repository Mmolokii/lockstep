import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Config } from "./config.ts";
import { isPortFree, probePostgres, probeRedis } from "./probes.ts";
import type { Check } from "./report.ts";

async function attempt(
  name: string,
  fn: () => Promise<string>,
  hint: string,
  optional = false,
): Promise<Check> {
  try {
    return { name, ok: true, detail: await fn() };
  } catch (err) {
    return { name, ok: false, detail: `${(err as Error).message}. ${hint}`, optional };
  }
}

/** Runs a command and returns trimmed stdout, or null if it fails. Injectable so tests never shell out. */
export type CommandRunner = (cmd: string, args: string[]) => string | null;

export const runCommand: CommandRunner = (cmd, args) => {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
};

export async function doctor(
  config: Config,
  root: string,
  command: CommandRunner = runCommand,
): Promise<Check[]> {
  const checks: Check[] = [];

  const wantNode = Number(readFileSync(join(root, ".nvmrc"), "utf8").trim());
  const haveNode = Number(process.versions.node.split(".")[0]);
  checks.push({
    name: "Node version",
    ok: haveNode >= wantNode,
    detail: `have v${process.versions.node}, need >= ${wantNode} (.nvmrc)`,
  });

  const wantPnpm = (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")).packageManager as string
  ).split("@")[1];
  const havePnpm = command("pnpm", ["--version"]);
  checks.push({
    name: "pnpm version",
    ok: havePnpm === wantPnpm,
    detail: havePnpm
      ? `have ${havePnpm}, packageManager pins ${wantPnpm}`
      : "pnpm not found on PATH",
    optional: havePnpm !== null,
  });

  const docker = command("docker", ["info", "--format", "{{.ServerVersion}}"]);
  checks.push({
    name: "Docker daemon",
    ok: docker !== null,
    detail: docker
      ? `server ${docker}`
      : "not reachable. Start Docker Desktop; needed for `pnpm infra:up`",
    optional: true,
  });

  const { postgres, redis } = config;
  checks.push(
    await attempt(
      "Postgres",
      () => probePostgres(postgres.host, postgres.port),
      "Run `pnpm infra:up` or set DATABASE_URL",
    ),
  );
  checks.push(
    await attempt(
      "Redis",
      () => probeRedis(redis.host, redis.port),
      "Run `pnpm infra:up` or set REDIS_URL",
    ),
  );

  for (const [name, port] of Object.entries(config.ports)) {
    const free = await isPortFree(port);
    checks.push({
      name: `Port ${port} free for ${name}`,
      ok: free,
      detail: free
        ? ""
        : "in use. Stop the process holding it (a dev server already running?) or change the port in .env",
    });
  }

  checks.push({
    name: ".env file",
    ok: existsSync(join(root, ".env")),
    detail: existsSync(join(root, ".env"))
      ? "found"
      : "missing; defaults from .env.example apply. `cp .env.example .env` to customise",
    optional: true,
  });

  return checks;
}
