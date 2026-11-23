/**
 * Hotkey Listener Content Script (Self-contained classic script)
 * Runs in all frames (all_frames: true) on <all_urls>.
 * Follows PRD §5.1 (FR-A1..A8).
 */
(() => {
  if (window.__hg_tailor_hotkey_injected__) return;
  window.__hg_tailor_hotkey_injected__ = true;

  const MIN_HOLD_DURATION_MS = 350;
  const MAX_RECORDING_DURATION_MS = 30000;

  // Default fallback settings available synchronously immediately
  let currentSettings = {
    enabled: true,
    hotkey: { code: 'KeyS', alt: true, ctrl: false, shift: false, meta: false },
    disabledHosts: []
  };

  let isHolding = false;
  let pressStartTime = 0;
  let autoStopTimer = null;

  function loadSettings() {
    try {
      if (chrome.storage?.sync) {
        chrome.storage.sync.get('settings', (data) => {
          if (chrome.runtime.lastError) return;
          if (data?.settings) {
            currentSettings = { ...currentSettings, ...data.settings };
          }
        });
      }
    } catch {
      // Extension context invalidated
    }
  }

  function isCurrentSiteDisabled() {
    if (!currentSettings.enabled) return true;
    const host = window.location.hostname.toLowerCase();
    const disabled = currentSettings.disabledHosts || [];
    return disabled.some((d) => host === d || host.endsWith(`.${d}`));
  }

  function matchesHotkey(e) {
    if (!currentSettings.enabled || isCurrentSiteDisabled()) return false;
    const hk = currentSettings.hotkey;
    if (!hk) return false;

    return (
      e.code === hk.code &&
      Boolean(e.altKey) === Boolean(hk.alt) &&
      Boolean(e.ctrlKey) === Boolean(hk.ctrl) &&
      Boolean(e.shiftKey) === Boolean(hk.shift) &&
      Boolean(e.metaKey) === Boolean(hk.meta)
    );
  }

  function matchesModifierRelease(e) {
    const hk = currentSettings.hotkey;
    if (!hk) return false;

    // Check if main key or any required modifier was released
    if (e.code === hk.code) return true;
    if (hk.alt && e.key === 'Alt') return true;
    if (hk.ctrl && e.key === 'Control') return true;
    if (hk.shift && e.key === 'Shift') return true;
    if (hk.meta && e.key === 'Meta') return true;

    return false;
  }

  function sendRuntimeMessage(payload) {
    try {
      chrome.runtime.sendMessage(payload, () => {
        if (chrome.runtime.lastError) {
          // Context invalidated or handler unavailable
        }
      });
    } catch {
      // Extension context invalidated
    }
  }

  function startHold(e) {
    isHolding = true;
    pressStartTime = Date.now();

    // Prevent typing characters (e.g. Option+S typing ß on macOS)
    e.preventDefault();
    e.stopPropagation();

    sendRuntimeMessage({
      type: 'VOICE_START',
      isTopFrame: window === window.top
    });

    if (autoStopTimer) clearTimeout(autoStopTimer);
    autoStopTimer = setTimeout(() => {
      if (isHolding) {
        isHolding = false;
        sendRuntimeMessage({ type: 'VOICE_STOP' });
      }
    }, MAX_RECORDING_DURATION_MS);
  }

  function stopHold(e) {
    if (!isHolding) return;
    isHolding = false;

    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }

    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const holdDuration = Date.now() - pressStartTime;
    if (holdDuration < MIN_HOLD_DURATION_MS) {
      // Tap shorter than 350 ms treated as accidental tap (FR-A8)
      sendRuntimeMessage({
        type: 'VOICE_CANCEL',
        reason: 'too_short'
      });
      return;
    }

    sendRuntimeMessage({ type: 'VOICE_STOP' });
  }

  function cancelHold(reason) {
    if (!isHolding) return;
    isHolding = false;

    if (autoStopTimer) {
      clearTimeout(autoStopTimer);
      autoStopTimer = null;
    }

    sendRuntimeMessage({
      type: 'VOICE_CANCEL',
      reason
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.isComposing) return;
    if (matchesHotkey(e)) {
      startHold(e);
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (isHolding && matchesModifierRelease(e)) {
      stopHold(e);
    }
  }, true);

  window.addEventListener('blur', () => {
    cancelHold('blur');
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelHold('hidden');
    }
  });

  // Handle diagnostics ping from options page
  try {
    if (chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg?.type === 'PING_CONTENT_SCRIPT') {
          sendResponse({
            status: 'ok',
            url: window.location.href,
            isTopFrame: window === window.top,
            settings: currentSettings
          });
        }
      });
    }
  } catch {
    // Ignore runtime listener error
  }

  // Listen for settings changes
  try {
    if (chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes.settings?.newValue) {
          currentSettings = { ...currentSettings, ...changes.settings.newValue };
        }
      });
    }
  } catch {
    // Ignore storage listener failure
  }

  loadSettings();
})();
