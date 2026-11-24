/**
 * Pure resolver for finding the user's default resume on hiregram.ai/resume.
 * Pure function with no imports and no chrome.* usage.
 * Follows FR-H9..FR-H11.
 *
 * @param {Document} doc - The DOM document of the resume list page.
 * @returns {{ status: 'found' | 'loading' | 'empty' | 'no-default' | 'ambiguous', href?: string, source?: string, element?: HTMLElement }}
 */
export function findDefaultResumeTarget(doc) {
  if (!doc) {
    return { status: 'loading' };
  }

  // 1. Scope = section[aria-labelledby="rh-index"]
  let scope = doc.querySelector('section[aria-labelledby="rh-index"]');
  if (!scope) {
    // Fall back to nearest <ul> containing a[data-row-link]
    const rowLink = doc.querySelector('a[data-row-link]');
    if (rowLink) {
      scope = rowLink.closest('ul') || rowLink.closest('section') || doc.body;
    }
  }

  if (!scope) {
    return { status: 'loading' };
  }

  // 2. Rows = scope li elements that contain a[href] pointing to /resume/<id>
  const liElements = scope.querySelectorAll('li');
  const validRows = [];
  const RESUME_ID_REGEX = /^\/resume\/[A-Za-z0-9_-]{8,}\/?$/;

  for (const li of liElements) {
    const candidateLink = li.querySelector('a[data-row-link][href], a[href^="/resume/"]');
    if (!candidateLink) continue;

    let parsedPath = '';
    try {
      const urlObj = new URL(candidateLink.href, doc.location ? doc.location.origin : 'https://hiregram.ai');
      // Validate origin if location is present
      if (doc.location && urlObj.origin !== doc.location.origin) {
        continue;
      }
      parsedPath = urlObj.pathname;
      if (urlObj.search && urlObj.search.length > 1) {
        continue; // No query parameters allowed (R2.5)
      }
    } catch {
      continue;
    }

    if (RESUME_ID_REGEX.test(parsedPath)) {
      validRows.push({
        li,
        anchor: candidateLink,
        href: parsedPath
      });
    }
  }

  // If list container exists but has zero rows
  if (validRows.length === 0) {
    return { status: 'empty' };
  }

  // 3. Default marker detection
  // Must be EXACTLY the case-sensitive string "Default" (after trimming, removing trailing "·" or "•", collapsing spaces)
  // Ignore markers inside any button, [role=group], [role=menu], or hero card
  const markedRows = [];

  for (const row of validRows) {
    let isMarked = false;

    // Search paragraphs/spans inside this row
    const candidateElements = row.li.querySelectorAll('p, span');
    for (const el of candidateElements) {
      // Must not be inside button, [role="group"], [role="menu"]
      if (el.closest('button, [role="group"], [role="menu"], [class*="hero"], [data-hero]')) {
        continue;
      }

      // Check leaf elements (elements with no child elements, or direct text nodes)
      for (const node of el.childNodes) {
        if (node.nodeType === 3) { // Text node
          const rawText = node.nodeValue || '';
          const normalized = rawText
            .trim()
            .replace(/[·•]\s*$/, '')
            .trim()
            .replace(/\s+/g, ' ');

          if (normalized === 'Default') {
            isMarked = true;
            break;
          }
        }
      }

      if (isMarked) break;
    }

    if (isMarked) {
      markedRows.push(row);
    }
  }

  // 6. Evaluate findings
  if (markedRows.length === 1) {
    return {
      status: 'found',
      href: markedRows[0].href,
      source: 'list-default-marker',
      element: markedRows[0].anchor
    };
  }

  if (markedRows.length > 1) {
    // Ambiguous: more than one marked row
    // Log warning and use FIRST one only if inside main list
    return {
      status: 'ambiguous',
      href: markedRows[0].href,
      source: 'ambiguous-first-fallback',
      element: markedRows[0].anchor
    };
  }

  // 7. Fallback source: Hero card above list (R2.7)
  // ONLY if there is no marker in rows.
  // The hero card is outside the list scope (never inside scope or an li)
  // and its heading/label contains "YOUR DEFAULT" (case-insensitive).
  const candidateHeroContainers = doc.querySelectorAll('section, div, [class*="card"]');
  for (const container of candidateHeroContainers) {
    if (scope.contains(container)) {
      continue; // Never match inside the resume list scope
    }

    // Check if direct heading or label mentions "YOUR DEFAULT"
    const heading = container.querySelector('h1, h2, h3, h4, h5, h6, span, p');
    if (heading && /your default/i.test(heading.textContent || '')) {
      // Check if hero card has an anchor to /resume/<id>
      const heroLink = container.querySelector('a[href^="/resume/"]');
      if (heroLink) {
        try {
          const urlObj = new URL(heroLink.href, doc.location ? doc.location.origin : 'https://hiregram.ai');
          if ((!doc.location || urlObj.origin === doc.location.origin) && RESUME_ID_REGEX.test(urlObj.pathname) && !urlObj.search) {
            return {
              status: 'found',
              href: urlObj.pathname,
              source: 'hero-anchor',
              element: heroLink
            };
          }
        } catch {
          // Ignore
        }
      }

      // If it only has an "Open in editor" button
      const clickables = container.querySelectorAll('button, a, [role="button"]');
      for (const btn of clickables) {
        const text = (btn.textContent || '').trim();
        const aria = btn.getAttribute('aria-label') || '';
        if (/open in editor/i.test(text) || /open in editor/i.test(aria)) {
          return {
            status: 'found',
            source: 'hero-button',
            element: btn
          };
        }
      }
    }
  }

  // Zero marked rows with rows present
  return { status: 'no-default' };
}
