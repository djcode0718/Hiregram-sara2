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

