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
  'sahara',
  'saira',
  'syra',
  'cyra',
  'sora',
  'surah',
  'shara',
  'serah',
  'sehra',
  'sayra',
  'tara',
  'saras',
  'sarahs',
  'saria',
  'saraa',
  'sharah'
]);

export const PREFIXES = new Set(['hey', 'hi', 'ok', 'okay', 'hello', 'please', 'can', 'could', 'would', 'yo']);

export const TAILOR_VERBS = new Set([
  'tailor',
  'taylor',
  'tailer',
  'tailors',
  'tailoring',
  'tailored',
  'trailer',
  'customize',
  'customise',
  'customizes',
  'customises',
  'customizing',
  'customising',
  'customized',
  'customised',
  'adapt',
  'adapts',
  'adapting',
  'adapted',
  'optimize',
  'optimise',
  'optimizes',
  'optimises',
  'optimizing',
  'optimising',
  'optimized',
  'optimised',
  'update',
  'updates',
  'updating',
  'updated',
  'rewrite',
  'rewrites',
  'rewriting',
  'rewrote',
  'rewritten',
  'fit',
  'fits',
  'fitting',
  'fitted',
  'match',
  'matches',
  'matching',
  'matched',
  'align',
  'aligns',
  'aligning',
  'aligned',
  'adjust',
  'adjusts',
  'adjusting',
  'adjusted',
  'tune',
  'tunes',
  'tuning',
  'tuned',
  'finetune',
  'fine-tune',
  'tweak',
  'tweaks',
  'tweaking',
  'tweaked',
  'refine',
  'refines',
  'refining',
  'refined',
  'rework',
  'reworks',
  'reworking',
  'reworked',
  'improve',
  'improves',
  'improving',
  'improved',
  'personalize',
  'personalise',
  'personalizes',
  'personalises',
  'personalizing',
  'personalising',
  'personalized',
  'personalised',
  'edit',
  'edits',
  'editing',
  'edited',
  'modify',
  'modifies',
  'modifying',
  'modified',
  'prepare',
  'prepares',
  'preparing',
  'prepared',
  'craft',
  'crafts',
  'crafting',
  'crafted',
  'format',
  'formats',
  'formatting',
  'formatted',
  'target',
  'targets',
  'targeting',
  'targeted',
  'shape',
  'shapes',
  'shaping',
  'shaped',
  'polish',
  'polishes',
  'polishing',
  'polished',
  'revise',
  'revises',
  'revising',
  'revised',
  'sync',
  'synchronize',
  'synchronise',
  'suit',
  'suits',
  'suited',
  'reframe',
  'reframes',
  'reframing',
  'reframed',
  'pitch',
  'pitches',
  'pitching',
  'pitched',
  'gear',
  'gears',
  'gearing',
  'geared'
]);

export const GENERAL_ACTION_VERBS = new Set([
  'make',
  'makes',
  'making',
  'made',
  'build',
  'builds',
  'building',
  'built',
  'generate',
  'generates',
  'generating',
  'generated',
  'create',
  'creates',
  'creating',
  'created',
  'write',
  'writes',
  'writing',
  'wrote',
  'set',
  'sets',
  'setting',
  'change',
  'changes',
  'changing',
  'changed',
  'apply',
  'applies',
  'applying',
  'applied',
  'do',
  'does',
  'doing',
  'did',
  'done',
  'work',
  'works',
  'working',
  'worked',
  'help',
  'helps',
  'helping',
  'helped',
  'put',
  'puts',
  'putting',
  'convert',
  'converts',
  'converting',
  'converted',
  'transform',
  'transforms',
  'transforming',
  'transformed'
]);

export const RESUME_ENTITIES = new Set([
  'resume',
  'resumes',
  'resumé',
  'résumé',
  'cv',
  'cvs',
  'profile',
  'profiles',
  'bio',
  'experience',
  'experiences',
  'skills',
  'skillset',
  'application',
  'applications',
  'background',
  'backgrounds',
  'qualification',
  'qualifications',
  'credentials',
  'credential',
  'detail',
  'details'
]);

