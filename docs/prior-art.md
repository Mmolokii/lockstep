# Prior art

What already exists for live collaborative editing, what each does well, and what it trades away. Researched November 2026. Claims are sourced; where only secondary sources were found, that's noted.

## Collaborative editors

### VS Code Live Share

**How it works.** Host and guest. The host's machine owns the files, language services, terminals and servers, and guests get a remote view. It tries a direct peer-to-peer connection first and falls back to a Microsoft cloud relay. The session is end-to-end encrypted with keys held by the host, and the relay doesn't persist traffic. ([features](https://learn.microsoft.com/en-us/visualstudio/liveshare/overview/features), [connectivity](https://docs.microsoft.com/en-us/visualstudio/liveshare/reference/connectivity), [security](https://learn.microsoft.com/visualstudio/liveshare/reference/security))

**Does well.** Shares the whole dev environment, not just text: debugging, terminals, localhost servers. Code never leaves the host, which matters in enterprises.

**Trade-offs.** The host is a single point of failure: when the host leaves, the session ends. No offline editing, because there's no replicated document to edit. It's tied to VS Code and Visual Studio, and Microsoft's docs now describe it as being in maintenance mode, with no new features planned. ([FAQ](https://learn.microsoft.com/en-us/visualstudio/liveshare/faq))

### Zed

**How it works.** Collaboration is built into the editor. Buffers are replicated with a CRDT that Zed wrote itself, in Rust, as part of its core text data structure. A central `collab` server (Rust, PostgreSQL, Protocol Buffers over WebSocket) handles auth, rooms and message routing, and LiveKit provides audio and screen sharing. ([Zed's CRDT post](https://zed.dev/blog/crdts), [local collaboration docs](https://zed.dev/docs/development/local-collaboration); routing details from [DeepWiki](https://deepwiki.com/zed-industries/zed/11.1-collaboration-architecture), an auto-generated secondary source)

**Does well.** The CRDT lives in the editor's own buffer, so collaboration costs almost nothing extra in latency or complexity for the user. It's the strongest public example of a production text CRDT designed hand in hand with an editor.

**Trade-offs.** Only works in Zed's native app (no browser). The CRDT is purpose-built and not reusable elsewhere. Self-hosting the collab server is documented as unsupported and still in development.

### Replit multiplayer

**How it works.** Operational transformation (OT), with the server as the authority on file contents. Replit moved file authority from the repl owner's browser to the server so that concurrent edits could be ordered and transformed centrally. ([Making Repl.it Collaborative at Heart](https://replit.com/blog/collab))

**Does well.** Collaboration covers the whole workspace, including running code, the shell and the file system, not just one editor buffer.

**Trade-offs.** OT needs a central server to order operations, which makes offline editing and peer-to-peer much harder than with a CRDT. Collaboration is inseparable from Replit's hosted runtime.

### CodeSandbox Live

**How it works.** At launch (2018), OT, using parts of `ot.js` on the client and an Elixir/Phoenix backend with a custom OT implementation. Each room was its own Elixir process, with room state kept in Redis so a disconnect or rolling deploy wouldn't lose it. It had an open mode and a "classroom" mode that restricts who can edit. ([launch post](https://codesandbox.io/blog/introducing-codesandbox-live-real-time-code-collaboration-in-the-browser)) I found no current official write-up of the internals.

**Does well.** Pioneered collaboration in the browser. The per-room process plus external state is a clean model for surviving deploys. Classroom mode anticipates the teaching use case.

**Trade-offs.** OT again requires a central server to order operations. Room state lives in Redis, so Redis availability becomes part of correctness.

## Infrastructure

### Yjs and its providers

A CRDT library for shared types (text, arrays, maps, XML) with a compact binary update format, a two-step sync protocol (state vector, then missing updates) and an awareness protocol for presence. Providers are pluggable: `y-websocket` (a reference server), `y-webrtc` (peer-to-peer), `y-indexeddb` (offline persistence). Editor bindings exist for CodeMirror, Monaco, ProseMirror and others.

**Does well.** Fast, small updates, a mature ecosystem, and transport-agnostic. **Trade-offs.** The reference server is minimal: no auth, permissions, scaling or durable persistence. Everything that makes it production-ready is left to you. That gap is exactly Lockstep's scope.

### Automerge

A JSON-like CRDT. Since version 2 the core is written in Rust and compiled to WebAssembly for JavaScript. `automerge-repo` adds storage and networking. Automerge 3 reports more than 10× lower memory use. ([Automerge](https://automerge.org/), [Merry Commitmas](https://automerge.org/blog/merry-commitmas/), [Towards Production](https://inkandswitch.com/automerge-rs/post/towards-production))

**Does well.** Keeps full history and is designed for local-first apps, with a rich data model. **Trade-offs.** A smaller ecosystem of editor bindings than Yjs. Per its docs, the Rust `automerge-repo` isn't wire-compatible with the JavaScript one yet. ([docs.rs](https://docs.rs/crate/automerge_repo/latest))

### Hocuspocus

An open-source, self-hostable Yjs WebSocket server from the Tiptap team, with hooks for auth, persistence and scaling (including a Redis extension). Community feedback praises how configurable it is. ([Yjs forum](https://discuss.yjs.dev/t/poll-persistence-solutions/3732))

**Does well.** Nearly everything Lockstep's sync server does, ready-made. **Trade-offs.** Its internals are its own: you configure behaviour through hooks rather than owning the protocol handling, backpressure or writer coordination. That's the right choice for a product, and the wrong one for a project whose point is to understand those parts.

### Liveblocks

A managed real-time platform: presence, storage, comments and notifications, plus a Yjs integration. Rooms run on Cloudflare Durable Objects, one object per room. ([Cloudflare case study](https://www.cloudflare.com/case-studies/liveblocks), [Liveblocks Yjs](https://liveblocks.io/blog/introducing-liveblocks-yjs))

**Does well.** The fastest route to a polished product, and one object per room gives every room a single writer for free. **Trade-offs.** Vendor lock-in and per-usage pricing, and the system is opaque: you can't measure or explain what happens inside it.

### PartyKit

An open-source platform for real-time servers on Cloudflare Workers and Durable Objects, with `y-partykit` for Yjs. Acquired by Cloudflare in 2024. Persistence beyond the latest document state is up to you. ([y-partykit docs](https://docs.partykit.io/reference/y-partykit-api)) A developer write-up reports updates being dropped while a Durable Object was still starting, which made them move persistence to snapshots in Cloudflare's D1 database. ([zenn.dev](https://zenn.dev/senspace/articles/f8e2554b283a6c), secondary)

**Does well.** Rooms at the edge, close to users, without running servers. **Trade-offs.** Tied to Cloudflare's runtime and its limits, and correctness around cold starts is your problem.

### y-sweet (not in the original list, included for completeness)

An open-source Yjs server in Rust from Jamsocket, persisting to S3-compatible storage, inspired by Figma's infrastructure. ([GitHub](https://github.com/jamsocket/y-sweet))

## Summary

| | Model | Offline | Self-host | Browser | Transparency |
|---|---|---|---|---|---|
| Live Share | Host-authoritative | No | No | Partly (vscode.dev) | Closed |
| Zed | Own CRDT | Partial | Unsupported | No | Open source |
| Replit | OT, server-authoritative | No | No | Yes | Closed |
| CodeSandbox | OT | No | No | Yes | Partly open |
| Hocuspocus | Yjs | Yes (client) | Yes | Yes | Open source |
| Liveblocks | Yjs / own | Yes (client) | No | Yes | Closed |
| PartyKit | Yjs on Durable Objects | Yes (client) | Partly | Yes | Open source |

## Lockstep's positioning

> **Learner task (M0):** write three honest bullets in your own words. Say what Lockstep does *differently or more transparently* than the tools above, not that it's better. Prompts to think about: what can a reviewer *see* in Lockstep that they can't see in Liveblocks? Which numbers will Lockstep publish that the others don't? Which hard parts that Hocuspocus hides are written, tested and documented here?

1. _TODO_
2. _TODO_
3. _TODO_
