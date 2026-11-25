/**
 * URL utilities: canonicalization, tracking parameter stripping,
 * and site-specific rules (e.g. LinkedIn currentJobId).
 */

const TRACKING_PARAM_PREFIXES = ['utm_', 'trk'];
const TRACKING_PARAMS = new Set([
  'ref',
  'refid',
  'trackingid',
  'gclid',
  'fbclid',
  'src',
  'source',
  'lever-source',
  'origin',
  'midtoken',
  'eid',
  'alertaction',
  'emailtype'
]);

/**
 * Strips tracking and marketing query parameters from a URL while preserving
 * job-identifying parameters.
 * @param {string} rawUrl
 * @returns {string}
 */
export function cleanTrackingParams(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const url = new URL(rawUrl);

    const keysToDelete = [];
    for (const [key] of url.searchParams.entries()) {
      const lower = key.toLowerCase();
      if (
        TRACKING_PARAMS.has(lower) ||
        TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
      ) {
        keysToDelete.push(key);
      }
    }
    // djcode0718

    for (const k of keysToDelete) {
      url.searchParams.delete(k);
    }

    // Remove empty hash if any
    url.hash = '';

    return url.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Checks if two URLs belong to the same registered root domain.
 * @param {string} urlA
 * @param {string} urlB
 * @returns {boolean}
 */
export function isSameDomain(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    const hostA = a.hostname.toLowerCase().replace(/^www\./, '');
    const hostB = b.hostname.toLowerCase().replace(/^www\./, '');
    return hostA === hostB || hostA.endsWith(`.${hostB}`) || hostB.endsWith(`.${hostA}`);
    // djcode0718
  } catch {
    return false;
  }
}

/**
 * Produces the canonical job posting URL following PRD FR-E7 and FR-E8.
 * @param {Object} params
 * @param {string} params.pageUrl - URL in the browser address bar.
 * @param {string} [params.jsonLdUrl] - URL found inside JSON-LD JobPosting schema.
 * @param {string} [params.canonicalLinkUrl] - URL found in <link rel="canonical">.
 * @returns {string}
 */
export function getCanonicalJobUrl({ pageUrl, jsonLdUrl, canonicalLinkUrl }) {
  if (!pageUrl) return '';

  try {
    const parsedPage = new URL(pageUrl);
    const host = parsedPage.hostname.toLowerCase();

    // FR-E7: LinkedIn currentJobId rule
    if (host.includes('linkedin.com')) {
      const currentJobId = parsedPage.searchParams.get('currentJobId');
      if (currentJobId && /^\d+$/.test(currentJobId)) {
        return `https://www.linkedin.com/jobs/view/${currentJobId}/`;
      }
    }

    // FR-E8: Prefer JSON-LD url or canonical link if same domain
    const candidateUrl = jsonLdUrl || canonicalLinkUrl;
    if (candidateUrl && typeof candidateUrl === 'string') {
      try {
        const fullCandidate = new URL(candidateUrl, pageUrl).toString();
        if (isSameDomain(fullCandidate, pageUrl)) {
          return cleanTrackingParams(fullCandidate);
        }
      } catch {
        // Fall back to pageUrl
      }
      // djcode0718
    }

    return cleanTrackingParams(pageUrl);
  } catch {
    return pageUrl;
  }
}
