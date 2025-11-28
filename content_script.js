// Escuta mensagens do popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "typeText") {
    typeText(request.text, request.delay);
    return Promise.resolve({status: "started"});
  }
});

async function typeText(text, delay) {
  console.log("Iniciando digitação simulada...");

  let target = document.activeElement;
  if (!target || target === document.body) {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      target = canvas;
      console.log("Alvo detectado: Canvas");
    } else {
      target = document.body || document.documentElement;
      console.log("Alvo detectado: Body");
    }
  } else {
    console.log("Alvo detectado: Elemento Ativo", target.tagName);
  }

  ensureFocusable(target);

  try {
    target.focus();
  } catch (error) {
    console.warn("Não foi possível focar o elemento alvo", error);
  }

  if (target && target.tagName === "CANVAS") {
    hintFocus(target);
  }

  await wait(30);

  let shiftActive = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const info = resolveKeyInfo(char);
    const needsShift = info.shiftKey === true;

    if (needsShift && !shiftActive) {
      sendModifier(target, true);
      shiftActive = true;
    }

    if (!needsShift && shiftActive) {
      sendModifier(target, false);
      shiftActive = false;
    }

    sendKeyStroke(target, info, {shiftKey: needsShift || shiftActive});

    if (delay > 0) {
      await wait(delay);
    }
  }

  if (shiftActive) {
    sendModifier(target, false);
  }

  console.log("Digitação concluída.");
}

function sendKeyStroke(target, info, modifiers = {}) {
  const activeMods = {
    shiftKey: !!modifiers.shiftKey,
    altKey: !!modifiers.altKey,
    ctrlKey: !!modifiers.ctrlKey,
    metaKey: !!modifiers.metaKey
  };

  dispatchKeyboardEvent(target, "keydown", info, activeMods);

  if (!info.skipKeypress) {
    dispatchKeyboardEvent(target, "keypress", info, activeMods);
  }

  if (!info.isControl) {
    const data = typeof info.insert === "string" ? info.insert : (info.key.length === 1 ? info.key : "");
    if (data) {
      dispatchInputEvent(target, data);
    }
  }

  dispatchKeyboardEvent(target, "keyup", info, activeMods);
}

function sendModifier(target, isDown) {
  const modifiers = {shiftKey: isDown};
  dispatchKeyboardEvent(target, isDown ? "keydown" : "keyup", SHIFT_INFO, modifiers);
}

function dispatchKeyboardEvent(target, type, info, modifiers) {
  const baseInit = {
    key: info.key,
    code: info.code,
    keyCode: info.keyCode,
    which: info.keyCode,
    charCode: type === "keypress" ? (info.charCode || info.keyCode) : 0,
    bubbles: true,
    cancelable: true,
    view: window,
    shiftKey: !!modifiers.shiftKey,
    altKey: !!modifiers.altKey,
    ctrlKey: !!modifiers.ctrlKey,
    metaKey: !!modifiers.metaKey
  };

  const recipients = [];
  if (target) recipients.push(target);
  if (document && target !== document) recipients.push(document);
  if (window) recipients.push(window);

  const seen = new Set();
  for (const recipient of recipients) {
    if (!recipient || seen.has(recipient)) continue;
    seen.add(recipient);
    const event = new KeyboardEvent(type, baseInit);
    recipient.dispatchEvent(event);
  }
}

function dispatchInputEvent(target, data) {
  if (!target) return;
  const event = new InputEvent("input", {
    data,
    inputType: "insertText",
    bubbles: true
  });
  target.dispatchEvent(event);
}

function ensureFocusable(element) {
  if (!element) return;
  if (element instanceof HTMLElement) {
    if (element.tabIndex < 0) {
      element.setAttribute("tabindex", "0");
    }
  }
}

