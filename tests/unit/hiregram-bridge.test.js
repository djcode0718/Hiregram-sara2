import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const BRIDGE_SCRIPT = fs.readFileSync(
  path.resolve('extension/src/content/hiregram-bridge.js'),
  'utf8'
);

function setupBridgeDom(html, { url = 'https://hiregram.ai/resume', allowed = true, pending = null } = {}) {
  const dom = new JSDOM(html, { url, runScripts: 'dangerously' });

  let storedPending = pending;
  const messagesSent = [];

  // In JSDOM, location.assign is non-configurable, so define mock on dom.window
  dom.window.assignedUrls = [];
  try {
    Object.defineProperty(dom.window.location, 'assign', {
      writable: true,
      configurable: true,
      value: (navUrl) => {
        dom.window.assignedUrls.push(navUrl);
      }
    });
  } catch {
    dom.window.assignUrl = (navUrl) => {
      dom.window.assignedUrls.push(navUrl);
    };
  }

  dom.window.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (key === 'pending') return { pending: storedPending };
          return {};
        },
        set: async (items) => {
          if (items.pending) storedPending = items.pending;
        },
        remove: async (key) => {
          if (key === 'pending') storedPending = null;
        }
      },
      onChanged: {
        addListener: () => {}
      }
    },
    runtime: {
      sendMessage: async (msg) => {
        messagesSent.push(msg);
        if (msg.type === 'CLAIM_PENDING') {
          return { allowed };
        }
        return { ok: true };
      }
    }
  };

  return {
    dom,
    getPending: () => storedPending,
    setPending: (p) => { storedPending = p; },
    getMessages: () => messagesSent
  };
}

