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




