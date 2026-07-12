import type { ThemeRegistrationRaw } from "shiki";

/**
 * Custom Shiki theme: keeps a plain dark background (the code-block chrome
 * already supplies its own #121212 background/border, so this theme's own
 * `colors` barely matter) but maps syntax highlighting to the same accent
 * palette used everywhere else in the app — sky for keywords, emerald for
 * strings, amber for numbers, violet for types — instead of the bundled
 * vitesse-dark theme's unrelated color choices.
 *
 * Rules live in `settings` (the raw TextMate format), not `tokenColors`
 * (the VS Code format) — Shiki treats a present `settings` array as
 * authoritative and ignores `tokenColors` entirely if both are set, so an
 * empty `settings: []` alongside `tokenColors` silently disables every
 * rule. `settings[0]` with no `scope` is the global/default foreground.
 *
 * `punctuation.definition.comment`/`.string` are explicitly matched to the
 * same color as `comment`/`string` — Shiki merges adjacent same-color
 * tokens into one rendered span, so leaving the comment/string delimiter
 * characters on a different color than their body splits what looks like
 * one token (e.g. a BLANK_1 comment marker) into three pieces. The
 * fill-in-blank renderer in
 * components/question/fill-in-blank-interactive.tsx matches the whole
 * marker against a single token's text, so a split there makes the blank
 * silently stop rendering as an input.
 */
export const KATA_SHIKI_THEME: ThemeRegistrationRaw = {
  name: "kata-dark",
  type: "dark",
  colors: {
    "editor.background": "#121212",
    "editor.foreground": "#e4e4e7",
  },
  settings: [
    {
      settings: { foreground: "#e4e4e7" },
    },
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#71717a" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#38bdf8" },
    },
    {
      scope: ["string", "punctuation.definition.string"],
      settings: { foreground: "#34d399" },
    },
    {
      scope: ["constant.numeric"],
      settings: { foreground: "#fbbf24" },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: "#a78bfa" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#f4f4f5" },
    },
    {
      scope: ["punctuation", "keyword.operator"],
      settings: { foreground: "#a1a1aa" },
    },
  ],
};
