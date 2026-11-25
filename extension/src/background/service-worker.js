/**
 * Background Service Worker
 * Handles context menus, toolbar clicks, extension lifecycle, and message coordination.
 */

import {
  RESTRICTED_BADGE_CLEAR_MS,
  MSG_CLAIM_PENDING,
  MSG_HANDOFF_RESULT,
  MSG_VOICE_START,
  MSG_VOICE_STOP,
  MSG_VOICE_CANCEL,
  MSG_ENGINE_EVENT
} from '../lib/constants.js';
import {
  runTailor,
  handleVoiceStart,
  handleVoiceStop,
  handleVoiceCancel,
  handleEngineEvent
} from './pipeline.js';
import { isTabAuthorizedForPending, removeTabAuthorization } from './handoff.js';
import { logger } from '../lib/logger.js';

function isRestrictedUrl(url) {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('view-source:') ||
    url.includes('chrome.google.com/webstore') ||
    url.includes('chromewebstore.google.com')
  );
}

function showRestrictedBadge(tabId) {
  try {
    chrome.action.setBadgeText({ tabId, text: '!' });
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#EF4444' });
    chrome.action.setTitle({ tabId, title: 'Hiregram Tailor cannot run on restricted browser pages' });

    setTimeout(() => {
      try {
        chrome.action.setBadgeText({ tabId, text: '' });
        chrome.action.setTitle({ tabId, title: 'Tailor resume with Hiregram' });
      } catch {
        // Tab might be closed
      }
    }, RESTRICTED_BADGE_CLEAR_MS);
  } catch {
    // Ignore badge errors
  }
}

// Helper: programmatically inject hotkey & overlay scripts into existing active/http tabs
async function injectContentScriptsIntoExistingTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (!tab.id || isRestrictedUrl(tab.url)) continue;
      chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: ['src/content/overlay.js', 'src/content/hotkey.js']
      }).catch(() => {
        // Tab might be discarded, navigating or restricted
      });
    }
  } catch (e) {
    logger.debug('tab_script_injection_failed', { error: String(e) });
  }
}

// 1. Extension Lifecycle Listener (Registered synchronously at top level)
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('runtime_onInstalled', { reason: details.reason });

  // Create context menu
  chrome.contextMenus.create({
    id: 'tailor',
    title: 'Tailor resume with Hiregram',
    contexts: ['selection', 'page']
  });

  // Inject into pre-existing tabs so user doesn't have to refresh all pages
  injectContentScriptsIntoExistingTabs();

  // Open onboarding on first install (FR-O1)
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding.html') }).catch(() => {});
  }
});

chrome.runtime.onStartup.addListener(() => {
  logger.info('runtime_onStartup');
  injectContentScriptsIntoExistingTabs();
});

// 2. Context Menu Click Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'tailor' || !tab?.id) return;

  const url = info.pageUrl || tab.url || '';
  if (isRestrictedUrl(url)) {
    showRestrictedBadge(tab.id);
    return;
  }

  await runTailor({
    tabId: tab.id,
    source: 'context-menu'
  });
});

// 3. Toolbar Action Click Listener
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab || !tab.id) return;

  const url = tab.url || '';
  if (isRestrictedUrl(url)) {
    showRestrictedBadge(tab.id);
    return;
  }

  await runTailor({
    tabId: tab.id,
    source: 'toolbar'
  });
});

// 4. Runtime Message Coordinator (Registered synchronously at top level)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender?.tab?.id;

  if (message.type === MSG_VOICE_START) {
    if (tabId) handleVoiceStart(tabId);
    return;
  }

  if (message.type === MSG_VOICE_STOP) {
    if (tabId) handleVoiceStop(tabId);
    return;
  }

  if (message.type === MSG_VOICE_CANCEL) {
    if (tabId) handleVoiceCancel(tabId, message.reason);
    return;
  }

  if (message.type === MSG_ENGINE_EVENT) {
    handleEngineEvent(message);
    return;
  }

  if (message.type === 'OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage().catch(() => {});
    return;
  }

  if (message.type === 'SWITCH_TAB') {
    if (message.tabId) {
      chrome.tabs.update(message.tabId, { active: true }).catch(() => {});
      chrome.tabs.get(message.tabId, (tab) => {
        if (!chrome.runtime.lastError && tab?.windowId) {
          chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
        }
      });
    }
    return;
  }

  if (message.type === MSG_CLAIM_PENDING) {
    const senderTabId = sender?.tab?.id;
    isTabAuthorizedForPending(message.pendingId, senderTabId).then((allowed) => {
      sendResponse({ allowed, tabId: senderTabId });
    }).catch(() => {
      sendResponse({ allowed: false });
    });
    return true; // Keep message channel open for async response
  }

  if (message.type === MSG_HANDOFF_RESULT) {
    if (message.id) {
      removeTabAuthorization(message.id).catch(() => {});
    }
    logger.info('handoff_result_received', {
      id: message.id,
      status: message.status
    });
  }
});

// 5. Keep-Alive Port Listener during active voice sessions
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'hg_voice_session') {
    logger.debug('voice_session_keepalive_connected');
    port.onDisconnect.addListener(() => {
      logger.debug('voice_session_keepalive_disconnected');
    });
  }
});
