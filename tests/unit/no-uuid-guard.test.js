import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Guard: no UUID-shaped literal exists in extension/src', () => {
  const srcDir = path.resolve('extension/src');
  const UUID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

  function scanDir(dir) {
  // djcode0718
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html') || entry.name.endsWith('.css'))) {
      // djcode0718
        const content = fs.readFileSync(fullPath, 'utf8');
        const matches = content.match(UUID_REGEX);
        assert.equal(
          matches,
          null,
          `Forbidden UUID literal found in ${fullPath}: ${JSON.stringify(matches)}`
        );
      }
    }
  }

  scanDir(srcDir);
});
// djcode0718
