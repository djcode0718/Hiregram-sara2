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

  dom.window.chrome = {
    storage: {
      local: {
        get: async (key) => {
          if (key === 'pending') return { pending: storedPending };
          return {};
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
    getMessages: () => messagesSent
  };
}

test('Bridge state machine: LIST page detects default resume and clicks Open in editor', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Welcome back</h1>
        <section class="default-section">
          <h2>YOUR DEFAULT</h2>
          <div class="resume-card">
            <h3>Software Engineer Resume</h3>
            <button id="openEditorBtn">Open in editor</button>
          </div>
        </section>
        <section>
          <h2>All resumes</h2>
        </section>
      </body>
    </html>
  `;

  const pending = { id: 'test_123', text: 'Tailor my resume...', ts: Date.now() };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume',
    allowed: true,
    pending
  });

  // Mock window.location setter
  dom.window.addEventListener('error', (e) => {
    e.preventDefault();
  });

  dom.window.eval(BRIDGE_SCRIPT);

  // Allow microtasks to complete
  await new Promise((r) => setTimeout(r, 100));

  // Pending must be retained until editor consumes it
  assert.notEqual(getPending(), null);

  const toast = dom.window.document.getElementById('hg-tailor-toast');
  assert.ok(toast);
  assert.match(toast.textContent, /opening your default resume/i);
});

test('Bridge state machine: EDITOR page fills textarea and clicks Send', async () => {
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

  const pending = { id: 'test_456', text: 'Tailor my resume to Stripe role', ts: Date.now() };
  const { dom, getPending, getMessages } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/editor/123',
    allowed: true,
    pending
  });

  let sendClicked = false;
  const sendBtn = dom.window.document.querySelector('button[aria-label="Send"]');
  sendBtn.addEventListener('click', () => { sendClicked = true; });

  dom.window.eval(BRIDGE_SCRIPT);

  await new Promise((r) => setTimeout(r, 200));

  const textarea = dom.window.document.querySelector('textarea[aria-label="Message Sara"]');
  assert.equal(textarea.value, 'Tailor my resume to Stripe role');
  assert.equal(sendClicked, true, 'Expected Send button to be clicked');
  assert.equal(getPending(), null, 'Expected pending to be atomically removed upon send');

  const toast = dom.window.document.getElementById('hg-tailor-toast');
  assert.ok(toast);
  assert.match(toast.textContent, /sent to Sara ✓/i);

  const handoffMsg = getMessages().find((m) => m.type === 'HANDOFF_RESULT');
  assert.ok(handoffMsg);
  assert.equal(handoffMsg.status, 'sent');
});

test('Bridge state machine: LOGIN page toasts and preserves pending', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Sign in to Hiregram</h1>
        <form>
          <input type="email" placeholder="Email" />
          <input type="password" placeholder="Password" />
          <button type="submit">Log in</button>
        </form>
      </body>
    </html>
  `;

  const pending = { id: 'test_789', text: 'Message', ts: Date.now() };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/login',
    allowed: true,
    pending
  });

  dom.window.eval(BRIDGE_SCRIPT);

  await new Promise((r) => setTimeout(r, 50));

  assert.notEqual(getPending(), null, 'Pending must be preserved on login page');
  const toast = dom.window.document.getElementById('hg-tailor-toast');
  assert.ok(toast);
  assert.match(toast.textContent, /log in to continue/i);
});

test('Bridge state machine: EDITOR page with real Hiregram markup fills and sends', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="rs-as-composer px-3 py-2.5">
          <div class="rs-as-tools flex items-start">
            <div class="rs-as-field min-w-0 flex-1">
              <textarea data-chat-box rows="1" maxlength="8000" aria-label="Message Sara" aria-describedby="_r_1o_" autocomplete="off" class="glass-scrollbar ph-no-capture min-h-[20px]"></textarea>
            </div>
            <span id="_r_1o_" class="sr-only ph-no-capture">Ask for a change, or paste a job post</span>
            <button type="button" class="rs-as-send rs-tip rs-tip-up" data-tip-side="end" data-tip="Send" data-keys="↵" aria-label="Send">
              <svg><path d="M5 12 7-7 7 7"></path></svg>
            </button>
          </div>
        </div>
      </body>
    </html>
  `;

  let sendClicked = false;
  const pending = { id: 'test_real_dom', text: 'Tailor resume for Senior Engineer at Anthropic', ts: Date.now() };
  const { dom, getPending, getMessages } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/c07fbf6b-dc4b-497f-98d9-41f3b5e3e37b',
    allowed: true,
    pending
  });

  const sendBtn = dom.window.document.querySelector('button.rs-as-send');
  sendBtn.addEventListener('click', () => {
    sendClicked = true;
  });

  dom.window.eval(BRIDGE_SCRIPT);

  await new Promise((r) => setTimeout(r, 200));

  const textarea = dom.window.document.querySelector('textarea[data-chat-box]');
  assert.equal(textarea.value, 'Tailor resume for Senior Engineer at Anthropic');
  assert.equal(sendClicked, true, 'Expected Send button to be clicked');
  assert.equal(getPending(), null, 'Expected pending to be atomically removed upon send');

  const toast = dom.window.document.getElementById('hg-tailor-toast');
  assert.ok(toast);
  assert.match(toast.textContent, /sent to Sara ✓/i);

  const handoffMsg = getMessages().find((m) => m.type === 'HANDOFF_RESULT');
  assert.ok(handoffMsg);
  assert.equal(handoffMsg.status, 'sent');
});

test('Bridge state machine: Unallocated tab does not claim pending', async () => {
  const html = `
    <!DOCTYPE html>
    <html>
      <body>
        <textarea aria-label="Message Sara"></textarea>
        <button aria-label="Send">Send</button>
      </body>
    </html>
  `;

  const pending = { id: 'test_unauth', text: 'Secret', ts: Date.now() };
  const { dom, getPending } = setupBridgeDom(html, {
    url: 'https://hiregram.ai/resume/editor/999',
    allowed: false, // SW says not target tab
    pending
  });

  dom.window.eval(BRIDGE_SCRIPT);

  await new Promise((r) => setTimeout(r, 50));

  // Should NOT touch pending and should NOT fill textarea
  assert.notEqual(getPending(), null);
  const textarea = dom.window.document.querySelector('textarea');
  assert.equal(textarea.value, '');
});
