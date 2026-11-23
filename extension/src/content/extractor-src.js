/**
 * Job Context Extractor
 * Multi-layer job posting extraction:
 * Layer 1: User selection (>= 80 chars)
 * Layer 2: JSON-LD JobPosting schema
 * Layer 3: Site adapters (LinkedIn, Wellfound, Naukri, Indeed, Greenhouse, Lever, Ashby, Workday, Instahyre)
 * Layer 4: Generic semantic heuristics & open Shadow DOM traversal
 * Layer 5: Cleaned page-text fallback
 */

import { htmlToText, cleanWhitespace } from '../lib/html-to-text.js';
import { getCanonicalJobUrl } from '../lib/url-utils.js';

const HEURISTIC_KEYWORDS = [
  'responsibilities',
  'requirements',
  'qualifications',
  'about the role',
  'what you will do',
  'what you\'ll do',
  'who you are',
  'benefits',
  'experience',
  'skills',
  'about us',
  'job description',
  'duties',
  'what we offer'
];

/**
 * Traverses an element and any open shadow roots.
 * @param {Element} root
 * @param {(el: Element) => void} callback
 */
function traverseDomAndShadow(root, callback) {
  if (!root || root.nodeType !== 1) return;
  callback(root);

  // Traverse open shadow root if present
  if (root.shadowRoot) {
    for (let c = root.shadowRoot.firstElementChild; c; c = c.nextElementSibling) {
      traverseDomAndShadow(c, callback);
    }
  }

  for (let child = root.firstElementChild; child; child = child.nextElementSibling) {
    traverseDomAndShadow(child, callback);
  }
}

/**
 * Finds text from a list of selector fallbacks.
 * @param {ParentNode} doc
 * @param {string[]} selectors
 * @returns {string}
 */
function findFirstText(doc, selectors) {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) {
        const text = el.textContent?.trim() || '';
        if (text) return text;
      }
    } catch {
      // Ignore invalid or unsupported selector
    }
  }
  return '';
}

/**
 * Parses all JSON-LD blocks and returns the first valid JobPosting entity.
 * @param {Document} doc
 * @returns {Record<string, unknown> | null}
 */
export function extractJsonLdJob(doc) {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const content = script.textContent?.trim();
      if (!content) continue;
      const parsed = JSON.parse(content);

      const items = Array.isArray(parsed)
        ? parsed
        : parsed['@graph'] && Array.isArray(parsed['@graph'])
          ? parsed['@graph']
          : [parsed];

      for (const item of items) {
        if (!item || typeof item !== 'object') continue;
        const type = item['@type'];
        const isJob = Array.isArray(type)
          ? type.includes('JobPosting')
          : type === 'JobPosting';

        if (isJob) return item;

        if (item.mainEntity && typeof item.mainEntity === 'object') {
          const mainType = item.mainEntity['@type'];
          if (mainType === 'JobPosting') return item.mainEntity;
        }
      }
    } catch {
      // Soft-fail invalid JSON blocks
    }
  }
  return null;
}

/**
 * Parses JSON-LD location representation into string.
 * @param {unknown} loc
 * @returns {string}
 */
function parseJsonLdLocation(loc) {
  if (!loc) return '';
  if (typeof loc === 'string') return loc.trim();
  if (Array.isArray(loc)) {
    return loc.map(parseJsonLdLocation).filter(Boolean).join(', ');
  }
  if (typeof loc === 'object') {
    const addr = loc.address;
    if (typeof addr === 'string') return addr.trim();
    if (addr && typeof addr === 'object') {
      const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry]
        .filter((p) => typeof p === 'string' && p.trim().length > 0)
        .map((p) => p.trim());
      if (parts.length > 0) return parts.join(', ');
    }
  }
  return '';
}

/**
 * Site-specific adapters for major platforms.
 * @param {Document} doc
 * @param {string} hostname
 * @returns {Partial<JobContext> | null}
 */
