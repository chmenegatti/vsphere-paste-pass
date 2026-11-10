# Modernização do VMware Paste Helper — Design

Data: 2026-11-10

## Intenção

A extensão digita texto em consoles web de VM (vSphere, Proxmox noVNC etc.) simulando teclas, porque esses consoles não aceitam colar. Hoje ela tem três limitações que o usuário sente na prática:

1. **Só funciona quando o sistema convidado usa teclado ABNT2.** O `KEY_MAP` envia `code`/`keyCode` de posições físicas do ABNT2, e o console traduz isso em scancodes. Com convidado em EN-US, caracteres saem errados ou somem. Caso real: o comando
   `curl -sS -m 10 -o /dev/null -w 'citrix:%{http_code}\n' https://api.cloud.com`
   digitado num destino EN-US perdeu as `/` (enviadas como `IntlRo`, tecla que não existe no US) e a `}` (enviada como `Backslash`, que no US com Shift vira `|`).
2. **Só existe um campo de uma linha (senha).** O usuário precisa digitar comandos de terminal e scripts PowerShell/bash de várias linhas.
3. **Visual datado.** O usuário quer algo mais bonito e moderno.

Sucesso = o comando acima, e scripts multi-linha, chegam idênticos num console EN-US; a extensão tem visual Material You.

## Objetivos

- Seletor de layout do teclado do destino: **ABNT2** ou **EN-US**.
- Nova aba **"Texto longo"** para textos multi-linha, digitados linha a linha com Enter ao fim de cada linha, como se o usuário digitasse.
- Redesenho completo do popup no estilo **Material You** (escolhido pelo usuário entre 5 opções; mockups em `.superpowers/brainstorm/*/content/visual-style.html` e `texto-longo.html`).

## Não-objetivos

- Suporte a outros layouts além de ABNT2 e EN-US.
- Colar via clipboard nativo do console / integração com APIs de VMware/Proxmox.
- Publicação na Chrome Web Store.
- Build step, bundler, framework ou dependências npm. Continua JS puro carregado direto.

## Anti-objetivos (falharia mesmo "funcionando")

- Caractere enviado errado silenciosamente. Se o layout escolhido não consegue enviar um caractere, o usuário precisa saber **antes** de digitar.
- Linhas chegando atropeladas porque o comando anterior ainda não terminou (mitigado pela pausa no modo automático; resolvido pelo modo passo a passo).
- Não conseguir parar uma digitação longa que deu errado.
- Senha visível/registrada onde não deveria (logs, storage).

## Decisões do usuário

- **Layout do destino:** controle segmentado ABNT2 | EN-US, visível nas duas abas.
- **Texto longo:** linha por linha, Enter após cada linha, exceto a última (usuário aperta Enter no console). Dois modos à escolha: tudo de uma vez ou passo a passo.
- **Acentos:** suportados no ABNT2 via composição dead key + letra.
- **Visual:** Material You — cantos bem arredondados (≈24px no container, pílulas nas abas/botões), paleta lilás (primária `#6750a4`, container `#e8def8`, superfície `#fdf7ff`, campo `#f3edf7` com borda inferior primária), controles segmentados com contorno.
- **Aceitou também** (propostos e confirmados com "tudo certo"):
  - Pausa configurável após cada Enter (padrão 500 ms), além do atraso entre teclas (padrão 10 ms).
  - Progresso ("Linha 3 de 6" + barra) com **Pausar** e **Cancelar**.
  - Aviso antes de digitar listando caracteres que o layout escolhido não suporta.
  - Preferências lembradas entre usos (layout, atraso entre teclas, pausa após Enter).
  - Tema claro e escuro seguindo o sistema (`prefers-color-scheme`).
  - Aba **Senha** mantém comportamento atual: campo oculto + botão olho, pré-preenchido do clipboard.
  - **Ctrl+Enter** dispara a digitação (na aba Texto longo, Enter sozinho quebra linha).
  - Progresso exibido como **painel flutuante na página do console** (o popup do Chrome fecha ao clicar fora).

## Comportamento

### Popup

- Cabeçalho "VM Paste" (+ ícone de configurações opcional, ver "Deixado ao construtor").
- Abas: **Senha** | **Texto longo**. Última aba usada pode ser lembrada (decisão do construtor).
- Comum às duas abas: seletor ABNT2/EN-US, atraso entre teclas (ms).
- Só na aba Texto longo: textarea monoespaçada, contador "N linhas · M caracteres", seletor de modo **Tudo de uma vez | Passo a passo**, pausa após Enter (ms, só no modo Tudo de uma vez), botão "Digitar N linhas".
- Validação antes de enviar: se houver caracteres sem mapeamento no layout escolhido, mostrar aviso com os caracteres (ex.: `é ã ç`) e não digitar até o usuário corrigir ou confirmar explicitamente. *(Chamada do construtor)* Ao confirmar ("Digitar pulando N caracteres"), os caracteres não suportados são **pulados**, nunca enviados como `Unidentified`.
- Erro se aba ativa não tiver o content script (página aberta antes de instalar/recarregar a extensão): mensagem clara pedindo para recarregar a página.

### Digitação (content script)

