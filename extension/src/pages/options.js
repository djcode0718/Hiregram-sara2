/**
 * Options page script: manages hotkey recorder, toggles, language, disabled hosts, and diagnostics.
 */
import { getSettings, saveSettings } from '../lib/settings.js';

const enableToggle = document.getElementById('enable-toggle');
const requireKeywordToggle = document.getElementById('require-keyword-toggle');
const openInBackgroundToggle = document.getElementById('open-in-background-toggle');
const languageSelect = document.getElementById('language-select');
const currentHotkeyEl = document.getElementById('current-hotkey');
const recordHotkeyBtn = document.getElementById('record-hotkey-btn');
const recordingNotice = document.getElementById('recording-notice');
const micIndicator = document.getElementById('mic-indicator');
const micStatusLabel = document.getElementById('mic-status-label');
const testMicBtn = document.getElementById('test-mic-btn');
const newHostInput = document.getElementById('new-host-input');
const addHostBtn = document.getElementById('add-host-btn');
const hostListEl = document.getElementById('host-list');
const checkActiveTabBtn = document.getElementById('check-active-tab-btn');
const copyDebugBtn = document.getElementById('copy-debug-btn');
const diagOutputBox = document.getElementById('diag-output-box');
const diagOutputText = document.getElementById('diag-output-text');

let isRecordingHotkey = false;
let currentSettings = null;

function formatHotkey(hk) {
  if (!hk) return '⌥ Option + S';
  const parts = [];
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  if (hk.meta) parts.push(isMac ? '⌘ Cmd' : 'Win');
  if (hk.ctrl) parts.push('Ctrl');
  if (hk.alt) parts.push(isMac ? '⌥ Option' : 'Alt');
  if (hk.shift) parts.push('Shift');

  const keyDisplay = hk.code.replace(/^Key/, '').replace(/^Digit/, '');
  parts.push(keyDisplay);
  return parts.join(' + ');
}

async function checkMicPermission() {
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'microphone' });
      updateMicUi(status.state);
      status.onchange = () => updateMicUi(status.state);
      return;
    }
  } catch {
    // Non-blocking
  }
  updateMicUi('prompt');
}

function updateMicUi(state) {
  if (state === 'granted') {
    micIndicator.className = 'status-indicator granted';
    micStatusLabel.textContent = 'Microphone permission granted ✓';
  } else if (state === 'denied') {
    micIndicator.className = 'status-indicator denied';
    micStatusLabel.textContent = 'Microphone denied. Enable in Chrome settings.';
  } else {
    micIndicator.className = 'status-indicator';
    micStatusLabel.textContent = 'Microphone access needed for speech recognition.';
  }
}

async function testMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    updateMicUi('granted');
  } catch {
    updateMicUi('denied');
  }
}

function renderHostList(hosts) {
  hostListEl.innerHTML = '';
  if (!hosts || !hosts.length) {
    const emptyLi = document.createElement('li');
    emptyLi.textContent = 'No disabled websites.';
    emptyLi.style.color = '#64748b';
    hostListEl.appendChild(emptyLi);
    return;
  }

  hosts.forEach((host) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = host;

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn-remove';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', async () => {
      const updated = currentSettings.disabledHosts.filter((h) => h !== host);
      currentSettings.disabledHosts = updated;
      await saveSettings({ disabledHosts: updated });
      renderHostList(updated);
    });

    li.appendChild(span);
    li.appendChild(removeBtn);
    hostListEl.appendChild(li);
  });
}