export function extractSiteAdapter(doc, hostname) {
  const host = hostname.toLowerCase();

  // 1. LinkedIn
  if (host.includes('linkedin.com')) {
    const title = findFirstText(doc, [
      '.job-details-jobs-unified-top-card__job-title',
      '.jobs-unified-top-card__job-title',
      'h1.top-card-layout__title',
      'h1.t-24',
      '.jobs-details__main-content h1'
    ]);
    const company = findFirstText(doc, [
      '.job-details-jobs-unified-top-card__company-name',
      '.jobs-unified-top-card__company-name',
      '.topcard__org-name-link',
      '.jobs-details__main-content .job-details-jobs-unified-top-card__primary-description-container a'
    ]);
    const location = findFirstText(doc, [
      '.job-details-jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__bullet',
      '.topcard__flavor--bullet'
    ]);
    const descEl = doc.querySelector('#job-details') ||
      doc.querySelector('.jobs-description__content') ||
      doc.querySelector('.jobs-description-content__text') ||
      doc.querySelector('.show-more-less-html__markup');
    const description = descEl ? htmlToText(descEl) : '';

    return {
      source: 'adapter:linkedin',
      title,
      company,
      location,
      description
    };
  }

  // 2. Wellfound
  if (host.includes('wellfound.com') || host.includes('angel.co')) {
    return {
      source: 'adapter:wellfound',
      title: findFirstText(doc, ['[data-test="JobTitle"]', 'h1', '.job-title']),
      company: findFirstText(doc, ['[data-test="StartupName"]', '[data-test="CompanyName"]', 'header h2']),
      location: findFirstText(doc, ['[data-test="JobLocation"]', '.location']),
      description: htmlToText(doc.querySelector('[data-test="JobDescription"]') || doc.querySelector('.styles_jobDescription__') || '')
    };
  }

  // 3. Naukri
  if (host.includes('naukri.com')) {
    return {
      source: 'adapter:naukri',
      title: findFirstText(doc, ['h1.styles_jd-header-title__', '.jd-header-title', 'h1.title']),
      company: findFirstText(doc, ['.styles_jd-header-comp-name__ a', '.jd-header-comp-name', '.comp-name']),
      location: findFirstText(doc, ['.styles_jhc__location__', '.location .loc', '.loc span']),
      description: htmlToText(doc.querySelector('.styles_JDJobs-rec-desc__') || doc.querySelector('.job-desc') || '')
    };
  }

  // 4. Indeed
  if (host.includes('indeed.com')) {
    return {
      source: 'adapter:indeed',
      title: findFirstText(doc, ['h1.jobsearch-JobInfoHeader-title', '[data-testid="jobsearch-JobInfoHeader-title"]', 'h1']),
      company: findFirstText(doc, ['[data-testid="inlineHeader-companyName"]', '.jobsearch-InlineCompanyRating-companyHeader']),
      location: findFirstText(doc, ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]']),
      description: htmlToText(doc.querySelector('#jobDescriptionText') || doc.querySelector('.jobsearch-JobComponent-description') || '')
    };
  }

  // 5. Greenhouse
  if (host.includes('greenhouse.io')) {
    return {
      source: 'adapter:greenhouse',
      title: findFirstText(doc, ['.app-title', 'h1.job-title', 'h1#app-title', 'h1']),
      company: findFirstText(doc, ['.company-name', '.org-name']),
      location: findFirstText(doc, ['.location', '.job-location']),
      description: htmlToText(doc.querySelector('#content') || doc.querySelector('#job-description') || '')
    };
  }

  // 6. Lever
  if (host.includes('lever.co')) {
    const logoImg = doc.querySelector('.main-header-logo img[alt]');
    const company = logoImg ? logoImg.getAttribute('alt') : findFirstText(doc, ['.posting-headline .company']);
    return {
      source: 'adapter:lever',
      title: findFirstText(doc, ['.posting-headline h2', 'h2', 'h1']),
      company,
      location: findFirstText(doc, ['.posting-category.location', '.sort-by-time.posting-category']),
      description: htmlToText(doc.querySelector('.section.page-centered[data-qa="job-description"]') || doc.querySelector('.content-wrapper') || '')
    };
  }

  // 7. Ashby
  if (host.includes('ashbyhq.com')) {
    return {
      source: 'adapter:ashby',
      title: findFirstText(doc, ['h1', '[class*="heading"]']),
      company: findFirstText(doc, ['[class*="companyName"]', 'header a']),
      location: findFirstText(doc, ['[class*="location"]', '[class*="department"]']),
      description: htmlToText(doc.querySelector('[class*="description"]') || doc.querySelector('[class*="JobPosting-body"]') || '')
    };
  }

  // 8. Workday
  if (host.includes('myworkdayjobs.com')) {
    return {
      source: 'adapter:workday',
      title: findFirstText(doc, ['[data-automation-id="jobPostingHeader"]', 'h2[data-automation-id="jobTitle"]', 'h1']),
      company: findFirstText(doc, ['[data-automation-id="companyName"]']),
      location: findFirstText(doc, ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]']),
      description: htmlToText(doc.querySelector('[data-automation-id="jobPostingDescription"]') || '')
    };
  }

  // 9. Instahyre
  if (host.includes('instahyre.com')) {
    return {
      source: 'adapter:instahyre',
      title: findFirstText(doc, ['.job-title', 'h1']),
      company: findFirstText(doc, ['.company-name', '.employer-name']),
      location: findFirstText(doc, ['.job-location', '.location']),
      description: htmlToText(doc.querySelector('#job-description') || doc.querySelector('.description') || '')
    };
  }

  return null;
}

