import * as monaco from "monaco-editor/editor/editor.api";
import "monaco-editor/basic-languages/monaco.contribution";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";

const doc = new Y.Doc();
const editor = monaco.editor.create(document.body, { value: "", language: "javascript" });
new MonacoBinding(doc.getText("t"), editor.getModel(), new Set([editor]));
