/**
 * Onboarding script: guides user through mic permission, hotkey preview, and demo test.
 */
import { getSettings, saveSettings } from '../lib/settings.js';

const micIndicator = document.getElementById('mic-indicator');
const micStatusText = document.getElementById('mic-status-text');
const grantMicBtn = document.getElementById('grant-mic-btn');
const hotkeyPreview = document.getElementById('hotkey-preview');
const demoKeyRef = document.getElementById('demo-key-ref');
const recordHotkeyBtn = document.getElementById('record-hotkey-btn');
const recordingNotice = document.getElementById('recording-notice');
const finishBtn = document.getElementById('finish-btn');
const demoFeedbackText = document.getElementById('demo-feedback-text');

let isRecordingHotkey = false;

function formatHotkey(hk) {
  if (!hk) return '⌥ Option + S';
  const parts = [];
  const isMac = navigator.platform.toUpperCase().includes('MAC');
  if (hk.meta) parts.push(isMac ? '⌘ Cmd' : 'Win');
  if (hk.ctrl) parts.push('Ctrl');
  if (hk.alt) parts.push(isMac ? '⌥ Option' : 'Alt');
  if (hk.shift) parts.push('Shift');

  let keyDisplay = hk.code.replace(/^Key/, '').replace(/^Digit/, '');
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
    // Fallback if query not supported
  }
  updateMicUi('prompt');
}

function updateMicUi(state) {
  if (state === 'granted') {
    micIndicator.className = 'status-indicator granted';
    micStatusText.textContent = 'Microphone permission granted ✓';
    grantMicBtn.textContent = 'Microphone Ready';
    grantMicBtn.disabled = true;
    grantMicBtn.style.opacity = '0.7';
  } else if (state === 'denied') {
    micIndicator.className = 'status-indicator denied';
    micStatusText.textContent = 'Microphone permission denied. Enable it in Chrome site settings.';
    grantMicBtn.textContent = 'Microphone Denied';
  } else {
    micIndicator.className = 'status-indicator';
    micStatusText.textContent = 'Microphone access needed for voice control.';
    grantMicBtn.textContent = 'Grant Microphone Permission';
    grantMicBtn.disabled = false;
  }
}

async function requestMic() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop tracks to release mic hardware
    stream.getTracks().forEach((track) => track.stop());
    updateMicUi('granted');
  } catch {
    updateMicUi('denied');
  }
}

async function init() {
  await checkMicPermission();
  const settings = await getSettings();

  const formatted = formatHotkey(settings.hotkey);
  hotkeyPreview.textContent = formatted;
  demoKeyRef.textContent = formatted;

  grantMicBtn.addEventListener('click', requestMic);

  recordHotkeyBtn.addEventListener('click', () => {
    isRecordingHotkey = true;
    recordingNotice.style.display = 'inline';
    recordHotkeyBtn.textContent = 'Listening for keys…';
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
      window.alert('Please include at least one modifier key (Alt, Option, Ctrl, or Shift).');
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

    const updatedFormatted = formatHotkey(newHotkey);
    hotkeyPreview.textContent = updatedFormatted;
    demoKeyRef.textContent = updatedFormatted;

    await saveSettings({ hotkey: newHotkey });
  });

  finishBtn.addEventListener('click', () => {
    window.close();
  });

  // Listen for speech engine events in demo if triggered
  chrome.runtime?.onMessage?.addListener((msg) => {
    if (msg.type === 'VOICE_EVENT') {
      demoFeedbackText.textContent = `Heard: "${msg.transcript || 'Listening…'}"`;
    }
  });
}

init();
