# Hiregram Tailor Build Checklist

**Progress:** 49 / 72 items done (68%)  
**Last updated / commit:** `feat: implement Phase 3 structured message composition and pipeline`

## Status Legend
- `[ ]` Todo
- `[x]` Done and verified
- `[~]` Partial / in progress
- `[!]` Blocked
- `NEEDS MANUAL TEST` Requires human testing on live browser / mic / external sites

---

## Phase 0 — Baseline, Structure and Voice Spike
- [x] Verify git state, create `feat/sara-voice`, commit MVP baseline untouched
- [x] Consolidate loose files vs `hiregram-tailor/` vs zip into `extension/`
- [x] Add package.json, eslint config, .gitignore, README skeleton, docs
- [x] Generate 16, 32, 48, 128 PNG icons and link in manifest
- [x] Build voice spike (`spike.html/.js` and offscreen document / host test)
- [~] Browser smoke test: load unpacked, verify extension Errors page is completely empty [NEEDS MANUAL TEST]
- [~] Test mic permission acquisition via user click [NEEDS MANUAL TEST]
- [~] Test speech recognition in offscreen doc (Host A) or fallback iframe (Host B) [NEEDS MANUAL TEST]
- [ ] Record spike outcome in `docs/DECISIONS.md` (Host A vs B latency & stability)
- [ ] Manual Gate 0 passed

---

## Phase 1 — Foundation & Refactor of Existing Flow
- [x] Update `extension/manifest.json` to MV3 spec v0.2.0
- [x] Create `lib/constants.js` (selectors, URLs, limits, timings, message types)
- [x] Create `lib/settings.js` (defaults, validation, storage.sync listener)
- [x] Create `lib/logger.js` (in-memory ring buffer, privacy-safe)
- [x] Refactor `background.js` into `service-worker.js` + `handoff.js` preserving exact behaviour
- [x] Implement FR-H1: Keep existing storage -> bridge -> Sara chat box -> Send mechanism
- [x] Implement FR-H2: Unique `pending.id`, atomic claim, no double-send across tabs
- [x] Implement FR-H3: 10 min TTL, retain pending if chat box not found, toast
- [x] Implement FR-H4: Centralized selectors, poll Send up to 8s, leave text if disabled
- [x] Implement FR-H5: Support `https://hiregram.ai/*` and `https://www.hiregram.ai/*`
- [x] Implement FR-H6: Sara busy wait up to 8s, fill-only + toast
- [x] Implement FR-H7: Focus existing tab or create new tab
- [x] Implement FR-O4: Toolbar button with badge `!` on restricted pages
- [x] Unit tests for `lib/settings.js`
- [~] Browser smoke test: toolbar click & context menu work with zero Errors in chrome://extensions [NEEDS MANUAL TEST]

---

## Phase 2 — Job-Context Extraction
- [x] Create `lib/html-to-text.js` (FR-E9: bullets, paragraphs, entities, no third-party libs)
- [x] Create `lib/url-utils.js` (FR-E7, FR-E8: canonicalization, LinkedIn currentJobId, strip tracking)
- [x] Implement FR-E1: Layer 1 user selection (>= 80 chars)
- [x] Implement FR-E2: Layer 2 JSON-LD JobPosting parsing (arrays, @graph, entity decode)
- [x] Implement FR-E3: Layer 3 Site Adapters:
  - [x] LinkedIn (`/jobs/view/` and `/jobs/search` pane) [NEEDS MANUAL VERIFY]
  - [x] Wellfound [NEEDS MANUAL VERIFY]
  - [x] Naukri [NEEDS MANUAL VERIFY]
  - [x] Indeed [NEEDS MANUAL VERIFY]
  - [x] Greenhouse [NEEDS MANUAL VERIFY]
  - [x] Lever [NEEDS MANUAL VERIFY]
  - [x] Ashby [NEEDS MANUAL VERIFY]
  - [x] Workday (`myworkdayjobs.com`) [NEEDS MANUAL VERIFY]
  - [x] Instahyre [NEEDS MANUAL VERIFY]
- [x] Implement FR-E4: Layer 4 generic heuristics (headings, keywords, link-density penalty, open shadow DOM)
- [x] Implement FR-E5: Layer 5 page-text fallback (confidence: low)
- [x] Implement FR-E6: < 150 chars fallback error
- [x] Implement FR-E10 (P1): Expand See more / Show more safely
- [x] Implement FR-E11: Confidence scoring (high, medium, low)
- [x] Implement FR-E12: 2.5s execution time budget
- [x] In service worker: `extractJobContext(tabId)` merging all frames
- [x] Wire right-click context menu and toolbar click to new extractor
- [x] Extractor unit & fixture tests in jsdom for all adapters, JSON-LD variants, edge cases
- [x] Guard test & ESLint rule: zero import/export in content scripts or injected scripts
- [~] Browser smoke test: extract on a real job page, verify zero console SyntaxErrors and clean hand-off [NEEDS MANUAL TEST]

---

## Phase 3 — Message Composition & Delivery Polish
- [x] Implement `lib/compose-message.js` (FR-M1..M5):
  - [x] Preserve opening phrase `Tailor my resume to this job post:`
  - [x] Omit empty fields (no "undefined" or "Unknown")
  - [x] 7500 char cap with budget calculation, sentence/paragraph boundary truncation + marker
  - [x] Normalize whitespace, strip control and zero-width characters
  - [x] URL-only fallback message when no JD is extractable
