/**
 * Tailor Execution Pipeline and Voice Session State Machine
 * Orchestrates: Voice push-to-talk -> Parse intent -> Extract -> Compose -> Hand-off -> Overlay feedback
 */

import { extractJobContext } from './extract.js';
import { composeMessage } from '../lib/compose-message.js';
import { sendToHiregram } from './handoff.js';
import { parseCommand } from '../lib/wake-intent.js';
import { ensureOffscreenVoiceHost } from './voice-host.js';
import { getSettings } from '../lib/settings.js';
import { logger } from '../lib/logger.js';
import {
  MSG_OVERLAY_STATE,
  MSG_ENGINE_START,
  MSG_ENGINE_STOP,
  MSG_ENGINE_CANCEL,
  STATE_IDLE,
  STATE_STARTING_MIC,
  STATE_LISTENING,
  STATE_UNDERSTANDING,
  STATE_READING_PAGE,
  STATE_SENDING,
  STATE_SENT,
  STATE_ERROR
} from '../lib/constants.js';

let activeSession = null;

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
    // Non-blocking
  }
}

/**
 * Handles VOICE_START event from hotkey content script.
 * @param {number} tabId
 */
export async function handleVoiceStart(tabId) {
  // Only one active session allowed at a time (PRD §6.2)
  if (activeSession) {
    logger.warn('session_ignored_already_active', { existingTabId: activeSession.tabId, newTabId: tabId });
    return;
  }

  const settings = await getSettings();
  if (!settings.enabled) return;

  activeSession = {
    tabId,
    state: STATE_STARTING_MIC,
    startTime: Date.now(),
    extractionPromise: extractJobContext(tabId), // Kicked off early in parallel (PRD §6.2)
    transcript: '',
    alternatives: []
  };

  logger.info('session_voice_start', { tabId });

  await notifyTabOverlay(tabId, {
    state: STATE_STARTING_MIC
  });

  const hostReady = await ensureOffscreenVoiceHost();
  if (!hostReady) {
    await notifyTabOverlay(tabId, {
      state: STATE_ERROR,
      message: 'Failed to initialize speech engine.'
    });
    activeSession = null;
    return;
  }

  // Start offscreen voice engine
  try {
    const lang = settings.language || 'en-IN';
    chrome.runtime.sendMessage({
      type: MSG_ENGINE_START,
      lang
    }).catch(() => {});
  } catch (err) {
    logger.error('session_engine_start_failed', { error: err.message });
    activeSession = null;
  }
}

/**
 * Handles incoming speech engine events from the offscreen host.
 * @param {Object} event
 */
export async function handleEngineEvent(event) {
  if (!activeSession) return;
  const tabId = activeSession.tabId;

  if (event.kind === 'audiostart') {
    activeSession.state = STATE_LISTENING;
    await notifyTabOverlay(tabId, {
      state: STATE_LISTENING,
      transcript: activeSession.transcript
    });
    logger.info('session_audio_started', { tabId });
  } else if (event.kind === 'interim') {
    activeSession.transcript = event.transcript || '';
    activeSession.alternatives = event.alternatives || [];
    if (activeSession.state === STATE_LISTENING) {
      await notifyTabOverlay(tabId, {
        state: STATE_LISTENING,
        transcript: activeSession.transcript
      });
    }
  } else if (event.kind === 'error') {
    activeSession.state = STATE_ERROR;
    let message = 'Something went wrong with speech recognition.';
    let action = null;

    if (event.errorCategory === 'MIC_DENIED') {
      message = 'Microphone access needed.';
      action = { type: 'options', title: 'Grant microphone' };
    } else if (event.errorCategory === 'NO_HARDWARE') {
      message = 'No microphone found.';
    } else if (event.errorCategory === 'NO_SPEECH') {
      message = "Didn't catch that. Hold the key and say 'Sara, tailor my resume'.";
    } else if (event.errorCategory === 'NETWORK_ERROR') {
      message = 'Speech recognition needs an internet connection.';
    }

    if (event.errorCategory !== 'ABORTED') {
      await notifyTabOverlay(tabId, {
        state: STATE_ERROR,
        message,
        action
      });
    }

    activeSession = null;
  }
}

