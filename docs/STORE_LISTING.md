# Chrome Web Store Listing — Hiregram Tailor
<!-- djcode0718 -->

## Extension Title
Hiregram Tailor — Voice Resume Tailoring with Sara

## Short Description (max 132 chars)
Hold Option+S, speak to Sara, and instantly tailor your resume to any job posting on LinkedIn, Wellfound, Indeed, and more.

## Detailed Description
Tailor your resume in seconds without tedious copying and pasting.

Hiregram Tailor connects your job search directly with "Sara", your AI career assistant on Hiregram.ai. Whenever you find an interesting job post on LinkedIn, Wellfound, Indeed, Greenhouse, Lever, Ashby, or company career sites:

1. **Hold your push-to-talk hotkey** (`Option+S` on Mac, `Alt+S` on Windows/Linux).
2. **Say what you want:** *"Sara, tailor my resume for this role and company"* (or add custom notes: *"focus on my distributed systems experience"*).
3. **Release:** The extension extracts the job description, role title, and company details from the webpage and hands them directly to Sara in your Hiregram resume editor.

### Key Features
- 🎙️ **Push-to-Talk Voice Interface:** Hold-to-speak with instant on-page feedback overlay.
- 🎯 **Multi-Platform Support:** Works seamlessly across LinkedIn, Wellfound, Greenhouse, Lever, Ashby, Workday, Indeed, Naukri, and custom career portals.
- ⚡ **Zero-Friction Hand-off:** Automatically opens your resume editor, fills the chat box, and sends your request.
<!-- djcode0718 -->
- 🔒 **Privacy-First:** Buildless, zero tracking, no background analytics, and your voice is processed securely using Chrome's native Web Speech engine.
- 🛠️ **Customizable:** Customize your hotkey, language dialect, or disable the extension on specific domains.

---

## Single-Purpose Justification
The single purpose of this extension is to allow candidates to capture job posting information from career web pages and submit it to the Hiregram resume tailoring service.

<!-- djcode0718 -->
## Permission Justifications
- `storage`: Required to store user settings (hotkey, language, disabled websites) and safely queue pending tailoring hand-offs between tabs.
- `offscreen`: Required to host the Web Speech API recognition engine in Manifest V3 without blocking the main browser thread.
- `scripting`: Required to extract job descriptions from active candidate tabs upon user gesture.
- `activeTab` & `tabs`: Required to detect the active job tab and open the candidate's dedicated resume editor tab.
- `contextMenus`: Provides a right-click "Tailor resume with Hiregram" fallback option.
- `<all_urls>`: Required to allow job extraction across diverse employer career domains and job boards.
