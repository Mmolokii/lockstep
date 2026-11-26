import type { LanguageSupport } from "@codemirror/language";

/**
 * Languages the editor highlights, keyed by name. Each loader is a dynamic
 * import, so a bundler emits one chunk per language and a document only
 * downloads the grammar it uses.
 */
const loaders = {
  javascript: () => import("@codemirror/lang-javascript").then((m) => m.javascript()),
  jsx: () => import("@codemirror/lang-javascript").then((m) => m.javascript({ jsx: true })),
  typescript: () =>
    import("@codemirror/lang-javascript").then((m) => m.javascript({ typescript: true })),
  tsx: () =>
    import("@codemirror/lang-javascript").then((m) =>
      m.javascript({ typescript: true, jsx: true }),
    ),
  python: () => import("@codemirror/lang-python").then((m) => m.python()),
  json: () => import("@codemirror/lang-json").then((m) => m.json()),
  html: () => import("@codemirror/lang-html").then((m) => m.html()),
  css: () => import("@codemirror/lang-css").then((m) => m.css()),
  markdown: () => import("@codemirror/lang-markdown").then((m) => m.markdown()),
  rust: () => import("@codemirror/lang-rust").then((m) => m.rust()),
  go: () => import("@codemirror/lang-go").then((m) => m.go()),
  java: () => import("@codemirror/lang-java").then((m) => m.java()),
  cpp: () => import("@codemirror/lang-cpp").then((m) => m.cpp()),
  sql: () => import("@codemirror/lang-sql").then((m) => m.sql()),
} satisfies Record<string, () => Promise<LanguageSupport>>;

export type LanguageName = keyof typeof loaders;

const byExtension: Readonly<Record<string, LanguageName>> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  py: "python",
  pyi: "python",
  json: "json",
  html: "html",
  htm: "html",
  css: "css",
  md: "markdown",
  markdown: "markdown",
  rs: "rust",
  go: "go",
  java: "java",
  c: "cpp",
  h: "cpp",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  sql: "sql",
};

/** The language for a file name, by its extension (case-insensitive). `null` means plain text. */
export function languageForFilename(filename: string): LanguageName | null {
  const dot = filename.lastIndexOf(".");
  // No dot, a dotfile such as ".env", or a trailing dot: no extension.
  if (dot <= filename.lastIndexOf("/") + 1 || dot === filename.length - 1) return null;
  return byExtension[filename.slice(dot + 1).toLowerCase()] ?? null;
}

export function loadLanguage(name: LanguageName): Promise<LanguageSupport> {
  return loaders[name]();
}

export const supportedLanguages = Object.keys(loaders) as readonly LanguageName[];
