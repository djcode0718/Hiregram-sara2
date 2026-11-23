# Pull Request Summary — Hiregram Tailor "Sara" Voice Upgrade (v0.2.0)

## Overview
This PR upgrades the Hiregram Tailor Chrome extension from an MVP right-click text forwarder to an end-to-end voice-driven assistant powered by Chrome's native Web Speech API. Users can press and hold `Option+S` (`Alt+S`), speak instructions to "Sara", and have job context automatically extracted, structured, and delivered directly into their Hiregram resume editor.

---

## Key Changes

### 1. Hardened Resume Editor Hand-off
- Direct targeting to candidate's dedicated resume editor: `https://hiregram.ai/resume/7c284c1a-26b8-41fd-97fb-210fe973f904`.
- Multi-stage bridge state machine on `hiregram-bridge.js` observing SPA navigation transitions with continuous polling.
- Dual composer support: React native prototype setter for `<textarea data-chat-box>` and `contenteditable` fallback.
- Support for Hiregram's "Pasted text · N words" chip formatting.
- Send button polling up to 8s with atomic storage claim and explicit stage feedback toasts.

### 2. Push-to-Talk Hotkey & On-Page Overlay
- Push-to-talk listener (`hotkey.js`) running in isolated world across all frames with modifier key validation, accidental tap cancellation (< 350ms), and 30s auto-stop.
- Programmatic injection on install/startup into all active tabs.
- Closed Shadow DOM visual feedback overlay (`overlay.js`) attached to `document.documentElement`, displaying microphone state, live interim transcript, and operation status without site CSS bleeding or layout shifts.
- Dedicated keep-alive port connection during voice capture to prevent service worker suspension.

### 3. Speech Engine & Fuzzy Wake-Intent Engine
- Manifest V3 offscreen document speech recognition host (`offscreen.html`/`offscreen.js`) with measured start latency of ~270ms.
- Deterministic intent parser (`wake-intent.js`) with fuzzy matching (Levenshtein ≤ 1, accepted Indian English phonetic spellings like "Sahara", noise filtering, and custom instruction marker parsing).

### 4. Multi-Layer Extraction & Message Composition
- Layered extraction pipeline with 9 site adapters (LinkedIn, Wellfound, Indeed, Naukri, Greenhouse, Lever, Ashby, Workday, Instahyre), schema.org JSON-LD parser, Shadow DOM traversal, and manual selection override.
- Structured message builder (`compose-message.js`) enforcing a 7500-character cap with paragraph- and sentence-boundary truncation.

### 5. Onboarding, Options & Diagnostics
- First-run onboarding flow (`onboarding.html`) with 1-click microphone permission grant and interactive demo test.
- Options page (`options.html`) with hotkey recorder, dialect selector (`en-IN` default), domain exclusion manager, tab diagnostic ping, and debug info exporter.

---

## Verification
- **Automated Tests:** 41/41 unit & integration tests passing (`npm test`).
- **Linter:** ESLint clean with 0 errors and 0 warnings (`npm run lint`).
- **Content Script Guard:** Asserted zero `import`/`export` keywords in all content and injected scripts.
- **Packaging:** Automated build creates `dist/hiregram-tailor-0.2.0.zip` via `npm run package`.
