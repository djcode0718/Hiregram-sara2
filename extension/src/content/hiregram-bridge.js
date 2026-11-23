/**
 * Hiregram Bridge Content Script (Self-contained classic script)
 * Runs on https://hiregram.ai/* and https://www.hiregram.ai/*
 *
 * Implements multi-stage hand-off state machine with continuous SPA navigation support:
 * 1. Claims pending tailor requests only if service worker confirms this tab is target (FR-H2, FR-H7).
 * 2. LIST page (/resume): Finds "Open in editor" control within "YOUR DEFAULT" section and navigates/clicks it.
 * 3. Continuous SPA Observer: Watches URL and DOM changes across transitions without requiring full page reload.
 * 4. EDITOR page (/resume/<uuid>): Finds Sara's chat box, injects React value (or execCommand/paste),
 *    polls Send button up to 8s until enabled, clicks Send.
 * 5. LOGIN page: Toasts "Log in to continue", preserves pending message until TTL.
 * 6. NO RESUMES: Toasts "Upload a resume on Hiregram first", preserves pending message until TTL.
 * 7. Explicit failure toasts and clean stage transitions.
 */
(() => {
  const TEXTAREA_SELECTORS = [
    'textarea[data-chat-box]',
    'textarea[aria-label="Message Sara"]',
    '.rs-as-composer textarea',
    '.rs-as-field textarea',
    'textarea[placeholder*="Message Sara" i]',
    'textarea[placeholder*="Sara" i]',
    'div[role="textbox"][aria-label*="Sara" i]',
    'textarea'
  ];

  const SEND_SELECTORS = [
    'button.rs-as-send',
    'button[aria-label="Send"]',
    'button[data-tip="Send"]',
    'button[aria-label*="Send" i]',
    'button[type="submit"]',
    'button:has(svg)'
  ];

  const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const SEND_POLL_TIMEOUT_MS = 8000;
  const TOTAL_HANDOFF_TIMEOUT_MS = 60000;

  const handledPendingIds = new Set();
  let isConsuming = false;
  let currentPending = null;
  let stageWatcherTimer = null;
  let stageStartTime = 0;
  let lastReportedStage = '';

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

  function showToast(msg, durationMs = 6000) {
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
    }, durationMs);
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

  function isEditorUrl() {
    const path = window.location.pathname.toLowerCase();
    // Matches /resume/<uuid> or /resume/editor
    return /^\/resume\/[0-9a-f-]+/i.test(path) || path.includes('/editor');
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

  /**
   * Dispatches text to Sara's input using React value setter or synthetic paste/execCommand.
   */
  function fillChatInput(inputEl, text) {
    inputEl.focus();

    if (inputEl instanceof window.HTMLTextAreaElement || inputEl instanceof window.HTMLInputElement) {
      const proto = inputEl instanceof window.HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      if (setter) {
        setter.call(inputEl, text);
      } else {
        inputEl.value = text;
      }
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Contenteditable / rich composer
      try {
        document.execCommand('insertText', false, text);
      } catch {
        // Fallback to textContent or paste event
      }
    }

    // Verify whether text was populated or converted into a chip
    const composer = inputEl.closest('.rs-as-composer') || inputEl.parentElement;
    const hasChip = composer && composer.textContent.includes('Pasted text');
    const hasValue = Boolean(inputEl.value && inputEl.value.length > 0);

    return hasValue || hasChip;
  }

  async function consumePending() {
    if (isConsuming) return;
    isConsuming = true;

    try {
      const data = await chrome.storage.local.get('pending');
      const pending = data?.pending;
      if (!pending || !pending.text) {
        isConsuming = false;
        return;
      }

      const id = pending.id || `${pending.ts}_legacy`;
      if (handledPendingIds.has(id)) {
        isConsuming = false;
        return;
      }

      // Check TTL
      if (Date.now() - (pending.ts || 0) > PENDING_TTL_MS) {
        await chrome.storage.local.remove('pending');
        isConsuming = false;
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
          isConsuming = false;
          return;
        }
      } catch {
        // If message fails (context invalid), abort
        isConsuming = false;
        return;
      }

      currentPending = { ...pending, id };
      stageStartTime = Date.now();
      startContinuousObserver();
    } catch {
      isConsuming = false;
    }
  }

  /**
   * Continuous observer that monitors SPA state transitions until completion or timeout.
   */
  function startContinuousObserver() {
    if (stageWatcherTimer) clearInterval(stageWatcherTimer);

    const checkStage = async () => {
      if (!currentPending) {
        if (stageWatcherTimer) clearInterval(stageWatcherTimer);
        isConsuming = false;
        return;
      }

      // Check overall timeout
      if (Date.now() - stageStartTime > TOTAL_HANDOFF_TIMEOUT_MS) {
        showToast("Hiregram Tailor: hand-off timed out waiting for editor.");
        stopContinuousObserver();
        return;
      }

      // Stage A: Login Page
      if (isLoginPage()) {
        if (lastReportedStage !== 'login') {
          showToast('Hiregram Tailor: log in to continue');
          lastReportedStage = 'login';
        }
        return;
      }

      // Stage B: Resume Editor
      const textarea = findElement(TEXTAREA_SELECTORS);
      if (textarea) {
        stopContinuousObserver();
        await deliverToEditor(textarea, currentPending.id, currentPending.text);
        return;
      }

      // Stage C: No resumes uploaded
      if (hasNoResumesState()) {
        if (lastReportedStage !== 'no-resumes') {
          showToast('Hiregram Tailor: upload a resume on Hiregram first');
          lastReportedStage = 'no-resumes';
        }
        return;
      }

      // Stage D: Resume List Page
      const openInEditorBtn = findDefaultResumeEditorControl();
      if (openInEditorBtn) {
        if (lastReportedStage !== 'opening-default') {
          showToast('Hiregram Tailor: opening your default resume…');
          lastReportedStage = 'opening-default';

          if (openInEditorBtn.tagName.toUpperCase() === 'A' && openInEditorBtn.href) {
            window.location.href = openInEditorBtn.href;
          } else {
            openInEditorBtn.click();
          }
        }
        return;
      }

      // If we are on /resume/<uuid> but textarea hasn't appeared yet
      if (isEditorUrl()) {
        if (lastReportedStage !== 'waiting-editor') {
          showToast('Hiregram Tailor: loading resume editor…');
          lastReportedStage = 'waiting-editor';
        }
      }
    };

    stageWatcherTimer = setInterval(checkStage, 300);
    checkStage();
  }

  function stopContinuousObserver() {
    if (stageWatcherTimer) {
      clearInterval(stageWatcherTimer);
      stageWatcherTimer = null;
    }
    isConsuming = false;
  }

  async function deliverToEditor(textarea, id, text) {
    // Atomically claim from storage
    const checkAgain = await chrome.storage.local.get('pending');
    const currentStoragePending = checkAgain?.pending;
    if (!currentStoragePending || (currentStoragePending.id && currentStoragePending.id !== id)) {
      currentPending = null;
      return;
    }

    handledPendingIds.add(id);
    await chrome.storage.local.remove('pending');
    currentPending = null;

    fillChatInput(textarea, text);

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

  // Also trigger consumePending on popstate / hashchange (SPA URL changes)
  window.addEventListener('popstate', () => {
    if (!handledPendingIds.size) consumePending();
  });
})();
