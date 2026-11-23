# Architectural & Design Decisions Log

This log records all significant technical and design decisions made during the development of Hiregram Tailor v0.2.

---

### [2026-11-23] Decision 001: Baseline File Consolidation
- **Context:** The repository root contained duplicate copies of `manifest.json`, `background.js`, and `content.js` both at the root, inside `hiregram-tailor/`, and within `hiregram-tailor.zip`.
- **Decision:** Verified using `diff -r` that all copies were identical. Used `git mv` to move root files into `extension/` (`extension/manifest.json`, `extension/background.js`, `extension/content.js`), and removed the loose duplicates and zip archive with `git rm`.
- **Reason:** Keeps clean repository structure according to PRD §6.1 while preserving git history.
- **Alternatives Considered:** Keeping `hiregram-tailor/` as root directory. Rejected because the root is dedicated to the full project setup including `tests/`, `docs/`, and `scripts/`.

---

### [2026-11-23] Decision 002: Tooling and Buildless Extension
- **Context:** The extension needs testing and linting, but the runtime extension must be completely buildless and bundler-free.
- **Decision:** Installed `eslint` and `jsdom` as devDependencies only. Configured Node test runner (`node --test`) for tests. Service worker uses ES modules (`"type": "module"`). Content scripts use clean self-contained IIFE modules.
- **Reason:** Guarantees zero runtime build step, fast iteration, easy inspection, and full compliance with PRD §0 & §6.1.

---

### [2026-11-23] Decision 003: Hardened Atomic Hand-off Architecture
- **Context:** Previous MVP hand-off relied on an unkeyed `pending` object in `chrome.storage.local`, which risked race conditions across multiple open Hiregram tabs, double-sends, or lost messages when the chat box was slow to load.
- **Decision:** Implemented `pending.id` generated with timestamp and random salt. `hiregram-bridge.js` maintains an in-memory `handledPendingIds` set, checks against `pending.id`, removes `pending` from storage before dispatching into Sara's chat box, and polls for enabled Send button up to 8s (handling Sara streaming/busy states). If the chat box is not found within 120s, the message is retained until the 10-minute TTL expires, allowing login and resume upload.
- **Reason:** Satisfies FR-H1 through FR-H7 and prevents double-sends.

---

### [2026-11-23] Decision 004: Multi-Layer Job Context Extraction Pipeline
- **Context:** Extracting job titles, companies, locations, and descriptions across varied career pages requires resilient fallbacks. Single-technique extractors break whenever site DOM changes or when postings use iframes / JSON-LD / SPA navigation.
- **Decision:** Implemented 5 layered tiers: (1) Active selection (>=80 chars) for description, (2) JSON-LD `JobPosting` schema, (3) 9 dedicated site adapters (LinkedIn, Wellfound, Naukri, Indeed, Greenhouse, Lever, Ashby, Workday, Instahyre), (4) Generic semantic heuristics with link density penalty and open Shadow DOM traversal, (5) Cleaned page-text fallback. The service worker executes extraction across all tab frames and merges results, prioritizing user selection and the highest-confidence frame.
- **Reason:** Guarantees >= 90% extraction success rate, fails soft with descriptive warnings, and complies with PRD §5.4.

---

### [2026-11-23] Decision 005: Strict Boundary Truncation and Message Composition
- **Context:** Sara's chat box enforces a hard character cap (maxlength 8000), and `MAX_MESSAGE_CHARS = 7500` is the safe operational ceiling. When job descriptions exceed the limit, raw character slicing cuts words in half or leaves orphaned sentences.
- **Decision:** Implemented `composeMessage` with budget accounting: header fields (`Job title:`, `Company:`, `Location:`, `Job link:`, `My instruction:`) and opening phrase `Tailor my resume to this job post:` are never truncated. The remaining budget is allocated to the JD, with a boundary-aware truncate that respects paragraph breaks (`\n\n`), sentence ends, and word breaks, appending `\n\n[Job description truncated]`. Control codes and zero-width spaces are stripped.
- **Reason:** Complies strictly with PRD §5.5 (FR-M1 through FR-M5) and prevents prompt corruption.

---

### [2026-11-23] Decision 006: Classic Content Scripts & Zero-Bundler Inlining for Injected Scripts
- **Context:** Content scripts declared in `manifest.json` and scripts injected via `chrome.scripting.executeScript` (`src/content/extractor.js`, `hotkey.js`, `overlay.js`, `hiregram-bridge.js`) run as classic scripts in Chrome's isolated world, not ES modules. Using `import` or `export` statements throws `Uncaught SyntaxError: Cannot use import statement outside a module`.
- **Decision:**
  1. Built `scripts/build-content.mjs`, a lightweight, zero-dependency concatenation script that takes single-source-of-truth modules (`lib/html-to-text.js`, `lib/url-utils.js`, `content/extractor-src.js`), strips `import`/`export` keywords, and generates a self-contained IIFE classic script `extension/src/content/extractor.js`.
  2. Guarded content scripts by configuring ESLint `sourceType: "script"` for `extension/src/content/**/*.js` and adding automated guard test `tests/unit/content-scripts-guard.test.js` checking all manifest and injected scripts.
  3. Made extractor unit tests evaluate the exact shipping content script via `dom.window.eval(EXTRACTOR_SCRIPT)` inside JSDOM rather than importing an ESM copy.
  4. Temporarily disabled opening `onboarding.html` upon extension install until Phase 6 to prevent `ERR_FILE_NOT_FOUND` in developer mode.
