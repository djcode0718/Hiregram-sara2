/**
 * Tailor Execution Pipeline
 * Orchestrates: Job extraction -> Message composition -> Sara Hand-off -> Origin tab feedback
 */

import { extractJobContext } from './extract.js';
import { composeMessage } from '../lib/compose-message.js';
import { sendToHiregram } from './handoff.js';
import { logger } from '../lib/logger.js';
import {
  MSG_OVERLAY_STATE,
  STATE_READING_PAGE,
  STATE_SENDING,
  STATE_SENT,
  STATE_ERROR
} from '../lib/constants.js';

/**
 * Sends overlay state update to the top frame of a tab (best-effort).
 * @param {number} tabId
 * @param {Object} payload
 */
export async function notifyTabOverlay(tabId, payload) {
  if (!tabId || tabId <= 0) return;
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: MSG_OVERLAY_STATE,
      ...payload
    });
  } catch {
    // Tab might not have content script loaded or is restricted
  }
}

/**
 * Executes full tailoring pipeline for a tab.
 * @param {Object} params
 * @param {number} params.tabId
 * @param {string} [params.instruction]
 * @param {string} [params.source]
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function runTailor({ tabId, instruction = '', source = 'toolbar' }) {
  logger.info('pipeline_runTailor_start', { tabId, source });

  try {
    await notifyTabOverlay(tabId, {
      state: STATE_READING_PAGE,
      message: 'Reading the job post…'
    });

    // 1. Extract Job Context
    const jobCtx = await extractJobContext(tabId);

    // 2. Check for missing JD
    if (!jobCtx.description && !jobCtx.url) {
      await notifyTabOverlay(tabId, {
        state: STATE_ERROR,
        message: "Couldn't find a job description on this page. Select the text and try again."
      });
      return { ok: false, error: 'NO_JD_FOUND' };
    }

    await notifyTabOverlay(tabId, {
      state: STATE_SENDING,
      message: 'Sending to Sara…'
    });

    // 3. Compose Message
    const message = composeMessage(jobCtx, { instruction, source });

    // 4. Hand-off to Hiregram
    const handoffResult = await sendToHiregram({
      text: message,
      meta: {
        title: jobCtx.title,
        company: jobCtx.company,
        url: jobCtx.url
      }
    });

    // 5. Notify Origin Tab
    await notifyTabOverlay(tabId, {
      state: STATE_SENT,
      message: 'Sent to Sara ✓'
    });

    logger.info('pipeline_runTailor_success', {
      tabId,
      id: handoffResult.id,
      createdTab: handoffResult.createdTab
    });

    return { ok: true, id: handoffResult.id };
  } catch (err) {
    logger.error('pipeline_runTailor_failed', { tabId, error: err.message });
    await notifyTabOverlay(tabId, {
      state: STATE_ERROR,
      message: 'Something went wrong. Try again.'
    });
    return { ok: false, error: err.message };
  }
}
