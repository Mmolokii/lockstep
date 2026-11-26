"use client";

import type { Editor, Theme } from "@lockstep/editor";
import { useEffect, useRef, useState } from "react";
import { openLocalDoc } from "../../lib/local-doc.ts";

const DOC_NAME = "scratch";
const FILENAME = "scratch.ts";

export function ScratchEditor() {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<Editor | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const parent = host.current;
    if (!parent) return;
    const local = openLocalDoc(DOC_NAME);
    const initialTheme: Theme = matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
    let cancelled = false;

    // The editor is loaded on demand so the rest of the app doesn't ship it.
    Promise.all([import("@lockstep/editor"), local.whenLoaded]).then(([{ createEditor }]) => {
      if (cancelled) return;
      editor.current = createEditor({
        parent,
        ytext: local.text,
        filename: FILENAME,
        theme: initialTheme,
        label: FILENAME,
      });
      setTheme(initialTheme);
      setReady(true);
    });

    return () => {
      cancelled = true;
      editor.current?.destroy();
      editor.current = null;
      void local.destroy();
    };
  }, []);

  const toggleTheme = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    editor.current?.setTheme(next);
    setTheme(next);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Editor">
      <div className="flex items-center justify-between text-sm">
        <span className="font-mono text-neutral-600 dark:text-neutral-400">{FILENAME}</span>
        <button
          type="button"
          onClick={toggleTheme}
          disabled={!ready}
          aria-pressed={theme === "dark"}
          className="rounded border border-neutral-300 px-3 py-1 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Dark theme
        </button>
      </div>
      <div
        ref={host}
        aria-busy={!ready}
        className="min-h-0 flex-1 overflow-auto rounded border border-neutral-300 dark:border-neutral-700 [&_.cm-editor]:h-full"
      />
    </section>
  );
}
