# Privacy Policy — Hiregram Tailor

**Last Updated:** November 23, 2026

Hiregram Tailor ("we", "our", or "the extension") is designed to respect user privacy and adhere to the principle of data minimization.

---

## 1. What Data We Access

- **Job Posting Information:** When you activate the extension (via voice shortcut, toolbar icon, or right-click menu), the extension extracts the visible job description, title, company, and URL from the active webpage.
- **Audio & Speech Data:** When you press and hold the push-to-talk hotkey, the extension activates your microphone using the standard browser Web Speech API (`webkitSpeechRecognition`).
  - Audio processing is performed locally by your browser and Google's standard speech recognition service.
  - No raw audio or voice recordings are collected, saved, or uploaded to any third-party servers by Hiregram Tailor.
- **Transcripts:** Transcripts are processed in-memory to detect the wake keyword ("Sara") and tailoring instructions. Transcripts are never permanently logged or stored.

---

## 2. How Data Is Used

- Extracted job details and tailoring instructions are transferred directly to your secure resume session on [hiregram.ai](https://hiregram.ai) using standard browser storage (`chrome.storage.local`).
- Your user preferences (hotkey, language dialect, disabled websites) are stored locally in your browser's sync storage (`chrome.storage.sync`).

---

## 3. Third-Party Sharing

Hiregram Tailor does **not** sell, rent, or share candidate data with data brokers, advertisers, or analytics trackers. Data is strictly transmitted to [hiregram.ai](https://hiregram.ai) to perform the resume tailoring service you explicitly request.

---

## 4. User Controls & Permissions

- You can revoke microphone permission at any time via Chrome Settings (`chrome://settings/content/microphone`).
- You can disable the extension globally or for specific websites in the Extension Options page.
