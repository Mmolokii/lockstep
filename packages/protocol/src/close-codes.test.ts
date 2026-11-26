import { describe, expect, it } from "vitest";
import { CloseCode, isCloseCode } from "./close-codes.ts";

describe("CloseCode", () => {
  it("keeps the documented numeric values stable", () => {
    expect(CloseCode).toEqual({
      Normal: 1000,
      ServiceRestart: 1012,
      MalformedMessage: 4400,
      InvalidToken: 4401,
      Forbidden: 4403,
      RoomNotFound: 4404,
      TooLarge: 4413,
      RateLimited: 4429,
    });
  });

  it("recognises known codes and rejects unknown ones", () => {
    expect(isCloseCode(4401)).toBe(true);
    expect(isCloseCode(1001)).toBe(false);
  });
});
