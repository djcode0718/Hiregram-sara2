/**
 * Central constants for Hiregram Tailor.
 */

// Hiregram Target URLs
export const HIREGRAM_URL = 'https://hiregram.ai/resume/7c284c1a-26b8-41fd-97fb-210fe973f904';
export const HIREGRAM_ORIGINS = ['https://hiregram.ai', 'https://www.hiregram.ai'];
export const TAB_PATTERNS = [
  'https://hiregram.ai/resume*',
  'https://www.hiregram.ai/resume*'
];

// Selectors for Sara's chat interface on hiregram.ai
export const TEXTAREA_SELECTORS = [
  'textarea[data-chat-box]',
  'textarea[aria-label="Message Sara"]',
  '.rs-as-composer textarea',
  '.rs-as-field textarea',
  'textarea[placeholder*="Message Sara" i]',
  'textarea[placeholder*="Sara" i]',
  'div[role="textbox"][aria-label*="Sara" i]',
  'textarea'
];

export const SEND_BUTTON_SELECTORS = [
  'button.rs-as-send',
  'button[aria-label="Send"]',
  'button[data-tip="Send"]',
  'button[aria-label*="Send" i]',
  'button[type="submit"]',
  'button:has(svg)'
];

export const CHAT_CONTAINER_SELECTORS = [
  '[data-chat-container]',
  '.chat-container',
  'main',
  '#root'
];

// Limits & Budgets
export const MAX_MESSAGE_CHARS = 7500;
export const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const SEND_POLL_TIMEOUT_MS = 8000;
export const SEND_POLL_INTERVAL_MS = 150;
export const CHAT_BOX_WAIT_TIMEOUT_MS = 120000; // 2 minutes
export const LIST_PAGE_WAIT_TIMEOUT_MS = 10000; // 10 seconds
export const RESTRICTED_BADGE_CLEAR_MS = 4000;
export const OVERLAY_SUCCESS_DISMISS_MS = 2500;
export const OVERLAY_ERROR_DISMISS_MS = 6000;
export const MIN_HOLD_DURATION_MS = 350;
export const MAX_RECORDING_DURATION_MS = 30000;
export const SPEECH_FINAL_TIMEOUT_MS = 2500;
export const EXTRACTION_TIMEOUT_MS = 2500;

// Hand-off Text & Tokens
export const DEFAULT_RESUME_SECTION_TEXT = 'YOUR DEFAULT';
export const OPEN_IN_EDITOR_TEXT = 'Open in editor';

// Internal Message Types
export const MSG_VOICE_START = 'VOICE_START';
export const MSG_VOICE_STOP = 'VOICE_STOP';
export const MSG_VOICE_CANCEL = 'VOICE_CANCEL';
export const MSG_OVERLAY_STATE = 'OVERLAY_STATE';
export const MSG_ENGINE_START = 'ENGINE_START';
export const MSG_ENGINE_STOP = 'ENGINE_STOP';
export const MSG_ENGINE_CANCEL = 'ENGINE_CANCEL';
export const MSG_ENGINE_EVENT = 'ENGINE_EVENT';
export const MSG_HANDOFF_RESULT = 'HANDOFF_RESULT';
export const MSG_CLAIM_PENDING = 'CLAIM_PENDING';

// Session State Names
export const STATE_IDLE = 'idle';
export const STATE_STARTING_MIC = 'starting-mic';
export const STATE_LISTENING = 'listening';
export const STATE_UNDERSTANDING = 'understanding';
export const STATE_READING_PAGE = 'reading-page';
export const STATE_SENDING = 'sending';
export const STATE_SENT = 'sent';
export const STATE_ERROR = 'error';
export const STATE_HINT = 'hint';

// Storage Keys
export const STORAGE_KEY_PENDING = 'pending';
export const STORAGE_KEY_SETTINGS = 'settings';
export const STORAGE_KEY_SESSION = 'active_session';
