// Painel flutuante de progresso, injetado na página do console (Shadow DOM).
(function (root) {
  const CSS = `
    :host { all: initial; }
    .panel {
      --primary: #6750a4; --on-primary: #fff; --container: #e8def8; --on-container: #1d192b;
      --surface: #fdf7ff; --on-surface: #1d1b20; --muted: #49454f; --outline: #79747e; --danger: #b3261e;
      position: fixed; right: 16px; bottom: 16px; z-index: 2147483647;
      width: 280px; box-sizing: border-box; padding: 14px 16px;
      background: var(--surface); color: var(--on-surface);
      border-radius: 24px; box-shadow: 0 8px 28px rgba(0,0,0,.28);
      font: 13px/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      .panel {
        --primary: #d0bcff; --on-primary: #381e72; --container: #4a4458; --on-container: #e8def8;
        --surface: #1d1b20; --on-surface: #e6e0e9; --muted: #cac4d0; --outline: #938f99; --danger: #f2b8b5;
      }
    }
    .title { font-weight: 600; font-size: 12px; color: var(--muted); margin-bottom: 4px; }
    .label { font-weight: 500; margin-bottom: 8px; }
    .bar { height: 6px; border-radius: 3px; background: var(--container); overflow: hidden; }
    .bar i { display: block; height: 100%; width: 0; background: var(--primary); transition: width .15s; }
    .actions { display: flex; gap: 8px; margin-top: 12px; }
    button {
      flex: 1; border: 0; border-radius: 20px; padding: 8px 0; cursor: pointer;
      font: inherit; font-weight: 600;
    }
    .main { background: var(--container); color: var(--on-container); }
    .cancel { background: transparent; color: var(--danger); border: 1px solid var(--outline); }
    [hidden] { display: none !important; }
  `;

  function createOverlay({ onPause, onResume, onCancel, onNext }) {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="panel" role="status" aria-live="polite">
        <div class="title">VM Paste</div>
        <div class="label"></div>
        <div class="bar"><i></i></div>
        <div class="actions">
          <button class="main" type="button"></button>
          <button class="cancel" type="button">Cancelar</button>
        </div>
      </div>`;
    const label = shadow.querySelector(".label");
    const fill = shadow.querySelector(".bar i");
    const actions = shadow.querySelector(".actions");
    const main = shadow.querySelector(".main");
    const cancel = shadow.querySelector(".cancel");
    let mainAction = null;
    let removeTimer = null;

    // Botões não roubam o foco do console.
    for (const b of [main, cancel]) b.addEventListener("mousedown", (e) => e.preventDefault());
    main.addEventListener("click", () => mainAction && mainAction());
    cancel.addEventListener("click", () => onCancel());

    // Em tela cheia só o elemento em tela cheia é desenhado: o painel vai junto.
    function place() {
      const fs = document.fullscreenElement;
      const usable = fs && !["CANVAS", "VIDEO", "IFRAME"].includes(fs.tagName);
      (usable ? fs : document.documentElement).appendChild(host);
    }
    document.addEventListener("fullscreenchange", place);
    place();

    function update(p, mode) {
      const pos = mode === "password"
        ? `Caractere ${p.done} de ${p.total}`
        : `Linha ${p.line} de ${p.lines}`;
      const texts = {
        typing: pos,
        paused: `${pos} (pausado)`,
        waiting: `${pos} — aperte Enter no console`,
        done: "Concluído",
        cancelled: "Cancelado"
      };
      label.textContent = texts[p.state] || pos;
      fill.style.width = p.total ? `${Math.round((p.done / p.total) * 100)}%` : "0";

      const finished = p.state === "done" || p.state === "cancelled";
      actions.hidden = finished;
      if (p.state === "waiting") {
        main.textContent = "Próxima linha";
        mainAction = onNext;
      } else if (p.state === "paused") {
        main.textContent = "Retomar";
        mainAction = onResume;
      } else {
        main.textContent = "Pausar";
        mainAction = onPause;
      }
      if (finished && !removeTimer) removeTimer = setTimeout(remove, 3000);
    }

    function remove() {
      clearTimeout(removeTimer);
      document.removeEventListener("fullscreenchange", place);
      host.remove();
    }

    return { update, remove };
  }

  const api = { createOverlay };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
