// Dispara eventos de teclado sintéticos no alvo, controlando o estado do Shift.
(function (root) {
  const SHIFT = { key: "Shift", code: "ShiftLeft", keyCode: 16, charCode: 0 };

  function createDispatcher(target, env) {
    const win = env ? env.window : root.window;
    const doc = env ? env.document : root.document;
    const recipients = [...new Set([target, doc, win].filter(Boolean))];
    let shiftDown = false;

    function fire(type, s) {
      const init = {
        key: s.key,
        code: s.code,
        keyCode: s.keyCode,
        which: s.keyCode,
        charCode: type === "keypress" ? (s.charCode || s.keyCode) : 0,
        bubbles: true,
        cancelable: true,
        shiftKey: shiftDown
      };
      if (win) init.view = win;
      for (const r of recipients) r.dispatchEvent(new KeyboardEvent(type, init));
    }

    function setShift(down) {
      if (down === shiftDown) return;
      if (down) {
        shiftDown = true;
        fire("keydown", SHIFT);
      } else {
        fire("keyup", SHIFT);
        shiftDown = false;
      }
    }

    function stroke(s) {
      setShift(!!s.shift);
      fire("keydown", s);
      if (!s.skipKeypress) fire("keypress", s);
      if (!s.control && s.key !== "Dead") {
        const data = s.insert != null ? s.insert : s.key.length === 1 ? s.key : "";
        if (data) target.dispatchEvent(new InputEvent("input", { data, inputType: "insertText", bubbles: true }));
      }
      fire("keyup", s);
    }

    return { stroke, releaseShift: () => setShift(false) };
  }

  // Escolhe o elemento que recebe a digitação: foco atual → canvas → body.
  function pickTarget(doc) {
    const active = doc.activeElement;
    if (active && active !== doc.body) return active;
    return doc.querySelector("canvas") || doc.body || doc.documentElement;
  }

  // Garante foco no alvo; canvas recebe clique sintético no centro.
  function focusTarget(el) {
    if (!el) return;
    if (el instanceof HTMLElement && el.tabIndex < 0) el.setAttribute("tabindex", "0");
    try {
      el.focus();
    } catch (_) {
      // alguns elementos não aceitam foco
    }
    if (el.tagName === "CANVAS") {
      const r = el.getBoundingClientRect();
      const opts = { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      for (const t of ["mousedown", "mouseup", "click"]) el.dispatchEvent(new MouseEvent(t, opts));
    }
  }

  const api = { createDispatcher, pickTarget, focusTarget };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
