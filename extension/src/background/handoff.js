/**
 * Hardened hand-off mechanism to Hiregram.
 * Retains the proven storage -> content script -> Sara chat box path.
 */

import {
  HIREGRAM_URL,
  TAB_PATTERNS,
  STORAGE_KEY_PENDING
} from '../lib/constants.js';
import { logger } from '../lib/logger.js';

/**
 * Generates a unique, collision-resistant message id.
 * @returns {string}
 */
export function generatePendingId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Writes pending payload to storage and activates or opens the Hiregram tab.
 * @param {Object} options
 * @param {string} options.text - Formatted message text to deliver to Sara.
 * @param {Object} [options.meta] - Job metadata (title, company, url).
 * @returns {Promise<{ id: string, createdTab: boolean }>}
 */
export async function sendToHiregram({ text, meta = {} }) {
  const id = generatePendingId();
  const payload = {
    id,
    text,
    ts: Date.now(),
    meta
  };

  // Leave message in storage.local for hiregram-bridge.js
  await chrome.storage.local.set({ [STORAGE_KEY_PENDING]: payload });
  logger.info('handoff_pending_set', { id, textLength: text.length });

  // Check for existing Hiregram tab
  let existingTab = null;
  for (const pattern of TAB_PATTERNS) {
    try {
      const tabs = await chrome.tabs.query({ url: pattern });
      if (tabs && tabs.length > 0) {
        existingTab = tabs[0];
        break;
      }
    } catch {
      // Ignore pattern query errors
    }
  }

  if (existingTab && existingTab.id !== undefined) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (existingTab.windowId !== undefined) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    logger.info('handoff_tab_focused', { tabId: existingTab.id });
    return { id, createdTab: false };
  }

  // Otherwise create new tab
  const newTab = await chrome.tabs.create({ url: HIREGRAM_URL });
  logger.info('handoff_tab_created', { tabId: newTab.id });
  return { id, createdTab: true };
}
