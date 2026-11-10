# Modernização do VMware Paste Helper — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar layout EN-US, acentos no ABNT2, aba "Texto longo" (modos tudo de uma vez / passo a passo), painel de progresso na página e popup Material You.

**Architecture:** Lógica pura (mapas de teclado, normalização/planejamento do texto, motor de digitação) em arquivos `src/*.js` sem dependência de DOM real, testados com `node --test`. Cada arquivo funciona como script clássico no navegador (expõe em `globalThis.VMPaste`) e como CommonJS no Node (`module.exports`). Content scripts declarados em ordem no `manifest.json` compartilham o escopo; popup carrega os mesmos arquivos via `<script>`.

**Tech Stack:** JS puro, Manifest V3, Node 25 `node:test` + `node:assert` (só para testes; zero dependências npm).

**Spec:** `docs/superpowers/specs/2026-11-10-modernizacao-design.md`

## Global Constraints

- Manifest V3, Edge/Chrome 88+. Sem build, sem bundler, sem dependências npm, sem fontes externas.
- UI, mensagens e comentários em pt-BR.
- Nunca persistir nem logar senha/texto digitado. `chrome.storage.local` guarda só: `layout`, `keyDelay`, `enterPause`, `mode`, `lastTab`.
- Padrões: `layout: "abnt2"`, `keyDelay: 10`, `enterPause: 500`, `mode: "all"`, `lastTab: "password"`.
- Paleta Material You: primária `#6750a4`, container `#e8def8`, superfície `#fdf7ff`, campo `#f3edf7` com borda inferior primária; container ≈24px de raio, abas/botões em pílula. Tema escuro via `prefers-color-scheme`.
- Padrão de módulo em todo `src/*.js`:
  ```js
  (function (root) {
    const api = { /* ... */ };
    root.VMPaste = Object.assign(root.VMPaste || {}, api);
    if (typeof module !== "undefined") module.exports = api;
  })(globalThis);
  ```
- Testes: `node --test tests/` na raiz do repo.

## Review Focus

1. Texto copiado do Windows (`\r\n`) → um Enter por quebra, nunca dois. → teste em Task 2.
2. Passo a passo: usuário aperta Enter no console enquanto a linha ainda está sendo digitada → ignorar, não pular linha. → teste em Task 4.
3. Cancelar no meio de uma maiúscula/símbolo com Shift → Shift solto (keyup enviado). → teste em Task 3 e Task 4.
4. Clicar "Digitar" de novo com digitação em andamento → recusar com erro `"Digitação em andamento"`, sem iniciar segunda. → teste em Task 5.
5. Texto vazio ou só com caracteres não suportados → popup mostra "Nada para digitar" e não envia. → teste em Task 2 (`buildPlan(...).total === 0`).

---

### Task 0: Branch e estrutura

- [ ] **Step 1:** `git checkout -b feat/modernizacao`. As mudanças não commitadas de `README.md`/`content_script.js` vão junto (o `content_script.js` será removido na Task 5).
- [ ] **Step 2:** Adicionar `.superpowers/` ao `.gitignore` (criar arquivo).
- [ ] **Step 3:** Commit: `chore: prepara branch de modernização` (inclui `.gitignore`, `CLAUDE.md`, `docs/`, `icons/`).

---

### Task 1: Mapas de teclado ABNT2 e EN-US

**Files:**
- Create: `src/keymaps.js`
- Test: `tests/keymaps.test.js`

**Interfaces:**
- Produces:
  - Tipo `Stroke = {key: string, code: string, keyCode: number, charCode: number, shift?: boolean, control?: boolean, skipKeypress?: boolean, insert?: string}`
  - `LAYOUTS = ["abnt2", "en-us"]`
  - `strokesFor(char: string, layout: "abnt2"|"en-us"): Stroke[] | null` — sequência de teclas que produz `char`; `null` se não suportado.
  - `ENTER: Stroke` (`key "Enter"`, `code "Enter"`, keyCode 13, `control: true`)

