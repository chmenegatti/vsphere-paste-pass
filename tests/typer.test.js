const test = require("node:test");
const assert = require("node:assert/strict");
const { createTyper } = require("../src/typer.js");
const { buildPlan } = require("../src/text-plan.js");

const flush = () => new Promise(setImmediate);

// wait controlado manualmente: cada chamada fica pendente até tick().
function manualWait() {
  const pending = [];
  return {
    wait: () => new Promise((r) => pending.push(r)),
    tick: async () => { pending.shift()(); await flush(); },
    get pending() { return pending.length; }
  };
}

function setup(text, mode, opts = {}) {
  const sent = [];
  const progress = [];
  let released = 0;
  const typer = createTyper({
    plan: buildPlan(text, "en-us", mode === "password" ? "password" : "long"),
    mode,
    keyDelay: opts.keyDelay ?? 0,
    enterPause: 0,
    send: (s) => sent.push(s.code),
    releaseShift: () => released++,
    wait: opts.wait || (() => Promise.resolve()),
    onProgress: (p) => progress.push({ ...p })
  });
  return { typer, sent, progress, released: () => released };
}

test("all: Enter entre linhas, nunca após a última", async () => {
  const { typer, sent } = setup("ab\ncd", "all");
  assert.equal(await typer.start(), "done");
  assert.deepEqual(sent, ["KeyA", "KeyB", "Enter", "KeyC", "KeyD"]);
});

test("step: espera Enter real do usuário sem enviar Enter sintético", async () => {
  const { typer, sent, progress } = setup("ab\ncd", "step");
  const done = typer.start();
  await flush();
  assert.deepEqual(sent, ["KeyA", "KeyB"]);
  assert.equal(progress.at(-1).state, "waiting");
  assert.equal(progress.at(-1).line, 1);
  typer.userEnter();
  assert.equal(await done, "done");
  assert.deepEqual(sent, ["KeyA", "KeyB", "KeyC", "KeyD"]);
});

test("step: next() envia Enter sintético", async () => {
  const { typer, sent } = setup("ab\ncd", "step");
  const done = typer.start();
  await flush();
  typer.next();
  await done;
  assert.deepEqual(sent, ["KeyA", "KeyB", "Enter", "KeyC", "KeyD"]);
});

test("step: Enter do usuário durante a digitação da linha é ignorado", async () => {
  const w = manualWait();
  const { typer, sent, progress } = setup("ab\ncd", "step", { keyDelay: 5, wait: w.wait });
  const done = typer.start();
  await flush();
  assert.deepEqual(sent, ["KeyA"]);
  typer.userEnter();
  await w.tick();
  await w.tick();
  assert.deepEqual(sent, ["KeyA", "KeyB"]);
  assert.equal(progress.at(-1).state, "waiting");
  typer.userEnter();
  await flush();
  while (w.pending) await w.tick();
  assert.equal(await done, "done");
  assert.deepEqual(sent, ["KeyA", "KeyB", "KeyC", "KeyD"]);
});

test("cancel: para, solta Shift e resolve cancelled", async () => {
  const w = manualWait();
  const { typer, sent, released } = setup("ABCD", "all", { keyDelay: 5, wait: w.wait });
  const done = typer.start();
  await flush();
  typer.cancel();
  await w.tick();
  assert.equal(await done, "cancelled");
  assert.deepEqual(sent, ["KeyA"]);
  assert.ok(released() >= 1);
});

test("cancel durante espera do passo a passo", async () => {
  const { typer, released } = setup("a\nb", "step");
  const done = typer.start();
  await flush();
  typer.cancel();
  assert.equal(await done, "cancelled");
  assert.ok(released() >= 1);
});

test("pause e resume", async () => {
  const w = manualWait();
  const { typer, sent, progress } = setup("abc", "all", { keyDelay: 5, wait: w.wait });
  const done = typer.start();
  await flush();
  typer.pause();
  await w.tick();
  assert.deepEqual(sent, ["KeyA"]);
  assert.equal(progress.at(-1).state, "paused");
  typer.resume();
  await flush();
  while (w.pending) await w.tick();
  assert.equal(await done, "done");
  assert.deepEqual(sent, ["KeyA", "KeyB", "KeyC"]);
});

test("progresso informa linha, total e estado final", async () => {
  const { typer, progress } = setup("ab\ncd", "all");
  await typer.start();
  const last = progress.at(-1);
  assert.deepEqual([last.line, last.lines, last.done, last.total, last.state], [2, 2, 4, 4, "done"]);
});

test("step: solta Shift antes de esperar o Enter do usuário", async () => {
  const { typer, progress, released } = setup('A\nb', "step");
  const done = typer.start();
  await flush();
  assert.equal(progress.at(-1).state, "waiting");
  assert.equal(released(), 1);
  typer.cancel();
  await done;
});

test("pause: solta Shift ao pausar", async () => {
  const w = manualWait();
  const { typer, progress, released } = setup("AB", "all", { keyDelay: 5, wait: w.wait });
  const done = typer.start();
  await flush();
  typer.pause();
  await w.tick();
  assert.equal(progress.at(-1).state, "paused");
  assert.equal(released(), 1);
  typer.cancel();
  await done;
});

test("atraso 0 ainda cede a vez entre teclas (permite cancelar)", async () => {
  const w = manualWait();
  const { typer, sent } = setup("abc", "all", { keyDelay: 0, wait: w.wait });
  const done = typer.start();
  await flush();
  assert.deepEqual(sent, ["KeyA"]);
  typer.cancel();
  await w.tick();
  assert.equal(await done, "cancelled");
});
