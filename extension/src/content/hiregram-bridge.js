/**
 * Hiregram Bridge Content Script
 * Runs on https://hiregram.ai/* and https://www.hiregram.ai/*
 * Claims pending tailor requests atomically and injects into Sara's chat box.
 */
(() => {
  const TEXTAREA_SELECTORS = [
    'textarea[aria-label="Message Sara"]',
    'textarea[placeholder*="Message Sara" i]',
    'textarea[placeholder*="Sara" i]',
    'div[role="textbox"][aria-label*="Sara" i]',
    'textarea'
  ];

  const SEND_SELECTORS = [
    'button[aria-label="Send"]',
    'button[aria-label*="Send" i]',
    'button[type="submit"]'
  ];

  const PENDING_TTL_MS = 10 * 60 * 1000;
  const SEND_POLL_TIMEOUT_MS = 8000;
  const CHAT_WAIT_TIMEOUT_MS = 120000;

  const handledPendingIds = new Set();
  let isConsuming = false;

  function findElement(selectors) {
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) return el;
      } catch {
        // Ignore invalid selector
      }
    }
    return null;
  }

  function waitFor(fn, timeoutMs = 10000, intervalMs = 200) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const res = fn();
        if (res) return resolve(res);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, intervalMs);
      };
      tick();
    });
  }

  function showToast(msg) {
    let el = document.getElementById('hg-tailor-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hg-tailor-toast';
      el.style.cssText =
        'position:fixed;bottom:20px;left:20px;z-index:2147483647;padding:10px 16px;' +
        'background:#0f172a;color:#f8fafc;font:500 13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;' +
        'border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.25);border:1px solid #334155;transition:opacity .2s;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      if (el.parentNode) el.remove();
    }, 6000);
  }

  function setReactValue(textarea, text) {
    const proto = textarea instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) {
      setter.call(textarea, text);
    } else {
      textarea.value = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function consumePending() {
    if (isConsuming) return;
    isConsuming = true;

    try {
      const data = await chrome.storage.local.get('pending');
      const pending = data?.pending;
      if (!pending || !pending.text) return;

      const id = pending.id || `${pending.ts}_legacy`;
      if (handledPendingIds.has(id)) {
        return;
      }

      // Check TTL
      if (Date.now() - (pending.ts || 0) > PENDING_TTL_MS) {
        await chrome.storage.local.remove('pending');
        return;
      }

      showToast('Hiregram Tailor: waiting for resume editor…');

      // Wait for Sara's chat textarea
      const textarea = await waitFor(() => findElement(TEXTAREA_SELECTORS), CHAT_WAIT_TIMEOUT_MS);
      if (!textarea) {
        // Keep pending in storage until TTL expires so user can log in or open editor
        showToast("Hiregram Tailor: couldn't find Sara's chat box. Upload your resume first, then try again.");
        return;
      }

      // Atomically re-verify and claim pending
      const checkAgain = await chrome.storage.local.get('pending');
      const currentPending = checkAgain?.pending;
      if (!currentPending || (currentPending.id && currentPending.id !== id)) {
        // Already claimed by another tab/instance
        return;
      }

      // Mark handled locally and delete from storage
      handledPendingIds.add(id);
      await chrome.storage.local.remove('pending');

      textarea.focus();
      setReactValue(textarea, currentPending.text);

      // Poll for Send button to be enabled (up to 8s)
      const sendButton = await waitFor(() => {
        const btn = findElement(SEND_SELECTORS);
        return (btn && !btn.disabled) ? btn : null;
      }, SEND_POLL_TIMEOUT_MS, 150);

      if (sendButton) {
        sendButton.click();
        showToast('Hiregram Tailor: sent to Sara ✓');
        chrome.runtime.sendMessage({
          type: 'HANDOFF_RESULT',
          id,
          status: 'sent'
        }).catch(() => {});
      } else {
        showToast('Hiregram Tailor: text is filled in, press Send yourself.');
        chrome.runtime.sendMessage({
          type: 'HANDOFF_RESULT',
          id,
          status: 'filled-not-sent'
        }).catch(() => {});
      }
    } catch {
      // Graceful error handling
    } finally {
      isConsuming = false;
    }
  }

  consumePending();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pending?.newValue) {
      consumePending();
    }
  });
})();