Regras:
- Letras, dígitos, espaço, `\t` (Tab, `control`, `skipKeypress`), `\b` iguais nos dois layouts. Shift indicado por `shift: true` no stroke (o dispatcher cuida do keydown/keyup de Shift).
- ABNT2: portar entradas atuais de `content_script.js` (`specials`). Dead keys `~` (`Quote`), `^` (Shift+`Quote`), `´` (`BracketRight`), `` ` `` (Shift+`BracketRight`), `¨` (Shift+`Digit6`) têm `key: "Dead"`, `skipKeypress: true`, sem `insert`. Caractere isolado → `[deadStroke, SPACE]`. Acentuados → `[deadStroke, letraStroke]`:
  `á é í ó ú` (´), `à` (`), `â ê ô` (^), `ã õ` (~), `ü` (¨), e maiúsculas (`Á`… com `shift: true` na letra). `ç`/`Ç` diretos (`Semicolon`).
- EN-US (US QWERTY): `` ` ``/`~` `Backquote` 192; `-`/`_` `Minus` 189; `=`/`+` `Equal` 187; `[`/`{` `BracketLeft` 219; `]`/`}` `BracketRight` 221; `\`/`|` `Backslash` 220; `;`/`:` `Semicolon` 186; `'`/`"` `Quote` 222; `,`/`<` `Comma` 188; `.`/`>` `Period` 190; `/`/`?` `Slash` 191; `!@#$%^&*()` = Shift+`Digit1..0` (`^` = Shift+`Digit6`). Sem dead keys. Acentuados, `ç`, `´`, `¨` → `null`.
- `\n` → `[ENTER]`.

- [ ] **Step 1: Escrever testes que falham**

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const { strokesFor } = require("../src/keymaps.js");
const codes = s => s.map(k => k.code + (k.shift ? "+S" : ""));

