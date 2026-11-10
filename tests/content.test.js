const test = require("node:test");
const assert = require("node:assert/strict");
const { createController } = require("../src/content.js");
const { buildPlan } = require("../src/text-plan.js");

function setup() {
  const typers = [];
  const deps = {
    buildPlan,
    pickTarget: () => ({}),
    focusTarget: () => {},
    createDispatcher: () => ({ stroke() {}, releaseShift() {} }),
    createOverlay: () => ({ update() {}, remove() {} }),
    wait: () => Promise.resolve(),
    createTyper: (opts) => {
      let finish;
      const t = {
        opts,
        userEnters: 0,
        start: () => new Promise((r) => (finish = r)),
        finish: (v) => finish(v),
        pause() {}, resume() {}, cancel() {}, next() {},
        userEnter() { t.userEnters++; }
      };
      typers.push(t);
      return t;
    }
  };
  return { controller: createController(deps), typers };
}

const msg = (text = "abc") => ({
  action: "vmpaste:start", text, layout: "en-us", kind: "long", mode: "step", keyDelay: 10, enterPause: 500
});

test("segunda digitação em andamento é recusada", async () => {
  const { controller, typers } = setup();
  assert.deepEqual(controller.handle(msg()), { ok: true });
  assert.deepEqual(controller.handle(msg()), { ok: false, error: "Digitação em andamento" });
  typers[0].finish("done");
  await new Promise(setImmediate);
  assert.deepEqual(controller.handle(msg()), { ok: true });
});

test("plano vazio → Nada para digitar", () => {
  const { controller, typers } = setup();
  assert.deepEqual(controller.handle(msg("éé")), { ok: false, error: "Nada para digitar" });
  assert.equal(typers.length, 0);
});

test("Enter real só repassado com digitação ativa", async () => {
  const { controller, typers } = setup();
  controller.onTrustedEnter();
  controller.handle(msg());
  controller.onTrustedEnter();
  assert.equal(typers[0].userEnters, 1);
  typers[0].finish("done");
  await new Promise(setImmediate);
  controller.onTrustedEnter();
  assert.equal(typers[0].userEnters, 1);
});

test("senha usa modo password", () => {
  const { controller, typers } = setup();
  controller.handle({ ...msg(), kind: "password" });
  assert.equal(typers[0].opts.mode, "password");
});

test("ação desconhecida é ignorada", () => {
  const { controller } = setup();
  assert.equal(controller.handle({ action: "outra" }), undefined);
});
