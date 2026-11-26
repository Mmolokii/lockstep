import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openLocalDoc, storageName } from "./local-doc.ts";

let counter = 0;
const uniqueName = () => `test-${++counter}-${Date.now()}`;

describe("openLocalDoc", () => {
  it("keeps content across a close and reopen (a reload)", async () => {
    const name = uniqueName();
    const first = openLocalDoc(name);
    await first.whenLoaded;
    first.text.insert(0, "hello");
    first.text.insert(5, " world");
    await first.destroy();

    const second = openLocalDoc(name);
    await second.whenLoaded;
    expect(second.text.toString()).toBe("hello world");
    await second.destroy();
  });

  it("starts empty for a new name", async () => {
    const fresh = openLocalDoc(uniqueName());
    await fresh.whenLoaded;
    expect(fresh.text.toString()).toBe("");
    await fresh.destroy();
  });

  it("keeps documents with different names apart", async () => {
    const a = openLocalDoc(uniqueName());
    const b = openLocalDoc(uniqueName());
    await Promise.all([a.whenLoaded, b.whenLoaded]);
    a.text.insert(0, "only in a");
    expect(b.text.toString()).toBe("");
    await Promise.all([a.destroy(), b.destroy()]);
  });

  it("merges edits made by two open copies (two tabs, before cross-tab sync)", async () => {
    const name = uniqueName();
    const tab1 = openLocalDoc(name);
    const tab2 = openLocalDoc(name);
    await Promise.all([tab1.whenLoaded, tab2.whenLoaded]);
    tab1.text.insert(0, "one ");
    tab2.text.insert(0, "two ");
    await Promise.all([tab1.destroy(), tab2.destroy()]);

    const reopened = openLocalDoc(name);
    await reopened.whenLoaded;
    const text = reopened.text.toString();
    expect(text).toContain("one ");
    expect(text).toContain("two ");
    await reopened.destroy();
  });
});

describe("two tabs", () => {
  it("share edits live while both are open", async () => {
    const name = uniqueName();
    const tab1 = openLocalDoc(name);
    const tab2 = openLocalDoc(name);
    await Promise.all([tab1.whenLoaded, tab2.whenLoaded]);
    tab1.text.insert(0, "typed in tab 1");
    const start = Date.now();
    while (tab2.text.toString() !== "typed in tab 1") {
      if (Date.now() - start > 2000) throw new Error("tab 2 never received the edit");
      await new Promise((r) => setTimeout(r, 5));
    }
    await Promise.all([tab1.destroy(), tab2.destroy()]);
  });
});

describe("storageName", () => {
  it("namespaces the database", () => {
    expect(storageName("scratch")).toBe("lockstep:scratch");
  });

  it("rejects an empty name", () => {
    expect(() => storageName("  ")).toThrow(/needs a name/);
  });
});