test("en-us: barra, dois-pontos e chaves do curl", () => {
  assert.deepEqual(codes(strokesFor("/", "en-us")), ["Slash"]);
  assert.deepEqual(codes(strokesFor(":", "en-us")), ["Semicolon+S"]);
  assert.deepEqual(codes(strokesFor("{", "en-us")), ["BracketLeft+S"]);
  assert.deepEqual(codes(strokesFor("}", "en-us")), ["BracketRight+S"]);
  assert.deepEqual(codes(strokesFor("~", "en-us")), ["Backquote+S"]);
  assert.deepEqual(codes(strokesFor("^", "en-us")), ["Digit6+S"]);
});
test("en-us: todo o comando curl é suportado", () => {
  const cmd = "curl -sS -m 10 -o /dev/null -w 'citrix:%{http_code}\\n' https://api.cloud.com";
  for (const ch of cmd) assert.ok(strokesFor(ch, "en-us"), `faltou ${ch}`);
});
test("en-us: acentos e ç não suportados", () => {
  for (const ch of "éãçÇ´¨") assert.equal(strokesFor(ch, "en-us"), null);
});
test("abnt2: barra e interrogação em IntlRo", () => {
  assert.deepEqual(codes(strokesFor("/", "abnt2")), ["IntlRo"]);
  assert.deepEqual(codes(strokesFor("?", "abnt2")), ["IntlRo+S"]);
});
test("abnt2: acentos compostos", () => {
  assert.deepEqual(codes(strokesFor("é", "abnt2")), ["BracketRight", "KeyE"]);
  assert.deepEqual(codes(strokesFor("ã", "abnt2")), ["Quote", "KeyA"]);
  assert.deepEqual(codes(strokesFor("ô", "abnt2")), ["Quote+S", "KeyO"]);
  assert.deepEqual(codes(strokesFor("à", "abnt2")), ["BracketRight+S", "KeyA"]);
  assert.deepEqual(codes(strokesFor("ü", "abnt2")), ["Digit6+S", "KeyU"]);
  assert.deepEqual(codes(strokesFor("Ã", "abnt2")), ["Quote", "KeyA+S"]);
  assert.deepEqual(codes(strokesFor("É", "abnt2")), ["BracketRight", "KeyE+S"]);
});
test("abnt2: dead key isolada seguida de espaço", () => {
  assert.deepEqual(codes(strokesFor("~", "abnt2")), ["Quote", "Space"]);
  assert.deepEqual(codes(strokesFor("^", "abnt2")), ["Quote+S", "Space"]);
});
test("ambos: ç direto no abnt2, quebra vira Enter", () => {
  assert.deepEqual(codes(strokesFor("ç", "abnt2")), ["Semicolon"]);
  assert.deepEqual(codes(strokesFor("\n", "en-us")), ["Enter"]);
});
test("caractere desconhecido → null", () => {
  assert.equal(strokesFor("€", "abnt2"), null);
});
```

- [ ] **Step 2:** `node --test tests/keymaps.test.js` → FAIL (`Cannot find module '../src/keymaps.js'`).
- [ ] **Step 3:** Implementar `src/keymaps.js` seguindo as regras acima e o padrão de módulo.
- [ ] **Step 4:** `node --test tests/keymaps.test.js` → PASS.
- [ ] **Step 5:** Commit `feat: mapas de teclado ABNT2 e EN-US com acentos`.

---

### Task 2: Normalização e plano de digitação

**Files:**
- Create: `src/text-plan.js`
- Test: `tests/text-plan.test.js`

**Interfaces:**
- Consumes: `strokesFor`, `ENTER` (Task 1)
- Produces:
  - `normalizeText(text: string): string` — `\r\n`/`\r` → `\n`; remove **uma** `\n` final.
  - `analyze(text: string, layout): {lines: number, chars: number, unsupported: string[], hasTabs: boolean}` — sobre o texto normalizado; `unsupported` sem repetição, na ordem em que aparecem.
  - `buildPlan(text: string, layout, kind: "password"|"long"): Plan`
  - Tipo `Plan = {lines: Stroke[][], total: number}` — `lines[i]` são os strokes da linha i **sem** Enter; Enter entre linhas é responsabilidade do Typer (Task 4). Caracteres não suportados são pulados. `total` = soma dos strokes. Para `kind: "password"`, o texto vira uma única linha (quebras removidas).

- [ ] **Step 1: Testes que falham**

```js
const { normalizeText, analyze, buildPlan } = require("../src/text-plan.js");
test("CRLF vira uma quebra só", () => {
  assert.equal(normalizeText("a\r\nb\rc"), "a\nb\nc");
});
test("remove só uma quebra final", () => {
  assert.equal(normalizeText("a\nb\n"), "a\nb");
  assert.equal(normalizeText("a\n\n"), "a\n");
});
test("linhas em branco no meio viram linhas vazias", () => {
  const p = buildPlan("a\n\nb", "en-us", "long");
  assert.equal(p.lines.length, 3);
  assert.equal(p.lines[1].length, 0);
});
test("analyze conta linhas e lista não suportados", () => {
  const r = analyze("olá ção\r\nok\tx\n", "en-us");
  assert.equal(r.lines, 2);
  assert.deepEqual(r.unsupported, ["á", "ç", "ã"]);
  assert.equal(r.hasTabs, true);
});
test("buildPlan pula não suportados", () => {
  const p = buildPlan("aéb", "en-us", "long");
  assert.deepEqual(p.lines[0].map(s => s.code), ["KeyA", "KeyB"]);
  assert.equal(p.total, 2);
});
test("texto só com não suportados → total 0", () => {
  assert.equal(buildPlan("éé", "en-us", "long").total, 0);
  assert.equal(buildPlan("", "abnt2", "password").total, 0);
});
test("password é uma linha", () => {
  assert.equal(buildPlan("ab\ncd", "abnt2", "password").lines.length, 1);
});
```

- [ ] **Step 2:** `node --test tests/text-plan.test.js` → FAIL.
- [ ] **Step 3:** Implementar `src/text-plan.js`.
- [ ] **Step 4:** `node --test tests/` → PASS (todas).
- [ ] **Step 5:** Commit `feat: normalização e plano de digitação`.

---

### Task 3: Dispatcher de eventos de teclado

**Files:**
- Create: `src/dispatch.js`
- Test: `tests/dispatch.test.js`

**Interfaces:**
- Consumes: `Stroke` (Task 1)
- Produces:
  - `createDispatcher(target: EventTarget, env?: {window, document}): {stroke(s: Stroke): void, releaseShift(): void}`
  - `pickTarget(doc: Document): Element` e `focusTarget(el: Element): void` — portar `activeElement → canvas → body`, `ensureFocusable`, `hintFocus` do `content_script.js` atual.

Comportamento de `stroke`: se `s.shift` e Shift solto → keydown Shift (`ShiftLeft`, 16); se `!s.shift` e Shift preso → keyup Shift. Depois `keydown` → `keypress` (exceto `skipKeypress`) → `InputEvent("input")` (exceto `control` ou `key === "Dead"`; `data = insert ?? key` se 1 char) → `keyup`. Eventos com `shiftKey` refletindo o estado, disparados no target, `document` e `window` (sem duplicar), como hoje. Sem `console.log` de conteúdo.

- [ ] **Step 1: Testes que falham** — no topo do teste, polyfill:

```js
globalThis.KeyboardEvent = class extends Event { constructor(t, i) { super(t, i); Object.assign(this, i); } };
globalThis.InputEvent = class extends Event { constructor(t, i) { super(t, i); Object.assign(this, i); } };
const log = []; const target = { dispatchEvent: e => log.push(`${e.type}:${e.key}`) };
const d = createDispatcher(target, { window: null, document: null });
```

Asserções:
- `d.stroke(<"A" de strokesFor>)` → `log` = `["keydown:Shift","keydown:A","keypress:A","input:undefined","keyup:A"]`; em seguida `d.stroke(<"a">)` começa com `"keyup:Shift"`.
- `d.stroke(<"!">); d.releaseShift()` → último evento `"keyup:Shift"`; segunda chamada de `releaseShift()` não gera evento.
- Dead key: `d.stroke(strokesFor("é","abnt2")[0])` não gera `keypress` nem `input`.

- [ ] **Step 2:** `node --test tests/dispatch.test.js` → FAIL.
- [ ] **Step 3:** Implementar `src/dispatch.js`.
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: dispatcher de eventos com controle de Shift`.

