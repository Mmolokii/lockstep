import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { syncAcrossTabs } from "./tab-sync.ts";

/**
 * A Y.Doc kept in this browser's IndexedDB (y-indexeddb), so edits survive a
 * reload and keep working with the network off, and shared live with other
 * tabs of this origin over a BroadcastChannel. Nothing here talks to a
 * server; the sync client (M3) adds the network on top of the same doc.
 */
export interface LocalDoc {
  readonly doc: Y.Doc;
  /** The document's text, under the field name every client agrees on. */
  readonly text: Y.Text;
  /** Resolves once the stored state has been loaded into `doc`. */
  readonly whenLoaded: Promise<void>;
  /** Stops persisting and frees the doc. Stored data is kept. */
  destroy(): Promise<void>;
}

export const TEXT_FIELD = "content";
const PREFIX = "lockstep:";

/** The IndexedDB database name for a document. */
export function storageName(name: string): string {
  if (name.trim() === "") throw new Error("a local document needs a name");
  return `${PREFIX}${name}`;
}

export function openLocalDoc(name: string): LocalDoc {
  const doc = new Y.Doc();
  const key = storageName(name);
  const persistence = new IndexeddbPersistence(key, doc);
  const tabs = syncAcrossTabs(doc, key);
  // Announce after stored state is in, so open tabs only send what's missing.
  const whenLoaded = persistence.whenSynced.then(() => tabs.announce());
  return {
    doc,
    text: doc.getText(TEXT_FIELD),
    whenLoaded,
    destroy: async () => {
      tabs.close();
      await persistence.destroy();
      doc.destroy();
    },
  };
}
