# Hiregram Tailor — "Sara" Voice Extension

> One-gesture voice tailoring for hiregram.ai from any job board or careers page.

## Overview
Hold `Option+S` (or `Alt+S`), say **"Sara, tailor my resume for this role and company"**, and release. Hiregram Tailor extracts the job posting, title, company, location, and canonical URL, and hands them off directly to Sara on [hiregram.ai](https://hiregram.ai).

## Architecture & Structure
```
Hiregram-sara2/
├── PRD.md
├── CHECKLIST.md
├── README.md
├── package.json
├── eslint.config.js
├── extension/
│   ├── manifest.json
│   ├── icons/
│   └── src/
│       ├── background/
│       ├── content/
│       ├── voice/
│       ├── pages/
│       └── lib/
├── tests/
│   ├── unit/
│   ├── extractor/
│   └── fixtures/
├── scripts/
│   └── package.mjs
└── docs/
    ├── DECISIONS.md
    ├── MANUAL_QA.md
    ├── PRIVACY.md
    └── STORE_LISTING.md
```

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run tests:
   ```bash
   npm test
   ```
3. Run linter:
   ```bash
   npm run lint
   ```
4. Build package:
   ```bash
   npm run package
   ```
