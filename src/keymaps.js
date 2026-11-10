// Mapas de teclado: convertem um caractere na sequência de teclas físicas
// (code/keyCode) que o produz no layout do sistema convidado.
(function (root) {
  const LAYOUTS = ["abnt2", "en-us"];

  const k = (key, code, keyCode, charCode, extra) =>
    Object.assign({ key, code, keyCode, charCode }, extra || {});

  const SPACE = k(" ", "Space", 32, 32);
  const ENTER = k("Enter", "Enter", 13, 13, { control: true });

  // Teclas iguais nos dois layouts: letras, dígitos, espaço e controles.
  function baseMap() {
    const map = {};
    for (const letter of "abcdefghijklmnopqrstuvwxyz") {
      const upper = letter.toUpperCase();
      const code = upper.charCodeAt(0);
      map[letter] = k(letter, "Key" + upper, code, letter.charCodeAt(0));
      map[upper] = k(upper, "Key" + upper, code, code, { shift: true });
    }
    for (const digit of "0123456789") {
      const code = digit.charCodeAt(0);
      map[digit] = k(digit, "Digit" + digit, code, code);
    }
    map[" "] = SPACE;
    map["\n"] = ENTER;
    map["\t"] = k("Tab", "Tab", 9, 9, { control: true, skipKeypress: true });
    map["\b"] = k("Backspace", "Backspace", 8, 8, { control: true, skipKeypress: true });
    return map;
  }

  // Símbolos de Shift+dígito comuns aos dois layouts.
  function shiftDigits(map, chars, digits) {
    for (let i = 0; i < chars.length; i++) {
      const d = digits[i];
      map[chars[i]] = k(chars[i], "Digit" + d, d.charCodeAt(0), chars[i].charCodeAt(0), { shift: true });
    }
  }

  // Adiciona par (normal, com Shift) na mesma tecla física.
  function pair(map, normal, shifted, code, keyCode) {
    if (normal) map[normal] = k(normal, code, keyCode, normal.charCodeAt(0));
    if (shifted) map[shifted] = k(shifted, code, keyCode, shifted.charCodeAt(0), { shift: true });
  }

  // ---- EN-US (US QWERTY) ----
  const EN_US = (() => {
    const map = baseMap();
    shiftDigits(map, "!@#$%^&*()", "1234567890");
    pair(map, "`", "~", "Backquote", 192);
    pair(map, "-", "_", "Minus", 189);
    pair(map, "=", "+", "Equal", 187);
    pair(map, "[", "{", "BracketLeft", 219);
    pair(map, "]", "}", "BracketRight", 221);
    pair(map, "\\", "|", "Backslash", 220);
    pair(map, ";", ":", "Semicolon", 186);
    pair(map, "'", "\"", "Quote", 222);
    pair(map, ",", "<", "Comma", 188);
    pair(map, ".", ">", "Period", 190);
    pair(map, "/", "?", "Slash", 191);
    return map;
  })();

  // ---- ABNT2 (PT-BR) ----
  const dead = (code, keyCode, shift) =>
    k("Dead", code, keyCode, 0, { skipKeypress: true, shift: !!shift });

  const ABNT2_DEAD = {
    "´": dead("BracketLeft", 219),
    "`": dead("BracketLeft", 219, true),
    "~": dead("Quote", 222),
    "^": dead("Quote", 222, true),
    "¨": dead("Digit6", 54, true)
  };

  const ABNT2 = (() => {
    const map = baseMap();
    shiftDigits(map, "!@#$%&*()", "123457890");
    pair(map, "-", "_", "Minus", 189);
    pair(map, "=", "+", "Equal", 187);
    pair(map, "[", "{", "BracketRight", 221);
    pair(map, "]", "}", "Backslash", 220);
    pair(map, "ç", "Ç", "Semicolon", 186);
    pair(map, "'", "\"", "Backquote", 192);
    pair(map, "\\", "|", "IntlBackslash", 226);
    pair(map, ";", ":", "Slash", 191);
    pair(map, ",", "<", "Comma", 188);
    pair(map, ".", ">", "Period", 190);
    pair(map, "/", "?", "IntlRo", 193);
    return map;
  })();

  // Letras acentuadas compostas: caractere → [dead key, letra base].
  const ABNT2_COMPOSED = {};
  const compose = (deadChar, pairs) => {
    for (let i = 0; i < pairs.length; i += 2) {
      ABNT2_COMPOSED[pairs[i]] = [deadChar, pairs[i + 1]];
      ABNT2_COMPOSED[pairs[i].toUpperCase()] = [deadChar, pairs[i + 1].toUpperCase()];
    }
  };
  compose("´", "áaéeíióoúu");
  compose("`", "àaèeìiòoùu");
  compose("^", "âaêeîiôoûu");
  compose("~", "ãaõoñn");
  compose("¨", "äaëeïiöoüu");

  function strokesFor(char, layout) {
    if (layout === "en-us") {
      return EN_US[char] ? [EN_US[char]] : null;
    }
    if (ABNT2_DEAD[char]) return [ABNT2_DEAD[char], SPACE];
    const composed = ABNT2_COMPOSED[char];
    if (composed) return [ABNT2_DEAD[composed[0]], ABNT2[composed[1]]];
    return ABNT2[char] ? [ABNT2[char]] : null;
  }

  const api = { LAYOUTS, ENTER, strokesFor };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
