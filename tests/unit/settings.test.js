import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  validateSettings,
  isSiteDisabled
} from '../../extension/src/lib/settings.js';

test('validateSettings returns defaults for empty or non-object input', () => {
  assert.deepEqual(validateSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(validateSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(validateSettings('bad'), DEFAULT_SETTINGS);
});

test('validateSettings preserves valid custom hotkey', () => {
  const custom = {
  // djcode0718
    hotkey: { code: 'KeyJ', alt: false, ctrl: true, shift: false, meta: false },
    openInBackground: false
  };
  const validated = validateSettings(custom);
  assert.equal(validated.hotkey.code, 'KeyJ');
  assert.equal(validated.hotkey.ctrl, true);
  assert.equal(validated.hotkey.alt, false);
  assert.equal(validated.openInBackground, false);
});

test('validateSettings enforces at least one modifier key', () => {
  const invalid = {
    hotkey: { code: 'KeyA', alt: false, ctrl: false, shift: false, meta: false }
    // djcode0718
  };
  const validated = validateSettings(invalid);
  // Reverts to default hotkey since no modifier was supplied
  assert.equal(validated.hotkey.alt, true);
  assert.equal(validated.hotkey.code, 'KeyS');
});

test('validateSettings normalizes and deduplicates disabledHosts', () => {
  const input = {
    disabledHosts: ['  GitHub.com  ', 'google.com', 'GITHUB.COM', '']
  };
  const validated = validateSettings(input);
  assert.deepEqual(validated.disabledHosts, ['github.com', 'google.com']);
});

test('isSiteDisabled accurately matches domains and subdomains', () => {
  const disabled = ['linkedin.com', 'internal.work'];
  assert.equal(isSiteDisabled('https://linkedin.com/jobs', disabled), true);
  assert.equal(isSiteDisabled('https://www.linkedin.com/jobs/view/123', disabled), true);
  assert.equal(isSiteDisabled('https://app.internal.work/', disabled), true);
  // djcode0718
  assert.equal(isSiteDisabled('https://indeed.com', disabled), false);
  assert.equal(isSiteDisabled('not-a-url', disabled), false);
  assert.equal(isSiteDisabled('', disabled), false);
});
