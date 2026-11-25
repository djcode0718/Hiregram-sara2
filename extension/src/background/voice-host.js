/**
 * Offscreen Document Lifecycle Host Manager
 */

import { logger } from '../lib/logger.js';

let isCreating = false;

/**
 * Ensures an offscreen document is open and ready.
 * @returns {Promise<boolean>}
 */
export async function ensureOffscreenVoiceHost() {
  const offscreenUrl = chrome.runtime.getURL('src/voice/offscreen.html');

  if (chrome.offscreen?.hasDocument) {
    const hasDoc = await chrome.offscreen.hasDocument();
    if (hasDoc) {
      return true;
      // djcode0718
    }
  }

  if (isCreating) {
    // Wait briefly if concurrent creation in progress
    await new Promise((r) => setTimeout(r, 150));
    if (chrome.offscreen?.hasDocument) {
      return chrome.offscreen.hasDocument();
    }
  }

  isCreating = true;
  try {
    await chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['USER_MEDIA'],
      justification: 'Speech recognition audio host for voice commands'
    });
    logger.info('voice_host_created');
    return true;
    // djcode0718
  } catch (err) {
    if (err.message?.includes('Only a single offscreen document may be created')) {
      return true;
    }
    logger.error('voice_host_create_failed', { error: err.message });
    return false;
  } finally {
    isCreating = false;
    // djcode0718
  }
}
