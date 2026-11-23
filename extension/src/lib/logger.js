/**
 * Privacy-preserving in-memory ring-buffer logger.
 * Never logs transcripts, page content, or full query parameters.
 */

const MAX_LOG_ENTRIES = 100;
const logBuffer = [];

/**
 * Sanitizes URLs to origin + pathname only, omitting query parameters and fragments.
 * @param {string} rawUrl
 * @returns {string}
 */
export function sanitizeUrlForLog(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Formats a log entry safely without private data.
 * @param {'info' | 'warn' | 'error'} level
 * @param {string} event
 * @param {Record<string, unknown>} [details]
 */
function createEntry(level, event, details = {}) {
  const safeDetails = {};
  for (const [k, v] of Object.entries(details)) {
    if (k === 'url' || k === 'pageUrl') {
      safeDetails[k] = sanitizeUrlForLog(String(v));
    } else if (k === 'text' || k === 'transcript' || k === 'description' || k === 'selection') {
      safeDetails[`${k}Length`] = typeof v === 'string' ? v.length : 0;
    } else if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      safeDetails[k] = v;
    }
  }

  const entry = {
    ts: Date.now(),
    level,
    event,
    details: safeDetails
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_ENTRIES) {
    logBuffer.shift();
  }

  return entry;
}

export const logger = {
  info(event, details) {
    return createEntry('info', event, details);
  },
  warn(event, details) {
    return createEntry('warn', event, details);
  },
  error(event, details) {
    return createEntry('error', event, details);
  },
  getRecentLogs() {
    return [...logBuffer];
  },
  clear() {
    logBuffer.length = 0;
  }
};
