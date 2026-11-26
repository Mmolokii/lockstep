import { language } from "@codemirror/language";
import { EditorView, runScopeHandlers } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Y from "yjs";
import { createEditor, type Editor } from "./editor.ts";
import * as languages from "./languages.ts";

const isMac = /Mac/.test(navigator.platform);
const mod = (key: string, extra: KeyboardEventInit = {}) =>
  new KeyboardEvent("keydown", {
    key,
    ...(isMac ? { metaKey: true } : { ctrlKey: true }),
    ...extra,
  });
const press = (editor: Editor, event: KeyboardEvent) =>
  runScopeHandlers(editor.view, event, "editor");

const open: Editor[] = [];
function setup(options: { text?: string; filename?: string; theme?: "light" | "dark" } = {}) {
  const doc = new Y.Doc();
  const ytext = doc.getText("content");
  if (options.text) ytext.insert(0, options.text);
  const parent = document.createElement("div");
  document.body.append(parent);
  const editor = createEditor({
    parent,
    ytext,
    ...(options.filename ? { filename: options.filename } : {}),
    ...(options.theme ? { theme: options.theme } : {}),
  });
  open.push(editor);
  return { doc, ytext, editor };
}

afterEach(() => {
  for (const e of open.splice(0)) e.destroy();
  document.body.replaceChildren();
});

describe("Y.Text binding", () => {
  it("starts from the shared text", () => {
    const { editor } = setup({ text: "hello" });
    expect(editor.view.state.doc.toString()).toBe("hello");
  });

  it("typing updates the Y.Text", () => {
    const { editor, ytext } = setup({ text: "ab" });
    editor.view.dispatch({ changes: { from: 1, insert: "X" }, userEvent: "input.type" });
    expect(ytext.toString()).toBe("aXb");
  });

  it("remote changes to the Y.Text appear in the editor", () => {
    const { editor, doc } = setup({ text: "local" });
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    remote.getText("content").insert(0, "remote ");
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)));
    expect(editor.view.state.doc.toString()).toBe("remote local");
  });
});

describe("language", () => {
  it("is chosen by file extension once the grammar loads", async () => {
    const { editor } = setup();
    await editor.setFilename("main.py");
    expect(editor.view.state.facet(language)?.name).toBe("python");
    await editor.setFilename("notes.txt");
    expect(editor.view.state.facet(language)).toBeNull();
  });

  it("applies only the latest request when grammars load out of order", async () => {
    const { editor } = setup();
    const slow = editor.setFilename("query.sql");
    await editor.setFilename("lib.rs");
    await slow;
    expect(editor.view.state.facet(language)?.name).toBe("rust");
  });

  it("ignores a grammar that finishes loading after destroy", async () => {
    const { editor } = setup();
    const pending = editor.setFilename("main.go");
    editor.destroy();
    await expect(pending).resolves.toBeUndefined();
  });
});

describe("language loading failures", () => {
  it("stays usable as plain text when the grammar can't load", async () => {
    const spy = vi.spyOn(languages, "loadLanguage").mockRejectedValue(new Error("offline"));
    try {
      const { editor, ytext } = setup({ filename: "main.py" });
      await Promise.resolve();
      expect(editor.view.state.facet(language)).toBeNull();
      editor.view.dispatch({ changes: { from: 0, insert: "x" } });
      expect(ytext.toString()).toBe("x");
      await expect(editor.setFilename("lib.rs")).rejects.toThrow("offline");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("theme", () => {
  it("toggles between light and dark", () => {
    const { editor } = setup();
    expect(editor.view.state.facet(EditorView.darkTheme)).toBe(false);
    editor.setTheme("dark");
    expect(editor.view.state.facet(EditorView.darkTheme)).toBe(true);
    editor.setTheme("light");
    expect(editor.view.state.facet(EditorView.darkTheme)).toBe(false);
  });

  it("can start dark", () => {
    const { editor } = setup({ theme: "dark" });
    expect(editor.view.state.facet(EditorView.darkTheme)).toBe(true);
  });
});

describe("keyboard", () => {
  it("Mod-z undoes this client's edit but never a collaborator's", () => {
    const { editor, ytext, doc } = setup({ text: "base" });
    editor.view.dispatch({ changes: { from: 4, insert: " mine" }, userEvent: "input.type" });
    // A collaborator's edit arrives as a remote update.
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    remote.getText("content").insert(0, "theirs ");
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)));

    expect(press(editor, mod("z"))).toBe(true);
    expect(ytext.toString()).toBe("theirs base");
    // With Shift held, browsers report key "Z"; CodeMirror maps it back through keyCode.
    expect(press(editor, mod("Z", { shiftKey: true, keyCode: 90 }))).toBe(true);
    expect(ytext.toString()).toBe("theirs base mine");
  });

  it("Mod-y redoes on Windows and Linux", () => {
    const { editor, ytext } = setup({ text: "a" });
    editor.view.dispatch({ changes: { from: 1, insert: "b" }, userEvent: "input.type" });
    press(editor, mod("z"));
    expect(ytext.toString()).toBe("a");
    if (!isMac) {
      expect(press(editor, mod("y"))).toBe(true);
      expect(ytext.toString()).toBe("ab");
    }
  });

  it("Tab indents the line", () => {
    const { editor, ytext } = setup({ text: "x" });
    expect(press(editor, new KeyboardEvent("keydown", { key: "Tab" }))).toBe(true);
    expect(ytext.toString()).toMatch(/^\s+x$/);
  });

  it("Mod-f opens search", () => {
    const { editor } = setup({ text: "find me" });
    expect(press(editor, mod("f"))).toBe(true);
    expect(editor.view.dom.querySelector(".cm-search")).not.toBeNull();
  });

  it("names the editing surface for assistive technology", () => {
    const { editor } = setup({ filename: "main.ts" });
    expect(editor.view.contentDOM.getAttribute("aria-label")).toBe("main.ts");
  });
});