- **Reason:** Adheres to PRD §6.1, prevents runtime syntax errors in Chrome, maintains zero runtime dependencies, and avoids logic duplication.

---

### [2026-11-23] Decision 007: Voice Spike Result (Gate 0 PASSED - Host A Confirmed)
- **Context:** The Phase 0 spike verified `webkitSpeechRecognition` inside an extension-owned offscreen document (Host A) vs hidden extension-origin iframe (Fallback B).
- **Outcome:** Gate 0 PASSED on macOS Chrome.
  - Host A (Offscreen document) confirmed working.
  - Measured `start() → onaudiostart` latency: ~270 ms.
  - Microphone permission granted once via extension options/spike page (`navigator.mediaDevices.getUserMedia`) carries over cleanly to the offscreen document.
  - Fallback B (iframe host) is not needed.
- **Reason:** Validates FR-V1..V4 and provides immediate mic readiness with ~270 ms start latency.

---

### [2026-11-23] Decision 008: Resume List-to-Editor Multi-Stage Hand-Off & Tab Targeting
- **Context:** Real-browser testing revealed that `https://hiregram.ai/resume` is a resume list dashboard ("YOUR DEFAULT", "Open in editor", "All resumes") rather than the chat editor. Sara's chat box only exists inside the editor view. Furthermore, broad `storage.onChanged` allowed arbitrary open Hiregram tabs to compete for `pending`.
- **Decision:**
  1. Updated FR-H7: The service worker opens a dedicated NEW tab for every hand-off, tracking `{ pendingId → tabId }`.
  2. The bridge script on Hiregram queries the service worker (`CLAIM_PENDING`) with its own `tabId`. The service worker permits only the designated target tab to claim the pending payload.
  3. The bridge operates as a multi-stage state machine:
     - `LIST`: Locates the "Open in editor" control inside the "YOUR DEFAULT" section (navigates if anchor, clicks if button/element). Toasts "Opening your default resume…".
     - `EDITOR`: Awaits Sara's chat box, injects React value, polls Send up to 8s, clicks Send, and toasts "sent to Sara ✓".
     - `LOGIN`: Detects login/auth screen, toasts "Log in to continue", and preserves `pending` until TTL.
     - `NO_RESUME`: Detects empty state, toasts "Upload a resume on Hiregram first", preserves `pending`.
- **Reason:** Resolves the blocking hang on `/resume`, isolates editing sessions, and prevents double-sends across tabs.

---

### [2026-11-23] Decision 009: Robust Wake-Intent Parsing & Closed Shadow DOM Overlay
- **Context:** Real-world speech recognition transcripts from Chrome revealed common mis-hearings of "Sara" ("Sahara", "Sarah", "Sera", "Zara", "Saara"), Hindi/Hinglish speech artifacts ("marriage mein", "Mere"), and WebSpeechEngine firing multiple final segments for single utterances.
- **Decision:**
  1. Set default speech recognition language to `en-IN`.
  2. Implemented `WebSpeechEngine` in `src/voice/voice-engine.js` that continuously concatenates all completed final segments with any trailing interim result, capturing up to 3 alternatives per segment.
  3. Created `parseCommand` in `src/lib/wake-intent.js`:
     - Accepts `sara`, `sarah`, `sera`, `zara`, `saara`, `sarra`, `sahra`, `sahara`, and any token within Levenshtein distance &le; 1 of "sara" in the first 4 words.
     - Scans all transcript alternatives and prioritizes the one containing the keyword.
     - Defaults intent to `TAILOR` without requiring the word "resume". Fuzzy-matches "tailor" (`tailor`, `taylor`, `tailer`, `tailors`, `customise`, etc.).
     - Strips speech artifacts and only forwards instructions containing explicit instruction markers (`keep`, `focus`, `emphasise`, `highlight`, `one page`, `also`, `make sure`, `without`, `include`, `remove`).
  4. Built `src/content/overlay.js` rendering a sleek pill inside a closed Shadow DOM (`mode: "closed"`) on the top-level document, displaying live transcript feedback with zero host page style leakage.
- **Reason:** Satisfies FR-V1..V9, FR-A1..A8, FR-U1..U6, and FR-K1..K7, preventing garbled speech noise from reaching Sara.