export const JOB_TARGETS = new Set([
  'jd',
  'jds',
  'job',
  'jobs',
  'role',
  'roles',
  'position',
  'positions',
  'opening',
  'openings',
  'posting',
  'postings',
  'post',
  'posts',
  'vacancy',
  'vacancies',
  'listing',
  'listings',
  'opportunity',
  'opportunities',
  'company',
  'companies',
  'employer',
  'employers',
  'firm',
  'firms',
  'screen',
  'page',
  'site',
  'here',
  'this',
  'that',
  'description',
  'descriptions',
  'requirement',
  'requirements',
  'criteria',
  'specification',
  'specifications',
  'specs',
  'spec',
  'advert',
  'advertisement',
  'reqs',
  'req'
]);

export const INSTRUCTION_MARKERS = [
  'keep',
  'focus',
  'emphasise',
  'emphasize',
  'highlight',
  'one page',
  'single page',
  '1 page',
  'also',
  'make sure',
  'but',
  'without',
  'include',
  'remove',
  'add'
];

export const NON_TAILORING_PATTERNS = [
  /^(?:what|who|where|when|why|how)\b/i,
  /^(?:tell\s+me|tell\s+a\s+joke|joke)\b/i,
  /^(?:play\s+|listen\s+to|spotify|youtube)\b/i,
  /^(?:search\s+for|search\s+google|google\s+for|find\s+jobs|look\s+up)\b/i,
  /^(?:order\s+|buy\s+|call\s+|send\s+(?:an?\s+)?email|text\s+|message\s+)/i,
  /^(?:weather|forecast)\b/i,
  /^(?:can\s+you\s+(?:tell|play|search|call|order|buy|sing))\b/i,
  /\b(?:coffee|tea|pizza|burger|food|lunch|dinner|breakfast|drink|water|groceries)\b/i,
  /\b(?:joke|laugh|music|song|spotify|youtube|netflix|movie|game)\b/i
];

const BOILERPLATE_PATTERNS = [
  /tailor\s+(?:my\s+)?(?:resume|cv|profile)?\s*(?:for\s+this\s+(?:role|job|company|position|jd)(?:\s+and\s+(?:company|role|job|jd))?)?/gi,
  /for\s+this\s+(?:role|job|company|position|jd)(?:\s+and\s+(?:company|role|job|jd))?/gi,
  /for\s+this\s+(?:company\s+and\s+job|job\s+and\s+company)/gi,
  /(?:for\s+this\s+)?\bjd\b/gi,
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
  // djcode0718
  return row[b.length];
}

/**
 * Checks if a token matches "sara" (exact list, or Levenshtein <= 1).
 * @param {string} token
 * @returns {boolean}
 */
export function isKeywordToken(token) {
  if (!token) return false;
  let clean = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean) return false;

  // Strip possessive or plural s ('s, s) e.g. "sarah's", "sara's"
  if (clean.endsWith('s') && clean.length > 4) {
    const stripped = clean.slice(0, -1);
    if (ACCEPTED_KEYWORDS.has(stripped) || levenshteinDistance(stripped, 'sara') <= 1) {
      return true;
    }
  }

  if (ACCEPTED_KEYWORDS.has(clean)) return true;

  // Check Levenshtein distance <= 1 against 'sara'
  if (levenshteinDistance(clean, 'sara') <= 1) {
    return true;
  }

  return false;
}

/**
 * Extracts keyword match info from the transcript.
 * Checks the beginning (first 5 words) or the end (last 2 words).
 * @param {string} transcript
 * @returns {{ found: boolean, keywordToken: string, index: number, words: string[] }}
 */
function findKeywordInTranscript(transcript) {
  if (!transcript || typeof transcript !== 'string') {
    return { found: false, keywordToken: '', index: -1, words: [] };
  }

  const rawWords = transcript.trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) {
    return { found: false, keywordToken: '', index: -1, words: [] };
  }

  // 1. Search in first 5 words (standard starting address)
  const firstBatchLimit = Math.min(rawWords.length, 5);
  for (let i = 0; i < firstBatchLimit; i++) {
    const word = rawWords[i];
    if (isKeywordToken(word)) {
      return { found: true, keywordToken: word, index: i, words: rawWords };
    }
  }

  // 2. Search in the last 2 words (e.g. "Tailor my resume for this jd, Sara")
  const endStartIndex = Math.max(0, rawWords.length - 2);
  for (let i = endStartIndex; i < rawWords.length; i++) {
    const word = rawWords[i];
    if (isKeywordToken(word)) {
      return { found: true, keywordToken: word, index: i, words: rawWords };
    }
  }

  return { found: false, keywordToken: '', index: -1, words: rawWords };
}

