// Preferências do popup. Só as chaves de DEFAULTS são gravadas: nunca senha nem texto.
(function (root) {
  const DEFAULTS = Object.freeze({
    layout: "abnt2",
    keyDelay: 10,
    enterPause: 500,
    mode: "all",
    lastTab: "password"
  });

  async function loadSettings(storage) {
    return { ...DEFAULTS, ...(await storage.get({ ...DEFAULTS })) };
  }

  async function saveSettings(storage, partial) {
    const clean = {};
    for (const k of Object.keys(DEFAULTS)) if (k in partial) clean[k] = partial[k];
    await storage.set(clean);
  }

  const api = { DEFAULTS, loadSettings, saveSettings };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
