# Hiregram Tailor "Sara" Voice Extension

> A buildless Manifest V3 Chrome extension that tailors your resume on [hiregram.ai](https://hiregram.ai) with a single push-to-talk voice command.

Hold **Option+S** (`Alt+S` on Windows/Linux), say **"Sara, tailor my resume for this role and company"**, and release. Hiregram Tailor automatically extracts the job context and sends it directly to Sara inside your Hiregram resume editor.

---

## Features

- **Push-to-Talk Voice Interface:** Hold your hotkey, speak your tailoring instruction, and release.
- **On-Page Visual Feedback:** Real-time closed Shadow DOM pill showing microphone status, live interim transcript, and progress states without layout shift.
- **Smart Wake-Keyword & Intent Recognition:** Powered by fuzzy matching (Levenshtein ≤ 1, accepted Indian English phonetic spellings like "Sahara", and instruction filters).
- **Multi-Layer Job Extraction:** Seamlessly extracts job title, company, location, and description across:
  - LinkedIn, Wellfound, Indeed, Naukri, Greenhouse, Lever, Ashby, Workday, Instahyre
  - Open Shadow DOM traversal & schema.org `JobPosting` JSON-LD
  - Manual text selection fallback (highlight ≥ 80 characters)
- **Direct Resume Editor Delivery:** Hardened atomic hand-off opens your dedicated resume editor (`https://hiregram.ai/resume/7c284c1a-26b8-41fd-97fb-210fe973f904`), fills Sara's chat box, and triggers Send.
- **Zero Runtime Dependencies & Buildless:** Pure vanilla JavaScript (ES modules for service worker and options; self-contained IIFE classic scripts for content scripts).
- **Privacy First:** No voice or candidate data is sent to third-party tracking servers. Audio is processed natively via Chrome's Web Speech API.

---

## Installation & Setup

### Requirements
- Google Chrome version 116 or newer.
- Node.js 18+ (used strictly for running tests, linter, and packaging).

### Loading the Unpacked Extension in Chrome
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top right corner.
3. Click **Load unpacked** in the top left.
4. Select the `extension/` directory inside this repository.
5. The extension onboarding page (`onboarding.html`) will automatically launch to guide you through microphone access and hotkey preview.

---

## Usage

1. Navigate to any job posting (e.g. on [Wellfound](https://wellfound.com) or [LinkedIn](https://www.linkedin.com/jobs)).
2. **Press and hold `Option+S`** (`Alt+S`).
3. The visual overlay pill will appear at the bottom of the page showing `Listening…`.
4. Say:
   > *"Sara, tailor my resume for this role and company"*
   *(You can also add specific instructions: "Sara, tailor my resume, focus on React and keep it to one page".)*
5. **Release `Option+S`**.
6. The extension extracts the job post, opens your Hiregram resume editor tab, pastes the tailored request, and clicks Send.

---

## Settings & Diagnostics

Open the extension Options by right-clicking the toolbar icon and selecting **Options** (or via `chrome://extensions` → Details → Extension options):
- **Enable / Disable Toggle:** Pause extension hotkey listeners.
- **Require "Sara" Keyword:** Toggle whether commands must contain "Sara".
- **Hotkey Recorder:** Change your push-to-talk shortcut with modifier validation.
- **Language Dialect:** Choose between `en-IN`, `en-US`, `en-GB`, `en-CA`, or `en-AU`.
- **Disabled Websites:** Specify domains where the extension shortcut should never trigger.
- **System Health Diagnostics:** Test microphone permissions and ping content scripts on the active tab.

---

## Development & Testing

```bash
# Install development tooling (linter & JSDOM)
npm install

# Run unit & extraction tests
npm test

# Run ESLint check
npm run lint

# Package extension for Chrome Web Store distribution
npm run package
```

The packaged store archive will be created at: `dist/hiregram-tailor-0.2.0.zip`.

---

## Documentation Links

- [PRD Specification](PRD.md)
- [Architectural Decisions Log](docs/DECISIONS.md)
- [Implementation Checklist](CHECKLIST.md)
- [Manual QA Test Plan & Matrix](docs/MANUAL_QA.md)
- [Privacy Policy](docs/PRIVACY.md)
- [Store Listing Copy](docs/STORE_LISTING.md)