/**
 * Evaluates whether the spoken text is related to tailoring a resume
 * for the job or company on the screen.
 * @param {string} commandText
 * @returns {boolean}
 */
export function isTailoringIntent(commandText) {
  if (!commandText || typeof commandText !== 'string') {
    return false;
  }

  const clean = commandText.trim();
  if (!clean) return false;

  // 1. Explicit Non-tailoring patterns
  for (const pattern of NON_TAILORING_PATTERNS) {
    if (pattern.test(clean)) {
      return false;
    }
  }

  // Normalize common STT representations of "j d" / "j.d." -> "jd"
  const normalized = clean.toLowerCase().replace(/\bj\s*\.?\s*d\b/g, 'jd');
  const words = normalized.replace(/[^a-z0-9\s-]/g, ' ').trim().split(/\s+/).filter(Boolean);

  // 2. Direct Tailoring Action Verb (or fuzzy match to "tailor")
  for (const word of words) {
    if (TAILOR_VERBS.has(word)) return true;
    if (levenshteinDistance(word, 'tailor') <= 1) return true;
  }

  // 3. Contains any Instruction Directive
  for (const marker of INSTRUCTION_MARKERS) {
    if (normalized.includes(marker)) return true;
  }

  const hasResume = words.some((w) => RESUME_ENTITIES.has(w));
  const hasJobTarget = words.some((w) => JOB_TARGETS.has(w));
  const hasGeneralVerb = words.some((w) => GENERAL_ACTION_VERBS.has(w));
  const hasConnector = /\b(?:for|to|with|against|towards|on|from|based|according|as\s+per)\b/i.test(normalized);

  // 4. Resume Entity + Job Target in any order ("here and there", e.g. "for this jd, my resume")
  if (hasResume && hasJobTarget) return true;

  // 5. Resume Entity + General creation verb or connector ("make my resume", "my resume for this")
  if (hasResume && (hasGeneralVerb || hasConnector)) return true;

  // 6. Job Target + Connector ("for this jd", "with this job description", "for Google")
  if (hasJobTarget && hasConnector) return true;

  // 7. Speech artifact check: user transcripts matching known boilerplate fragments
  if (
    normalized.includes('for this') ||
    normalized.includes('for that') ||
    normalized.includes('this job') ||
    normalized.includes('this role') ||
    normalized.includes('this company') ||
    normalized.includes('marriage image') ||
    normalized.includes('marriage mein')
  ) {
    return true;
  }

  return false;
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
  // djcode0718
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
    // djcode0718
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

  // 3. Extract command tokens (remove the keyword token wherever it appears)
  let commandText = '';
  if (keywordMatch.found) {
    const rawTokens = heard.split(/\s+/).filter(Boolean);
    const commandTokens = rawTokens.filter((token, idx) => {
      if (idx === keywordMatch.index) return false;
      // Also drop repeated keyword token immediately adjacent (e.g. "Sara Sara")
      if (Math.abs(idx - keywordMatch.index) === 1 && isKeywordToken(token)) return false;
      return true;
    });

    // Strip leading conversational prefixes/greetings (e.g. "Hey", "Hi", "Ok", "Please")
    while (commandTokens.length > 0) {
      const cleanFirst = commandTokens[0].toLowerCase().replace(/[^a-z]/g, '');
      if (PREFIXES.has(cleanFirst)) {
        commandTokens.shift();
      } else {
        break;
      }
    }

    commandText = commandTokens.join(' ').trim();
  } else {
    commandText = heard;
  }

  // 4. Require an instruction (bare "Sara" does not trigger tailoring)
  if (!commandText) {
    return {
      ok: false,
      keywordFound: keywordMatch.found,
      intent: 'NONE',
      instruction: '',
      reason: 'NO_INSTRUCTION',
      heard
    };
  }

  // 5. Intent Determination
  if (!isTailoringIntent(commandText)) {
    return {
      ok: false,
      keywordFound: keywordMatch.found,
      intent: 'UNSUPPORTED',
      instruction: '',
      reason: 'UNSUPPORTED_INTENT',
      heard
    };
  }

  // Validated tailoring intent
  const intent = 'TAILOR';

  // 6. Instruction Extraction
  const instruction = extractValidInstruction(commandText);

  return {
    ok: true,
    keywordFound: keywordMatch.found,
    intent,
    instruction,
    heard
  };
}
