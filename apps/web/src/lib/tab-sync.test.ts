import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { parseMessage, syncAcrossTabs, type TabSync } from "./tab-sync.ts";

let counter = 0;
const channelName = () => `tab-sync-test-${++counter}-${Date.now()}`;

const open: TabSync[] = [];
function tab(name: string, text = "") {
  const doc = new Y.Doc();
  if (text) doc.getText("content").insert(0, text);
  const sync = syncAcrossTabs(doc, name);
  open.push(sync);
  return { doc, text: doc.getText("content"), sync };
}

/** Waits for a condition that depends on BroadcastChannel delivery (asynchronous). */
async function until(condition: () => boolean, timeoutMs = 2000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeoutMs) throw new Error("condition not met in time");
    await new Promise((r) => setTimeout(r, 5));
  }
}
const settle = () => new Promise((r) => setTimeout(r, 50));

afterEach(() => {
  for (const s of open.splice(0)) s.close();
  vi.restoreAllMocks();
});

describe("syncAcrossTabs", () => {
  it("delivers a live edit to the other tab", async () => {
    const name = channelName();
    const a = tab(name);
    const b = tab(name);
    a.text.insert(0, "hello");
    await until(() => b.text.toString() === "hello");
  });

  it("brings a tab that opens later up to date", async () => {
    const name = channelName();
    tab(name, "existing work");
    const late = tab(name);
    late.sync.announce();
    await until(() => late.text.toString() === "existing work");
  });

  it("exchanges edits both ways when a tab joins with its own changes", async () => {
    const name = channelName();
    const a = tab(name, "from a ");
    const b = tab(name, "from b ");
    b.sync.announce();
    await until(() => a.text.toString() === b.text.toString() && a.text.length === 14);
    expect(a.text.toString()).toContain("from a ");
    expect(a.text.toString()).toContain("from b ");
  });

  it("never re-broadcasts an update it received (no echo)", async () => {
    const name = channelName();
    const a = tab(name);
    const b = tab(name);
    const posted = vi.spyOn(BroadcastChannel.prototype, "postMessage");
    a.text.insert(0, "x");
    await until(() => b.text.toString() === "x");
    await settle();
    expect(posted).toHaveBeenCalledTimes(1);
  });

  it("ignores malformed messages and bytes Yjs can't apply", async () => {
    const name = channelName();
    const b = tab(name, "intact");
    const rogue = new BroadcastChannel(name);
    rogue.postMessage("not an object");
    rogue.postMessage({ t: "update", u: [1, 2, 3] });
    rogue.postMessage({ t: "update", u: new Uint8Array([255, 255, 255, 255]) });
    rogue.postMessage({ t: "sync", u: new Uint8Array([255, 1]), sv: new Uint8Array([0]) });
    await settle();
    rogue.close();
    expect(b.text.toString()).toBe("intact");
  });

  it("stops sending and receiving once closed", async () => {
    const name = channelName();
    const a = tab(name);
    const b = tab(name);
    b.sync.close();
    a.text.insert(0, "after close");
    b.text.insert(0, "local only");
    await settle();
    expect(b.text.toString()).toBe("local only");
    expect(a.text.toString()).toBe("after close");
  });
});

describe("closing before announcing", () => {
  it("doesn't throw when announce runs after close (destroyed before IndexedDB loaded)", () => {
    const { sync } = tab(channelName());
    sync.close();
    expect(() => sync.announce()).not.toThrow();
  });
});

describe("parseMessage", () => {
  const bytes = new Uint8Array([0]);
  it.each([
    [{ t: "update", u: bytes }, "update"],
    [{ t: "hello", sv: bytes }, "hello"],
    [{ t: "sync", u: bytes, sv: bytes }, "sync"],
  ])("accepts %o", (message, type) => {
    expect(parseMessage(message)?.t).toBe(type);
  });

  it.each([
    null,
    "update",
    42,
    {},
    { t: "update" },
    { t: "update", u: [0] },
    { t: "hello", u: bytes },
    { t: "sync", u: bytes },
    { t: "other", u: bytes },
  ])("rejects %o", (message) => {
    expect(parseMessage(message)).toBeNull();
  });
});
