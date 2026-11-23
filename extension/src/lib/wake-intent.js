/**
 * Keyword matcher and intent parser for Sara.
 * Follows PRD §5.3 (FR-K1..K7) and addresses real transcript variations:
 * - Accepted keywords: sara, sarah, sera, zara, saara, sarra, sahra, sahara
 * - Levenshtein <= 1 matching in first 4 words
 * - Multi-alternative preference
 * - Intent: TAILOR by default if keyword present (does not require 'resume')
 * - Fuzzy match 'tailor' (tailor, taylor, tailer, tailors)
 * - Extra instruction gating: forward only if instruction markers present,
 *   filtering out speech artifacts ('marriage mein', 'Mere', etc.)
 */

export const ACCEPTED_KEYWORDS = new Set([
  'sara',
  'sarah',
  'sera',
  'zara',
  'saara',
  'sarra',
  'sahra',
  'sahara'
]);

export const PREFIXES = new Set(['hey', 'hi', 'ok', 'okay', 'hello']);

export const TAILOR_VERBS = new Set([
  'tailor',
  'taylor',
  'tailer',
  'tailors',
  'customize',
  'customise',
  'adapt',
  'optimize',
  'optimise',
  'update',
  'rewrite',
  'fit',
  'match',
  'improve',
  'tweak',
  'personalize',
  'personalise'
]);

export const INSTRUCTION_MARKERS = [
  'keep',
  'focus',
  'emphasise',
  'emphasize',
  'highlight',
  'one page',
  'single page',
  'also',
  'make sure',
  'but',
  'without',
  'include',
  'remove',
  'add'
];

const BOILERPLATE_PATTERNS = [
  /tailor\s+(?:my\s+)?(?:resume|cv|profile)?\s*(?:for\s+this\s+(?:role|job|company|position)(?:\s+and\s+(?:company|role|job))?)?/gi,
  /for\s+this\s+(?:role|job|company|position)(?:\s+and\s+(?:company|role|job))?/gi,
  /for\s+this\s+(?:company\s+and\s+job|job\s+and\s+company)/gi,
  /marriage\s+(?:mein|image|me)/gi,
  /\bmere\b/gi,
  /\bthis\s+company\b/gi,
  /\bthis\s+job\b/gi,
  /\bthis\s+role\b/gi,
  /\bfor\s+this\b/gi
];

/**
 * Computes Levenshtein distance between two short strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const row = [];
  for (let j = 0; j <= b.length; j++) row[j] = j;

  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      let val;
      if (a[i - 1] === b[j - 1]) {
        val = row[j - 1];
      } else {
        val = Math.min(row[j - 1] + 1, prev + 1, row[j] + 1);
      }
      row[j - 1] = prev;
      prev = val;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

/**
 * Checks if a token matches "sara" (exact list, or Levenshtein <= 1).
 * @param {string} token
 * @returns {boolean}
 */
export function isKeywordToken(token) {
  if (!token) return false;
  const clean = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;

  if (ACCEPTED_KEYWORDS.has(clean)) return true;

  // Check Levenshtein distance <= 1 against 'sara'
  if (levenshteinDistance(clean, 'sara') <= 1) {
    return true;
  }

  return false;
}

/**
 * Extracts keyword match info from the first 4 words of a transcript.
 * @param {string} transcript
 * @returns {{ found: boolean, keywordToken: string, index: number, words: string[] }}
 */
function findKeywordInTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return { found: false, keywordToken: '', index: -1, words: [] };
  }

  const cleanWords = transcript
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^\w-]/g, '').toLowerCase())
    .filter(Boolean);

  const searchWords = cleanWords.slice(0, 4);

  // Skip optional prefix if present in word 0
  let startIndex = 0;
  if (searchWords.length > 1 && PREFIXES.has(searchWords[0])) {
    startIndex = 1;
  }

  for (let i = startIndex; i < searchWords.length; i++) {
    const word = searchWords[i];
    if (isKeywordToken(word)) {
      return { found: true, keywordToken: word, index: i, words: cleanWords };
    }
  }

  return { found: false, keywordToken: '', index: -1, words: cleanWords };
}

