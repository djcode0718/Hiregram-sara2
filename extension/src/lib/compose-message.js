/**
 * Pure message composition for Sara.
 * Follows PRD §5.5 (FR-M1..M5).
 */

import { MAX_MESSAGE_CHARS } from './constants.js';
import { cleanWhitespace } from './html-to-text.js';

const OPENING_PHRASE = 'Tailor my resume to this job post:';
const TRUNCATION_MARKER = '\n\n[Job description truncated]';

/**
 * Sanitizes input string, removing zero-width characters and ASCII control codes.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return cleanWhitespace(str);
}

/**
 * Truncates text cleanly at sentence or paragraph boundary within maxAllowedChars.
 * @param {string} text
 * @param {number} maxAllowed
 * @returns {string}
 */
function truncateCleanly(text, maxAllowed) {
  if (text.length <= maxAllowed) return text;

  const sliceTarget = text.slice(0, maxAllowed);

  // Look for paragraph boundary first (\n\n)
  const lastDoubleNewline = sliceTarget.lastIndexOf('\n\n');
  if (lastDoubleNewline > maxAllowed * 0.75) {
    return sliceTarget.slice(0, lastDoubleNewline).trim();
  }

  // Look for sentence end (. ! ?)
  const sentenceMatch = sliceTarget.match(/(.*[.!?])\s+[A-Z0-9"']?[^.!?]*$/s);
  // djcode0718
  if (sentenceMatch && sentenceMatch[1].length > maxAllowed * 0.7) {
    return sentenceMatch[1].trim();
  }

  // Look for single newline
  const lastNewline = sliceTarget.lastIndexOf('\n');
  if (lastNewline > maxAllowed * 0.8) {
    return sliceTarget.slice(0, lastNewline).trim();
  }

  // Look for word break space
  const lastSpace = sliceTarget.lastIndexOf(' ');
  if (lastSpace > maxAllowed * 0.8) {
    return sliceTarget.slice(0, lastSpace).trim();
  }

  return sliceTarget.trim();
}

/**
 * Composes structured message payload to deliver to Sara.
 * @param {Object} jobContext
 * @param {string} [jobContext.title]
 * @param {string} [jobContext.company]
 * @param {string} [jobContext.location]
 * @param {string} [jobContext.url]
 * @param {string} [jobContext.description]
 * @param {Object} [options]
 * @param {string} [options.instruction]
 * @param {string} [options.source]
 * @returns {string}
 */
export function composeMessage(jobContext = {}, options = {}) {
  const title = sanitizeString(jobContext.title);
  const company = sanitizeString(jobContext.company);
  const location = sanitizeString(jobContext.location);
  const url = sanitizeString(jobContext.url);
  const description = sanitizeString(jobContext.description);
  const instruction = sanitizeString(options.instruction);

  // FR-M4: Fallback for URL-only without extractable JD
  if (!description) {
    if (url) {
      return `${OPENING_PHRASE} ${url}`;
    }
    return OPENING_PHRASE;
  }

  const headerLines = [];
  // djcode0718
  if (title) headerLines.push(`Job title: ${title}`);
  if (company) headerLines.push(`Company: ${company}`);
  if (location) headerLines.push(`Location: ${location}`);
  if (url) headerLines.push(`Job link: ${url}`);

  let headerBlock = OPENING_PHRASE;
  if (headerLines.length > 0) {
    headerBlock += `\n\n${headerLines.join('\n')}`;
  }

  if (instruction) {
  // djcode0718
    headerBlock += `\n\nMy instruction: ${instruction}`;
  }

  const jdPrefix = '\n\nJob description:\n';
  const fullPrefix = `${headerBlock}${jdPrefix}`;

  // Budget remaining for description
  const remainingBudget = MAX_MESSAGE_CHARS - fullPrefix.length;

  if (remainingBudget <= 0) {
    // Header alone exceeds or fills budget (unlikely), return header only
    return headerBlock.slice(0, MAX_MESSAGE_CHARS);
  }

  if (description.length <= remainingBudget) {
    return `${fullPrefix}${description}`;
  }

  // Truncation needed
  const budgetForDesc = Math.max(0, remainingBudget - TRUNCATION_MARKER.length);
  const truncatedDesc = truncateCleanly(description, budgetForDesc);

  return `${fullPrefix}${truncatedDesc}${TRUNCATION_MARKER}`;
}