async function init() {
  currentSettings = await getSettings();

  enableToggle.checked = Boolean(currentSettings.enabled);
  requireKeywordToggle.checked = Boolean(currentSettings.requireKeyword);
  if (openInBackgroundToggle) {
    openInBackgroundToggle.checked = currentSettings.openInBackground !== false;
  }
  languageSelect.value = currentSettings.language || 'en-IN';
  currentHotkeyEl.textContent = formatHotkey(currentSettings.hotkey);
  renderHostList(currentSettings.disabledHosts);

  await checkMicPermission();

  enableToggle.addEventListener('change', async () => {
    currentSettings.enabled = enableToggle.checked;
    await saveSettings({ enabled: enableToggle.checked });
  });

  requireKeywordToggle.addEventListener('change', async () => {
    currentSettings.requireKeyword = requireKeywordToggle.checked;
    await saveSettings({ requireKeyword: requireKeywordToggle.checked });
  });

  if (openInBackgroundToggle) {
    openInBackgroundToggle.addEventListener('change', async () => {
      currentSettings.openInBackground = openInBackgroundToggle.checked;
      await saveSettings({ openInBackground: openInBackgroundToggle.checked });
    });
  }

  languageSelect.addEventListener('change', async () => {
    currentSettings.language = languageSelect.value;
    await saveSettings({ language: languageSelect.value });
  });

  testMicBtn.addEventListener('click', testMic);

  recordHotkeyBtn.addEventListener('click', () => {
    isRecordingHotkey = true;
    recordingNotice.style.display = 'block';
    recordHotkeyBtn.textContent = 'Listening…';
  });

  window.addEventListener('keydown', async (e) => {
    if (!isRecordingHotkey) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      isRecordingHotkey = false;
      recordingNotice.style.display = 'none';
      recordHotkeyBtn.textContent = 'Change Hotkey';
      return;
    }

    if (['Alt', 'Control', 'Shift', 'Meta'].includes(e.key)) return;

    const hasModifier = e.altKey || e.ctrlKey || e.shiftKey || e.metaKey;
    if (!hasModifier) {
      window.alert('Hotkey must include at least one modifier key (Alt, Option, Ctrl, Shift).');
      return;
    }

    const newHotkey = {
      code: e.code,
      alt: e.altKey,
      ctrl: e.ctrlKey,
      shift: e.shiftKey,
      meta: e.metaKey
    };

    isRecordingHotkey = false;
    recordingNotice.style.display = 'none';
    recordHotkeyBtn.textContent = 'Change Hotkey';
    currentHotkeyEl.textContent = formatHotkey(newHotkey);

    currentSettings.hotkey = newHotkey;
    await saveSettings({ hotkey: newHotkey });
  });

  addHostBtn.addEventListener('click', async () => {
    const raw = newHostInput.value.trim().toLowerCase();
    if (!raw) return;

    let clean = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (!clean) return;

    const current = currentSettings.disabledHosts || [];
    if (!current.includes(clean)) {
      current.push(clean);
      currentSettings.disabledHosts = current;
      await saveSettings({ disabledHosts: current });
      renderHostList(current);
    }
    newHostInput.value = '';
  });

  checkActiveTabBtn.addEventListener('click', async () => {
    diagOutputBox.style.display = 'block';
    diagOutputText.textContent = 'Pinging active tab content script…\n';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        diagOutputText.textContent += 'No active tab found.';
        return;
      }

      chrome.tabs.sendMessage(tab.id, { type: 'PING_CONTENT_SCRIPT' }, (res) => {
        if (chrome.runtime.lastError) {
          diagOutputText.textContent += `Error: ${chrome.runtime.lastError.message}\n(Content script not active on this tab; refresh tab or navigate to a regular website).`;
        } else {
          diagOutputText.textContent += `Success: Content script responded:\n${JSON.stringify(res, null, 2)}`;
        }
      });
    } catch (e) {
      diagOutputText.textContent += `Error: ${e.message}`;
    }
  });

  copyDebugBtn.addEventListener('click', async () => {
    const diag = {
      timestamp: new Date().toISOString(),
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      settings: currentSettings
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(diag, null, 2));
      copyDebugBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        copyDebugBtn.textContent = 'Copy Debug Info';
      }, 2000);
    } catch {
      window.alert('Could not copy to clipboard.');
    }
  });
}

init();