- Alvo: mesma lógica de hoje (`activeElement` → primeiro `canvas` → `body`; foco forçado no canvas).
- Normalizar quebras: `\r\n` e `\r` viram um único Enter (hoje `\r\n` geraria dois Enters, porque `\r` e `\n` estão mapeados separadamente).
- **Dois modos na aba Texto longo** (decisão do usuário: poder escolher; scripts curtos vão de uma vez):
  - **Tudo de uma vez** (padrão): digita linha, Enter, aguarda a pausa configurada, próxima linha. Última linha sem Enter.
  - **Passo a passo**: digita a linha **sem** Enter e espera. O usuário confere e aperta Enter no console; o content script detecta esse Enter real (`keydown` com `isTrusted === true`, ouvido em captura no `document`/`window`) e digita a próxima linha. O painel também tem botão **"Próxima linha"** como alternativa (envia o Enter sintético e segue). Após a última linha, encerra sem enviar Enter.
  - Campo "Pausa após Enter" só aparece no modo Tudo de uma vez. Modo escolhido é lembrado (persistência).
- Texto da aba Senha: digitado como hoje, sem Enter extra no fim.
- Texto longo: Enter ao fim de cada linha, **exceto a última** (decisão do usuário: ele confere e aperta Enter no console). Ex.: 6 linhas → 5 Enters.
- *(Chamada do construtor)* Uma única quebra de linha no fim do texto (comum ao copiar de editor) é removida antes de contar/digitar. Linhas em branco no meio do script enviam Enter sozinho. Contador "N linhas" reflete o texto já normalizado.
- *(Chamada do construtor)* Tab dentro do texto é enviado como Tab, sem conversão; o aviso pré-digitação menciona que o texto contém Tabs (podem disparar autocomplete no shell).
- **Acentos no ABNT2 (decisão do usuário: incluir).** Letras acentuadas são compostas como uma pessoa digita: dead key + letra. `á é í ó ú` = `´` + vogal; `à` = `` ` `` (Shift+`´`) + `a`; `â ê ô` = `^` (Shift+`~`) + vogal; `ã õ` = `~` + vogal; `ü` = `¨` (Shift+`6`) + `u`; maiúsculas com Shift na vogal. `ç`/`Ç` continuam teclas diretas. Na composição **não** se envia o Espaço pós-dead-key. No EN-US os acentuados continuam não suportados (aviso), já que US-International está fora de escopo.
- Dead keys: no ABNT2, `~ ^ ´ \`` são dead keys. Hoje `~`/`^` são enviados como `key: "Dead"` + `insert` sem nada depois, então o convidado pode combinar com a próxima letra (`^a` → `â`). *(Chamada do construtor)* No ABNT2, enviar Espaço logo após cada dead key isolada — é o que uma pessoa faz para obter o caractere puro. No EN-US, `~ ^ \`` são teclas normais (`Backquote`, `Digit6`+Shift) — sem dead key.

### Mapa EN-US

Novo mapa paralelo ao ABNT2 com `code`/`keyCode` do teclado americano padrão (US QWERTY): `/`→`Slash`/191, `?`→Shift+`Slash`, `;`/`:`→`Semicolon`/186, `'`/`"`→`Quote`/222, `[`/`{`→`BracketLeft`/219, `]`/`}`→`BracketRight`/221, `\`/`|`→`Backslash`/220, `` ` ``/`~`→`Backquote`/192, `^`→Shift+`Digit6`, `-`/`_`, `=`/`+`, `,`/`<`, `.`/`>`, `!@#$%&*()` em Shift+dígitos. Letras, dígitos, espaço, Enter, Tab, Backspace iguais ao ABNT2. Caracteres sem tecla no EN-US (`ç`, acentuados, `¨`, `´`) = não suportados → aviso.

### Painel de progresso na página

- Injetado pelo content script na página do console, isolado em **Shadow DOM** para não herdar/vazar CSS da página.
- Mesmo estilo Material You. Mostra "Linha X de N" (ou "caractere X de N" na senha) + barra, botões Pausar/Retomar e Cancelar. No modo passo a passo mostra "Linha X de N — aperte Enter no console" + botão "Próxima linha" no lugar de Pausar.
- Cancelar: para imediatamente e solta Shift se estiver pressionado.
- Clicar no painel tira o foco do console: ao retomar, devolver foco ao alvo original antes de continuar.
- Some sozinho alguns segundos após concluir (mostra "Concluído").
- Na senha: painel não mostra o conteúdo, só o progresso.

### Persistência

- `chrome.storage.local`: layout, atraso entre teclas, pausa após Enter, modo (tudo de uma vez / passo a passo). **Nunca** salvar a senha nem o texto.
- Requer permissão `storage` no `manifest.json`.

## Restrições

- Manifest V3, Edge/Chrome 88+ (Firefox temporário continua "melhor esforço").
- Sem dependências externas; fontes do sistema (sem Google Fonts dentro da extensão).
- UI, mensagens e comentários em português (pt-BR).
- Não logar texto digitado no console (hoje o content script loga só status; manter assim).

## Deixado ao construtor

- Estrutura de arquivos (ex.: separar mapas de teclado em arquivo próprio, CSS separado do HTML).
- Protocolo de mensagens popup ↔ content script, desde que suporte iniciar/pausar/cancelar.
- Valores exatos de espaçamento, tons do tema escuro, animações.
- Se o ícone ⚙ vira algo ou sai.
- Adicionar campo `icons` no `manifest.json` usando os PNGs já existentes em `icons/` (recomendado).
- Atualizar README e CLAUDE.md para refletir as mudanças.
