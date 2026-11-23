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
