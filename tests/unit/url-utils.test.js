import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanTrackingParams,
  getCanonicalJobUrl,
  isSameDomain
} from '../../extension/src/lib/url-utils.js';

test('cleanTrackingParams removes utm and tracking parameters while preserving job parameters', () => {
  const url = 'https://example.com/job/123?utm_source=twitter&utm_medium=cpc&ref=xyz&jobId=456&gh_jid=789';
  const cleaned = cleanTrackingParams(url);
  assert.equal(cleaned, 'https://example.com/job/123?jobId=456&gh_jid=789');
});

test('isSameDomain correctly matches subdomains and domains', () => {
  assert.equal(isSameDomain('https://jobs.lever.co/stripe', 'https://lever.co/about'), true);
  assert.equal(isSameDomain('https://boards.greenhouse.io/airbnb', 'https://greenhouse.io'), true);
  assert.equal(isSameDomain('https://linkedin.com/jobs', 'https://google.com/jobs'), false);
});

test('getCanonicalJobUrl applies LinkedIn currentJobId rule (FR-E7)', () => {
  const pageUrl = 'https://www.linkedin.com/jobs/search/?currentJobId=3991234567&geoId=103644278';
  const canonical = getCanonicalJobUrl({ pageUrl });
  assert.equal(canonical, 'https://www.linkedin.com/jobs/view/3991234567/');
});

test('getCanonicalJobUrl prefers valid JSON-LD url if on same domain (FR-E8)', () => {
  const pageUrl = 'https://jobs.ashbyhq.com/company/abc?utm_campaign=hiring';
  const jsonLdUrl = 'https://jobs.ashbyhq.com/company/abc';
  const canonical = getCanonicalJobUrl({ pageUrl, jsonLdUrl });
  assert.equal(canonical, 'https://jobs.ashbyhq.com/company/abc');
});
