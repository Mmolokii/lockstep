import { createConnection, createServer } from "node:net";

const TIMEOUT_MS = 2000;

/** Open a TCP connection, write `payload`, and resolve with the first bytes received. */
function exchange(host: string, port: number, payload: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`no response within ${TIMEOUT_MS} ms`));
    }, TIMEOUT_MS);
    socket.once("connect", () => socket.write(payload));
    socket.once("data", (data) => {
      clearTimeout(timer);
      socket.end();
      resolve(data);
    });
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Proves a Postgres server (not just any TCP listener) is answering: send an
 * SSLRequest message, to which Postgres replies with a single byte, 'S' or 'N'.
 */
export async function probePostgres(host: string, port: number): Promise<string> {
  const sslRequest = Buffer.alloc(8);
  sslRequest.writeInt32BE(8, 0);
  sslRequest.writeInt32BE(80877103, 4);
  const reply = await exchange(host, port, sslRequest);
  const byte = String.fromCharCode(reply[0] ?? 0);
  if (byte !== "S" && byte !== "N")
    throw new Error(`unexpected reply 0x${reply.toString("hex", 0, 4)}; not Postgres?`);
  return `Postgres protocol answered on ${host}:${port} (SSL ${byte === "S" ? "available" : "not offered"})`;
}

/** Sends a real Redis PING and expects +PONG. */
export async function probeRedis(host: string, port: number): Promise<string> {
  const reply = (await exchange(host, port, Buffer.from("PING\r\n"))).toString();
  if (!reply.startsWith("+PONG"))
    throw new Error(`expected +PONG, got ${JSON.stringify(reply.slice(0, 40))}`);
  return `PING → PONG on ${host}:${port}`;
}

/** Resolves true if nothing is listening on the port (we can bind it ourselves). */
export function isPortFree(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}
