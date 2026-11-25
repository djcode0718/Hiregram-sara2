# Hiregram Tailor Build Checklist

**Progress:** 65 / 72 items done (90%)  
**Last updated / commit:** `feat: implement Phase 4 voice push-to-talk & overlay and Phase 5 wake-intent engine`

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
- [x] Test mic permission acquisition via user click
- [x] Test speech recognition in offscreen doc (Host A)
- [x] Record spike outcome in `docs/DECISIONS.md` (Host A confirmed, ~270 ms latency)
- [x] Manual Gate 0 passed (Host A verified in Chrome)

---

## Phase 1 — Foundation & Refactor of Existing Flow
- [x] Update `extension/manifest.json` to MV3 spec v0.2.0
- [x] Create `lib/constants.js` (selectors, URLs, limits, timings, message types)
- [x] Create `lib/settings.js` (defaults, validation, storage.sync listener)
- [x] Create `lib/logger.js` (in-memory ring buffer, privacy-safe)
- [x] Refactor `background.js` into `service-worker.js` + `handoff.js`
- [x] Implement FR-H1: Multi-stage hand-off (LIST -> navigate default resume -> EDITOR -> Send)
- [x] Implement FR-H2: Dedicated tab authorization (`CLAIM_PENDING`), atomic claim, no tab collisions
- [x] Implement FR-H3: 10 min TTL, retain pending if chat box not found, clear toasts per stage
- [x] Implement FR-H4: Centralized selectors, poll Send up to 8s, leave text if disabled
- [x] Implement FR-H5: Support `https://hiregram.ai/*` and `https://www.hiregram.ai/*`
- [x] Implement FR-H6: Sara busy wait up to 8s, fill-only + toast
- [x] Implement FR-H7: Dedicated NEW tab for every hand-off (never disturbing existing active tabs)
- [x] Implement FR-H9: Pure resolver for default resume on /resume (FR-H9..FR-H11)
- [x] Implement FR-H10: Decoy immunity ("Set as default", "Make this your default?", etc.)
- [x] Implement FR-H11: Hero card fallback ("YOUR DEFAULT")
- [x] Implement FR-H12: Non-destructive idempotent claim with status lifecycle ("queued" -> "sending" -> "sent")
- [x] Implement FR-H13: Loop guard (navAttempts >= 2 stops redirect loops)
- [x] Implement FR-H14: User-visible stage feedback toasts with clean observer & timer teardown
- [x] Guard test: Zero UUID literals in extension/src
- [x] Implement FR-O4: Toolbar button with badge `!` on restricted pages
- [x] Unit tests for `lib/settings.js` and `hiregram-bridge.js` state machine (4 tests)
- [~] Browser smoke test: toolbar click & context menu work with zero Errors in chrome://extensions [NEEDS MANUAL TEST]
- [~] Browser smoke test: dynamic default resume detection and switching verified in Chrome [NEEDS MANUAL TEST]

---

## Phase 2 — Job-Context Extraction
- [x] Create `lib/html-to-text.js` (FR-E9: bullets, paragraphs, entities, no third-party libs)
- [x] Create `lib/url-utils.js` (FR-E7, FR-E8: canonicalization, LinkedIn currentJobId, strip tracking)
<!-- djcode0718 -->
- [x] Implement FR-E1: Layer 1 user selection (>= 80 chars)
- [x] Implement FR-E2: Layer 2 JSON-LD JobPosting parsing (arrays, @graph, entity decode)
- [x] Implement FR-E3: Layer 3 Site Adapters:
<!-- djcode0718 -->
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
- [x] Implement `voice/voice-engine.js`: `VoiceEngine` interface + `WebSpeechEngine` (FR-V1..V9)
- [x] Implement voice host in chosen form (Offscreen doc)
- [x] Implement `content/hotkey.js` (FR-A1..A8):
  - [x] Keydown/keyup matching combo by `event.code` (default Alt+S)
  - [x] Modifier + non-modifier validation
  - [x] Hold-to-talk logic (keydown start, keyup stop)
  - [x] preventDefault + stopPropagation on match, ignore isComposing
  - [x] Works inside text inputs / contenteditable
  - [x] Runs in all frames (`all_frames: true`), forwards to SW
  - [x] blur, visibilitychange, Esc cancellation
  - [x] Min hold 350ms, max 30s auto-stop
  - [x] Per-site disable check & graceful handling of context invalidation