/**
 * Evaluates semantic content containers to find the best candidate job description.
 * @param {Document} doc
 * @returns {{ description: string, score: number }}
 */
function evaluateContentHeuristics(doc) {
  const candidateElements = [];
  const visited = new Set();

  traverseDomAndShadow(doc.body, (el) => {
    if (!el || visited.has(el)) return;
    visited.add(el);

    const tag = el.tagName?.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NAV' || tag === 'FOOTER' || tag === 'HEADER') {
      return;
    }

    const isSemanticBlock = tag === 'MAIN' || tag === 'ARTICLE' || el.getAttribute('role') === 'main';
    const textLen = el.textContent?.length || 0;

    if (isSemanticBlock || textLen >= 400) {
      candidateElements.push(el);
    }
  });

  let bestEl = null;
  let bestScore = -Infinity;

  for (const el of candidateElements) {
    const text = el.textContent || '';
    if (text.length < 300) continue;

    const lower = text.toLowerCase();
    let score = 0;

    // Match keywords
    for (const kw of HEURISTIC_KEYWORDS) {
      if (lower.includes(kw)) {
        score += 80;
      }
    }

    // Link density penalty
    const links = el.querySelectorAll('a');
    let linkTextLen = 0;
    for (const a of links) {
      linkTextLen += a.textContent?.length || 0;
    }
    const linkDensity = linkTextLen / (text.length || 1);
    if (linkDensity > 0.4) {
      score -= 300;
    } else {
      score -= linkDensity * 100;
    }

    // Tag bonuses / penalties
    const tag = el.tagName?.toUpperCase();
    if (tag === 'ARTICLE' || tag === 'MAIN') score += 100;
    if (el.closest('nav, footer, aside')) score -= 250;

    // Length score: favor medium-to-large descriptive blocks
    score += Math.min(text.length / 20, 150);

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  if (bestEl && bestScore > 0) {
    return {
      description: htmlToText(bestEl),
      score: bestScore
    };
  }

  return { description: '', score: 0 };
}

/**
 * Extracts job posting details from a document.
 * @param {Document} doc
 * @param {Window} win
 * @returns {JobContext}
 */
