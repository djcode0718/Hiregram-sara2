/**
 * Hiregram Bridge Source (Raw source with imports)
 * Transformed into self-contained classic script extension/src/content/hiregram-bridge.js
 * by scripts/build-content.mjs (concatenating default-resume.js).
 */

import { findDefaultResumeTarget } from '../lib/default-resume.js';

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

  // User-visible toast messages (R5)
  const TOAST_MESSAGES = {
    FINDING: 'Hiregram Tailor: finding your default resume…',
    OPENING: 'Hiregram Tailor: opening your default resume…',
    EMPTY: 'Hiregram Tailor: upload a resume on Hiregram first.',
    NO_DEFAULT: "Hiregram Tailor: couldn't find your default resume. Open Hiregram and set one.",
    TIMED_OUT: "Hiregram Tailor: timed out looking for default resume. Check that your resume is set.",
    AMBIGUOUS_WARNING: 'Hiregram Tailor: multiple default resumes found, opening first one…',
    LOOP_GUARD: "Hiregram Tailor: couldn't open your default resume.",
    LOGIN_REQUIRED: 'Hiregram Tailor: log in to continue.',
    SENT: 'Hiregram Tailor: sent to Sara ✓',
    ALREADY_SENT: 'Hiregram Tailor: message may already have been sent, check Sara.',
    PRESS_SEND_MANUALLY: 'Hiregram Tailor: text is filled in, press Send yourself.',
    WAITING_EDITOR: 'Hiregram Tailor: loading resume editor…'
  };

  const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
  const SEND_POLL_TIMEOUT_MS = 8000;
  const RESOLVE_TIMEOUT_MS = 12000; // R3: 12s overall resolve timeout
  const EMPTY_CONFIRM_DELAY_MS = 3000; // R3: Treat empty as final after >= 3s

  const handledPendingIds = new Set();
  let isConsuming = false;
  let currentPending = null;
  let stageWatcherTimer = null;
  let listMutationObserver = null;
  let toastTimer = null;
  let stageStartTime = 0;
  let emptyFirstSeenTime = 0;
  let lastReportedToast = '';

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
    if (lastReportedToast === msg) return;
    lastReportedToast = msg;

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
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (el.parentNode) el.remove();
      if (lastReportedToast === msg) lastReportedToast = '';
      toastTimer = null;
    }, durationMs);
    // djcode0718
  }

  function navigateToUrl(targetUrl) {
    try {
      if (typeof window.assignUrl === 'function') {
        window.assignUrl(targetUrl);
      } else if (typeof window.location.assign === 'function') {
        window.location.assign(targetUrl);
      } else {
        window.location.href = targetUrl;
      }
    } catch {
      // In testing environments (JSDOM), navigation may throw
      if (typeof window.assignUrl === 'function') {
        window.assignUrl(targetUrl);
      }
    }
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
    // Matches /resume/<id> with at least 8 chars
    return /^\/resume\/[A-Za-z0-9_-]{8,}\/?$/i.test(path);
  }

  function isListPage() {
    const path = window.location.pathname.toLowerCase();
    return path === '/resume' || path === '/resume/';
  }

  function hasExplicitNoResumesState() {
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
      try {
        document.execCommand('insertText', false, text);
      } catch {
        // Fallback
      }
    }

    const composer = inputEl.closest('.rs-as-composer') || inputEl.parentElement;
    const hasChip = composer && composer.textContent.includes('Pasted text');
    const hasValue = Boolean(inputEl.value && inputEl.value.length > 0);

    return hasValue || hasChip;
  }

  function stopAllObservers() {
    if (stageWatcherTimer) {
      clearInterval(stageWatcherTimer);
      stageWatcherTimer = null;
    }
    if (listMutationObserver) {
      listMutationObserver.disconnect();
      listMutationObserver = null;
    }
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
    isConsuming = false;
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

      // Check TTL (10 min)
      if (Date.now() - (pending.ts || 0) > PENDING_TTL_MS) {
        await chrome.storage.local.remove('pending');
        isConsuming = false;
        return;
      }

      // Check status (R4)
      if (pending.status === 'sent') {
        showToast(TOAST_MESSAGES.ALREADY_SENT);
        isConsuming = false;
        return;
      }

      // 1. Verify this tab is the authorized target tab (FR-H2, FR-H7) non-destructively
      try {
      // djcode0718
        const auth = await chrome.runtime.sendMessage({
          type: 'CLAIM_PENDING',
          pendingId: id
        });
        if (!auth?.allowed) {
          // Not the target tab; do not touch
          isConsuming = false;
          return;
        }
      } catch {
        isConsuming = false;
        return;
      }

      currentPending = {
        ...pending,
        id,
        status: pending.status || 'queued',
        navAttempts: pending.navAttempts || 0
      };

      stageStartTime = Date.now();
      emptyFirstSeenTime = 0;
      startStageMachine();
    } catch {
      isConsuming = false;
    }
  }

  function startStageMachine() {
    stopAllObservers();
    isConsuming = true;

    const evaluateState = async () => {
      if (!currentPending) {
        stopAllObservers();
        return;
      }

      // 1. LOGIN page check
      if (isLoginPage()) {
        showToast(TOAST_MESSAGES.LOGIN_REQUIRED);
        return;
      }

      // 2. RESUME EDITOR stage
      if (isEditorUrl()) {
        const textarea = findElement(TEXTAREA_SELECTORS);
        if (textarea) {
          stopAllObservers();
          await deliverToEditor(textarea, currentPending);
          return;
        }
        showToast(TOAST_MESSAGES.WAITING_EDITOR);
        return;
      }

      // 3. RESUME LIST stage (/resume)
      if (isListPage()) {
        // Loop guard check (R4)
        if (currentPending.navAttempts >= 2) {
          showToast(TOAST_MESSAGES.LOOP_GUARD);
          stopAllObservers();
          return;
        }

        // Check resolve timeout (12s)
        if (Date.now() - stageStartTime > RESOLVE_TIMEOUT_MS) {
          showToast(TOAST_MESSAGES.TIMED_OUT);
          stopAllObservers();
          return;
        }

        // Show finding toast
        showToast(TOAST_MESSAGES.FINDING);

        const targetResult = findDefaultResumeTarget(document);

        if (targetResult.status === 'found') {
          stopAllObservers();
          showToast(TOAST_MESSAGES.OPENING);

          // Update navAttempts in storage before navigating
          currentPending.navAttempts = (currentPending.navAttempts || 0) + 1;
          await chrome.storage.local.set({
            pending: {
              ...currentPending,
              navAttempts: currentPending.navAttempts
            }
          });

          if (targetResult.source === 'hero-button' && targetResult.element) {
            targetResult.element.click();
          } else if (targetResult.href) {
            const resolvedUrl = new URL(targetResult.href, window.location.origin).href;
            navigateToUrl(resolvedUrl);
          }
          return;
        }

        if (targetResult.status === 'ambiguous') {
          // Log warning and navigate to first
          stopAllObservers();
          showToast(TOAST_MESSAGES.AMBIGUOUS_WARNING);

          currentPending.navAttempts = (currentPending.navAttempts || 0) + 1;
          // djcode0718
          await chrome.storage.local.set({
            pending: {
              ...currentPending,
              navAttempts: currentPending.navAttempts
            }
          });

          if (targetResult.href) {
            const resolvedUrl = new URL(targetResult.href, window.location.origin).href;
            navigateToUrl(resolvedUrl);
          }
          return;
        }

        if (targetResult.status === 'empty') {
          if (hasExplicitNoResumesState()) {
            showToast(TOAST_MESSAGES.EMPTY);
            stopAllObservers();
            return;
          }
          if (!emptyFirstSeenTime) {
            emptyFirstSeenTime = Date.now();
          } else if (Date.now() - emptyFirstSeenTime >= EMPTY_CONFIRM_DELAY_MS) {
            showToast(TOAST_MESSAGES.EMPTY);
            stopAllObservers();
            return;
          }
          return;
        }

        if (targetResult.status === 'no-default') {
          showToast(TOAST_MESSAGES.NO_DEFAULT);
          stopAllObservers();
          return;
        }

        // status: "loading" -> keep waiting
      }
    };

    // MutationObserver on document.body for instant reactive resolution
    if (typeof MutationObserver !== 'undefined' && document.body) {
      listMutationObserver = new MutationObserver(() => {
        evaluateState();
      });
      listMutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    // 250ms polling backup
    stageWatcherTimer = setInterval(evaluateState, 250);
    evaluateState();
  }

  async function deliverToEditor(textarea, pendingObj) {
    if (pendingObj.status === 'sending' || pendingObj.status === 'sent') {
      showToast(TOAST_MESSAGES.ALREADY_SENT);
      return;
    }

    // Mark status: "sending" right before Send
    pendingObj.status = 'sending';
    await chrome.storage.local.set({ pending: pendingObj });

    fillChatInput(textarea, pendingObj.text);

    // Poll for Send button to be enabled (up to 8s)
    const sendButton = await waitFor(() => {
      const btn = findElement(SEND_SELECTORS);
      return (btn && !btn.disabled) ? btn : null;
    }, SEND_POLL_TIMEOUT_MS, 150);

    if (sendButton) {
      sendButton.click();

      // R4: pending is deleted ONLY after Send was clicked and confirmed
      pendingObj.status = 'sent';
      handledPendingIds.add(pendingObj.id);
      await chrome.storage.local.remove('pending');
      currentPending = null;

      showToast(TOAST_MESSAGES.SENT);
      chrome.runtime.sendMessage({
        type: 'HANDOFF_RESULT',
        id: pendingObj.id,
        status: 'sent'
      }).catch(() => {});
    } else {
      showToast(TOAST_MESSAGES.PRESS_SEND_MANUALLY);
      chrome.runtime.sendMessage({
        type: 'HANDOFF_RESULT',
        id: pendingObj.id,
        status: 'filled-not-sent'
      }).catch(() => {});
    }
  }

  // Initial execution on document idle
  consumePending();

  // Clean up observers and timers on page unload / pagehide (PRD R3)
  window.addEventListener('beforeunload', stopAllObservers);
  window.addEventListener('pagehide', stopAllObservers);

  // Listen to storage changes in case message arrived after page load
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pending?.newValue) {
      consumePending();
    }
  });

  // Listen for SPA navigation
  window.addEventListener('popstate', () => {
    if (!handledPendingIds.size) consumePending();
  });
})();