/**
 * Handles VOICE_STOP event when user releases the hotkey.
 * @param {number} tabId
 */
export async function handleVoiceStop(tabId) {
  if (!activeSession || activeSession.tabId !== tabId) return;

  activeSession.state = STATE_UNDERSTANDING;
  logger.info('session_voice_stop', { tabId });

  // 1. Request final result from engine
  let finalResult = null;
  try {
    finalResult = await chrome.runtime.sendMessage({ type: MSG_ENGINE_STOP });
  } catch {
    // Non-blocking
  }

  const transcript = finalResult?.transcript || activeSession.transcript || '';
  const alternatives = finalResult?.alternatives || activeSession.alternatives || [transcript];

  // 2. Parse command & intent (PRD §5.3)
  const settings = await getSettings();
  const parsed = parseCommand(alternatives, {
    requireKeyword: settings.requireKeyword
  });

  if (!parsed.ok) {
    let errorMsg = "Didn't catch that.";
    if (parsed.reason === 'KEYWORD_MISSING') {
      errorMsg = parsed.heard
        ? `Didn't hear 'Sara'. Heard: "${parsed.heard}"`
        : "Didn't hear 'Sara'. Try: 'Sara, tailor my resume for this role.'";
    } else if (parsed.reason === 'UNSUPPORTED_INTENT') {
      errorMsg = "I can only tailor your resume for jobs on screen. Try: 'Sara, tailor my resume for this role.'";
    } else if (parsed.reason === 'NO_SPEECH') {
      errorMsg = "Didn't catch that. Hold the key and say 'Sara, tailor my resume'.";
    }

    await notifyTabOverlay(tabId, {
      state: STATE_ERROR,
      message: errorMsg
    });
    activeSession = null;
    return;
  }

  // 3. Extraction stage
  activeSession.state = STATE_READING_PAGE;
  await notifyTabOverlay(tabId, {
    state: STATE_READING_PAGE,
    transcript: parsed.heard
  });

  let jobCtx = null;
  try {
    jobCtx = await activeSession.extractionPromise;
  } catch {
    jobCtx = await extractJobContext(tabId);
  }

  if (!jobCtx?.description && !jobCtx?.url) {
    await notifyTabOverlay(tabId, {
      state: STATE_ERROR,
      message: "Couldn't find a job description on this page. Select the text and try again."
    });
    activeSession = null;
    return;
  }

  // 4. Message composition & hand-off
  activeSession.state = STATE_SENDING;
  await notifyTabOverlay(tabId, {
    state: STATE_SENDING
  });

  const message = composeMessage(jobCtx, {
    instruction: parsed.instruction,
    source: 'voice'
  });

  try {
    const handoff = await sendToHiregram({
      text: message,
      meta: {
        title: jobCtx.title,
        company: jobCtx.company,
        url: jobCtx.url
      }
    });

    await notifyTabOverlay(tabId, {
      state: STATE_SENT,
      message: 'Sent to Sara ✓'
    });

    logger.info('session_complete_success', { tabId, pendingId: handoff.id });
  } catch {
    await notifyTabOverlay(tabId, {
      state: STATE_ERROR,
      message: 'Failed to deliver to Hiregram.'
    });
  } finally {
    activeSession = null;
  }
}

/**
 * Handles VOICE_CANCEL event.
 * @param {number} tabId
 * @param {string} reason
 */
export async function handleVoiceCancel(tabId, reason = 'unknown') {
  if (activeSession && activeSession.tabId === tabId) {
    logger.info('session_cancelled', { tabId, reason });
    chrome.runtime.sendMessage({ type: MSG_ENGINE_CANCEL }).catch(() => {});
    if (reason !== 'too_short') {
      await notifyTabOverlay(tabId, {
        state: STATE_IDLE
      });
    }
    activeSession = null;
  }
}

/**
 * Executes direct tailoring pipeline (toolbar click / context menu).
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
      tabCreated: handoffResult.tabId
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
