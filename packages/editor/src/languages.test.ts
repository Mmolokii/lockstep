import { describe, expect, it } from "vitest";
import { languageForFilename, loadLanguage, supportedLanguages } from "./languages.ts";

describe("languageForFilename", () => {
  it.each([
    ["index.ts", "typescript"],
    ["App.tsx", "tsx"],
    ["server.mjs", "javascript"],
    ["view.jsx", "jsx"],
    ["main.py", "python"],
    ["package.json", "json"],
    ["index.html", "html"],
    ["site.css", "css"],
    ["README.md", "markdown"],
    ["lib.rs", "rust"],
    ["main.go", "go"],
    ["Main.java", "java"],
    ["vector.hpp", "cpp"],
    ["schema.sql", "sql"],
    ["src/deep/path/file.PY", "python"],
  ])("%s → %s", (file, language) => {
    expect(languageForFilename(file)).toBe(language);
  });

  it.each(["Makefile", ".env", "config/.gitignore", "notes.", "archive.tar.zst", ""])(
    "%j is plain text",
    (file) => {
      expect(languageForFilename(file)).toBeNull();
    },
  );
});

describe("loadLanguage", () => {
  it("loads a grammar for every supported language", async () => {
    // At least ten languages, per #26.
    expect(supportedLanguages.length).toBeGreaterThanOrEqual(10);
    for (const name of supportedLanguages) {
      const support = await loadLanguage(name);
      expect(support.language.name, name).toBeTruthy();
    }
  });
});
