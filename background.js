const TAB_PATTERN = "https://hiregram.ai/resume*";
const HIREGRAM_URL = "https://hiregram.ai/resume";
const MAX_CHARS = 7500; // the chat box has maxlength=8000

function buildMessage(selection, url) {
  selection = (selection || "").trim();
  if (selection) {
    const text =
      selection.length > MAX_CHARS ? selection.slice(0, MAX_CHARS) : selection;
    return `Tailor my resume to this job post:\n\n${text}`;
  }
  return `Tailor my resume to this job post: ${url}`;
}

async function sendToHiregram(message) {
  // Leave the message for the content script, which picks it up on load
  // (new tab) or via storage.onChanged (already-open tab).
  await chrome.storage.local.set({ pending: { text: message, ts: Date.now() } });

  const tabs = await chrome.tabs.query({ url: TAB_PATTERN });
  if (tabs.length) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: HIREGRAM_URL });
  }
}

// Right-click menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tailor",
    title: "Tailor resume with Hiregram",
    contexts: ["selection", "page"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "tailor") return;
  sendToHiregram(buildMessage(info.selectionText, info.pageUrl || tab.url));
});

// Toolbar button: use selected text if any, otherwise the page URL
chrome.action.onClicked.addListener(async (tab) => {
  let selection = "";
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.getSelection().toString(),
    });
    selection = res?.result || "";
  } catch (e) {
    // restricted page (chrome://, web store, etc.), fall back to URL
  }
  sendToHiregram(buildMessage(selection, tab.url));
});
