/**
 * Pure HTML to formatted plain-text converter.
 * Preserves paragraphs, line breaks, and list bullets.
 * Decodes HTML entities and strips unwanted tags (script, style, svg, noscript).
 * Works on DOM nodes or raw HTML strings without external libraries.
 */

const ENTITY_MAP = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&bull;': '• ',
  '&middot;': '· ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&trade;': '™',
  '&copy;': '©',
  '&reg;': '®'
};

/**
 * Decodes HTML entities in text.
 * @param {string} text
 * @returns {string}
 */
export function decodeHtmlEntities(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp|bull|middot|mdash|ndash|trade|copy|reg|#39);/gi, (match) => {
      const lower = match.toLowerCase();
      return ENTITY_MAP[lower] || match;
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(parseInt(dec, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCharCode(parseInt(hex, 16));
      } catch {
        return '';
      }
    });
}

/**
 * Converts a DOM node or HTML string to clean formatted plain text.
 * @param {Node|string} input
 * @returns {string}
 */
export function htmlToText(input) {
  if (!input) return '';

  if (typeof input === 'string') {
    return htmlStringToText(input);
  }

  if (typeof input === 'object' && input.nodeType !== undefined) {
    return domNodeToText(input);
  }

  return '';
}

/**
 * String-based HTML parser when a DOM node is not directly supplied.
 * Handles nested tags, bullets, paragraphs, and entity decoding.
 * @param {string} html
 * @returns {string}
 */
function htmlStringToText(html) {
  let s = html;

  // Strip scripts, styles, noscript, svg
  s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  s = s.replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
  s = s.replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '');

  // Convert list items to bullet lines
  s = s.replace(/<li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<\/li>/gi, '');

  // Convert break tags
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // Convert block elements to newlines
  s = s.replace(/<\/(p|div|section|article|h[1-6]|ul|ol|table|tr|blockquote)>/gi, '\n\n');
  s = s.replace(/<(p|div|section|article|h[1-6]|ul|ol|table|tr|blockquote)\b[^>]*>/gi, '\n');

  // Strip all other HTML tags
  s = s.replace(/<[^>]+>/g, '');

  // Decode entities
  s = decodeHtmlEntities(s);

  return cleanWhitespace(s);
}

/**
 * Walks a DOM tree and emits text preserving block breaks and list items.
 * @param {Node} root
 * @returns {string}
 */
function domNodeToText(root) {
  const IGNORED_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'NAV', 'FOOTER']);
  const BLOCK_TAGS = new Set([
    'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'MAIN',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'TABLE', 'TR', 'BLOCKQUOTE'
  ]);

  let result = '';

  function walk(node) {
    if (!node) return;

    if (node.nodeType === 3) { // Text node
      result += node.nodeValue || '';
      return;
    }

    if (node.nodeType === 1) { // Element
      const tag = node.tagName.toUpperCase();
      if (IGNORED_TAGS.has(tag)) return;

      if (tag === 'BR') {
        result += '\n';
        return;
      }

      if (tag === 'LI') {
        result += '\n- ';
      }

      for (let child = node.firstChild; child; child = child.nextSibling) {
        walk(child);
      }

      if (BLOCK_TAGS.has(tag)) {
        result += '\n\n';
      }
    }
  }

  walk(root);
  return cleanWhitespace(decodeHtmlEntities(result));
}

/**
 * Normalizes newlines and spaces, removing control & zero-width characters.
 * @param {string} text
 * @returns {string}
 */
export function cleanWhitespace(text) {
  if (!text) return '';
  return text
    // Remove control characters (except newline \n and tab \t) and zero-width chars
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '')
    // Normalize Windows line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Replace tabs with a single space
    .replace(/\t/g, ' ')
    // Collapse horizontal spaces
    .replace(/[^\S\n]+/g, ' ')
    // Clean up empty spaces around newlines
    .replace(/ *\n */g, '\n')
    // Collapse 3 or more consecutive newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
