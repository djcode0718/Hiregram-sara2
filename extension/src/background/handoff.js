/**
 * Hardened hand-off mechanism to Hiregram.
 * Retains the proven storage -> content script -> Sara chat box path.
 * Updated with dedicated new tab targeting (FR-H7) to avoid disturbing existing tabs.
 */

import {
  HIREGRAM_URL,
  STORAGE_KEY_PENDING
} from '../lib/constants.js';
import { logger } from '../lib/logger.js';

// In-memory mapping of pendingId -> targetTabId
const targetTabMap = new Map();

/**
 * Generates a unique, collision-resistant message id.
 * @returns {string}
 */
export function generatePendingId() {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Checks if a tab is authorized to claim a given pending request.
 * @param {string} pendingId
 * @param {number} tabId
 * @returns {Promise<boolean>}
 */
export async function isTabAuthorizedForPending(pendingId, tabId) {
  if (!pendingId || !tabId) return false;

  // Check in-memory map first
  if (targetTabMap.has(pendingId)) {
    return targetTabMap.get(pendingId) === tabId;
  }

  // Check storage.session fallback in case service worker was suspended
  try {
    if (chrome.storage?.session) {
      const data = await chrome.storage.session.get('targetTabMap');
      const savedMap = data?.targetTabMap || {};
      if (savedMap[pendingId]) {
        targetTabMap.set(pendingId, savedMap[pendingId]);
        return savedMap[pendingId] === tabId;
      }
    }
  } catch {
    // Non-blocking
  }

  return false;
}

/**
 * Records tab authorization in memory and session storage.
 * @param {string} pendingId
 * @param {number} tabId
 */
async function recordTabAuthorization(pendingId, tabId) {
  targetTabMap.set(pendingId, tabId);
  try {
    if (chrome.storage?.session) {
      const data = await chrome.storage.session.get('targetTabMap');
      const savedMap = data?.targetTabMap || {};
      savedMap[pendingId] = tabId;
      await chrome.storage.session.set({ targetTabMap: savedMap });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Removes tab authorization once consumed or completed.
 * @param {string} pendingId
 */
export async function removeTabAuthorization(pendingId) {
  targetTabMap.delete(pendingId);
  try {
    if (chrome.storage?.session) {
      const data = await chrome.storage.session.get('targetTabMap');
      const savedMap = data?.targetTabMap || {};
      delete savedMap[pendingId];
      await chrome.storage.session.set({ targetTabMap: savedMap });
    }
  } catch {
    // Non-blocking
  }
}

/**
 * Writes pending payload to storage and opens a DEDICATED NEW TAB (FR-H7).
 * @param {Object} options
 * @param {string} options.text - Formatted message text to deliver to Sara.
 * @param {Object} [options.meta] - Job metadata (title, company, url).
 * @returns {Promise<{ id: string, tabId: number }>}
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

  // FR-H7: Always open a DEDICATED NEW TAB for every hand-off
  const newTab = await chrome.tabs.create({ url: HIREGRAM_URL });
  if (newTab.id) {
    await recordTabAuthorization(id, newTab.id);
  }

  logger.info('handoff_new_tab_created', { tabId: newTab.id, pendingId: id });
  return { id, tabId: newTab.id };
}