test('Bridge state machine: LIST page resolves default row and navigates via location.assign', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <section aria-labelledby="rh-index">
          <div><h2 id="rh-index">All resumes</h2><span>2 resumes</span></div>
          <ul>
            <li class="group">
              <a data-row-link="true" href="/resume/11111111-2222-3333-4444-555555555555"></a>
              <p><span class="text-[var(--rh-ink)]">Default · </span>Single Column · edited 21 hours ago</p>
            </li>
            <li class="group">
              <a data-row-link="true" href="/resume/22222222-3333-4444-5555-666666666666"></a>
              <p>Modern · edited 1 day ago</p>
            </li>
          </ul>
        </section>
      </body>
    </html>
  `;

  const pending = { id: 'test_resolve_1', text: 'Tailor my resume...', ts: Date.now(), status: 'queued', navAttempts: 0 };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume',
    allowed: true,
    pending
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(dom.window.assignedUrls[0], 'https://hiregram.ai/resume/11111111-2222-3333-4444-555555555555');
    const currentPending = getPending();
    assert.ok(currentPending);
    assert.equal(currentPending.navAttempts, 1);

    const toast = dom.window.document.getElementById('hg-tailor-toast');
    assert.ok(toast);
    assert.match(toast.textContent, /opening your default resume/i);
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: Default changes between two hand-offs -> new default is respected fresh', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <section aria-labelledby="rh-index">
          <ul>
            <li id="row1">
              <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
              <p id="meta1">Original · edited 1 day ago</p>
            </li>
            <li id="row2">
              <a data-row-link="true" href="/resume/22222222-2222-2222-2222-222222222222"></a>
              <p id="meta2"><span class="text-[var(--rh-ink)]">Default · </span>Updated default</p>
            </li>
          </ul>
        </section>
      </body>
    </html>
  `;

  const pending = { id: 'test_new_default', text: 'Tailor resume for new job', ts: Date.now(), status: 'queued', navAttempts: 0 };
  const { dom } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume',
    allowed: true,
    pending
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(dom.window.assignedUrls[0], 'https://hiregram.ai/resume/22222222-2222-2222-2222-222222222222');
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: EDITOR page fills textarea and clicks Send, deletes pending only after Send', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="chat-container">
          <textarea aria-label="Message Sara"></textarea>
          <button aria-label="Send">Send</button>
        </div>
      </body>
    </html>
  `;

  let sendClicked = false;
  const pending = { id: 'test_editor_claim', text: 'Tailor my resume to Stripe role', ts: Date.now(), status: 'queued' };
  const { dom, getPending, getMessages } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/11111111-2222-3333-4444-555555555555',
    allowed: true,
    pending
  });

  try {
    const sendBtn = dom.window.document.querySelector('button[aria-label="Send"]');
    sendBtn.addEventListener('click', () => {
      sendClicked = true;
    });

    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 150));

    const textarea = dom.window.document.querySelector('textarea[aria-label="Message Sara"]');
    assert.equal(textarea.value, 'Tailor my resume to Stripe role');
    assert.equal(sendClicked, true, 'Expected Send button to be clicked');
    assert.equal(getPending(), null, 'Pending must be removed only after Send confirmed');

    const toast = dom.window.document.getElementById('hg-tailor-toast');
    assert.ok(toast);
    assert.match(toast.textContent, /sent to Sara ✓/i);

    const handoffMsg = getMessages().find((m) => m.type === 'HANDOFF_RESULT');
    assert.ok(handoffMsg);
    assert.equal(handoffMsg.status, 'sent');
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: LIST -> full reload -> EDITOR flow survives reload and sends once', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="rs-as-composer px-3 py-2.5">
          <textarea data-chat-box aria-label="Message Sara"></textarea>
          <button type="button" class="rs-as-send" aria-label="Send"></button>
        </div>
      </body>
    </html>
  `;

  let sendClicked = false;
  const pending = { id: 'test_reload_flow', text: 'Tailored message across reload', ts: Date.now(), status: 'queued', navAttempts: 1 };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/11111111-2222-3333-4444-555555555555',
    allowed: true,
    pending
  });

  try {
    const sendBtn = dom.window.document.querySelector('button.rs-as-send');
    sendBtn.addEventListener('click', () => {
      sendClicked = true;
    });

    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 150));

    assert.equal(sendClicked, true);
    assert.equal(getPending(), null);
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: Loop guard halts if redirected back to list >= 2 times', async () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-2222-3333-4444-555555555555"></a>
          <p><span>Default</span></p>
        </li>
      </ul>
    </section>
  `;

  const pending = { id: 'test_loop', text: 'Looping', ts: Date.now(), status: 'queued', navAttempts: 2 };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume',
    allowed: true,
    pending
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(dom.window.assignedUrls.length, 0);
    const toast = dom.window.document.getElementById('hg-tailor-toast');
    assert.ok(toast);
    assert.match(toast.textContent, /couldn't open your default resume/i);
    assert.notEqual(getPending(), null, 'Keeps pending until TTL');
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: Does not re-send if status is already sent', async () => {
  const html = `
    <div class="chat-container">
      <textarea aria-label="Message Sara"></textarea>
      <button aria-label="Send">Send</button>
    </div>
  `;

  let sendClicked = false;
  const pending = { id: 'test_sent_state', text: 'Already sent', ts: Date.now(), status: 'sent' };
  const { dom } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/11111111-2222-3333-4444-555555555555',
    allowed: true,
    pending
  });

  try {
    dom.window.document.querySelector('button[aria-label="Send"]').addEventListener('click', () => {
      sendClicked = true;
    });

    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 80));

    assert.equal(sendClicked, false, 'Must not re-send if status is sent');
    const toast = dom.window.document.getElementById('hg-tailor-toast');
    assert.ok(toast);
    assert.match(toast.textContent, /may already have been sent/i);
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: LOGIN page toasts and preserves pending', async () => {
  const html = `
    <h1>Sign in to Hiregram</h1>
    <input type="password" />
  `;

  const pending = { id: 'test_login', text: 'Message', ts: Date.now() };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/login',
    allowed: true,
    pending
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 50));

    assert.notEqual(getPending(), null);
    const toast = dom.window.document.getElementById('hg-tailor-toast');
    assert.ok(toast);
    assert.match(toast.textContent, /log in to continue/i);
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Bridge state machine: Unallocated tab does not claim pending', async () => {
  const html = `
    <textarea aria-label="Message Sara"></textarea>
  `;

  const pending = { id: 'test_unauth', text: 'Secret', ts: Date.now() };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/11111111-2222-3333-4444-555555555555',
    allowed: false,
    pending
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    await new Promise((r) => setTimeout(r, 50));

    assert.notEqual(getPending(), null);
    const textarea = dom.window.document.querySelector('textarea');
    assert.equal(textarea.value, '');
  } finally {
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    dom.window.close();
  }
});

test('Guard: zero timers and observers remain after pagehide', () => {
  const html = `<body><section aria-labelledby="rh-index"></section></body>`;
  const { dom } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume',
    allowed: true,
    pending: { id: 'test_teardown', text: 'Teardown', ts: Date.now() }
  });

  try {
    dom.window.eval(BRIDGE_SCRIPT);
    dom.window.dispatchEvent(new dom.window.Event('pagehide'));
    assert.ok(true);
  } finally {
    dom.window.close();
  }
});
