/**
 * User settings management and validation for Hiregram Tailor.
 */

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  hotkey: {
    code: 'KeyS',
    alt: true,
    ctrl: false,
    shift: false,
    meta: false
  },
  language: 'en-IN', // Default en-IN as requested
  requireKeyword: true,
  openInBackground: true,
  disabledHosts: [],
  showHints: true,
  debug: false,
  schemaVersion: 1
});

/**
 * Validates and normalizes settings object against schema.
 * @param {unknown} input
 * @returns {typeof DEFAULT_SETTINGS}
 */
export function validateSettings(input) {
  if (!input || typeof input !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const s = input;

  const enabled = typeof s.enabled === 'boolean' ? s.enabled : DEFAULT_SETTINGS.enabled;

  let hotkey = { ...DEFAULT_SETTINGS.hotkey };
  if (s.hotkey && typeof s.hotkey === 'object') {
    const code = typeof s.hotkey.code === 'string' && s.hotkey.code.trim().length > 0
      ? s.hotkey.code.trim()
      : DEFAULT_SETTINGS.hotkey.code;
    const alt = Boolean(s.hotkey.alt);
    const ctrl = Boolean(s.hotkey.ctrl);
    const shift = Boolean(s.hotkey.shift);
    const meta = Boolean(s.hotkey.meta);

    // Require at least one modifier
    if (alt || ctrl || shift || meta) {
      hotkey = { code, alt, ctrl, shift, meta };
    }
  }

  const language = typeof s.language === 'string' && s.language.trim().length > 0
    ? s.language.trim()
    : DEFAULT_SETTINGS.language;

  const requireKeyword = typeof s.requireKeyword === 'boolean'
    ? s.requireKeyword
    : DEFAULT_SETTINGS.requireKeyword;

  const openInBackground = typeof s.openInBackground === 'boolean'
    ? s.openInBackground
    : DEFAULT_SETTINGS.openInBackground;

  let disabledHosts = DEFAULT_SETTINGS.disabledHosts;
  if (Array.isArray(s.disabledHosts)) {
    disabledHosts = [...new Set(
      s.disabledHosts
        .filter((h) => typeof h === 'string' && h.trim().length > 0)
        .map((h) => h.trim().toLowerCase())
    )];
  }

  const showHints = typeof s.showHints === 'boolean'
    ? s.showHints
    : DEFAULT_SETTINGS.showHints;

  const debug = typeof s.debug === 'boolean'
    ? s.debug
    : DEFAULT_SETTINGS.debug;

  return {
    enabled,
    hotkey,
    language,
    requireKeyword,
    openInBackground,
    disabledHosts,
    showHints,
    debug,
    schemaVersion: 1
  };
}

/**
 * Loads settings from chrome.storage.sync with fallback to defaults.
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function getSettings() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      const data = await chrome.storage.sync.get('settings');
      return validateSettings(data?.settings);
    }
  } catch {
    // Fallback if storage access throws
  }
  return { ...DEFAULT_SETTINGS };
}

/**
 * Updates settings in chrome.storage.sync.
 * @param {Partial<typeof DEFAULT_SETTINGS>} partial
 * @returns {Promise<typeof DEFAULT_SETTINGS>}
 */
export async function updateSettings(partial) {
  const current = await getSettings();
  const merged = validateSettings({ ...current, ...partial });
  if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
    await chrome.storage.sync.set({ settings: merged });
  }
  return merged;
}

/**
 * Checks if a URL hostname is in the disabled hosts list.
 * @param {string} urlString
 * @param {string[]} disabledHosts
 * @returns {boolean}
 */
export function isSiteDisabled(urlString, disabledHosts = []) {
  if (!urlString || !Array.isArray(disabledHosts) || disabledHosts.length === 0) {
    return false;
  }
  try {
    const parsed = new URL(urlString);
    const host = parsed.hostname.toLowerCase();
    return disabledHosts.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}