export function extractJobContextFromDocument(doc, win) {
  const startTime = Date.now();
  const warnings = [];
  const pageUrl = win.location?.href || doc.location?.href || '';
  const hostname = win.location?.hostname || '';

  // Safe "See more" expansion attempt (FR-E10)
  try {
    const seeMoreBtn = doc.querySelector('.jobs-description__footer-button, button.show-more-less-html__button--more');
    if (seeMoreBtn && typeof seeMoreBtn.click === 'function') {
      seeMoreBtn.click();
    }
  } catch {
    // Non-blocking
  }

  // --- Layer 1: User selection ---
  let selectedText = '';
  try {
    selectedText = win.getSelection()?.toString().trim() || '';
  } catch {
    // Ignore selection error
  }

  // --- Layer 2: JSON-LD ---
  const jsonLd = extractJsonLdJob(doc);
  let jsonTitle = '';
  let jsonCompany = '';
  let jsonLocation = '';
  let jsonEmploymentType = '';
  let jsonDescription = '';
  let jsonLdUrl = '';

  if (jsonLd) {
    jsonTitle = typeof jsonLd.title === 'string' ? jsonLd.title.trim() : '';
    if (jsonLd.hiringOrganization && typeof jsonLd.hiringOrganization === 'object') {
      jsonCompany = typeof jsonLd.hiringOrganization.name === 'string'
        ? jsonLd.hiringOrganization.name.trim()
        : '';
    }
    jsonLocation = parseJsonLdLocation(jsonLd.jobLocation);
    if (jsonLd.jobLocationType === 'TELECOMMUTE' && !jsonLocation.toLowerCase().includes('remote')) {
      jsonLocation = jsonLocation ? `${jsonLocation} (Remote)` : 'Remote';
    }
    if (typeof jsonLd.employmentType === 'string') {
      jsonEmploymentType = jsonLd.employmentType.trim();
    }
    if (jsonLd.description) {
      jsonDescription = htmlToText(jsonLd.description);
    }
    if (typeof jsonLd.url === 'string') {
      jsonLdUrl = jsonLd.url;
    }
  }

  // --- Layer 3: Site Adapter ---
  const adapterResult = extractSiteAdapter(doc, hostname);

  // --- Layer 4: Generic Heuristics ---
  const heuristicResult = evaluateContentHeuristics(doc);

  // Generic metadata extraction
  let genericTitle = '';
  const h1 = doc.querySelector('h1');
  if (h1 && h1.textContent?.trim()) {
    genericTitle = h1.textContent.trim();
  } else {
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle) {
      genericTitle = ogTitle.split(/ at | - | \| | – | — /)[0].trim();
    } else if (doc.title) {
      genericTitle = doc.title.split(/ at | - | \| | – | — /)[0].trim();
    }
  }

  let genericCompany = '';
  const ogSiteName = doc.querySelector('meta[property="og:site_name"]')?.getAttribute('content');
  if (ogSiteName) {
    genericCompany = ogSiteName.trim();
  } else {
    const metaAuthor = doc.querySelector('meta[name="author"]')?.getAttribute('content');
    if (metaAuthor) {
      genericCompany = metaAuthor.trim();
    } else {
      // Hostname fallback (e.g. careers.stripe.com -> Stripe)
      const parts = hostname.replace(/^www\./, '').split('.');
      if (parts.length >= 2) {
        genericCompany = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
    }
  }

  // --- Merge Fields by Precedence (Selection -> JSON-LD -> Adapter -> Heuristics -> Page-text) ---
  let source = 'heuristic';
  let description = '';

  if (selectedText.length >= 80) {
    source = 'selection';
    description = cleanWhitespace(selectedText);
  } else if (jsonDescription && jsonDescription.length >= 50) {
    source = 'jsonld';
    description = jsonDescription;
  } else if (adapterResult?.description && adapterResult.description.length >= 50) {
    source = adapterResult.source || 'adapter';
    description = adapterResult.description;
  } else if (heuristicResult.description && heuristicResult.description.length >= 100) {
    source = 'heuristic';
    description = heuristicResult.description;
  } else {
    // Layer 5: Page-text fallback
    source = 'page-text';
    const bodyClone = doc.body ? doc.body.cloneNode(true) : null;
    if (bodyClone) {
      // Remove nav, footer, script, style
      const removes = bodyClone.querySelectorAll('script, style, noscript, nav, footer, aside, header');
      for (const r of removes) r.remove();
      description = htmlToText(bodyClone);
    }
  }

  const title = (jsonTitle || adapterResult?.title || genericTitle || '').trim();
  const company = (jsonCompany || adapterResult?.company || genericCompany || '').trim();
  const location = (jsonLocation || adapterResult?.location || '').trim();
  const employmentType = (jsonEmploymentType || adapterResult?.employmentType || '').trim();

  // Canonical URL
  const canonicalLink = doc.querySelector('link[rel="canonical"]')?.getAttribute('href');
  const url = getCanonicalJobUrl({
    pageUrl,
    jsonLdUrl,
    canonicalLinkUrl: canonicalLink
  });

  // Confidence Calculation (FR-E11)
  let confidence = 'low';
  if ((source.startsWith('adapter') || source === 'jsonld' || source === 'selection') && title && company && description.length >= 300) {
    confidence = 'high';
  } else if (description.length >= 300) {
    confidence = 'medium';
  }

  if (description.length < 150) {
    warnings.push('NO_JOB_DESCRIPTION_FOUND');
  }

  const elapsedMs = Date.now() - startTime;
  if (elapsedMs > 2500) {
    warnings.push('TIME_BUDGET_EXCEEDED');
  }

  return {
    source,
    title,
    company,
    location,
    employmentType,
    url,
    pageUrl,
    description,
    confidence,
    warnings
  };
}
