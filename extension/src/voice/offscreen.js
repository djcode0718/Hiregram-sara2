/**
 * Offscreen Document Voice Host
 * Manages WebSpeechEngine and forwards speech events to service worker.
 */

import { WebSpeechEngine } from './voice-engine.js';
import {
  MSG_ENGINE_START,
  MSG_ENGINE_STOP,
  MSG_ENGINE_CANCEL,
  MSG_ENGINE_EVENT
} from '../lib/constants.js';

let engine = null;

function getEngine() {
  if (!engine) {
    engine = new WebSpeechEngine();

    engine.onAudioStart = () => {
      chrome.runtime.sendMessage({
        type: MSG_ENGINE_EVENT,
        kind: 'audiostart'
      }).catch(() => {});
    };

    engine.onInterim = ({ transcript, alternatives }) => {
      chrome.runtime.sendMessage({
        type: MSG_ENGINE_EVENT,
        kind: 'interim',
        transcript,
        alternatives
      }).catch(() => {});
    };

    engine.onError = ({ category, raw, message }) => {
      chrome.runtime.sendMessage({
        type: MSG_ENGINE_EVENT,
        kind: 'error',
        errorCategory: category,
        rawError: raw,
        errorMessage: message
      }).catch(() => {});
    };

    engine.onEnd = ({ transcript, alternatives }) => {
      chrome.runtime.sendMessage({
        type: MSG_ENGINE_EVENT,
        kind: 'end',
        transcript,
        alternatives
      }).catch(() => {});
    };
  }
  return engine;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Production Voice Engine Messages
  if (message.type === MSG_ENGINE_START) {
    const speech = getEngine();
    const success = speech.start({ lang: message.lang || 'en-IN' });
    sendResponse({ ok: success });
    return true;
  }

  if (message.type === MSG_ENGINE_STOP) {
    if (engine) {
      engine.stop().then((result) => {
        sendResponse({ ok: true, ...result });
      }).catch((err) => {
        sendResponse({ ok: false, error: err.message });
      });
      return true;
    }
    sendResponse({ ok: false, error: 'Engine not active' });
    return true;
  }

  if (message.type === MSG_ENGINE_CANCEL) {
    if (engine) {
      engine.cancel();
    }
    sendResponse({ ok: true });
    return true;
  }

  // Backwards compatibility with spike page
  if (message.type === 'SPIKE_START_RECOGNITION') {
    const speech = getEngine();
    const success = speech.start({ lang: message.lang || 'en-US' });
    sendResponse({ ok: success });
    return true;
  }

  if (message.type === 'SPIKE_STOP_RECOGNITION') {
    if (engine) {
      engine.stop().then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
      return true;
    }
    sendResponse({ ok: false });
    return true;
  }

  if (message.type === 'SPIKE_ABORT_RECOGNITION') {
    if (engine) engine.cancel();
    sendResponse({ ok: true });
    return true;
  }
});
