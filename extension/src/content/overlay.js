/**
 * On-page feedback overlay (Self-contained classic script)
 * Runs in isolated world on all web pages (top frame only).
 * Rendered in a closed Shadow DOM to ensure complete CSS isolation.
 * Follows PRD §5.7 (FR-U1..U6).
 */
(() => {
  // Only inject overlay in the top-level window
  if (window !== window.top) return;
  if (window.__hg_tailor_overlay_injected__) return;
  window.__hg_tailor_overlay_injected__ = true;

  const OVERLAY_SUCCESS_DISMISS_MS = 2500;
  const OVERLAY_ERROR_DISMISS_MS = 6000;

  let hostEl = null;
  let shadowRoot = null;
  // djcode0718
  let containerEl = null;
  let autoDismissTimer = null;
  let isVisible = false;

  function ensureOverlayDom() {
    if (hostEl && shadowRoot) return;

    hostEl = document.createElement('div');
    hostEl.id = 'hg-tailor-overlay-host';
    hostEl.style.cssText =
      'position:fixed;bottom:24px;left:0;right:0;margin:0 auto;width:max-content;max-width:90vw;' +
      'z-index:2147483647;pointer-events:none;display:flex;justify-content:center;';

    // Attach closed Shadow DOM
    shadowRoot = hostEl.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      :host {
        all: initial;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui, sans-serif;
      }
      .pill {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        background: #0f172a;
        color: #f8fafc;
        border: 1px solid #334155;
        border-radius: 9999px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
        font-size: 13px;
        font-weight: 500;
        line-height: 1.4;
        transition: opacity 0.2s ease, transform 0.2s ease;
        opacity: 0;
        transform: translateY(8px);
        pointer-events: auto;
      }
      .pill.visible {
        opacity: 1;
        transform: translateY(0);
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #94a3b8;
        flex-shrink: 0;
      }
      .dot.listening {
        background: #ef4444;
        animation: pulse 1.2s infinite;
      }
      .dot.working {
        background: #6366f1;
        animation: pulse 1s infinite;
      }
      .dot.success {
        background: #22c55e;
      }
      .dot.error {
        background: #ef4444;
      }
      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.3); opacity: 0.6; }
      }
      .text-area {
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .transcript-text {
        color: #cbd5e1;
        font-style: italic;
      }
      .action-btn {
        background: #334155;
        color: #f8fafc;
        border: none;
        border-radius: 6px;
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        margin-left: 4px;
      }
      .action-btn:hover {
        background: #475569;
      }
      .close-btn {
        background: transparent;
        color: #94a3b8;
        border: none;
        cursor: pointer;
        padding: 0 4px;
        font-size: 14px;
        display: flex;
        align-items: center;
      }
      .close-btn:hover {
        color: #f8fafc;
      }
      @media (prefers-reduced-motion: reduce) {
        .pill, .dot {
          animation: none !important;
          transition: none !important;
        }
      }
      @media (prefers-color-scheme: light) {
        .pill {
          background: #ffffff;
          color: #0f172a;
          border-color: #cbd5e1;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        .transcript-text { color: #64748b; }
        .action-btn { background: #e2e8f0; color: #0f172a; }
        .action-btn:hover { background: #cbd5e1; }
        .close-btn { color: #64748b; }
        .close-btn:hover { color: #0f172a; }
      }
    `;

    containerEl = document.createElement('div');
    containerEl.className = 'pill';
    containerEl.setAttribute('role', 'status');
    containerEl.setAttribute('aria-live', 'polite');

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(containerEl);

    // Attach to documentElement
    (document.documentElement || document.body).appendChild(hostEl);
  }

  function hideOverlay() {
    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }
    if (containerEl) {
      containerEl.classList.remove('visible');
    }
    isVisible = false;
  }

  function renderState({ state, message = '', transcript = '', action = null }) {
    ensureOverlayDom();

    if (autoDismissTimer) {
      clearTimeout(autoDismissTimer);
      autoDismissTimer = null;
    }

    containerEl.innerHTML = '';

    const dot = document.createElement('span');
    dot.className = 'dot';

    const textSpan = document.createElement('span');
    textSpan.className = 'text-area';

    switch (state) {
      case 'starting-mic':
        dot.className = 'dot working';
        textSpan.textContent = 'Starting mic…';
        break;

      case 'listening':
        dot.className = 'dot listening';
        if (transcript) {
          textSpan.innerHTML = '';
          // djcode0718
          const prefix = document.createTextNode('Listening: ');
          const transSpan = document.createElement('span');
          transSpan.className = 'transcript-text';
          transSpan.textContent = `"${transcript}"`;
          textSpan.appendChild(prefix);
          textSpan.appendChild(transSpan);
        } else {
          textSpan.textContent = 'Listening…';
        }
        break;

      case 'understanding':
        dot.className = 'dot working';
        textSpan.textContent = transcript ? `Understanding: "${transcript}"` : 'Understanding…';
        break;

      case 'reading-page':
        dot.className = 'dot working';
        textSpan.textContent = 'Reading the job post…';
        break;

      case 'sending':
        dot.className = 'dot working';
        textSpan.textContent = 'Sending to Sara…';
        break;

      case 'sent':
        dot.className = 'dot success';
        textSpan.textContent = message || 'Sent to Sara ✓';
        if (action?.title) {
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.textContent = action.title;
          btn.onclick = () => {
            if (action.type === 'switch_tab' && action.tabId) {
              chrome.runtime.sendMessage({ type: 'SWITCH_TAB', tabId: action.tabId }).catch(() => {});
            }
            hideOverlay();
          };
          textSpan.appendChild(btn);
        }
        autoDismissTimer = setTimeout(hideOverlay, action ? 6000 : OVERLAY_SUCCESS_DISMISS_MS);
        break;

      case 'error':
        dot.className = 'dot error';
        textSpan.textContent = message || 'Something went wrong.';
        if (action?.title) {
          const btn = document.createElement('button');
          btn.className = 'action-btn';
          btn.textContent = action.title;
          btn.onclick = () => {
            if (action.type === 'options') {
              chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' }).catch(() => {});
            }
            hideOverlay();
          };
          textSpan.appendChild(btn);
        }
        autoDismissTimer = setTimeout(hideOverlay, OVERLAY_ERROR_DISMISS_MS);
        break;

      case 'hint':
        dot.className = 'dot working';
        textSpan.textContent = message || 'Hold Option+S and say "Sara, tailor my resume"';
        autoDismissTimer = setTimeout(hideOverlay, 4000);
        break;

      default:
        textSpan.textContent = message || '';
        break;
    }

    containerEl.appendChild(dot);
    containerEl.appendChild(textSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.textContent = '✕';
    closeBtn.onclick = hideOverlay;
    containerEl.appendChild(closeBtn);

    containerEl.classList.add('visible');
    isVisible = true;
  }

  // Handle escape key to cancel/dismiss
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isVisible) {
      hideOverlay();
      chrome.runtime.sendMessage({ type: 'VOICE_CANCEL', reason: 'escape' }).catch(() => {});
      // djcode0718
    }
  }, true);

  // Runtime message listener
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'OVERLAY_STATE') {
      renderState(msg);
    }
    if (msg.type === 'OVERLAY_HIDE') {
      hideOverlay();
    }
  });
})();
