# Hiregram Tailor — Manual QA Matrix & Test Scenarios

## Test Environment
- **Browser:** Google Chrome (macOS / Windows / Linux)
- **Extension Version:** 0.2.0 (Manifest V3)
- **Target URL:** `https://hiregram.ai/resume/c07fbf6b-dc4b-497f-98d9-41f3b5e3e37b`

---

## 1. Job Board Extraction Scenarios (≥ 12 Sites)

| # | Site | Test Page / URL Pattern | Expected Extraction Result | Pass/Fail |
|---|------|-------------------------|----------------------------|-----------|
| 1 | **LinkedIn** | `linkedin.com/jobs/view/...` or `...currentJobId=...` | Job title, company, clean description (stripping applicant badges & similar jobs), canonical URL | [ ] |
| 2 | **Wellfound** | `wellfound.com/jobs/...` | Clean JD, salary/equity, location, company name | [ ] |
| 3 | **Indeed** | `indeed.com/viewjob?jk=...` | Job title, company header, full description text | [ ] |
| 4 | **Naukri** | `naukri.com/job-listings-...` | JD body, experience, company, key skills | [ ] |
| 5 | **Greenhouse** | `boards.greenhouse.io/{company}/jobs/...` | Clean markdown structure, duties, requirements | [ ] |
| 6 | **Lever** | `jobs.lever.co/{company}/...` | Position title, team/location, requirements list | [ ] |
| 7 | **Ashby** | `jobs.ashbyhq.com/{company}/...` | React SSR/JSON-LD job context, clean sections | [ ] |
| 8 | **Workday** | `*.myworkdayjobs.com/...` | Dynamic rendered content, qualifications, location | [ ] |
| 9 | **Instahyre** | `instahyre.com/job-...` | Role title, company overview, job specification | [ ] |
| 10 | **Custom Career Page (JSON-LD)** | Any site with `<script type="application/ld+json">` `JobPosting` | Title, hiringOrganization, jobLocation, description | [ ] |
| 11 | **Selected Text Override** | Highlight any paragraph (≥ 80 chars) on any page | Highlighted text is used exclusively as description | [ ] |
| 12 | **Generic Blog / Non-Job Page** | `en.wikipedia.org` or news article | Fails soft with warning: "Couldn't find a job description on this page. Select the text and try again." | [ ] |

---

## 2. Voice & Push-to-Talk Verification

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| **Standard Voice Flow** | Hold `Option+S`, say *"Sara, tailor my resume for this role"*, release | Overlay appears "Listening…", shows transcript, "Tailoring for [Company]…", opens resume editor, fills and sends | [ ] |
| **Accidental Tap (< 350ms)** | Tap `Option+S` quickly without speaking | Overlay cancels quietly without error or popup | [ ] |
| **Indian English Accent & Aliases** | Hold `Option+S`, say *"Sahara tailor my resume"*, release | Recognized as Sara, matches TAILOR intent | [ ] |
| **Custom Instructions** | Say *"Sara tailor my resume, focus on React and keep it to one page"* | Message includes `My instruction: focus on React and keep it to one page` | [ ] |
| **No Keyword / Off-topic** | Say *"What is the weather today"* | Overlay reports: *"Didn't hear 'Sara'…"* and cancels | [ ] |
| **Microphone Revoked** | Turn off mic in Chrome site settings and hold hotkey | Overlay displays *"Microphone access needed"* with [Grant microphone] action | [ ] |

---

## 3. Resume Editor Hand-off State Machine

| Test Case | Scenario | Expected Result | Pass/Fail |
|-----------|----------|-----------------|-----------|
| **Direct Editor Delivery** | Tab opens directly to default resume editor URL | Text populated via React value setter, Send button enabled and clicked, toast *"Sent to Sara ✓"* | [ ] |
| **Long JD Chip Conversion** | JD exceeds 200 words | Hiregram converts text into "Pasted text" chip, bridge verifies presence, clicks Send without error | [ ] |
| **Sara Streaming / Busy** | Send button is disabled on page load | Bridge polls every 150ms up to 8s; once enabled, clicks Send | [ ] |
| **Logged Out** | User not logged in to Hiregram | Toast *"Hiregram Tailor: log in to continue"*, pending payload preserved in storage until TTL (10 min) | [ ] |

---

## 4. Settings & Permissions

| Test Case | Steps | Expected Result | Pass/Fail |
|-----------|-------|-----------------|-----------|
| **First-Run Onboarding** | Install extension | `onboarding.html` opens automatically; allows 1-click mic grant and hotkey test | [ ] |
| **Custom Hotkey** | Change hotkey to `Ctrl+Shift+U` in Options | Immediately works across all open web tabs without reload | [ ] |
| **Disabled Website** | Add `github.com` to disabled sites list | Hotkey does nothing on GitHub pages | [ ] |
| **Tab Diagnostics** | Click "Check Active Tab" in Options page | Reports content script response and active settings | [ ] |
