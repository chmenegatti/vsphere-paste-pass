const test = require("node:test");
const assert = require("node:assert/strict");
const { strokesFor } = require("../src/keymaps.js");

const codes = (s) => s.map((k) => k.code + (k.shift ? "+S" : ""));

test("en-us: barra, dois-pontos e chaves do curl", () => {
  assert.deepEqual(codes(strokesFor("/", "en-us")), ["Slash"]);
  assert.deepEqual(codes(strokesFor(":", "en-us")), ["Semicolon+S"]);
  assert.deepEqual(codes(strokesFor("{", "en-us")), ["BracketLeft+S"]);
  assert.deepEqual(codes(strokesFor("}", "en-us")), ["BracketRight+S"]);
  assert.deepEqual(codes(strokesFor("~", "en-us")), ["Backquote+S"]);
  assert.deepEqual(codes(strokesFor("^", "en-us")), ["Digit6+S"]);
});

test("en-us: todo o comando curl é suportado", () => {
  const cmd = "curl -sS -m 10 -o /dev/null -w 'citrix:%{http_code}\\n' https://api.cloud.com";
  for (const ch of cmd) assert.ok(strokesFor(ch, "en-us"), `faltou ${ch}`);
});

test("en-us: acentos e ç não suportados", () => {
  for (const ch of "éãçÇ´¨") assert.equal(strokesFor(ch, "en-us"), null);
});

test("abnt2: barra e interrogação em IntlRo", () => {
  assert.deepEqual(codes(strokesFor("/", "abnt2")), ["IntlRo"]);
  assert.deepEqual(codes(strokesFor("?", "abnt2")), ["IntlRo+S"]);
});

test("abnt2: acentos compostos", () => {
  assert.deepEqual(codes(strokesFor("é", "abnt2")), ["BracketLeft", "KeyE"]);
  assert.deepEqual(codes(strokesFor("ã", "abnt2")), ["Quote", "KeyA"]);
  assert.deepEqual(codes(strokesFor("ô", "abnt2")), ["Quote+S", "KeyO"]);
  assert.deepEqual(codes(strokesFor("à", "abnt2")), ["BracketLeft+S", "KeyA"]);
  assert.deepEqual(codes(strokesFor("ü", "abnt2")), ["Digit6+S", "KeyU"]);
  assert.deepEqual(codes(strokesFor("Ã", "abnt2")), ["Quote", "KeyA+S"]);
  assert.deepEqual(codes(strokesFor("É", "abnt2")), ["BracketLeft", "KeyE+S"]);
});

test("abnt2: dead key isolada seguida de espaço", () => {
  assert.deepEqual(codes(strokesFor("~", "abnt2")), ["Quote", "Space"]);
  assert.deepEqual(codes(strokesFor("^", "abnt2")), ["Quote+S", "Space"]);
});

test("ambos: ç direto no abnt2, quebra vira Enter", () => {
  assert.deepEqual(codes(strokesFor("ç", "abnt2")), ["Semicolon"]);
  assert.deepEqual(codes(strokesFor("\n", "en-us")), ["Enter"]);
});

test("abnt2: layout físico (aspas à esquerda do 1, colchetes)", () => {
  assert.deepEqual(codes(strokesFor("'", "abnt2")), ["Backquote"]);
  assert.deepEqual(codes(strokesFor("[", "abnt2")), ["BracketRight"]);
  assert.deepEqual(codes(strokesFor("}", "abnt2")), ["Backslash+S"]);
  assert.deepEqual(codes(strokesFor(":", "abnt2")), ["Slash+S"]);
});

test("caractere desconhecido → null", () => {
  assert.equal(strokesFor("€", "abnt2"), null);
});
