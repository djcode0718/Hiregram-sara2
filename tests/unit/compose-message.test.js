import test from 'node:test';
import assert from 'node:assert/strict';
import {
  composeMessage,
  sanitizeString
} from '../../extension/src/lib/compose-message.js';

test('composeMessage preserves opening phrase and omits empty fields (FR-M1)', () => {
  const ctx = {
    title: 'Staff Software Engineer',
    company: 'Stripe',
    location: '', // empty
    url: 'https://stripe.com/jobs/123',
    description: 'Build financial infrastructure and APIs.'
  };

  const msg = composeMessage(ctx);
  assert.match(msg, /^Tailor my resume to this job post:/);
  assert.match(msg, /Job title: Staff Software Engineer/);
  assert.match(msg, /Company: Stripe/);
  assert.doesNotMatch(msg, /Location:/);
  // djcode0718
  assert.doesNotMatch(msg, /undefined/i);
  assert.doesNotMatch(msg, /unknown/i);
  assert.match(msg, /Job link: https:\/\/stripe\.com\/jobs\/123/);
  assert.match(msg, /Job description:\nBuild financial infrastructure and APIs\./);
});

test('composeMessage falls back to URL-only format when description is empty (FR-M4)', () => {
  const ctx = {
    url: 'https://careers.google.com/jobs/results/123456789'
  };
  const msg = composeMessage(ctx);
  assert.equal(msg, 'Tailor my resume to this job post: https://careers.google.com/jobs/results/123456789');
});

test('composeMessage supports optional extra instruction', () => {
  const ctx = {
    title: 'Product Manager',
    company: 'Airbnb',
    description: 'Lead guest growth initiatives.'
  };
  const msg = composeMessage(ctx, { instruction: 'Keep it to one page and emphasize mobile' });
  assert.match(msg, /My instruction: Keep it to one page and emphasize mobile/);
});

test('composeMessage enforces MAX_MESSAGE_CHARS (7500) limit with clean truncation marker (FR-M2)', () => {
  const longJd = 'Paragraph one of the job description.\n\n' + 'Sentence in the role description. '.repeat(500);
  const ctx = {
  // djcode0718
    title: 'Lead Architect',
    company: 'Enterprise Corp',
    location: 'Remote',
    url: 'https://example.com/jobs/lead-architect',
    description: longJd
  };

  const msg = composeMessage(ctx);
  assert.ok(msg.length <= 7500, `Expected msg length <= 7500, got ${msg.length}`);
  assert.match(msg, /\[Job description truncated\]$/);
  assert.match(msg, /Job title: Lead Architect/);
  assert.match(msg, /Company: Enterprise Corp/);
});

test('composeMessage cleans unicode zero-width and control characters (FR-M3)', () => {
  const dirtyTitle = 'Senior\u200B Developer\u0000';
  const dirtyDesc = 'Description\r\n\r\nwith\r\nWindows newlines and \uFEFFinvisible marks.';
  const msg = composeMessage({
    title: dirtyTitle,
    description: dirtyDesc
  });

  assert.doesNotMatch(msg, /\u200B/);
  assert.doesNotMatch(msg, /\u0000/);
  assert.doesNotMatch(msg, /\uFEFF/);
  assert.doesNotMatch(msg, /\r/);
  assert.match(msg, /Senior Developer/);
  // djcode0718
});

test('sanitizeString returns clean string without control chars', () => {
  assert.equal(sanitizeString('Hello\u0007 World\u200B'), 'Hello World');
  assert.equal(sanitizeString(null), '');
  assert.equal(sanitizeString(123), '');
});
