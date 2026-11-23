/**
 * Hiregram Bridge Content Script (Self-contained classic script)
 * Runs on https://hiregram.ai/* and https://www.hiregram.ai/*
 *
 * Implements multi-stage hand-off state machine:
 * 1. Claims pending tailor requests only if service worker confirms this tab is target (FR-H2, FR-H7).
 * 2. LIST page: Finds "Open in editor" control within "YOUR DEFAULT" section and navigates/clicks it.
 * 3. EDITOR page: Finds Sara's chat box, injects React value, polls Send button up to 8s, clicks Send.
 * 4. LOGIN page: Toasts "Log in to continue", preserves pending message until TTL.
 * 5. NO RESUMES: Toasts "Upload a resume on Hiregram first", preserves pending message until TTL.
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

  const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const SEND_POLL_TIMEOUT_MS = 8000;
  const CHAT_WAIT_TIMEOUT_MS = 15000;
  const LIST_WAIT_TIMEOUT_MS = 8000;

  const handledPendingIds = new Set();
  let isConsuming = false;

  function findElement(selectors, root = document) {
    for (const sel of selectors) {
      try {
        const el = root.querySelector(sel);
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

  function isLoginPage() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes('/login') || path.includes('/signin') || path.includes('/auth')) {
      return true;
    }
    if (document.querySelector('input[type="password"]')) {
      return true;
    }
    const headings = document.querySelectorAll('h1, h2, h3');
    for (const h of headings) {
      if (/log in|sign in/i.test(h.textContent || '')) {
        return true;
      }
    }
    return false;
  }

  /**
   * Finds the "Open in editor" control within the "YOUR DEFAULT" resume section.
   */
  function findDefaultResumeEditorControl() {
    const allContainers = document.querySelectorAll('section, div, card, [class*="resume"], [class*="card"]');
    let defaultSection = null;

    for (const el of allContainers) {
      const heading = el.querySelector('h1, h2, h3, h4, h5, h6, span, p');
      if (heading && /your default/i.test(heading.textContent || '')) {
        defaultSection = el;
        break;
      }
    }

    const searchRoots = defaultSection ? [defaultSection, document.body] : [document.body];

    for (const root of searchRoots) {
      const clickables = root.querySelectorAll('a, button, [role="button"]');
      for (const el of clickables) {
        const text = (el.textContent || '').trim();
        const aria = el.getAttribute('aria-label') || '';
        if (/open in editor/i.test(text) || /open in editor/i.test(aria)) {
          return el;
        }
      }
    }

    return null;
  }

  function hasNoResumesState() {
    const bodyText = document.body?.textContent || '';
    return /upload your (?:first )?resume|no resumes (?:found|uploaded)/i.test(bodyText);
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

      // 1. Verify this tab is the authorized target tab (FR-H2, FR-H7)
      try {
        const auth = await chrome.runtime.sendMessage({
          type: 'CLAIM_PENDING',
          pendingId: id
        });
        if (!auth?.allowed) {
          // Not the target tab; do not interfere
          return;
        }
      } catch {
        // If message fails (context invalid), abort
        return;
      }

      // 2. Stage: LOGIN PAGE
      if (isLoginPage()) {
        showToast('Hiregram Tailor: log in to continue');
        return;
      }

      // 3. Stage: RESUME EDITOR (Check for Sara's chat box)
      let textarea = findElement(TEXTAREA_SELECTORS);
      if (textarea) {
        await deliverToEditor(textarea, id, pending.text);
        return;
      }

      // 4. Stage: RESUME LIST PAGE (Wait for "Open in editor" control)
      const openInEditorBtn = await waitFor(
        () => findDefaultResumeEditorControl(),
        LIST_WAIT_TIMEOUT_MS,
        250
      );

      if (openInEditorBtn) {
        showToast('Hiregram Tailor: opening your default resume…');

        if (openInEditorBtn.tagName.toUpperCase() === 'A' && openInEditorBtn.href) {
          window.location.href = openInEditorBtn.href;
        } else {
          openInEditorBtn.click();
        }
        return;
      }

      // 5. Check if user has no resumes
      if (hasNoResumesState()) {
        showToast('Hiregram Tailor: upload a resume on Hiregram first');
        return;
      }

      // 6. Otherwise wait for editor textarea in case it is still rendering
      textarea = await waitFor(() => findElement(TEXTAREA_SELECTORS), CHAT_WAIT_TIMEOUT_MS, 300);
      if (textarea) {
        await deliverToEditor(textarea, id, pending.text);
      } else {
        showToast("Hiregram Tailor: couldn't find resume editor. Check that your resume is uploaded.");
      }
    } catch {
      // Graceful error handling
    } finally {
      isConsuming = false;
    }
  }

  async function deliverToEditor(textarea, id, text) {
    // Atomically claim from storage
    const checkAgain = await chrome.storage.local.get('pending');
    const currentPending = checkAgain?.pending;
    if (!currentPending || (currentPending.id && currentPending.id !== id)) {
      return;
    }

    handledPendingIds.add(id);
    await chrome.storage.local.remove('pending');

    textarea.focus();
    setReactValue(textarea, text);

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
  }

  // Initial execution on document idle
  consumePending();

  // Listen to storage changes in case message arrived after page load
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pending?.newValue) {
      consumePending();
    }
  });
})();
