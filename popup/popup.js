(async () => {
  const V = globalThis.VMPaste;
  const storage = chrome.storage.local;
  const $ = (id) => document.getElementById(id);

  const els = {
    tabs: document.querySelectorAll(".tab"),
    panels: document.querySelectorAll(".panel"),
    password: $("passwordInput"),
    toggle: $("toggleVisibility"),
    long: $("longInput"),
    longMeta: $("longMeta"),
    keyDelay: $("keyDelay"),
    enterPause: $("enterPause"),
    enterPauseWrap: $("enterPauseWrap"),
    warning: $("warning"),
    status: $("status"),
    button: $("typeButton")
  };

  const settings = await V.loadSettings(storage);
  let confirmed = false; // segundo clique após aviso

  const save = (partial) => {
    Object.assign(settings, partial);
    V.saveSettings(storage, partial);
  };

  // ---- Controles segmentados ----
  function segmented(id, key, onChange) {
    const buttons = $(id).querySelectorAll("button");
    const render = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === settings[key])));
    buttons.forEach((b) => b.addEventListener("click", () => {
      save({ [key]: b.dataset.value });
      render();
      onChange && onChange();
    }));
    render();
  }

  // ---- Abas ----
  function showTab(name) {
    els.tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    els.panels.forEach((p) => (p.hidden = p.dataset.panel !== name));
    save({ lastTab: name });
    refresh();
    (name === "password" ? els.password : els.long).focus();
  }
  els.tabs.forEach((t) => t.addEventListener("click", () => showTab(t.dataset.tab)));

  const currentKind = () => settings.lastTab;
  const currentText = () => (currentKind() === "password" ? els.password.value : els.long.value);

  // ---- Estado da UI ----
  function setStatus(text, kind) {
    els.status.textContent = text;
    els.status.className = "status" + (kind ? " " + kind : "");
  }

  function clearWarning() {
    confirmed = false;
    els.warning.hidden = true;
    els.warning.textContent = "";
  }

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  function refresh() {
    const kind = currentKind();
    const a = V.analyze(els.long.value, settings.layout);
    els.longMeta.textContent = `${plural(a.lines, "linha", "linhas")} · ${plural(a.chars, "caractere", "caracteres")}`;
    els.enterPauseWrap.hidden = !(kind === "long" && settings.mode === "all");
    if (!confirmed) {
      els.button.textContent = kind === "long" && a.lines > 0
        ? `Digitar ${plural(a.lines, "linha", "linhas")}`
        : "Digitar no console";
    }
  }

  function countSkipped(text, unsupported) {
    let n = 0;
    for (const ch of V.normalizeText(text)) if (unsupported.includes(ch)) n++;
    return n;
  }

  function showWarning(a, text) {
    const parts = [];
    if (a.unsupported.length) {
      const list = a.unsupported.map((c) => `<code>${escapeHtml(c)}</code>`).join(" ");
      parts.push(`Não suportados em ${settings.layout === "en-us" ? "EN-US" : "ABNT2"}: ${list}`);
    }
    if (a.hasTabs) parts.push("Contém Tabs: podem acionar o autocompletar do shell");
    els.warning.innerHTML = parts.join("<br>");
    els.warning.hidden = false;
    const skipped = countSkipped(text, a.unsupported);
    els.button.textContent = skipped
      ? `Digitar pulando ${plural(skipped, "caractere", "caracteres")}`
      : "Digitar mesmo assim";
    confirmed = true;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  }

  // ---- Envio ----
  async function send() {
    const kind = currentKind();
    const text = currentText();
    if (V.buildPlan(text, settings.layout, kind).total === 0) {
      setStatus("Nada para digitar", "error");
      return;
    }
    const a = V.analyze(text, settings.layout);
    if (!confirmed && (a.unsupported.length || a.hasTabs)) {
      showWarning(a, text);
      return;
    }

    els.button.disabled = true;
    setStatus("Enviando…");
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("sem aba");
      const res = await chrome.tabs.sendMessage(tab.id, {
        action: "vmpaste:start",
        text,
        layout: settings.layout,
        kind,
        mode: settings.mode,
        keyDelay: settings.keyDelay,
        enterPause: settings.enterPause
      });
      if (!res || !res.ok) {
        setStatus((res && res.error) || "Falha ao iniciar a digitação", "error");
        els.button.disabled = false;
        return;
      }
      window.close(); // progresso segue no painel da página
    } catch (_) {
      setStatus("Recarregue a página do console e tente de novo.", "error");
      els.button.disabled = false;
    }
  }

  // ---- Ligações ----
  segmented("layoutSeg", "layout", () => { clearWarning(); refresh(); });
  segmented("modeSeg", "mode", refresh);

  function numberInput(el, key) {
    el.value = settings[key];
    el.addEventListener("change", () => {
      const n = Math.max(0, parseInt(el.value, 10) || 0);
      el.value = n;
      save({ [key]: n });
    });
  }
  numberInput(els.keyDelay, "keyDelay");
  numberInput(els.enterPause, "enterPause");

  for (const input of [els.password, els.long]) {
    input.addEventListener("input", () => { clearWarning(); setStatus(""); refresh(); });
  }

  els.toggle.addEventListener("click", () => {
    const show = els.password.type === "password";
    els.password.type = show ? "text" : "password";
    els.toggle.classList.toggle("on", show);
    const label = show ? "Ocultar senha" : "Mostrar senha";
    els.toggle.title = label;
    els.toggle.setAttribute("aria-label", label);
  });

  els.button.addEventListener("click", send);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!els.button.disabled) send();
    }
  });

  showTab(settings.lastTab === "long" ? "long" : "password");

  // Pré-preenche a senha com a área de transferência (se permitido).
  try {
    const clip = await navigator.clipboard.readText();
    if (clip && !els.password.value) els.password.value = clip;
  } catch (_) {
    // sem permissão de leitura: ignora
  }
})();
