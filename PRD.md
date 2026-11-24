# PRD: Hiregram Tailor — "Sara" Voice Command (v0.2 MVP)

| | |
|---|---|
| **Product** | Hiregram Tailor (Chrome extension, Manifest V3) |
| **Version** | 0.1.0 (existing) → 0.2.0 (this PRD) |
| **Status** | Existing MVP built (right-click / toolbar → Sara). This PRD adds voice activation and automatic job-context extraction. |
| **Platform** | Google Chrome (desktop, macOS primary; Windows/Linux must work). Chromium browsers best-effort. |
| **Dev environment** | MacBook Air M4, Antigravity, repo folder `Hiregram-sara2`, GitHub connected |

---

## 1. Overview

Today a candidate must select a job description and use the right-click menu "Tailor resume with Hiregram". This PRD replaces that effort with a single gesture:

> The candidate is on any job page. They **hold a hotkey**, say **"Sara, tailor my resume for this role and company"**, and **release**. The extension grabs the job description, title, company, location and URL from the page, sends it to Sara on hiregram.ai, and Hiregram opens in a tab with Sara already tailoring the resume.

The hand-off to Hiregram (storage → content script → Sara's chat box → Send → open/focus tab) **already exists and is retained**. New work is: voice capture, the "Sara" keyword gate, intent parsing, job-context extraction, on-page feedback UI, settings/onboarding, and hardening.

## 2. Goals, non-goals, success metrics

### Goals
1. One-gesture tailoring from any job page, with no manual copying or selecting.
2. Reliable extraction of job description + title + company + location + source URL from major portals and generic career pages.
3. Feels like a polished product: instant feedback, clear errors, never silently fails, never double-sends.
4. Works fully inside Chrome. No local server, no backend changes required.

### Non-goals (v0.2)
- Always-on wake word ("Hey Sara" without a hotkey).
- System-wide hotkey outside Chrome.
- Firefox / Safari / mobile.
- Backend transcription (Whisper etc.) and LLM-based extraction. The code must keep these as clean future swap-in points (see §6.4).
- Choosing among multiple resumes (Hiregram uses the candidate's default/base resume).
- Auto-applying to jobs, scraping job lists, background crawling.

### Success metrics (targets for MVP acceptance)
| Metric | Target |
|---|---|
| Key release → message sent to Sara (page already open) | ≤ 4 s p50, ≤ 7 s p90 (excludes Hiregram page load) |
| Extraction yields a usable JD (≥ 300 chars) on the supported-site test set | ≥ 90 % |
| Title + company correctly detected on supported-site test set | ≥ 85 % |
| Duplicate sends per gesture | 0 |
| Unhandled errors visible only in console (user sees nothing) | 0 |

## 3. Users and scenarios

**Primary user:** an active job seeker using Hiregram, browsing LinkedIn, Wellfound, Naukri, Indeed, company career pages (Greenhouse, Lever, Ashby, Workday, etc.).

| # | Scenario | Expected result |
|---|---|---|
| S1 | On a LinkedIn job page, holds hotkey, says "Sara, tailor my resume for this role and company" | JD + metadata extracted, sent to Sara, Hiregram tab opens/focuses, Sara starts tailoring |
| S2 | On a company careers page, user highlights only part of the JD, then does S1 | Selected text is used as the JD; metadata still filled from the page |
| S3 | User says "Sara, tailor my resume for this role, keep it to one page" | Extra instruction passed to Sara verbatim |
| S4 | User has no mic / mic denied | Toolbar button and right-click still work (no voice needed) |
| S5 | User says something without "Sara" | Nothing is sent; overlay explains what to say |
| S6 | User is on a non-job page | Clear message: no job description found; suggests selecting text |
| S7 | Hiregram tab already open | Existing tab is focused and the message is delivered (existing behaviour) |
| S8 | User not logged in / no resume uploaded on Hiregram | Message waits (TTL 10 min) and sends once the chat box appears; clear toast otherwise |

## 4. User flow

### 4.1 Primary flow (voice)
1. User is on a job page in Chrome. The page is focused.
2. User **presses and holds** the hotkey (default `Alt+S` = `Option+S` on Mac; configurable).
3. Overlay (bottom-center pill) appears immediately: **"Listening…"** with a mic animation and live transcript. Mic activates. **Extraction starts in parallel at key-down** so it is ready by key-up.
4. User speaks: *"Sara, tailor my resume for this role and company."*
5. User **releases** the hotkey. Overlay → **"Understanding…"**.
6. Transcript is checked: keyword "Sara" present at the start → intent = tailor.
7. Overlay → **"Reading the job post…"** (usually already done) then **"Sending to Sara…"**.
8. Hiregram `/resume` tab is opened or focused (existing behaviour). Content script on hiregram.ai fills Sara's box and presses Send (existing behaviour).
9. Overlay on the job page → **"Sent to Sara ✓"** and fades after 2.5 s. On Hiregram, the existing toast shows "sent to Sara ✓".
10. Sara tailors; the candidate reviews and edits in Hiregram.

### 4.2 Fallback flows (kept working)
- **Right-click → "Tailor resume with Hiregram"** (selection or page). Now uses the new extractor.
- **Toolbar button click**: tailors the current page immediately, no voice, no keyword needed.

### 4.3 Cancel
- `Esc` while listening cancels everything. Holding shorter than 350 ms is treated as an accidental tap and ignored silently. Recording auto-stops at 30 s.

## 5. Functional requirements

Priority: **P0** = must ship, **P1** = should ship in MVP if time allows.

### 5.1 Activation and hotkey
| ID | Requirement | P |
|---|---|---|
| FR-A1 | A content script listens for `keydown`/`keyup` and matches the configured combo using `event.code` (not `event.key`, because Option+S types "ß" on macOS). | P0 |
| FR-A2 | Combo = at least one modifier (Alt/Ctrl/Shift/Meta) + one non-modifier key. Default `Alt+S`. | P0 |
| FR-A3 | Hold-to-talk: recording starts on first `keydown` (ignore `event.repeat`), stops on `keyup` of the main key **or** any required modifier. | P0 |
| FR-A4 | On match, call `preventDefault()` + `stopPropagation()` so no character is typed and sites don't react. Ignore while `event.isComposing` (IME). | P0 |
| FR-A5 | Works inside text inputs / contenteditable. | P0 |
| FR-A6 | Runs in all frames (`all_frames: true`) because many career pages embed Greenhouse/Lever iframes. Overlay is only drawn in the top frame; sub-frames forward events through the service worker. | P0 |
| FR-A7 | Window `blur`, tab hidden, or `Esc` while recording → cancel cleanly. | P0 |
| FR-A8 | Minimum hold 350 ms, maximum 30 s (auto-stop and proceed). | P0 |
| FR-A9 | Hotkey is configurable in Options with a "press the shortcut" recorder that validates the combo and warns about common conflicts (e.g. `Cmd+C`, `Cmd+V`, `Cmd+T`, `Cmd+W`, `Ctrl+C`). | P0 |
| FR-A10 | Global on/off toggle, and a per-site "disable on this site" list. | P1 |

### 5.2 Voice capture (Chrome Web Speech API)
| ID | Requirement | P |
|---|---|---|
| FR-V1 | Use `webkitSpeechRecognition` with `continuous = true`, `interimResults = true`, `maxAlternatives = 3`. | P0 |
| FR-V2 | Recognition language defaults to `navigator.language` (fallback `en-US`); selectable in Options (include `en-IN`, `en-US`, `en-GB`). | P0 |
| FR-V3 | Mic permission is requested **once** through an extension-owned page (Options/Onboarding) via a user click, so the permission belongs to the extension origin and never prompts per website. | P0 |
| FR-V4 | Recognition runs in an extension-owned context (offscreen document **or** extension-origin iframe; see §6.3 / spike) so it is independent of the host site's permissions and CSP. | P0 |
| FR-V5 | On key release call `stop()` (not `abort()`), wait for the final result (`onend`), with a 2.5 s safety timeout. If no final result, use the last interim result. | P0 |
| FR-V6 | Show the live transcript in the overlay while listening. Indicator switches to "Listening" only once audio actually starts (`onaudiostart`), so users don't speak before the mic is hot. Overlay shows a brief "Starting mic…" until then. | P0 |
| FR-V7 | Microphone is only active while the key is held. No background listening. | P0 |
| FR-V8 | Handle recognition errors with friendly messages: `not-allowed` / `service-not-allowed` (open Options to grant mic), `no-speech` ("Didn't catch that"), `audio-capture` (no mic found), `network` (speech service unreachable), `aborted` (silent). | P0 |
| FR-V9 | Voice engine sits behind a `VoiceEngine` interface so a backend transcription engine can replace it later. | P0 |

### 5.3 The "Sara" keyword and intent
| ID | Requirement | P |
|---|---|---|
| FR-K1 | The transcript must contain the keyword within its first 4 words. Accepted: "sara", "sarah", "sera", "zara", "saara", "sarra", "sahra", optional prefix "hey/hi/ok/okay". Matching is case-insensitive, punctuation-insensitive, and also accepts any first-4-words token within Levenshtein distance ≤ 1 of "sara". Also check the alternative transcripts (`maxAlternatives`). | P0 |
| FR-K2 | "Require keyword" is a setting, default **ON**. If OFF, any command is accepted. | P0 |
| FR-K3 | If the keyword is missing, send nothing. Overlay: **"Didn't hear 'Sara'. Try: 'Sara, tailor my resume for this role.'"** | P0 |
| FR-K4 | After removing the keyword, the remainder is the **instruction**. Intent `TAILOR` matches verbs (tailor, customize/customise, adapt, optimize/optimise, update, rewrite, fit, match, improve, tweak, personalize) with resume/CV/profile, or phrases such as "for this job/role/position/company". An instruction that is **only** "Sara" (or "Sara, go") defaults to `TAILOR`. | P0 |
| FR-K5 | If the instruction has a recognisable intent that is **not** tailoring (e.g. "Sara, what's the weather") → send nothing, overlay: "I can only tailor your resume from here for now." | P0 |
| FR-K6 | Extra instructions beyond the core command ("keep it to one page", "emphasise backend work") are preserved and forwarded to Sara in the message (§5.5). Boilerplate ("tailor my resume for this role and company") is stripped to avoid redundancy. | P0 |
| FR-K7 | All parsing is pure, deterministic and unit-tested with a table of ≥ 40 phrases (including mis-hearings like "Sarah, tailor my CV for this position"). | P0 |

### 5.4 Job-context extraction
The extractor runs **on demand** (not continuously) in the active tab via `chrome.scripting.executeScript` with `allFrames: true`. Results from all frames are scored and the best one is used.

**Output (`JobContext`)** — see §7.1: `title`, `company`, `location`, `employmentType?`, `url` (canonical), `pageUrl`, `description` (plain text), `source`, `confidence`, `warnings[]`.

| ID | Requirement | P |
|---|---|---|
| FR-E1 | **Layer 1: user selection.** If the user has selected ≥ 80 characters (in any frame), use it as `description` (source `selection`). Metadata still comes from the layers below. | P0 |
| FR-E2 | **Layer 2: JSON-LD `JobPosting`.** Parse all `<script type="application/ld+json">`, handle arrays, `@graph`, nested `mainEntity`, invalid JSON (try/catch per block). Map `title`, `hiringOrganization.name`, `jobLocation` (array or object; `addressLocality`, `addressRegion`, `addressCountry`), `jobLocationType` (TELECOMMUTE → "Remote"), `employmentType`, `description` (HTML, possibly entity-escaped → convert to plain text preserving paragraph and list structure). | P0 |
| FR-E3 | **Layer 3: site adapters** for: LinkedIn (`/jobs/view/…` and the right-hand pane on `/jobs/search`, `/jobs/collections`), Wellfound, Naukri, Indeed, Greenhouse, Lever, Ashby, Workday (`myworkdayjobs.com`), Instahyre. Each adapter has several fallback selectors plus text-heuristics, lives in its own file/section, and fails soft (returns partial data). | P0 |
| FR-E4 | **Layer 4: generic heuristics.** Title from `h1` / `og:title` / `document.title` (split on " at ", " - ", " | ", " – ", " — "); company from `og:site_name`, JSON-LD `publisher`, `meta[name=author]`, hostname as last resort (e.g. `careers.stripe.com` → "Stripe"); JD = best-scoring content block: candidates are `main`, `article`, `[role=main]`, and block elements with ≥ 500 chars text; score by presence of headings/keywords (responsibilities, requirements, qualifications, about the role, what you'll do, who you are, benefits, experience, skills), text length, link density (penalise), and penalise nav/footer/aside/cookie banners. | P0 |
| FR-E5 | **Layer 5: page-text fallback.** If JD < 300 chars after all layers, use cleaned `main`/`body` text (nav/footer/script/style stripped, whitespace collapsed) trimmed to the budget, with `confidence: "low"`. Sara can read company/title from raw text. | P0 |
| FR-E6 | If even the fallback is < 150 chars → error: "Couldn't find a job description on this page. Select the text and try again." Nothing is sent. | P0 |
| FR-E7 | LinkedIn search pane: derive the canonical URL `https://www.linkedin.com/jobs/view/<currentJobId>/` from the `currentJobId` query param. | P0 |
| FR-E8 | Canonical URL: prefer JSON-LD `url` / `<link rel=canonical>` if it's the same site; strip tracking params (`utm_*`, `trk*`, `ref`, `refId`, `trackingId`, `gclid`, `fbclid`, `src`, `source`) but keep params that identify the job (`jobId`, `gh_jid`, `currentJobId`, `id`, `job`, `jk`, `lever-source` is stripped). | P0 |
| FR-E9 | HTML → text conversion preserves paragraphs, line breaks, and list bullets (`- `), strips scripts/styles, decodes entities, collapses 3+ blank lines. No third-party libs. | P0 |
| FR-E10 | Expand "See more / Show more" content when the full text isn't in the DOM, only if it can be done safely (click is limited to known adapter selectors, with a 600 ms wait). Otherwise fall back to what's present and add a warning. | P1 |
| FR-E11 | `confidence`: `high` = JSON-LD or adapter gave title + company + JD ≥ 300; `medium` = JD ok but metadata incomplete; `low` = page-text fallback. | P0 |
| FR-E12 | Extraction must finish within 2.5 s or return best-so-far. | P0 |

### 5.5 Message composition
Sara's chat box has `maxlength=8000` (existing code uses 7500 as a safe cap). The message must keep the **existing opening phrase** (`Tailor my resume to this job post:`) because Sara already responds to it.

```
Tailor my resume to this job post:

Job title: <title>
Company: <company>
Location: <location>
Job link: <url>

My instruction: <extra instruction, if any>

Job description:
<description>
```

| ID | Requirement | P |
|---|---|---|
| FR-M1 | Omit any line whose value is empty (never print "undefined" / "Unknown"). | P0 |
| FR-M2 | Hard cap `MAX_MESSAGE_CHARS = 7500`. The JD gets whatever budget remains after header lines; truncate at a paragraph/sentence boundary and append `\n\n[Job description truncated]`. Header is never truncated. | P0 |
| FR-M3 | Normalise whitespace; strip control characters and zero-width characters. | P0 |
| FR-M4 | Source toolbar/context-menu usage without extractable JD and with only URL falls back to the **existing** message `Tailor my resume to this job post: <url>`. | P0 |
| FR-M5 | Message builder is a pure function with unit tests (empty fields, long JD, unicode, exactly-at-limit). | P0 |

### 5.6 Hand-off to Hiregram (retained, hardened & multi-stage)
| ID | Requirement | P |
|---|---|---|
| FR-H1 | Multi-stage hand-off: write `pending` to `chrome.storage.local`, open a dedicated new tab to `https://hiregram.ai/resume`. Content script handles both the resume list page (navigates default resume to editor) and the editor page (fills Sara's textarea + Send). | P0 |
| FR-H2 | `pending` gets a unique `id`; service worker records `{ pendingId: tabId }`. The bridge claims only if the service worker confirms its own tab id matches (runtime message `CLAIM_PENDING`). Guarantees no double-send and no other Hiregram tab steals the pending payload. | P0 |
| FR-H3 | TTL 10 min. If user is logged out, keep `pending` until TTL so it sends after login. Clear toasts for each stage. | P0 |
| FR-H4 | All Hiregram DOM selectors live in `constants.js` with fallbacks. Bridge state machine handles `LIST` ("Open in editor" under YOUR DEFAULT), `EDITOR` (Sara's textarea), `LOGIN` (login prompt), and `NO_RESUMES`. Send button poll up to 8 s; if disabled, leave text filled and toast. | P0 |
| FR-H5 | Support `https://hiregram.ai/*` and `https://www.hiregram.ai/*`. Centralized URL patterns and selectors. | P0 |
| FR-H6 | If Sara is busy (Send disabled because a previous reply is streaming), wait up to 8 s, then fill-only + toast. | P0 |
| FR-H7 | Dedicated new tab: open a NEW tab for every hand-off (do not reuse or navigate existing Hiregram tabs) so the candidate's active editing session is never disturbed. | P0 |
| FR-H8 | Report delivery result back to the job page overlay (best effort): `sent`, `filled-not-sent`, `timeout`. | P1 |
| FR-H9 | **Dynamic default resume detection:** Service worker opens `https://hiregram.ai/resume`. Bridge inspects `section[aria-labelledby="rh-index"]` (or fallback `<ul>` containing `a[data-row-link]`) for the row whose metadata paragraph starts with leaf element text `Default` (excluding buttons, group menus, decoys). Navigates via `location.assign` to that row's anchor href. No hardcoded resume IDs anywhere. | P0 |
| FR-H10 | **Decoy immunity:** Strictly ignore "Set as default", "Make this your default?", "YOUR DEFAULT", and row action menus. Never use loose substring or class-only matching. | P0 |
| FR-H11 | **Hero card fallback:** If no list marker exists, resolve via hero card ("YOUR DEFAULT") anchor to `/resume/<id>` or click its "Open in editor" button. | P0 |
| FR-H12 | **Non-destructive idempotent claim:** `CLAIM_PENDING` verifies target tab authorization and returns payload without deleting from storage. Payload deleted ONLY after Send click is confirmed. Reloading the page survives cleanly. | P0 |
| FR-H13 | **Hand-off lifecycle states & loop guard:** Track `pending.status` ("queued" -> "sending" -> "sent") and `pending.navAttempts`. If redirected back to list &ge; 2 times, stop with loop guard toast. Never re-send if status is "sending" or "sent". | P0 |
| FR-H14 | **Stage feedback & timeouts:** Explicit toasts per stage (finding, opening, empty, no-default, timed-out, loop, login). Overall resolve timeout 12s; empty confirmed after &ge; 3s. Clean up all observers and timers on stage exit or page unload. | P0 |

### 5.7 On-page feedback overlay
| ID | Requirement | P |
|---|---|---|
| FR-U1 | Rendered in a **closed Shadow DOM** attached to `document.documentElement`, so site CSS never leaks in or out. Fixed bottom-center, max z-index, `pointer-events: none` except for a close/cancel button. | P0 |
| FR-U2 | States: `starting-mic`, `listening` (pulsing mic + live transcript), `understanding`, `reading-page`, `sending`, `sent`, `error`, `hint` (first-run tip). Each has clear copy, an icon, and no layout jump. | P0 |
| FR-U3 | `role="status"` + `aria-live="polite"`. Respects `prefers-reduced-motion` and `prefers-color-scheme`. | P0 |
| FR-U4 | Success auto-dismisses after 2.5 s; errors after 6 s (or on any keypress/click); `Esc` always dismisses/cancels. | P0 |
| FR-U5 | Error overlay may include an action link ("Open settings", "Grant microphone"). | P0 |
| FR-U6 | Overlay is never shown when the extension is disabled for the site. Not injected into the Hiregram site itself (the bridge toast covers that). | P0 |

### 5.8 Options, onboarding, permissions
| ID | Requirement | P |
|---|---|---|
| FR-O1 | **First-run onboarding** opens on install (`chrome.runtime.onInstalled`, reason `install`): 3 steps: (1) Grant microphone (button → `getUserMedia`, then stop tracks), (2) See/change hotkey, (3) Try it: a tiny demo page section with sample job text and instructions. Includes a privacy note: speech is processed by Chrome's speech service (Google). | P0 |
| FR-O2 | **Options page**: hotkey recorder, language, "Require 'Sara' keyword", enable/disable, disabled sites, mic permission status (checked via `navigator.permissions.query({name:'microphone'})`) with Grant / Test mic button, "Open Hiregram" link, version, "Copy debug info" button, link to shortcuts for Chrome. | P0 |
| FR-O3 | Settings stored in `chrome.storage.sync` with defaults and schema validation; changes propagate live to content scripts via `storage.onChanged` (no reload). | P0 |
| FR-O4 | Toolbar button (existing) keeps working. Badge shows `!` with a title tooltip on restricted pages (chrome://, Web Store, PDF viewer, `about:`), cleared after 4 s. | P0 |
| FR-O5 | On update (`reason: update`), do not re-open onboarding. Re-inject content scripts into already-open tabs is **not** required; overlay shows "Extension updated — refresh this page" if the old context is invalidated. | P0 |

### 5.9 Error-handling matrix (must all be implemented)
| Situation | User sees | Sends? |
|---|---|---|
| Mic denied / not granted | "Microphone access needed" + [Grant microphone] | No |
| No mic hardware | "No microphone found" | No |
| Silence / no speech | "Didn't catch that. Hold the key and say 'Sara, tailor my resume'." | No |
| Keyword missing | "Didn't hear 'Sara'…" with the heard transcript | No |
| Unsupported intent | "I can only tailor your resume from here for now." | No |
| Speech service offline | "Speech recognition needs an internet connection." | No |
| No JD found | "Couldn't find a job description. Select the text and try again." | No |
| Restricted page | Badge `!` + tooltip | No |
| Extension context invalidated | "Hiregram Tailor was updated. Refresh this page." | No |
| Hiregram chat box not found (≤ TTL) | Toast on Hiregram, message retained | Later |
| Send disabled | Text filled, toast "press Send" | Partial |
| Another gesture in progress | Ignored; overlay stays in current state | No |
| Unexpected exception | "Something went wrong. [Copy debug info]" | No |

## 6. Architecture

### 6.1 Components
```
extension/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── service-worker.js      # orchestrator, state machine, menus, action click
│   │   ├── pipeline.js            # voice → parse → extract → compose → handoff
│   │   ├── handoff.js             # existing sendToHiregram(), hardened
│   │   └── voice-host.js          # creates/ensures offscreen doc (or iframe host)
│   ├── content/
│   │   ├── hotkey.js              # keydown/keyup listener (all frames)
│   │   ├── overlay.js             # shadow-DOM UI (top frame)
│   │   ├── extractor.js           # injected on demand, all frames
│   │   └── hiregram-bridge.js     # existing content.js, renamed + hardened
│   ├── voice/
│   │   ├── offscreen.html / offscreen.js   # hosts SpeechRecognition
│   │   ├── voice-engine.js        # VoiceEngine interface + WebSpeechEngine
│   ├── pages/
│   │   ├── options.html/.js/.css
│   │   └── onboarding.html/.js/.css
│   └── lib/
│       ├── constants.js           # selectors, limits, defaults, message types
│       ├── settings.js            # load/save/validate/defaults
│       ├── wake-intent.js         # keyword + intent parser (pure)
│       ├── compose-message.js     # message builder (pure)
│       ├── html-to-text.js        # html→text (pure, DOM-less capable)
│       ├── url-utils.js           # canonicalise, strip tracking
│       └── logger.js              # ring buffer debug log, no page content
├── icons/ (16, 32, 48, 128)
tests/
docs/
```
No bundler. Service worker is an ES module (`"type": "module"`). Content scripts are self-contained classic scripts (IIFEs) because they cannot use static `import`. Pure logic lives in `lib/` and is imported by the service worker/pages and unit-tested in Node (`node --test`).

### 6.2 State machine (service worker, one active session at a time)
```
IDLE → STARTING_MIC → LISTENING → TRANSCRIBING → PARSING → EXTRACTING → SENDING → DONE
                         ↘ (cancel / error at any point) → ERROR → IDLE
```
- Only one session may exist. A second `VOICE_START` while not `IDLE` is ignored.
- Every transition is pushed to the top frame's overlay of the originating tab.
- Extraction is started at `LISTENING` entry and awaited at `EXTRACTING` (hides latency).
- Service worker may be suspended by Chrome: persist `session` in `chrome.storage.session`; keep alive during a session by an open port from the content script. All listeners registered synchronously at top-level.

### 6.3 Voice host (spike decides)
`SpeechRecognition` is not available in the service worker. Options:

- **A (preferred): Offscreen document** (`chrome.offscreen.createDocument`, reason `USER_MEDIA`) running `voice-engine.js`. Mic permission pre-granted at onboarding.
- **B (fallback): Extension-origin iframe** (`voice.html`, listed in `web_accessible_resources`, `allow="microphone"`) injected hidden into the top frame by the content script.
- Do **not** run recognition directly in the page's content script (prompts per site) and do **not** use a separate popup window (steals focus, key-up would be lost).

**Phase 0 spike must prove** that `webkitSpeechRecognition` starts, delivers interim + final results, and stops cleanly in option A after mic permission was granted from the Options page. If it doesn't, switch to B and record the decision in `docs/DECISIONS.md`.

### 6.4 Extensibility seams (do now, build later)
- `VoiceEngine` interface: `start(opts)`, `stop()`, `cancel()`, events `onaudiostart | onInterim | onFinal | onError | onEnd`. `WebSpeechEngine` is the only implementation.
- `Extractor` returns `JobContext`. A future `extractWithLLM(ctx)` can post-process low-confidence results.
- `Handoff` can later change from "type into textarea" to "structured payload / URL param" without touching callers.

### 6.5 Message contracts (internal)
| Type | From → To | Payload |
|---|---|---|
| `VOICE_START` | hotkey → SW | `{ frameId }` |
| `VOICE_STOP` | hotkey → SW | `{}` |
| `VOICE_CANCEL` | hotkey/overlay → SW | `{ reason }` |
| `OVERLAY_STATE` | SW → top frame | `{ state, transcript?, message?, action? }` |
| `ENGINE_START/STOP/CANCEL` | SW → offscreen | `{ lang }` |
| `ENGINE_EVENT` | offscreen → SW | `{ kind, transcript?, alternatives?, error? }` |
| `SETTINGS_CHANGED` | storage.onChanged | — |

## 7. Data contracts

### 7.1 `JobContext`
```ts
{
  source: "selection" | "jsonld" | "adapter:<name>" | "heuristic" | "page-text",
  title: string,          // "" if unknown
  company: string,
  location: string,
  employmentType: string,
  url: string,            // canonical, tracking stripped
  pageUrl: string,        // as in the address bar
  description: string,    // plain text
  confidence: "high" | "medium" | "low",
  warnings: string[]
}
```

### 7.2 `Settings` (storage.sync)
```ts
{
  enabled: true,
  hotkey: { code: "KeyS", alt: true, ctrl: false, shift: false, meta: false },
  language: "auto",            // "auto" → navigator.language
  requireKeyword: true,
  disabledHosts: [],
  showHints: true,
  debug: false,
  schemaVersion: 1
}
```

### 7.3 `pending` (storage.local, consumed by bridge)
```ts
{ id: string, text: string, ts: number, meta?: { title, company, url } }
```

## 8. Privacy, security, permissions

- **Voice:** Chrome's Web Speech API streams audio to Google's speech service for recognition. This must be disclosed in onboarding, the Options page, the README and the Web Store privacy section. The extension itself never stores audio.
- **Page data:** Page content is read only when the user triggers an action (hotkey, menu, toolbar) and is sent **only** to hiregram.ai through the existing storage → bridge path. No other network calls. No analytics in MVP.
- **Logs:** Debug log (local ring buffer, last 100 events) stores event names, timings, error codes, hostnames only. Never transcripts, JD text or full URLs. Opt-in "Copy debug info".
- **Permissions and justification** (for the Store listing):
  | Permission | Why |
  |---|---|
  | `contextMenus` | Right-click entry |
  | `storage` | Settings and hand-off message |
  | `scripting` | On-demand extraction in all frames |
  | `activeTab` | Toolbar click extraction |
  | `tabs` | Find/focus/open Hiregram tab |
  | `offscreen` | Host speech recognition |
  | host `<all_urls>` | Hotkey must work on any job site/careers page; extraction on demand |
- Content script must not leak into page JS (isolated world), must not use `eval`/`innerHTML` with untrusted strings (use `textContent`), strict CSP in extension pages (no inline scripts).
- Hiregram bridge only runs on hiregram.ai origins and only reads `chrome.storage.local.pending`.
- Treat page content as untrusted data: it is placed in a chat message as plain text only.

## 9. Non-functional requirements

- **Performance:** Hotkey listener is trivial (no work on non-matching keys). No observers or timers when idle. Extraction ≤ 2.5 s. Overlay appears ≤ 100 ms after key-down.
- **Reliability:** No unhandled promise rejections. Every async path has a timeout and a user-visible outcome. Idempotent hand-off.
- **Accessibility:** Overlay text contrast ≥ 4.5:1, announced via `aria-live`, all Options controls keyboard-operable and labelled.
- **Compatibility:** Chrome ≥ 116 (offscreen API + storage.session). macOS primary; verify keyboard handling on Windows layout notes in docs.
- **Code quality:** ESLint (basic config), consistent formatting, JSDoc on public functions, no dead code, no `console.log` in production paths (use `logger`).

## 10. Edge cases (explicit)

1. SPA navigation (LinkedIn): extraction is on-demand so it always reads current DOM.
2. Job description inside iframe: all-frames extraction, pick highest score.
3. Closed/open shadow DOM on page: extraction traverses open shadow roots; closed ones are skipped without error.
4. User selects text in one frame while hotkey pressed in another: selection from any frame wins (FR-E1).
5. Very long JD (> 7500): truncated with marker.
6. Non-English JD: passed through unchanged.
7. Page with multiple jobs (search results list): prefer the detail pane / selected job (adapter); otherwise lowest-confidence warning.
8. Hotkey pressed twice rapidly: second ignored.
9. Tab switched / page navigated while listening: session cancelled.
10. Browser offline: speech error shown; toolbar/menu still work with copy of page text.
11. Hiregram redirected to login: pending retained until TTL.
12. Extension reloaded while page open: invalidated-context message, no console spam.
13. Same job triggered twice within 60 s: allowed, but each has its own `id`; no dedupe by content (user intent wins).

## 11. Testing and QA

- **Unit tests (Node `node --test`)**: `wake-intent` (≥ 40 phrases), `compose-message` (limits, empty fields, unicode), `url-utils`, `html-to-text`, `settings` validation.
- **Extractor tests (jsdom)** with HTML fixtures in `tests/fixtures/` for each supported site type (JSON-LD page, LinkedIn-like markup, Greenhouse, Lever, Ashby, Workday-like, Naukri-like, Indeed-like, generic careers page, non-job page, iframe case).
- **Manual QA script** `docs/MANUAL_QA.md`: step-by-step for voice (mic grant, hold/release, mis-hearings, Esc cancel), 10+ real job pages, Hiregram hand-off (tab closed, tab open, logged out, no resume), restricted pages, update/reload behaviour.
- **Acceptance** = all P0 requirements checked in `CHECKLIST.md`, unit/extractor tests green, manual QA passed on macOS Chrome stable.

## 12. Release plan

1. Load unpacked from `extension/` for internal testing (`chrome://extensions` → Developer mode).
2. Package: `npm run package` → `dist/hiregram-tailor-<version>.zip` (excludes tests/docs).
3. Chrome Web Store: unlisted/trusted-testers first. Needs: permission justifications (§8), privacy policy URL, single-purpose statement, screenshots, 128px icon, short demo video.
4. Version bump to `0.2.0`; changelog in README.

## 13. Risks and open questions

| Risk / Question | Mitigation |
|---|---|
| Web Speech API unavailable or flaky in offscreen documents | Phase 0 spike; fallback host B (§6.3) |
| First words clipped because mic starts late | Overlay says "Listening" only after `onaudiostart`; short "Starting mic…" state; hint in onboarding |
| Portal DOM changes break adapters | Multiple selectors per field, JSON-LD first, heuristic + page-text fallbacks, fixtures, per-adapter warnings |
| `Alt+S` clashes with a site's shortcut on some pages | Configurable hotkey, per-site disable |
| Speech mishears "Sara" | Fuzzy match + alternatives + setting to disable keyword requirement |
| Sara responds to the exact phrase "Tailor my resume to this job post:" | Preserve it as the message opening. **Open question:** confirm with the Hiregram team that the structured header lines don't confuse Sara; keep format in one constant for easy change |
| Chrome Web Store review of `<all_urls>` | Clear single-purpose, justification, minimal on-idle behaviour |
| Hiregram DOM changes (aria-labels) | Centralised selectors with fallbacks; bridge fails visibly, keeps pending |

## 14. Future (not in MVP)
Backend transcription (Whisper) engine; LLM-assisted extraction for low-confidence pages; structured hand-off API/URL param instead of typing into the chat box; modifier-only push-to-talk (e.g. hold Right Option); "Sara, save this job"; more commands; Edge/Brave verification; system-wide hotkey via a Mac helper.
