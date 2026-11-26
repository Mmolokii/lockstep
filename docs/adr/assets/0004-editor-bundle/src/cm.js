import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { basicSetup, EditorView } from "codemirror";
import { yCollab } from "y-codemirror.next";
import * as Y from "yjs";

const doc = new Y.Doc();
const text = doc.getText("t");
new EditorView({
  extensions: [basicSetup, javascript(), python(), yCollab(text, null)],
  parent: document.body,
});