---

### Task 4: Motor de digitação (Typer)

**Files:**
- Create: `src/typer.js`
- Test: `tests/typer.test.js`

**Interfaces:**
- Consumes: `Plan` (Task 2), `ENTER` (Task 1), dispatcher (Task 3)
- Produces:
  - `createTyper({plan: Plan, mode: "all"|"step"|"password", keyDelay: number, enterPause: number, send: (s: Stroke) => void, releaseShift: () => void, wait: (ms: number) => Promise<void>, onProgress: (p: Progress) => void}): Typer`
  - `Typer = {start(): Promise<"done"|"cancelled">, pause(), resume(), cancel(), next(), userEnter()}`
  - `Progress = {line: number, lines: number, done: number, total: number, state: "typing"|"paused"|"waiting"|"done"|"cancelled"}` (`line` 1-based)

Comportamento:
- Entre linhas `i` e `i+1`: `"all"` → `send(ENTER)`, `wait(enterPause)`; `"step"` → estado `"waiting"` até `userEnter()` (usuário já apertou Enter real, não enviar Enter) ou `next()` (envia `ENTER`). Nunca Enter após a última linha. `"password"` = uma linha, sem Enter.
- `userEnter()`/`next()` fora do estado `"waiting"` são ignorados.
- `wait(keyDelay)` após cada stroke se `keyDelay > 0`. Em `"step"`, `wait(50)` após o Enter antes da próxima linha.
- `pause()` suspende no próximo stroke; `resume()` continua. `cancel()` interrompe no próximo stroke, chama `releaseShift()`, resolve `"cancelled"`. Fim normal: `releaseShift()`, `"done"`.
- `onProgress` chamado a cada mudança de linha/estado e a cada stroke.

- [ ] **Step 1: Testes que falham** — usar `wait = () => Promise.resolve()` e `send` registrando `s.code`.
  - `"all"`, plano de `buildPlan("ab\ncd","en-us","long")` → codes `["KeyA","KeyB","Enter","KeyC","KeyD"]`; resultado `"done"`.
  - `"step"`, mesmo plano: após `start()` e flush (`await new Promise(setImmediate)`), codes `["KeyA","KeyB"]` e último progresso `state: "waiting", line: 1`; `userEnter()` → final `["KeyA","KeyB","KeyC","KeyD"]` (sem Enter sintético).
  - `"step"`, `next()` em vez de `userEnter()` → inclui `"Enter"` entre as linhas.
  - `userEnter()` chamado **durante** a digitação da linha 1 (antes de chegar a `"waiting"`; use `wait` que resolve manualmente) → ignorado; linha 2 só começa após novo `userEnter()`.
  - `cancel()` no meio → resolve `"cancelled"`, `releaseShift` chamado, nenhum stroke depois.
  - `pause()` → nenhum stroke novo após flush; `resume()` → termina com `"done"`.
