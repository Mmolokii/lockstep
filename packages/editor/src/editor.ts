import { defaultKeymap, indentWithTab } from "@codemirror/commands";
import {
  bracketMatching,
  defaultHighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from "@codemirror/view";
import { yCollab, yUndoManagerKeymap } from "y-codemirror.next";
import * as Y from "yjs";
import { type LanguageName, languageForFilename, loadLanguage } from "./languages.ts";

export type Theme = "light" | "dark";

export interface EditorOptions {
  /** Element the editor mounts into. */
  readonly parent: Element;
  /** The shared text. Local edits write to it; remote changes to it appear in the editor. */
  readonly ytext: Y.Text;
  /** Picks the language by extension. Omit for plain text. */
  readonly filename?: string;
  readonly theme?: Theme;
  /** Yjs awareness for remote cursors (arrives with the sync client in M3). */
  readonly awareness?: unknown;
  /** Accessible name for the editing surface, e.g. the file name. */
  readonly label?: string;
}

export interface Editor {
  readonly view: EditorView;
  /** Undo history scoped to this client's own edits, never a collaborator's. */
  readonly undoManager: Y.UndoManager;
  setTheme(theme: Theme): void;
  /**
   * Switches highlighting for a new file name. Resolves when the grammar has
   * loaded; rejects if it can't load, leaving the current highlighting.
   */
  setFilename(filename: string): Promise<void>;
  destroy(): void;
}

const themeExtension = (theme: Theme): Extension =>
  theme === "dark" ? oneDark : syntaxHighlighting(defaultHighlightStyle, { fallback: true });

/**
 * A CodeMirror 6 editor bound to a Y.Text (ADR 0004).
 *
 * Keyboard: the default keymap, search (Mod-f) and Yjs-aware undo (Mod-z,
 * Mod-y / Mod-Shift-z). Tab indents. CodeMirror's tab-focus mode keeps the
 * editor escapable from the keyboard alone: press Escape, then Tab, to move
 * focus out, or toggle the mode with Ctrl-m (Shift-Alt-m on macOS).
 */
export function createEditor(options: EditorOptions): Editor {
  const { parent, ytext, filename, theme = "light", awareness, label } = options;
  const languageSlot = new Compartment();
  const themeSlot = new Compartment();
  // Y.UndoManager tracks the `null` origin by default, which would let undo
  // revert a collaborator's update applied without an origin. Start with no
  // tracked origins; the binding adds its own, so only local edits are undoable.
  const undoManager = new Y.UndoManager(ytext, { trackedOrigins: new Set() });
  let destroyed = false;
  let languageRequest = 0;

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: ytext.toString(),
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([...yUndoManagerKeymap, ...searchKeymap, ...defaultKeymap, indentWithTab]),
        EditorView.contentAttributes.of({ "aria-label": label ?? filename ?? "Code editor" }),
        yCollab(ytext, awareness ?? null, { undoManager }),
        languageSlot.of([]),
        themeSlot.of(themeExtension(theme)),
      ],
    }),
  });

  const setFilename = async (name: string): Promise<void> => {
    const request = ++languageRequest;
    const language: LanguageName | null = languageForFilename(name);
    const support = language === null ? [] : await loadLanguage(language);
    // A later call, or destroy(), wins over a grammar that loaded late.
    if (destroyed || request !== languageRequest) return;
    view.dispatch({ effects: languageSlot.reconfigure(support) });
  };

  // If the grammar can't load (offline before its chunk was cached), the
  // editor stays usable as plain text; a later setFilename can retry.
  if (filename !== undefined) setFilename(filename).catch(() => undefined);

  return {
    view,
    undoManager,
    setTheme: (next) => {
      view.dispatch({ effects: themeSlot.reconfigure(themeExtension(next)) });
    },
    setFilename,
    destroy: () => {
      destroyed = true;
      view.destroy();
      undoManager.destroy();
    },
  };
}
