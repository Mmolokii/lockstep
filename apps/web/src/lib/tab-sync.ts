import * as Y from "yjs";

/**
 * Keeps one Y.Doc in step across tabs of the same origin with a
 * BroadcastChannel. No server is involved; this is local-first only.
 *
 * Messages (structured-cloned, never sent over the network):
 * - `{ t: "update", u }`: a local edit, as a Yjs update
 * - `{ t: "hello", sv }`: a tab joined; `sv` is its state vector
 * - `{ t: "sync", u, sv }`: reply to hello: what the newcomer is missing,
 *   plus the replier's state vector so the newcomer can send back what the
 *   replier is missing
 *
 * Anything else, or bytes Yjs can't apply, is ignored. Contents are never logged.
 */
export interface TabSync {
  /** Announces this tab so open tabs send what it's missing. Call once local state has loaded. */
  announce(): void;
  close(): void;
}

type Message =
  | { readonly t: "update"; readonly u: Uint8Array }
  | { readonly t: "hello"; readonly sv: Uint8Array }
  | { readonly t: "sync"; readonly u: Uint8Array; readonly sv: Uint8Array };

const isBytes = (v: unknown): v is Uint8Array => v instanceof Uint8Array;

export function parseMessage(data: unknown): Message | null {
  if (typeof data !== "object" || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m.t === "update" && isBytes(m.u)) return { t: "update", u: m.u };
  if (m.t === "hello" && isBytes(m.sv)) return { t: "hello", sv: m.sv };
  if (m.t === "sync" && isBytes(m.u) && isBytes(m.sv)) return { t: "sync", u: m.u, sv: m.sv };
  return null;
}

/** An update that changes nothing: no structs, empty delete set. */
const isEmptyUpdate = (u: Uint8Array) => u.length <= 2;

export function syncAcrossTabs(doc: Y.Doc, channelName: string): TabSync {
  const channel = new BroadcastChannel(channelName);
  // Updates applied from the channel carry this origin, so they're never re-broadcast.
  const origin = channel;
  let closed = false;

  const post = (message: Message) => {
    if (!closed) channel.postMessage(message);
  };

  const apply = (update: Uint8Array) => {
    try {
      Y.applyUpdate(doc, update, origin);
    } catch {
      // Malformed bytes from another tab: ignore rather than break this tab.
    }
  };

  const onUpdate = (update: Uint8Array, updateOrigin: unknown) => {
    if (updateOrigin !== origin) post({ t: "update", u: update });
  };

  channel.onmessage = (event: MessageEvent<unknown>) => {
    const message = parseMessage(event.data);
    if (message === null) return;
    switch (message.t) {
      case "update":
        apply(message.u);
        return;
      case "hello":
        post({
          t: "sync",
          u: Y.encodeStateAsUpdate(doc, message.sv),
          sv: Y.encodeStateVector(doc),
        });
        return;
      case "sync": {
        apply(message.u);
        const missing = Y.encodeStateAsUpdate(doc, message.sv);
        if (!isEmptyUpdate(missing)) post({ t: "update", u: missing });
        return;
      }
    }
  };

  doc.on("update", onUpdate);

  return {
    announce: () => post({ t: "hello", sv: Y.encodeStateVector(doc) }),
    close: () => {
      closed = true;
      doc.off("update", onUpdate);
      channel.close();
    },
  };
}
