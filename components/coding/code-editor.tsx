"use client";

import CodeMirror from "@uiw/react-codemirror";
import { createTheme } from "@uiw/codemirror-themes";
import { cpp } from "@codemirror/lang-cpp";
import { rust } from "@codemirror/lang-rust";
import { tags as t } from "@lezer/highlight";
import type { Language } from "@/types/coding-exercise";

// Same palette as the read-only code blocks (lib/shiki-theme.ts): sky
// keywords, emerald strings, amber numbers, violet types.
const kataTheme = createTheme({
  theme: "dark",
  settings: {
    background: "oklch(0.13 0.006 250)",
    foreground: "#e4e4e7",
    caret: "#38bdf8",
    selection: "#38bdf833",
    selectionMatch: "#38bdf822",
    lineHighlight: "#ffffff08",
    gutterBackground: "oklch(0.13 0.006 250)",
    gutterForeground: "#4b5563",
    gutterBorder: "transparent",
    fontFamily: "var(--font-mono)",
  },
  styles: [
    { tag: [t.comment, t.lineComment, t.blockComment], color: "#71717a" },
    { tag: [t.keyword, t.modifier, t.controlKeyword, t.definitionKeyword], color: "#38bdf8" },
    { tag: [t.string, t.character], color: "#34d399" },
    { tag: [t.number, t.bool, t.null], color: "#fbbf24" },
    { tag: [t.typeName, t.className, t.namespace, t.standard(t.typeName)], color: "#a78bfa" },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#f4f4f5" },
    { tag: [t.operator, t.punctuation, t.bracket], color: "#a1a1aa" },
    { tag: [t.processingInstruction, t.macroName], color: "#f472b6" },
  ],
});

const LANGUAGE_EXTENSIONS = {
  cpp: [cpp()],
  rust: [rust()],
} satisfies Record<Language, unknown>;

export function CodeEditor({
  value,
  language,
  onChange,
}: {
  value: string;
  language: Language;
  onChange: (value: string) => void;
}) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      theme={kataTheme}
      extensions={LANGUAGE_EXTENSIONS[language]}
      // Fill the screen below the toolbar, then keep growing with the code
      // so a long solution is never trapped in an inner scroll box.
      minHeight="max(28rem, calc(100dvh - 15rem))"
      basicSetup={{ tabSize: 4, foldGutter: false }}
      indentWithTab
      className="text-[13px] [&_.cm-editor]:outline-none! [&_.cm-gutters]:pr-1"
      aria-label="Solution editor"
    />
  );
}
