# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Idioma:** responder ao usuário e escrever documentação sempre em português (pt-BR). Strings de UI, comentários e README já são em pt-BR; manter.

## Projeto

"VMware Paste Helper" — extensão Manifest V3 (Edge/Chrome; Firefox só temporária) que digita texto (normalmente senhas) em consoles web de VMs (vSphere, Proxmox noVNC etc.) sem suporte a área de transferência, simulando teclas.

## Build / execução / testes

Sem build, sem gerenciador de pacotes, sem linter, sem testes. JS puro carregado direto pelo navegador.

- Carregar: `chrome://extensions` ou `edge://extensions` → modo desenvolvedor → "Carregar sem compactação" → selecionar raiz do repo. Firefox: `about:debugging` → carregar `manifest.json` temporariamente.
- Após editar: recarregar a extensão na página de extensões **e** recarregar a aba alvo (content script só é injetado no carregamento da página; abas antigas fazem `chrome.tabs.sendMessage` falhar, e o popup mostra "Erro ao enviar. Recarregue a página.").
- Debug: logs do popup via botão direito no popup → Inspecionar; logs do content script aparecem no DevTools da página alvo.

## Arquitetura

Duas partes comunicando por uma única mensagem:

1. `popup.html` / `popup.js` — UI do popup. Ao abrir, preenche o campo com `navigator.clipboard.readText()`. Ao clicar, envia `{action: "typeText", text, delay}` para a aba ativa via `chrome.tabs.sendMessage`. Atraso padrão: 10 ms.
2. `content_script.js` — injetado em `<all_urls>` (declarado em `manifest.json`). Trata `typeText` e retorna na hora (`{status: "started"}`); a digitação roda de forma assíncrona, então "Concluído" no popup significa "enviado", não "digitação terminada".

Fluxo do content script:
- **Escolha do alvo**: `document.activeElement` → primeiro `<canvas>` → `document.body`. Canvas recebe `tabindex` forçado e mousedown/mouseup/click sintéticos no centro (`hintFocus`) para pegar foco.
- **Por caractere**: `resolveKeyInfo(char)` consulta `KEY_MAP`; caracteres desconhecidos caem em `code: "Unidentified"`.
- **Shift**: keydown/keyup de Shift só enviados na transição entre caracteres com e sem Shift (não a cada caractere).
- **Sequência de eventos** (`sendKeyStroke`): `keydown` → `keypress` (exceto `skipKeypress`) → `InputEvent("input")` (exceto `isControl`; usa `insert` se definido) → `keyup`. Eventos de teclado disparados no alvo, em `document` e em `window`.

### KEY_MAP segue layout ABNT2 (PT-BR)

Valores de `code`/`keyCode` modelam teclado físico ABNT2, não US (ex.: `/` e `?` → `IntlRo`/193, `;`/`:` → `Slash`, `]`/`}` → `Backslash`, `\`/`|` → `IntlBackslash`, `~`/`^` são dead keys em `Quote` com `key: "Dead"` e `insert`). Consoles de VM geralmente traduzem `code`/`keyCode` em scancodes, então o layout de teclado do sistema convidado precisa ser ABNT2. Ao adicionar/alterar caracteres, manter coerência com ABNT2 e usar as flags `shiftKey`, `isControl`, `skipKeypress`, `insert` como nas entradas existentes.

`SHIFT_INFO` e `KEY_MAP` são `const` declarados no fim do arquivo — funciona porque só são acessados quando chega mensagem, mas não chamar funções de digitação no topo do arquivo antes deles.

## Observações

- `manifest.json` ainda não tem campo `icons`, embora `icons/` tenha PNGs + `icon.svg`. README cita `./icons/generate-icons.sh`, que não existe no repo.
