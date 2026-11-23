// Runs on hiregram.ai. Finds Sara's chat box, fills it, and clicks Send.
const TEXTAREA_SEL = 'textarea[aria-label="Message Sara"]';
const SEND_SEL = 'button[aria-label="Send"]';

let busy = false;

function waitFor(fn, timeoutMs = 120000, intervalMs = 300) {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const el = fn();
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

function toast(msg) {
  let el = document.getElementById("hg-tailor-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "hg-tailor-toast";
    el.style.cssText =
      "position:fixed;bottom:16px;left:16px;z-index:2147483647;padding:8px 12px;" +
      "background:#111;color:#fff;font:13px system-ui;border-radius:8px;opacity:.92";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.remove(), 6000);
}

// React ignores plain `.value = ...`, so use the native setter + input event.
function setReactValue(textarea, text) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value"
  ).set;
  setter.call(textarea, text);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

async function consumePending() {
  if (busy) return;
  const { pending } = await chrome.storage.local.get("pending");
  if (!pending) return;
  if (Date.now() - pending.ts > 10 * 60 * 1000) {
    await chrome.storage.local.remove("pending");
    return;
  }

  busy = true;
  try {
    toast("Hiregram Tailor: waiting for the resume editor…");
    const textarea = await waitFor(() => document.querySelector(TEXTAREA_SEL));
    if (!textarea) {
      toast("Hiregram Tailor: couldn't find Sara's chat box. Upload your resume first, then try again.");
      return;
    }

    // Claim the message so no other tab/instance sends it twice.
    const { pending: still } = await chrome.storage.local.get("pending");
    if (!still) return;
    await chrome.storage.local.remove("pending");

    textarea.focus();
    setReactValue(textarea, pending.text);

    const send = await waitFor(() => {
      const b = document.querySelector(SEND_SEL);
      return b && !b.disabled ? b : null;
    }, 5000, 100);

    if (send) {
      send.click();
      toast("Hiregram Tailor: sent to Sara ✓");
    } else {
      toast("Hiregram Tailor: text is filled in, press Send yourself.");
    }
  } finally {
    busy = false;
  }
}

consumePending();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.pending?.newValue) consumePending();
});
