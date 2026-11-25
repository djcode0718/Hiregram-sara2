import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCommand,
  isKeywordToken,
  levenshteinDistance
} from '../../extension/src/lib/wake-intent.js';

test('levenshteinDistance handles equality, insertions, deletions and substitutions', () => {
  assert.equal(levenshteinDistance('sara', 'sara'), 0);
  assert.equal(levenshteinDistance('sara', 'sarah'), 1);
  assert.equal(levenshteinDistance('sara', 'sera'), 1);
  assert.equal(levenshteinDistance('sara', 'zara'), 1);
  assert.equal(levenshteinDistance('sara', 'sahara'), 2);
});

test('isKeywordToken accepts all keyword variations and aliases', () => {
  const accepted = ['sara', 'sarah', 'sera', 'zara', 'saara', 'sarra', 'sahra', 'sahara'];
  for (const word of accepted) {
    assert.equal(isKeywordToken(word), true, `Expected "${word}" to match keyword`);
    assert.equal(isKeywordToken(word.toUpperCase()), true, `Expected uppercase "${word}" to match keyword`);
  }
  assert.equal(isKeywordToken('random'), false);
  assert.equal(isKeywordToken('google'), false);
});

// Table of 40+ test cases covering real transcripts, mis-hearings, instructions, and edge cases
const TEST_PHRASES = [
  // 1-5: User's real transcripts from Chrome testing
  {
    input: ['Sahara tailor marriage image'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },
  {
    input: ['Sara tailor my resume for this'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },
  {
    input: ['Sara Sara tailor Mere'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },
  {
    input: ['Sara tailor marriage mein for this company and job'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },
  {
    input: ['Sahara tailor marriage mein company and job'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },

  // 6: Alternatives test: second candidate has keyword
  {
    input: ['Noise transcript without name', 'Sara tailor marriage mein company and job'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: ''
  },

  // 7-15: Canonical phrases with extra instructions (instruction markers preserved)
  {
    input: ['Sara, tailor my resume, keep it to one page'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'keep it to one page'
  },
  {
    input: ['Sara, emphasize backend systems and distributed databases'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'emphasize backend systems and distributed databases'
  },
  {
    input: ['Sarah, focus on leadership and project management'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'focus on leadership and project management'
  },
  {
    input: ['Sara, make sure to highlight full stack experience'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'make sure to highlight full stack experience'
  },
  {
    input: ['Sara, also include my cloud certifications'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'also include my cloud certifications'
  },
  {
    input: ['Sara, tailor my CV without previous internships'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'without previous internships'
  },
  {
    input: ['Sara, remove old university projects'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'remove old university projects'
  },
  {
    input: ['Sara, single page resume format please'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'single page resume format please'
  },
  {
    input: ['Sara, add Golang and Rust to the skills section'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR',
    expectedInstruction: 'add Golang and Rust to the skills section'
  },

  // 16-25: Accepted keyword spelling variants and prefixes
  {
    input: ['Hey Sara, tailor for this role'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Hi Sarah, update my profile'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Ok Sera, adapt this CV'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Okay Zara, tailor my resume for this position'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Saara, optimize my resume for Google'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sarra, rewrite for this job'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sahra, tweak my resume'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sahara, customize for this opening'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, go'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara'],
    expectedOk: false,
    expectedReason: 'NO_INSTRUCTION'
  },
  {
    input: ['Sara, make me a coffee'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },

  // 26-32: Fuzzy tailor verb variants
  {
    input: ['Sara, taylor my resume'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, tailer my CV'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, tailors my profile'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, personalise this resume'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, match this role'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, improve this resume'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, fit my skills to this job'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },

  // 33-36: Unsupported intents (non-tailor commands)
  {
    input: ["Sara, what's the weather today"],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, search for jobs in Seattle'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, play music on spotify'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, weather forecast'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, tell me a joke'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, how do you make pizza'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, order a pizza'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, call mom'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, who is the president of France'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, what time is our meeting'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, how are you doing today'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, can you open Netflix'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, write an essay about space exploration'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },
  {
    input: ['Sara, do you like coffee or tea'],
    expectedOk: false,
    expectedReason: 'UNSUPPORTED_INTENT'
  },

  // 37-46: Additional natural tailoring ways
  {
    input: ['Sara, adapt this CV for Google'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, customize my profile for this opening'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ["Sara, align my resume with what's on the screen"],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, tune my resume for this position'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, polish my CV for this JD'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, revise my resume for this opening'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, prepare my application for this employer'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, craft my CV for this listing'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, resume for this role'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },
  {
    input: ['Sara, my CV for this company'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  },

  // 37-43: Keyword missing & edge cases
  {
    input: ['Tailor my resume for this role and company'],
    expectedOk: false,
    expectedReason: 'KEYWORD_MISSING'
  },
  {
    input: ['Hello, please update my CV'],
    expectedOk: false,
    expectedReason: 'KEYWORD_MISSING'
  },
  {
    input: [''],
    expectedOk: false,
    expectedReason: 'NO_SPEECH'
  },
  {
    input: [],
    expectedOk: false,
    expectedReason: 'NO_SPEECH'
  },
  {
    input: ['This role is great but we mentioned Sara at the very end of the paragraph'],
    expectedOk: false,
    expectedReason: 'KEYWORD_MISSING' // Keyword not in first 4 words
  },
  {
    input: ['Hey there, tailor this role'],
    expectedOk: false,
    expectedReason: 'KEYWORD_MISSING'
  },
  {
    input: ['SARA, TAILOR MY RESUME FOR THIS ROLE'],
    expectedOk: true,
    expectedKeyword: true,
    expectedIntent: 'TAILOR'
  }
];

test('parseCommand satisfies full test suite of >= 40 phrases', () => {
  assert.ok(TEST_PHRASES.length >= 40, `Expected at least 40 test phrases, got ${TEST_PHRASES.length}`);

  for (let i = 0; i < TEST_PHRASES.length; i++) {
    const { input, expectedOk, expectedKeyword, expectedIntent, expectedInstruction, expectedReason } = TEST_PHRASES[i];
    const res = parseCommand(input);

    assert.equal(
      res.ok,
      expectedOk,
      `Phrase #${i + 1} "${JSON.stringify(input)}": expected ok=${expectedOk}, got ok=${res.ok}`
    );

    if (expectedOk) {
      if (expectedKeyword !== undefined) {
        assert.equal(res.keywordFound, expectedKeyword);
      }
      if (expectedIntent !== undefined) {
        assert.equal(res.intent, expectedIntent);
      }
      if (expectedInstruction !== undefined) {
        assert.equal(
          res.instruction,
          expectedInstruction,
          `Phrase #${i + 1} "${JSON.stringify(input)}": expected instruction="${expectedInstruction}", got "${res.instruction}"`
        );
      }
    } else {
      if (expectedReason !== undefined) {
        assert.equal(
          res.reason,
          expectedReason,
          `Phrase #${i + 1} "${JSON.stringify(input)}": expected reason=${expectedReason}, got ${res.reason}`
        );
      }
    }
  }
});

test('parseCommand respects requireKeyword: false option', () => {
  const res = parseCommand(['Tailor my resume for this role'], { requireKeyword: false });
  assert.equal(res.ok, true);
  assert.equal(res.intent, 'TAILOR');
});