- [x] Support optional instruction (`My instruction: ...`)
- [x] Implement FR-H8 (P1): Delivery result reporting to origin tab
- [x] Integrate into `pipeline.js`: `runTailor({ tabId, instruction, source })`
- [x] Unit tests for message composition
- [~] Browser smoke test: structured message delivered to Sara on Hiregram [NEEDS MANUAL TEST]

---

## Phase 4 — Voice Capture, Hotkey and Overlay
- [ ] Implement `voice/voice-engine.js`: `VoiceEngine` interface + `WebSpeechEngine` (FR-V1..V9)
- [ ] Implement voice host in chosen form (Offscreen doc / Iframe host)
- [ ] Implement `content/hotkey.js` (FR-A1..A8):
  - [ ] Keydown/keyup matching combo by `event.code` (default Alt+S)
  - [ ] Modifier + non-modifier validation
  - [ ] Hold-to-talk logic (keydown start, keyup stop)
  - [ ] preventDefault + stopPropagation on match, ignore isComposing
  - [ ] Works inside text inputs / contenteditable
  - [ ] Runs in all frames (`all_frames: true`), forwards to SW
  - [ ] blur, visibilitychange, Esc cancellation
  - [ ] Min hold 350ms, max 30s auto-stop
  - [ ] Per-site disable check & graceful handling of context invalidation
- [ ] Implement `content/overlay.js` (FR-U1..U6):
  - [ ] Closed Shadow DOM on `document.documentElement`
  - [ ] States: starting-mic, listening, understanding, reading-page, sending, sent, error, hint
  - [ ] role="status" and aria-live="polite", prefers-reduced-motion, dark/light theme
  - [ ] Auto-dismiss (2.5s success, 6s error, Esc dismiss)
  - [ ] Action links for error recovery
- [ ] Implement session state machine in `pipeline.js`
- [ ] Manual Gate 1 passed (Voice capture & overlay verified)

---

## Phase 5 — Keyword, Intent and End-to-End
- [ ] Implement `lib/wake-intent.js` (FR-K1..K7):
  - [ ] Fuzzy keyword in first 4 words (Levenshtein <= 1, accepted spellings, prefixes)
  - [ ] "Require keyword" setting toggle
  - [ ] Keyword missing rejection
  - [ ] TAILOR intent matching, "Sara" only defaults to TAILOR
  - [ ] Unsupported intent rejection
  - [ ] Extra instructions extraction, boilerplate stripped
  - [ ] Pure deterministic function with >= 40 unit test phrases
- [ ] Connect full pipeline: keyup -> transcript -> parse -> extract -> compose -> handoff -> feedback
- [ ] Implement Error-Handling Matrix (§5.9):
  - [ ] Mic denied / not granted
  - [ ] No mic hardware
  - [ ] Silence / no speech
  - [ ] Keyword missing
  - [ ] Unsupported intent
  - [ ] Speech service offline
  - [ ] No JD found
  - [ ] Restricted page
  - [ ] Extension context invalidated
  - [ ] Hiregram chat box not found (<= TTL)
  - [ ] Send disabled
  - [ ] Another gesture in progress
  - [ ] Unexpected exception
- [ ] Debounce/ignore duplicate gestures
- [ ] Manual Gate 2 passed (End-to-end voice tailoring verified)

---

## Phase 6 — Options, Onboarding and Settings
- [ ] Implement `pages/onboarding.html/.js/.css` (FR-O1: 3-step mic grant, hotkey, demo, privacy notice)
- [ ] Implement `pages/options.html/.js/.css` (FR-O2, FR-A9, FR-A10, FR-O3):
  - [ ] Hotkey recorder with validation and conflict warnings
  - [ ] Language selection
  - [ ] Require-keyword toggle
  - [ ] Global enable toggle
  - [ ] Per-site disabled list
  - [ ] Mic status & Grant/Test button
  - [ ] Version, links, debug info export
- [ ] Implement first-run hint in overlay (FR-U2)
- [ ] Unit tests for hotkey validation
- [ ] Manual Gate 3 passed (Clean install & onboarding verified)

---

## Phase 7 — Hardening, Security, Edge Cases
- [ ] Service worker suspension handling & keep-alive port during session
- [ ] Context invalidation graceful handling
- [ ] Tab switch / navigation during listening handling
- [ ] Multiple Hiregram tabs & logged out scenarios
- [ ] Security review against PRD §8 (no innerHTML with dynamic data, isolated world, strict CSP)
- [ ] Performance audit: zero idle cost, overlay <= 100ms
- [ ] ESLint clean across all files
- [ ] Accessibility pass on overlay and pages

---

## Phase 8 — QA, Docs and Packaging
- [ ] `docs/MANUAL_QA.md`: complete scripted test plan (voice, 12+ real job pages, hand-off, restricted)
- [ ] `README.md`: complete guide (install, hotkey, settings, architecture, dev setup, troubleshooting)
- [ ] `docs/PRIVACY.md`: privacy policy draft
- [ ] `docs/STORE_LISTING.md`: descriptions, single-purpose, permission justifications, screenshot list
- [ ] `scripts/package.mjs`: package script creating `dist/hiregram-tailor-<version>.zip`
- [ ] Bump version to 0.2.0, write `docs/PR_SUMMARY.md`
- [ ] Tag `v0.2.0` locally
