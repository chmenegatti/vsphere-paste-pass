const test = require("node:test");
const assert = require("node:assert/strict");

// Polyfill mínimo: copia campos do init que Event não define.
class FakeEvent extends Event {
  constructor(t, i = {}) {
    super(t, i);
    for (const [k, v] of Object.entries(i)) if (!(k in this)) this[k] = v;
  }
}
globalThis.KeyboardEvent = FakeEvent;
globalThis.InputEvent = FakeEvent;

const { createDispatcher } = require("../src/dispatch.js");
const { strokesFor } = require("../src/keymaps.js");

function setup() {
  const log = [];
  const target = { dispatchEvent: (e) => log.push(`${e.type}:${e.key}`) };
  const d = createDispatcher(target, { window: null, document: null });
  return { log, d };
}

test("maiúscula pressiona Shift e minúscula seguinte solta", () => {
  const { log, d } = setup();
  d.stroke(strokesFor("A", "en-us")[0]);
  assert.deepEqual(log, ["keydown:Shift", "keydown:A", "keypress:A", "input:undefined", "keyup:A"]);
  d.stroke(strokesFor("a", "en-us")[0]);
  assert.equal(log[5], "keyup:Shift");
});

test("releaseShift solta Shift uma vez só", () => {
  const { log, d } = setup();
  d.stroke(strokesFor("!", "en-us")[0]);
  d.releaseShift();
  assert.equal(log.at(-1), "keyup:Shift");
  const n = log.length;
  d.releaseShift();
  assert.equal(log.length, n);
});

test("dead key não gera keypress nem input", () => {
  const { log, d } = setup();
  d.stroke(strokesFor("é", "abnt2")[0]);
  assert.deepEqual(log, ["keydown:Dead", "keyup:Dead"]);
});

test("Enter não gera input", () => {
  const { log, d } = setup();
  d.stroke(strokesFor("\n", "en-us")[0]);
  assert.deepEqual(log, ["keydown:Enter", "keypress:Enter", "keyup:Enter"]);
});
