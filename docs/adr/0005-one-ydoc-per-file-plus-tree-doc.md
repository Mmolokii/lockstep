# 0005. One Y.Doc per file, plus one project Y.Doc for the file tree

- **Status:** Accepted
- **Date:** 2026-11-26
- **Milestone:** M2 (#24)

## Context

A project contains many files. We have to choose the unit of synchronisation, which is also the unit of loading, memory, persistence and permission checks.

## Options considered

### One Y.Doc per project

Every file is a `Y.Text` inside a single document.

- **Pros:** edits across files are atomic, and there's one room per project.
- **Cons:** opening one file loads every file. Memory per room, and the size of the first sync, grow with the whole project. A single hot file makes the whole project's room busy. Compaction and snapshots rewrite everything.

### One Y.Doc per file, plus a tree doc

Each file is its own document and room. A separate project document holds the file tree as a `Y.Map` from file ID to metadata (path, name, language). File content lives in the file's own document, keyed by file ID, not by path.

- **Pros:** load only what's open, smaller rooms, and smaller syncs. Persistence and compaction work per file.
- **Cons:** edits across files aren't atomic. A client holds several connections (or several multiplexed rooms) at once.

### Sub-documents (Yjs subdocs)

Nested Y.Docs inside a parent document.

- **Pros:** lazy loading within one logical document.
- **Cons:** limited support across providers and persistence. We'd build all of our sync handling around a less-travelled feature.

## Decision

**One Y.Doc per file, plus one project Y.Doc for the tree.** Files are identified by a stable ID, so a rename only changes the tree document and never moves content.

## Consequences

- Room ID = document ID. The sync server, persistence (`doc_updates.doc_id`) and room tokens all work per document. `documents.kind` is either `tree` or `file`.
- A rename or move is one tree-document update. Concurrent rename-versus-delete rules are decided in the file-tree ADR (M6a).
- **No cross-file atomicity.** A future "rename symbol across files" feature couldn't be applied atomically. That's acceptable for v1, and noted here so nobody assumes otherwise.
- The client connects to several rooms (the tree plus each open file). The protocol (#30) must decide between one socket per room and multiplexing.
- Deleting a project means deleting the tree document and every file document (#79).
