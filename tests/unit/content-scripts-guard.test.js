import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Guard: no content script or injected script contains import or export statements', () => {
  const manifestPath = path.resolve('extension/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const scriptPaths = new Set();

  // 1. Files declared in manifest content_scripts
  if (Array.isArray(manifest.content_scripts)) {
    for (const entry of manifest.content_scripts) {
      if (Array.isArray(entry.js)) {
        for (const file of entry.js) {
          scriptPaths.add(file);
        }
      }
    }
  }

  // 2. Scripts injected dynamically via chrome.scripting.executeScript
  scriptPaths.add('src/content/extractor.js');

  assert.ok(scriptPaths.size >= 4, `Expected at least 4 content scripts, got ${scriptPaths.size}`);

  // Regex targeting module import/export keywords
  const forbiddenPattern = /\bimport\s+[\s\S]*?from\s+['"]|\bimport\s*\(|\bexport\s+/;

  for (const relPath of scriptPaths) {
    const fullPath = path.resolve('extension', relPath);
    assert.ok(fs.existsSync(fullPath), `Content script does not exist: ${relPath}`);

    const code = fs.readFileSync(fullPath, 'utf8');
    const match = code.match(forbiddenPattern);

    assert.equal(
      match,
      null,
      `Content script "${relPath}" must be a self-contained classic script without module syntax, but found forbidden keyword: "${match ? match[0] : ''}"`
    );
  }
});