- [ ] **Step 2:** `node --test tests/typer.test.js` → FAIL.
- [ ] **Step 3:** Implementar `src/typer.js`.
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: motor de digitação com modos tudo/passo a passo, pausa e cancelamento`.

---

### Task 5: Painel na página + content script + manifest

**Files:**
- Create: `src/overlay.js`, `src/content.js`
- Test: `tests/content.test.js`
- Modify: `manifest.json`
- Delete: `content_script.js`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - Mensagem popup → content: `{action: "vmpaste:start", text: string, layout, kind: "password"|"long", mode: "all"|"step", keyDelay: number, enterPause: number}`. Resposta: `{ok: true}` ou `{ok: false, error: string}`.
  - `createController({createTyper, createOverlay, pickTarget, ...}): {handle(msg): {ok, error?}, onTrustedEnter(): void}` em `src/content.js` (injeção para teste). No final do arquivo, se `typeof chrome !== "undefined" && chrome.runtime?.onMessage`, registra o listener (resposta síncrona via `sendResponse`) e `window.addEventListener("keydown", e => { if (e.isTrusted && e.key === "Enter") controller.onTrustedEnter(); }, true)`.
  - `createOverlay({onPause, onResume, onCancel, onNext}): {update(p: Progress, mode), remove()}` em `src/overlay.js`.

Overlay: host `div` fixo (canto inferior direito, `z-index: 2147483647`) com `attachShadow({mode: "closed"})`; estilo Material You (Global Constraints) com tema escuro. Texto: `"Linha X de N"` (long) / `"Caractere X de N"` (password, nunca mostra conteúdo); `"waiting"` → `"Linha X de N — aperte Enter no console"` + botão "Próxima linha" no lugar de Pausar/Retomar; barra de progresso; botão Cancelar. Todos os botões com `mousedown → preventDefault()` para não roubar foco do console. `"done"` → "Concluído", remove após 3 s; `"cancelled"` → "Cancelado", remove após 3 s.

Manifest: `permissions: ["activeTab", "scripting", "storage"]`; `action.default_popup: "popup/popup.html"`; `icons` e `action.default_icon` com `icons/icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`; `content_scripts[0].js`: `["src/keymaps.js","src/text-plan.js","src/dispatch.js","src/typer.js","src/overlay.js","src/content.js"]`; `version: "2.0"`.

- [ ] **Step 1: Testes que falham** (`tests/content.test.js`, com fakes para `createTyper` cujo `start()` retorna promise controlada e `createOverlay` no-op):
  - `handle(start)` → `{ok: true}`; segundo `handle(start)` antes de terminar → `{ok: false, error: "Digitação em andamento"}`; após o primeiro resolver, novo `handle` → `{ok: true}`.
  - `handle` com texto cujo plano tem `total === 0` → `{ok: false, error: "Nada para digitar"}`.
  - `onTrustedEnter()` repassa para `typer.userEnter()` só quando há digitação ativa.
- [ ] **Step 2:** `node --test tests/content.test.js` → FAIL.
- [ ] **Step 3:** Implementar `src/overlay.js`, `src/content.js`; atualizar `manifest.json`; `git rm content_script.js`.
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5:** Commit `feat: content script com painel de progresso na página`.

---

### Task 6: Popup Material You + persistência

**Files:**
- Create: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `src/settings.js`
- Test: `tests/settings.test.js`
- Delete: `popup.html`, `popup.js`

**Interfaces:**
- Consumes: `analyze` (Task 2), mensagem `vmpaste:start` (Task 5).
- Produces: `DEFAULTS`, `loadSettings(storage): Promise<Settings>`, `saveSettings(storage, partial): Promise<void>` em `src/settings.js` — `storage` = `chrome.storage.local` (injetado para teste). `saveSettings` só grava chaves de `DEFAULTS` (descarta qualquer outra, ex. `text`).

Popup (`popup.html` carrega `../src/keymaps.js`, `../src/text-plan.js`, `../src/settings.js`, `popup.js`), largura ~360px, layout conforme mockup `.superpowers/brainstorm/*/content/texto-longo.html`:
- Cabeçalho "VM Paste". Abas pílula **Senha** | **Texto longo** (última aba lembrada em `lastTab`).
- Comum: seletor segmentado **ABNT2 | EN-US**; atraso entre teclas (ms).
- Senha: input `password` + botão olho (alterna `type`), pré-preenchido via `navigator.clipboard.readText()` (falha silenciosa); botão "Digitar no console".
- Texto longo: `textarea` monoespaçada; contador `"N linhas · M caracteres"` (de `analyze`, atualizado no `input`); seletor **Tudo de uma vez | Passo a passo**; "Pausa após Enter (ms)" visível só em "Tudo de uma vez"; botão `"Digitar N linhas"`.
- Antes de enviar: `analyze`. Se `unsupported.length` ou `hasTabs` → bloco de aviso listando os caracteres (`"Não suportados em EN-US: é ã ç"`) e/ou `"Contém Tabs: podem acionar o autocompletar do shell"`; botão muda para `"Digitar pulando N caracteres"` (ou `"Digitar mesmo assim"` se só Tabs) e exige segundo clique. Editar o texto/layout limpa o aviso.
- Ctrl+Enter dispara o botão da aba ativa.
- Resposta `{ok:false,error}` → mostrar `error`. Exceção do `sendMessage` (sem content script) → `"Recarregue a página do console e tente de novo."`. Sucesso → `window.close()` (progresso segue no painel da página).
- Toda mudança de layout/atrasos/modo/aba → `saveSettings`.
- `popup.css`: tokens CSS em `:root` + `@media (prefers-color-scheme: dark)`; fonte `system-ui`.

- [ ] **Step 1: Testes que falham** (`tests/settings.test.js`, `storage` fake com `get`/`set` em memória):
  - `loadSettings` com storage vazio → igual a `DEFAULTS`.
  - `saveSettings(s, {layout: "en-us", text: "segredo"})` → storage contém `layout` e **não** contém `text`.
  - `loadSettings` após salvar → `layout: "en-us"`, demais padrões.
- [ ] **Step 2:** `node --test tests/settings.test.js` → FAIL.
- [ ] **Step 3:** Implementar `src/settings.js` e o popup; `git rm popup.html popup.js`.
- [ ] **Step 4:** `node --test tests/` → PASS.
- [ ] **Step 5: Verificação manual** (`/run` ou à mão): carregar extensão sem compactação; abrir uma página de teste local com `<textarea>` e com `<canvas tabindex=0>` que loga `keydown` (`e.code`, `e.key`); conferir: (a) EN-US + comando curl → codes `Slash`, `Semicolon`+Shift, `BracketLeft/Right`+Shift; (b) ABNT2 + `ação é` → dead key + letra; (c) Passo a passo pausa após a linha 1 e segue ao apertar Enter real; (d) Cancelar solta Shift; (e) tema escuro.
- [ ] **Step 6:** Commit `feat: popup Material You com abas, modos e preferências`.

---

### Task 7: Documentação

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] **Step 1:** README: novas funcionalidades (layout EN-US, acentos, texto longo e modos, painel, atalho Ctrl+Enter), nova estrutura de arquivos, seção "Testes" com `node --test tests/`; remover referência a `./icons/generate-icons.sh`; versão 2.0.
- [ ] **Step 2:** CLAUDE.md: comando de testes, nova arquitetura (`src/*` padrão de módulo, ordem dos content scripts, protocolo `vmpaste:start`, Typer/overlay), remover nota sobre `icons` e `generate-icons.sh`.
- [ ] **Step 3:** `node --test tests/` → PASS.
- [ ] **Step 4:** Commit `docs: atualiza README e CLAUDE.md para v2`.
