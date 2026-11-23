/**
 * Background Service Worker
 * Handles context menus, toolbar clicks, extension lifecycle, and message coordination.
 */

import {
  RESTRICTED_BADGE_CLEAR_MS,
  MSG_CLAIM_PENDING,
  MSG_HANDOFF_RESULT
} from '../lib/constants.js';
import { runTailor } from './pipeline.js';
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

// 1. Extension Lifecycle Listener (Registered synchronously at top level)
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('runtime_onInstalled', { reason: details.reason });

  // Create context menu
  chrome.contextMenus.create({
    id: 'tailor',
    title: 'Tailor resume with Hiregram',
    contexts: ['selection', 'page']
  });

  // Onboarding tab will be enabled in Phase 6 once onboarding.html is built
  /*
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding.html') }).catch(() => {});
  }
  */
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