/**
 * Extracts explicit user instruction while dropping garbled speech noise.
 * @param {string} textAfterKeyword
 * @returns {string}
 */
export function extractValidInstruction(textAfterKeyword) {
  if (!textAfterKeyword) return '';

  let cleaned = textAfterKeyword;
  for (const pattern of BOILERPLATE_PATTERNS) {
    cleaned = cleaned.replace(pattern, ' ');
  }
  // Remove leading/trailing punctuation and collapse whitespace
  cleaned = cleaned.replace(/^[\s,;:.!?-]+|[\s,;:.!?-]+$/g, '').replace(/\s+/g, ' ').trim();

  const lower = cleaned.toLowerCase();
  const hasMarker = INSTRUCTION_MARKERS.some((marker) => lower.includes(marker));

  if (hasMarker) {
    return cleaned;
  }

  // If no instruction markers present, drop noise (e.g. "marriage mein", "Mere")
  return '';
}

/**
 * Parses a transcript (and its alternatives) into structured command intent.
 * @param {string[]} transcriptAlternatives
 * @param {Object} [options]
 * @param {boolean} [options.requireKeyword=true]
 * @returns {{ ok: boolean, keywordFound: boolean, intent: string, instruction: string, reason?: string, heard: string }}
 */
export function parseCommand(transcriptAlternatives, options = {}) {
  const requireKeyword = options.requireKeyword !== false;

  const candidates = Array.isArray(transcriptAlternatives)
    ? transcriptAlternatives.filter((t) => typeof t === 'string' && t.trim().length > 0)
    : typeof transcriptAlternatives === 'string'
      ? [transcriptAlternatives]
      : [];

  if (candidates.length === 0) {
    return {
      ok: false,
      keywordFound: false,
      intent: 'NONE',
      instruction: '',
      reason: 'NO_SPEECH',
      heard: ''
    };
  }

  // 1. Scan all alternatives and select the one with the keyword match
  let bestCandidate = candidates[0];
  let keywordMatch = findKeywordInTranscript(bestCandidate);

  if (!keywordMatch.found) {
    for (let i = 1; i < candidates.length; i++) {
      const match = findKeywordInTranscript(candidates[i]);
      if (match.found) {
        bestCandidate = candidates[i];
        keywordMatch = match;
        break;
      }
    }
  }

  const heard = bestCandidate.trim();

  // 2. Keyword Requirement Check
  if (requireKeyword && !keywordMatch.found) {
    return {
      ok: false,
      keywordFound: false,
      intent: 'NONE',
      instruction: '',
      reason: 'KEYWORD_MISSING',
      heard
    };
  }

  // 3. Extract text after keyword
  let afterKeywordText = '';
  if (keywordMatch.found) {
    const rawTokens = heard.split(/\s+/);
    afterKeywordText = rawTokens.slice(keywordMatch.index + 1).join(' ').trim();
  } else {
    afterKeywordText = heard;
  }

  // 4. Intent Determination
  // Check for non-tailoring intents (e.g. weather, youtube, search)
  const lowerAfter = afterKeywordText.toLowerCase();
  if (
    lowerAfter.startsWith("what's the weather") ||
    lowerAfter.startsWith('weather') ||
    lowerAfter.startsWith('search for') ||
    lowerAfter.startsWith('play music')
  ) {
    return {
      ok: false,
      keywordFound: keywordMatch.found,
      intent: 'UNSUPPORTED',
      instruction: '',
      reason: 'UNSUPPORTED_INTENT',
      heard
    };
  }

  // Default to TAILOR (FR-K4: instruction that is only "Sara" or with tailor verbs defaults to TAILOR)
  const intent = 'TAILOR';

  // 5. Instruction Extraction
  const instruction = extractValidInstruction(afterKeywordText);

  return {
    ok: true,
    keywordFound: keywordMatch.found,
    intent,
    instruction,
    heard
  };
}
