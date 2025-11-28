document.addEventListener('DOMContentLoaded', () => {
  const typeButton = document.getElementById('typeButton');
  const textInput = document.getElementById('textInput');
  const delayInput = document.getElementById('delay');
  const statusDiv = document.getElementById('status');
  const toggleVisibility = document.getElementById('toggleVisibility');

  // Tenta focar no campo automaticamente
  textInput.focus();

  // Tenta colar do clipboard automaticamente ao abrir
  navigator.clipboard.readText().then(text => {
      if (text) {
          textInput.value = text;
      }
  }).catch(err => {
      // Ignora erro se não tiver permissão
      console.log('Clipboard read failed', err);
  });

  // Alterna entre mostrar e ocultar a senha
  toggleVisibility.addEventListener('click', () => {
    if (textInput.type === 'password') {
      textInput.type = 'text';
      toggleVisibility.textContent = '🙈';
      toggleVisibility.title = 'Ocultar senha';
    } else {
      textInput.type = 'password';
      toggleVisibility.textContent = '👁️';
      toggleVisibility.title = 'Mostrar senha';
    }
  });

  typeButton.addEventListener('click', async () => {
    const text = textInput.value;
    const delay = parseInt(delayInput.value, 10) || 10;

    if (!text) {
      statusDiv.textContent = "❌ Nada para digitar!";
      statusDiv.className = "status error";
      return;
    }

    statusDiv.textContent = "⏳ Enviando...";
    statusDiv.className = "status sending";
    typeButton.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      if (!tab) {
        statusDiv.textContent = "❌ Nenhuma aba ativa encontrada.";
        statusDiv.className = "status error";
        typeButton.disabled = false;
        return;
      }

      await chrome.tabs.sendMessage(tab.id, {
        action: "typeText",
        text: text,
        delay: delay
      });

      statusDiv.textContent = "✅ Concluído!";
      statusDiv.className = "status success";
      typeButton.disabled = false;
      
      // Opcional: fechar o popup automaticamente após sucesso
      // setTimeout(() => window.close(), 1500);
    } catch (error) {
      console.error(error);
      statusDiv.textContent = "❌ Erro ao enviar. Recarregue a página.";
      statusDiv.className = "status error";
      typeButton.disabled = false;
    }
  });
});
