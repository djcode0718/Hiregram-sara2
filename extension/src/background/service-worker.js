/**
 * Background Service Worker
 * Handles context menus, toolbar clicks, extension lifecycle, and message coordination.
 */

import {
  RESTRICTED_BADGE_CLEAR_MS,
  MAX_MESSAGE_CHARS
} from '../lib/constants.js';
import { sendToHiregram } from './handoff.js';
import { extractJobContext } from './extract.js';
import { logger } from '../lib/logger.js';

// Baseline message builder (will be augmented in Phase 3 with compose-message)
function buildBaselineMessage(selection, url) {
  const cleanSelection = (selection || '').trim();
  if (cleanSelection) {
    const text = cleanSelection.length > MAX_MESSAGE_CHARS
      ? cleanSelection.slice(0, MAX_MESSAGE_CHARS)
      : cleanSelection;
    return `Tailor my resume to this job post:\n\n${text}`;
  }
  return `Tailor my resume to this job post: ${url}`;
}

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

  if (details.reason === 'install') {
    // Open onboarding on first install
    chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/onboarding.html') }).catch(() => {});
  }
});

// 2. Context Menu Click Listener
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'tailor' || !tab?.id) return;

  const url = info.pageUrl || tab.url || '';
  if (isRestrictedUrl(url)) {
    showRestrictedBadge(tab.id);
    return;
  }

  const jobCtx = await extractJobContext(tab.id);
  if (info.selectionText) {
    jobCtx.description = info.selectionText;
    jobCtx.source = 'selection';
  }

  const message = buildBaselineMessage(jobCtx.description, jobCtx.url || url);
  await sendToHiregram({
    text: message,
    meta: {
      title: jobCtx.title,
      company: jobCtx.company,
      url: jobCtx.url || url
    }
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

  const jobCtx = await extractJobContext(tab.id);
  const message = buildBaselineMessage(jobCtx.description, jobCtx.url || url);
  await sendToHiregram({
    text: message,
    meta: {
      title: jobCtx.title,
      company: jobCtx.company,
      url: jobCtx.url || url
    }
  });
});
