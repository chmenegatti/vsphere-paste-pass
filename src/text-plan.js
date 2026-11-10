// Normaliza o texto e monta o plano de digitação (teclas por linha).
(function (root) {
  const keymaps = typeof module !== "undefined" ? require("./keymaps.js") : root.VMPaste;

  // \r\n e \r viram \n; remove uma única quebra final (comum ao copiar de editor).
  function normalizeText(text) {
    return String(text || "").replace(/\r\n?/g, "\n").replace(/\n$/, "");
  }

  function splitLines(normalized) {
    return normalized === "" ? [] : normalized.split("\n");
  }

  function analyze(text, layout) {
    const normalized = normalizeText(text);
    const unsupported = [];
    for (const ch of normalized) {
      if (ch !== "\n" && !keymaps.strokesFor(ch, layout) && !unsupported.includes(ch)) {
        unsupported.push(ch);
      }
    }
    return {
      lines: splitLines(normalized).length,
      chars: [...normalized].filter((c) => c !== "\n").length,
      unsupported,
      hasTabs: normalized.includes("\t")
    };
  }

  // Caracteres não suportados são pulados. Enter entre linhas é do Typer.
  function buildPlan(text, layout, kind) {
    let normalized = normalizeText(text);
    if (kind === "password") normalized = normalized.replace(/\n/g, "");
    const lines = splitLines(normalized).map((line) => {
      const strokes = [];
      for (const ch of line) {
        const s = keymaps.strokesFor(ch, layout);
        if (s) strokes.push(...s);
      }
      return strokes;
    });
    const total = lines.reduce((n, l) => n + l.length, 0);
    return { lines, total };
  }

  const api = { normalizeText, analyze, buildPlan };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
