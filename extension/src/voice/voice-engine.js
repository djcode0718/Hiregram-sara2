/**
 * VoiceEngine interface and WebSpeechEngine implementation.
 * Follows PRD §5.2 (FR-V1..V9) and incorporates real-world speech findings:
 * - Default language: en-IN
 * - Concatenation of multiple final segments + trailing interim
 * - Multi-alternative preservation
 * - Timeout-safe stop() with last-interim fallback
 * - Canonical error mapping
 */

import { SPEECH_FINAL_TIMEOUT_MS } from '../lib/constants.js';

export const ERROR_CATEGORIES = Object.freeze({
  MIC_DENIED: 'MIC_DENIED',
  NO_HARDWARE: 'NO_HARDWARE',
  NO_SPEECH: 'NO_SPEECH',
  NETWORK_ERROR: 'NETWORK_ERROR',
  ABORTED: 'ABORTED',
  UNKNOWN: 'UNKNOWN'
});

/**
 * Maps Web Speech API event.error string to canonical error category.
 * @param {string} rawError
 * @returns {string}
 */
export function mapSpeechError(rawError) {
  switch (rawError) {
    case 'not-allowed':
    case 'service-not-allowed':
      return ERROR_CATEGORIES.MIC_DENIED;
    case 'audio-capture':
      return ERROR_CATEGORIES.NO_HARDWARE;
    case 'no-speech':
      return ERROR_CATEGORIES.NO_SPEECH;
    case 'network':
      return ERROR_CATEGORIES.NETWORK_ERROR;
    case 'aborted':
      return ERROR_CATEGORIES.ABORTED;
    default:
      return ERROR_CATEGORIES.UNKNOWN;
  }
}

/**
 * Base VoiceEngine interface.
 */
export class VoiceEngine {
  constructor() {
    this.onAudioStart = null;
    this.onInterim = null;
    this.onFinal = null;
    this.onError = null;
    this.onEnd = null;
  }

  start(_options = {}) {
    throw new Error('Not implemented');
  }

  stop() {
    throw new Error('Not implemented');
  }

  cancel() {
    throw new Error('Not implemented');
  }
}

/**
 * Web Speech API recognition implementation.
 */
export class WebSpeechEngine extends VoiceEngine {
  constructor() {
    super();
    this.recognition = null;
    this.isActive = false;
    this.finalSegments = [];
    this.lastInterim = '';
    this.allAlternatives = [];
    this.stopPromiseResolve = null;
    this.stopTimeoutId = null;
    this.hasReportedAudioStart = false;
  }

  start({ lang = 'en-IN', maxAlternatives = 3 } = {}) {
    const SpeechRec = typeof window !== 'undefined'
      ? (window.SpeechRecognition || window.webkitSpeechRecognition)
      : null;

    if (!SpeechRec) {
      const err = { category: ERROR_CATEGORIES.UNKNOWN, raw: 'SpeechRecognition not supported' };
      if (this.onError) this.onError(err);
      return false;
    }

    if (this.isActive) {
      this.cancel();
    }

    this.finalSegments = [];
    this.lastInterim = '';
    this.allAlternatives = [];
    this.hasReportedAudioStart = false;

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = maxAlternatives;
      this.recognition.lang = lang || 'en-IN';

      this.recognition.onaudiostart = () => {
        this.hasReportedAudioStart = true;
        if (this.onAudioStart) this.onAudioStart();
      };

      this.recognition.onresult = (event) => {
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res.isFinal) {
            const finalTxt = res[0]?.transcript?.trim() || '';
            if (finalTxt) {
              this.finalSegments.push(finalTxt);
            }
            // Capture alternatives from final result
            for (let a = 0; a < res.length; a++) {
              const alt = res[a]?.transcript?.trim();
              if (alt && !this.allAlternatives.includes(alt)) {
                this.allAlternatives.push(alt);
              }
            }
          } else {
            currentInterim += (res[0]?.transcript || '');
            for (let a = 0; a < res.length; a++) {
              const alt = res[a]?.transcript?.trim();
              if (alt && !this.allAlternatives.includes(alt)) {
                this.allAlternatives.push(alt);
              }
            }
          }
        }

        this.lastInterim = currentInterim.trim();

        // Build combined live transcript: all completed finals + current interim
        const combinedLive = [...this.finalSegments, this.lastInterim]
          .filter(Boolean)
          .join(' ')
          .trim();

        if (this.onInterim) {
          this.onInterim({
            transcript: combinedLive,
            alternatives: [...this.allAlternatives]
          });
        }
      };

      this.recognition.onerror = (event) => {
        const category = mapSpeechError(event.error);
        if (this.onError) {
          this.onError({ category, raw: event.error, message: event.message });
        }
      };

      this.recognition.onend = () => {
        this.isActive = false;

        // Build full final transcript: all finals + trailing interim if any
        const fullTranscript = [...this.finalSegments, this.lastInterim]
          .filter(Boolean)
          .join(' ')
          .trim();

        const allAlts = this.allAlternatives.length > 0 ? [...this.allAlternatives] : [];
        if (fullTranscript && !allAlts.includes(fullTranscript)) {
          allAlts.unshift(fullTranscript);
        }

        if (this.onEnd) {
          this.onEnd({
            transcript: fullTranscript,
            alternatives: allAlts.length > 0 ? allAlts : [fullTranscript]
          });
        }

        if (this.stopPromiseResolve) {
          if (this.stopTimeoutId) clearTimeout(this.stopTimeoutId);
          this.stopPromiseResolve({
            transcript: fullTranscript,
            alternatives: allAlts.length > 0 ? allAlts : [fullTranscript]
          });
          this.stopPromiseResolve = null;
        }

        this.recognition = null;
      };

      this.isActive = true;
      this.recognition.start();
      return true;
    } catch (err) {
      this.isActive = false;
      const category = ERROR_CATEGORIES.UNKNOWN;
      if (this.onError) {
        this.onError({ category, raw: err.name, message: err.message });
      }
      return false;
    }
  }

  /**
   * Gracefully stops recording, waiting for onend with a safety timeout.
   * @returns {Promise<{ transcript: string, alternatives: string[] }>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this.isActive || !this.recognition) {
        const transcript = [...this.finalSegments, this.lastInterim].filter(Boolean).join(' ').trim();
        return resolve({
          transcript,
          alternatives: this.allAlternatives.length > 0 ? this.allAlternatives : [transcript]
        });
      }

      this.stopPromiseResolve = resolve;

      // 2.5s safety timeout (FR-V5)
      this.stopTimeoutId = setTimeout(() => {
        if (this.stopPromiseResolve) {
          const fallback = [...this.finalSegments, this.lastInterim].filter(Boolean).join(' ').trim();
          this.stopPromiseResolve({
            transcript: fallback,
            alternatives: this.allAlternatives.length > 0 ? this.allAlternatives : [fallback]
          });
          this.stopPromiseResolve = null;
        }
        this.cancel();
      }, SPEECH_FINAL_TIMEOUT_MS);

      try {
        this.recognition.stop();
      } catch {
        this.cancel();
      }
    });
  }

  cancel() {
    this.isActive = false;
    if (this.stopTimeoutId) {
      clearTimeout(this.stopTimeoutId);
      this.stopTimeoutId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignore abort errors
      }
      this.recognition = null;
    }
  }
}