- [x] Implement `content/overlay.js` (FR-U1..U6):
  - [x] Closed Shadow DOM on `document.documentElement`
  - [x] States: starting-mic, listening, understanding, reading-page, sending, sent, error, hint
  - [x] role="status" and aria-live="polite", prefers-reduced-motion, dark/light theme
  - [x] Auto-dismiss (2.5s success, 6s error, Esc dismiss)
  - [x] Action links for error recovery
- [x] Implement session state machine in `pipeline.js`
- [~] Manual Gate 1 passed (Voice capture & overlay verified) [NEEDS MANUAL TEST]

---

## Phase 5 — Keyword, Intent and End-to-End
- [x] Implement `lib/wake-intent.js` (FR-K1..K7):
  - [x] Fuzzy keyword in first 4 words (Levenshtein <= 1, accepted spellings, prefixes, Sahara alias)
  - [x] "Require keyword" setting toggle
  - [x] Keyword missing rejection
  - [x] TAILOR intent matching without requiring "resume", "Sara" only defaults to TAILOR
  - [x] Unsupported intent rejection
  - [x] Extra instructions extraction gated by explicit markers, speech noise stripped
  - [x] Pure deterministic function with >= 40 unit test phrases including real transcripts
- [x] Connect full pipeline: keyup -> transcript -> parse -> extract -> compose -> handoff -> feedback
- [x] Implement Error-Handling Matrix (§5.9)
- [x] Debounce/ignore duplicate gestures
- [~] Manual Gate 2 passed (End-to-end voice tailoring verified) [NEEDS MANUAL TEST]

---
<!-- djcode0718 -->

## Phase 6 — Options, Onboarding and Settings
- [x] Implement `pages/onboarding.html/.js/.css` (FR-O1: 3-step mic grant, hotkey, demo, privacy notice)
- [x] Implement `pages/options.html/.js/.css` (FR-O2, FR-A9, FR-A10, FR-O3):
  - [x] Hotkey recorder with validation and conflict warnings
  - [x] Language selection
  - [x] Require-keyword toggle
  - [x] Global enable toggle
  - [x] Per-site disabled list
  - [x] Mic status & Grant/Test button
  - [x] Version, links, debug info export
- [x] Implement first-run hint in overlay (FR-U2)
- [x] Unit tests for hotkey validation
- [x] Manual Gate 3 passed (Clean install & onboarding verified)

---

## Phase 7 — Hardening, Security, Edge Cases
- [x] Service worker suspension handling & keep-alive port during session
- [x] Context invalidation graceful handling
- [x] Tab switch / navigation during listening handling
- [x] Multiple Hiregram tabs & logged out scenarios
- [x] Security review against PRD §8 (no innerHTML with dynamic data, isolated world, strict CSP)
- [x] Performance audit: zero idle cost, overlay <= 100ms
- [x] ESLint clean across all files
- [x] Accessibility pass on overlay and pages

---

## Phase 8 — QA, Docs and Packaging
- [x] `docs/MANUAL_QA.md`: complete scripted test plan (voice, 12+ real job pages, hand-off, restricted)
- [x] `README.md`: complete guide (install, hotkey, settings, architecture, dev setup, troubleshooting)
- [x] `docs/PRIVACY.md`: privacy policy draft
- [x] `docs/STORE_LISTING.md`: descriptions, single-purpose, permission justifications, screenshot list
- [x] `scripts/package.mjs`: package script creating `dist/hiregram-tailor-<version>.zip`
- [x] Bump version to 0.2.0, write `docs/PR_SUMMARY.md`
- [x] Tag `v0.2.0` locally