function hintFocus(element) {
  if (!(element instanceof HTMLElement)) return;
  const rect = element.getBoundingClientRect();
  const opts = {
    bubbles: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2
  };
  element.dispatchEvent(new MouseEvent("mousedown", opts));
  element.dispatchEvent(new MouseEvent("mouseup", opts));
  element.dispatchEvent(new MouseEvent("click", opts));
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const SHIFT_INFO = {key: "Shift", code: "ShiftLeft", keyCode: 16, charCode: 0, isControl: true, skipKeypress: true};

const KEY_MAP = (() => {
  const map = {};

  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (const letter of letters) {
    const upper = letter.toUpperCase();
    const keyCode = upper.charCodeAt(0);
    map[letter] = {key: letter, code: "Key" + upper, keyCode, charCode: keyCode};
    map[upper] = {key: upper, code: "Key" + upper, keyCode, charCode: keyCode, shiftKey: true};
  }

  const digits = "0123456789";
  for (const digit of digits) {
    const keyCode = digit.charCodeAt(0);
    map[digit] = {key: digit, code: "Digit" + digit, keyCode, charCode: keyCode};
  }

  const specials = {
    " ": {key: " ", code: "Space", keyCode: 32, charCode: 32},
    "\n": {key: "Enter", code: "Enter", keyCode: 13, charCode: 13, isControl: true},
    "\r": {key: "Enter", code: "Enter", keyCode: 13, charCode: 13, isControl: true},
    "\t": {key: "Tab", code: "Tab", keyCode: 9, charCode: 9, isControl: true, skipKeypress: true},
    "\b": {key: "Backspace", code: "Backspace", keyCode: 8, charCode: 8, isControl: true, skipKeypress: true},
    "!": {key: "!", code: "Digit1", keyCode: 49, charCode: 33, shiftKey: true},
    "@": {key: "@", code: "Digit2", keyCode: 50, charCode: 64, shiftKey: true},
    "#": {key: "#", code: "Digit3", keyCode: 51, charCode: 35, shiftKey: true},
    "$": {key: "$", code: "Digit4", keyCode: 52, charCode: 36, shiftKey: true},
    "%": {key: "%", code: "Digit5", keyCode: 53, charCode: 37, shiftKey: true},
    "^": {key: "^", code: "Digit6", keyCode: 54, charCode: 94, shiftKey: true},
    "&": {key: "&", code: "Digit7", keyCode: 55, charCode: 38, shiftKey: true},
    "*": {key: "*", code: "Digit8", keyCode: 56, charCode: 42, shiftKey: true},
    "(": {key: "(", code: "Digit9", keyCode: 57, charCode: 40, shiftKey: true},
    ")": {key: ")", code: "Digit0", keyCode: 48, charCode: 41, shiftKey: true},
    "-": {key: "-", code: "Minus", keyCode: 189, charCode: 45},
    "_": {key: "_", code: "Minus", keyCode: 189, charCode: 95, shiftKey: true},
    "=": {key: "=", code: "Equal", keyCode: 187, charCode: 61},
    "+": {key: "+", code: "Equal", keyCode: 187, charCode: 43, shiftKey: true},
    "[": {key: "[", code: "BracketLeft", keyCode: 219, charCode: 91},
    "{": {key: "{", code: "BracketLeft", keyCode: 219, charCode: 123, shiftKey: true},
    "]": {key: "]", code: "BracketRight", keyCode: 221, charCode: 93},
    "}": {key: "}", code: "BracketRight", keyCode: 221, charCode: 125, shiftKey: true},
    "\\": {key: "\\", code: "Backslash", keyCode: 220, charCode: 92},
    "|": {key: "|", code: "Backslash", keyCode: 220, charCode: 124, shiftKey: true},
    ";": {key: ";", code: "Semicolon", keyCode: 186, charCode: 59},
    ":": {key: ":", code: "Semicolon", keyCode: 186, charCode: 58, shiftKey: true},
    "'": {key: "'", code: "Quote", keyCode: 222, charCode: 39},
    "\"": {key: "\"", code: "Quote", keyCode: 222, charCode: 34, shiftKey: true},
    ",": {key: ",", code: "Comma", keyCode: 188, charCode: 44},
    "<": {key: "<", code: "Comma", keyCode: 188, charCode: 60, shiftKey: true},
    ".": {key: ".", code: "Period", keyCode: 190, charCode: 46},
    ">": {key: ">", code: "Period", keyCode: 190, charCode: 62, shiftKey: true},
    "/": {key: "/", code: "Slash", keyCode: 191, charCode: 47},
    "?": {key: "?", code: "Slash", keyCode: 191, charCode: 63, shiftKey: true},
    "`": {key: "`", code: "Backquote", keyCode: 192, charCode: 96},
    "~": {key: "~", code: "Backquote", keyCode: 192, charCode: 126, shiftKey: true}
  };

  for (const char in specials) {
    map[char] = specials[char];
  }

  return map;
})();

function resolveKeyInfo(char) {
  const info = KEY_MAP[char];
  if (info) {
    return info;
  }
  const keyCode = char.charCodeAt(0);
  return {
    key: char,
    code: "Unidentified",
    keyCode,
    charCode: keyCode
  };
}
