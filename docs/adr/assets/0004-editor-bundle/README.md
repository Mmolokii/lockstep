# ADR 0004 bundle measurement

Reproduces the bundle sizes in [ADR 0004](../../0004-codemirror-6-over-monaco.md). Not part of the workspace.

Run these from an empty scratch directory, outside the repo, with this folder's `src/` and `measure.mjs` copied in:

```bash
npm install esbuild@0.28.2 codemirror@6.0.2 @codemirror/lang-javascript @codemirror/lang-python yjs y-codemirror.next@0.3.6 monaco-editor@0.58.0 y-monaco@0.1.6 y-protocols
```

```bash
for e in cm monaco-min monaco-worker; do npx esbuild "src/$e.js" --bundle --minify --format=esm --splitting --outdir="out/$e" --loader:.ttf=file --metafile="out/$e.meta.json" --alias:monaco-editor/esm/vs/editor/editor.api.js=monaco-editor/editor/editor.api; done
```

```bash
node measure.mjs
```

The `--alias` is needed because `y-monaco` 0.1.6 imports a path that Monaco 0.58 no longer exports.
