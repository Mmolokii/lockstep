import * as Y from "yjs";
import type { Replica } from "./harness.ts";
import { type Op, Rga } from "./rga.ts";

/** The toy RGA behind the harness interface. Messages are single ops. */
export function rgaReplica(index: number): Replica<Op> & { readonly doc: Rga } {
  const doc = new Rga(`r${index}`);
  let outgoing: Op[] = [];
  return {
    doc,
    get length() {
      return doc.length;
    },
    text: () => doc.toString(),
    insert: (position, char) => {
      outgoing.push(doc.insert(position, char));
    },
    delete: (position) => {
      outgoing.push(doc.delete(position));
    },
    takeOutgoing: () => {
      const out = outgoing;
      outgoing = [];
      return out;
    },
    receive: (messages) => doc.merge(messages),
  };
}

const REMOTE = Symbol("remote");

/** Yjs behind the same interface. Messages are binary Yjs updates. */
export function yjsReplica(index: number): Replica<Uint8Array> {
  const doc = new Y.Doc();
  doc.clientID = index + 1; // deterministic ids so failing runs reproduce
  const text = doc.getText("t");
  let outgoing: Uint8Array[] = [];
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== REMOTE) outgoing.push(update);
  });
  return {
    get length() {
      return text.length;
    },
    text: () => text.toString(),
    insert: (position, char) => text.insert(position, char),
    delete: (position) => text.delete(position, 1),
    takeOutgoing: () => {
      const out = outgoing;
      outgoing = [];
      return out;
    },
    receive: (messages) => {
      for (const m of messages) Y.applyUpdate(doc, m, REMOTE);
    },
  };
}
