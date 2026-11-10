// Motor de digitação: percorre o plano linha a linha, com pausa,
// cancelamento e modo passo a passo. Não conhece DOM (send/wait injetados).
(function (root) {
  const keymaps = typeof module !== "undefined" ? require("./keymaps.js") : root.VMPaste;
  const STEP_SETTLE_MS = 50;

  function createTyper({ plan, mode, keyDelay, enterPause, send, releaseShift, wait, onProgress }) {
    const lines = plan.lines.length;
    let line = 0;
    let done = 0;
    let state = "typing";
    let cancelled = false;
    let paused = false;
    let resumeGate = null; // resolve() que libera a pausa
    let stepGate = null; // resolve(sendEnter) que libera a próxima linha

    const report = (s) => {
      if (s) state = s;
      onProgress({ line, lines, done, total: plan.total, state });
    };

    // Bloqueia enquanto pausado; retorna true se cancelado.
    async function gate() {
      while (paused && !cancelled) {
        releaseShift(); // não deixa Shift preso no convidado durante a pausa
        report("paused");
        await new Promise((r) => (resumeGate = r));
      }
      if (!cancelled && state !== "typing") report("typing");
      return cancelled;
    }

    function finish(result) {
      releaseShift();
      report(result);
      return result;
    }

    async function start() {
      for (let i = 0; i < lines; i++) {
        line = i + 1;
        report("typing");
        for (const s of plan.lines[i]) {
          if (await gate()) return finish("cancelled");
          send(s);
          done++;
          report();
          // Sempre cede a vez (mesmo com atraso 0) para Pausar/Cancelar funcionarem.
          await wait(Math.max(0, keyDelay || 0));
        }
        if (i === lines - 1) break;

        if (mode === "step") {
          releaseShift(); // o Enter real do usuário não pode virar Shift+Enter
          report("waiting");
          const sendEnter = await new Promise((r) => (stepGate = r));
          stepGate = null;
          if (cancelled) return finish("cancelled");
          if (sendEnter) send(keymaps.ENTER);
          await wait(STEP_SETTLE_MS);
        } else {
          if (await gate()) return finish("cancelled");
          send(keymaps.ENTER);
          if (enterPause > 0) await wait(enterPause);
        }
      }
      if (cancelled) return finish("cancelled");
      return finish("done");
    }

    function release(gateFn, value) {
      if (gateFn) gateFn(value);
    }

    return {
      start,
      pause() {
        if (state === "typing") paused = true;
      },
      resume() {
        paused = false;
        release(resumeGate);
        resumeGate = null;
      },
      cancel() {
        cancelled = true;
        paused = false;
        release(resumeGate);
        release(stepGate, false);
      },
      next() {
        if (state === "waiting") release(stepGate, true);
      },
      userEnter() {
        if (state === "waiting") release(stepGate, false);
      }
    };
  }

  const api = { createTyper };
  root.VMPaste = Object.assign(root.VMPaste || {}, api);
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
