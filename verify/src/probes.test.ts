import { createServer, type Server } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { isPortFree, probePostgres, probeRedis } from "./probes.ts";

const servers: Server[] = [];

/** A TCP server that answers the first data it receives with `reply`. */
function fakeServer(reply: string | Buffer | null): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer((socket) => {
      socket.once("data", () => {
        if (reply !== null) socket.write(reply);
      });
      socket.on("error", () => {});
    });
    servers.push(server);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve(typeof address === "object" && address ? address.port : 0);
    });
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => new Promise((r) => s.close(r))));
});

describe("probeRedis", () => {
  it("passes when the server answers PING with +PONG", async () => {
    const port = await fakeServer("+PONG\r\n");
    await expect(probeRedis("127.0.0.1", port)).resolves.toContain("PING → PONG");
  });

  it("fails when something other than Redis answers", async () => {
    const port = await fakeServer("HTTP/1.1 400 Bad Request\r\n");
    await expect(probeRedis("127.0.0.1", port)).rejects.toThrow("expected +PONG");
  });

  it("fails when nothing is listening", async () => {
    const port = await fakeServer(null);
    await new Promise((r) => servers.pop()?.close(r));
    await expect(probeRedis("127.0.0.1", port)).rejects.toThrow();
  });
});

describe("probePostgres", () => {
  it("passes when the server answers the SSLRequest with N", async () => {
    const port = await fakeServer("N");
    await expect(probePostgres("127.0.0.1", port)).resolves.toContain("SSL not offered");
  });

  it("passes when the server answers with S", async () => {
    const port = await fakeServer("S");
    await expect(probePostgres("127.0.0.1", port)).resolves.toContain("SSL available");
  });

  it("fails when a non-Postgres service answers", async () => {
    const port = await fakeServer("+PONG\r\n");
    await expect(probePostgres("127.0.0.1", port)).rejects.toThrow("not Postgres");
  });

  it("times out when the server never answers", async () => {
    const port = await fakeServer(null);
    await expect(probePostgres("127.0.0.1", port)).rejects.toThrow("no response");
  }, 5000);
});

describe("isPortFree", () => {
  it("reports a listening port as taken and an unused one as free", async () => {
    const port = await fakeServer(null);
    expect(await isPortFree(port)).toBe(false);
    await new Promise((r) => servers.pop()?.close(r));
    expect(await isPortFree(port)).toBe(true);
  });
});
