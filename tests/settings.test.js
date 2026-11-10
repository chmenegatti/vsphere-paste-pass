const test = require("node:test");
const assert = require("node:assert/strict");
const { DEFAULTS, loadSettings, saveSettings } = require("../src/settings.js");

function fakeStorage() {
  const data = {};
  return {
    data,
    get: async (keys) => {
      const out = {};
      for (const k of Object.keys(keys)) out[k] = k in data ? data[k] : keys[k];
      return out;
    },
    set: async (items) => { Object.assign(data, items); }
  };
}

test("padrões quando storage vazio", async () => {
  assert.deepEqual(await loadSettings(fakeStorage()), {
    layout: "abnt2", keyDelay: 10, enterPause: 500, mode: "all", lastTab: "password"
  });
  assert.deepEqual(await loadSettings(fakeStorage()), DEFAULTS);
});

test("nunca grava texto nem senha", async () => {
  const s = fakeStorage();
  await saveSettings(s, { layout: "en-us", text: "segredo", password: "x" });
  assert.equal(s.data.layout, "en-us");
  assert.equal("text" in s.data, false);
  assert.equal("password" in s.data, false);
});

test("load após save mantém demais padrões", async () => {
  const s = fakeStorage();
  await saveSettings(s, { layout: "en-us" });
  const loaded = await loadSettings(s);
  assert.equal(loaded.layout, "en-us");
  assert.equal(loaded.keyDelay, 10);
});
