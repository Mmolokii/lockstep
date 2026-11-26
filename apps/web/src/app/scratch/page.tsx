import type { Metadata } from "next";
import { ScratchEditor } from "./scratch-editor.tsx";

export const metadata: Metadata = { title: "Scratch · Lockstep" };

export default function ScratchPage() {
  return (
    <main className="mx-auto flex h-dvh max-w-5xl flex-col gap-3 px-4 py-6">
      <h1 className="text-xl font-semibold tracking-tight">Scratch</h1>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Saved in this browser only. Edits survive a reload and work offline.
      </p>
      <ScratchEditor />
    </main>
  );
}
