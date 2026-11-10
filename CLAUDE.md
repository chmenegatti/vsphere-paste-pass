# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Idioma:** responder ao usuário e escrever documentação sempre em português (pt-BR). Strings de UI, comentários e README já são em pt-BR; manter.

## Projeto

"VMware Paste Helper" — extensão Manifest V3 (Edge/Chrome; Firefox só temporária) que digita texto em consoles web de VMs (vSphere, Proxmox noVNC etc.) sem suporte a área de transferência, simulando teclas. Aba Senha (uma linha) e aba Texto longo (comandos/scripts, modos "tudo de uma vez" e "passo a passo"). Layout do destino ABNT2 ou EN-US.

## Comandos

- Testes: `node --test` (runner nativo, auto-descobre `tests/*.test.js`; sem npm/dependências). Um arquivo: `node --test tests/typer.test.js`. Obs.: `node --test tests/` **não** funciona no Node 25.
- Sem build, sem linter. Carregar: `chrome://extensions` / `edge://extensions` → modo desenvolvedor → "Carregar sem compactação" → raiz do repo.
- Após editar: recarregar a extensão **e** a aba alvo (content script só é injetado no carregamento da página).
- Debug: popup → botão direito → Inspecionar; content script → DevTools da página alvo.

## Arquitetura

Todo `src/*.js` segue o mesmo padrão de módulo: IIFE que expõe em `globalThis.VMPaste` (navegador, escopo compartilhado entre content scripts e no popup via `<script>`) e `module.exports` (Node, testes). Dependências entre arquivos: `typeof module !== "undefined" ? require(...) : root.VMPaste`. Ordem dos content scripts no `manifest.json` importa (keymaps → text-plan → dispatch → typer → overlay → content).

Fluxo: `popup/popup.js` valida com `analyze()` (avisa caracteres não suportados/Tabs, exige segundo clique) e envia `{action: "vmpaste:start", text, layout, kind: "password"|"long", mode: "all"|"step", keyDelay, enterPause}` → `src/content.js` (`createController`) responde na hora `{ok}` ou `{ok:false, error}` e o popup fecha (`{action: "vmpaste:cancel"}` cancela pelo popup quando o painel não está visível); o progresso fica no painel `src/overlay.js` (Shadow DOM, botões com `mousedown preventDefault` para não roubar foco do console).

- `src/keymaps.js` — `strokesFor(char, layout)` → lista de `Stroke` ou `null`. Mapas modelam a **tecla física** (`code`/`keyCode`), pois consoles VMware traduzem para scancode; o layout do convidado precisa bater. ABNT2: acentos = dead key + letra; dead key isolada = dead + Espaço. EN-US: sem acentos/`ç`.
- `src/text-plan.js` — `normalizeText` (`\r\n`→`\n`, remove uma quebra final), `analyze`, `buildPlan` (pula não suportados; linhas sem Enter).
- `src/typer.js` — `createTyper` sem DOM (send/wait injetados): Enter entre linhas, nunca após a última; `step` espera `userEnter()` (Enter real, `isTrusted`, ouvido em captura no `window` por `content.js`) ou `next()` (envia Enter); `pause/resume/cancel` (cancel solta Shift).
- `src/dispatch.js` — dispara keydown/keypress/input/keyup no alvo + `document` + `window`; Shift só nas transições. `pickTarget`: activeElement → canvas → body.
- `src/settings.js` — `chrome.storage.local`; só grava chaves de `DEFAULTS` (nunca senha/texto).

Testes injetam fakes (dispatcher com polyfill de `KeyboardEvent`, typer/overlay falsos no controller). Popup e overlay não têm teste unitário: conferir no navegador.

## Docs de design

Spec e plano da v2 em `docs/superpowers/`. `.superpowers/` (mockups, ledger) é ignorado pelo git.
