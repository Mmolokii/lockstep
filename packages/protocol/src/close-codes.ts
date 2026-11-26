/**
 * WebSocket close codes used by Lockstep. These values are part of the public
 * wire contract (see docs/protocol.md) and must never be renumbered.
 *
 * Placeholder for M0: M3 adds the client behaviour for each code.
 */
export const CloseCode = {
  Normal: 1000,
  ServiceRestart: 1012,
  MalformedMessage: 4400,
  InvalidToken: 4401,
  Forbidden: 4403,
  RoomNotFound: 4404,
  TooLarge: 4413,
  RateLimited: 4429,
} as const;

export type CloseCode = (typeof CloseCode)[keyof typeof CloseCode];

const known = new Set<number>(Object.values(CloseCode));

export function isCloseCode(code: number): code is CloseCode {
  return known.has(code);
}
