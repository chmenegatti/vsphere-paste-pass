const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeText, analyze, buildPlan } = require("../src/text-plan.js");

test("CRLF vira uma quebra só", () => {
  assert.equal(normalizeText("a\r\nb\rc"), "a\nb\nc");
});

test("remove só uma quebra final", () => {
  assert.equal(normalizeText("a\nb\n"), "a\nb");
  assert.equal(normalizeText("a\n\n"), "a\n");
});

test("linhas em branco no meio viram linhas vazias", () => {
  const p = buildPlan("a\n\nb", "en-us", "long");
  assert.equal(p.lines.length, 3);
  assert.equal(p.lines[1].length, 0);
});

test("CRLF no buildPlan gera uma linha por quebra", () => {
  const p = buildPlan("a\r\nb\r\n", "en-us", "long");
  assert.equal(p.lines.length, 2);
});

test("analyze conta linhas e lista não suportados", () => {
  const r = analyze("olá ção\r\nok\tx\n", "en-us");
  assert.equal(r.lines, 2);
  assert.deepEqual(r.unsupported, ["á", "ç", "ã"]);
  assert.equal(r.hasTabs, true);
});

test("buildPlan pula não suportados", () => {
  const p = buildPlan("aéb", "en-us", "long");
  assert.deepEqual(p.lines[0].map((s) => s.code), ["KeyA", "KeyB"]);
  assert.equal(p.total, 2);
});

test("texto só com não suportados → total 0", () => {
  assert.equal(buildPlan("éé", "en-us", "long").total, 0);
  assert.equal(buildPlan("", "abnt2", "password").total, 0);
});

test("password é uma linha", () => {
  assert.equal(buildPlan("ab\ncd", "abnt2", "password").lines.length, 1);
});
