// Content script: recebe o pedido do popup e conduz a digitação na página.
(function (root) {
  function createController(deps) {
    let typer = null;

    function handle(msg) {
      if (!msg) return undefined;
      if (msg.action === "vmpaste:cancel") {
        if (!typer) return { ok: false, error: "Nenhuma digitação em andamento" };
        typer.cancel();
        return { ok: true };
      }
      if (msg.action !== "vmpaste:start") return undefined;
      if (typer) return { ok: false, error: "Digitação em andamento" };

      const plan = deps.buildPlan(msg.text, msg.layout, msg.kind);
      if (plan.total === 0) return { ok: false, error: "Nada para digitar" };

      const mode = msg.kind === "password" ? "password" : msg.mode;
      const target = deps.pickTarget();
      deps.focusTarget(target);
      const dispatcher = deps.createDispatcher(target);

      let current = null;
      const overlay = deps.createOverlay({
        onPause: () => current.pause(),
        onResume: () => current.resume(),
        onCancel: () => current.cancel(),
        onNext: () => current.next()
      });

      current = deps.createTyper({
        plan,
        mode,
        keyDelay: msg.keyDelay,
        enterPause: msg.enterPause,
        send: dispatcher.stroke,
        releaseShift: dispatcher.releaseShift,
        wait: deps.wait,
        onProgress: (p) => overlay.update(p, mode)
      });
      typer = current;

      current.start().catch((err) => console.error("VM Paste:", err)).finally(() => {
        typer = null;
      });
      return { ok: true };
    }

    function onTrustedEnter() {
      if (typer) typer.userEnter();
    }

    return { handle, onTrustedEnter };
  }

  const api = { createController };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;

  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    const V = root.VMPaste;
    const controller = createController({
      buildPlan: V.buildPlan,
      createTyper: V.createTyper,
      createOverlay: V.createOverlay,
      createDispatcher: V.createDispatcher,
      pickTarget: () => V.pickTarget(document),
      focusTarget: V.focusTarget,
      wait: (ms) => new Promise((r) => setTimeout(r, ms))
    });

    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      const result = controller.handle(msg);
      if (result) sendResponse(result);
    });

    // Enter real do usuário (modo passo a passo). Eventos sintéticos têm isTrusted = false.
    root.addEventListener("keydown", (e) => {
      if (e.isTrusted && e.key === "Enter") controller.onTrustedEnter();
    }, true);
  }
})(globalThis);
