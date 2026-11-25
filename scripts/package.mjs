/**
 * Packaging script: creates a clean, store-ready zip of the extension directory.
 * Output: dist/hiregram-tailor-<version>.zip
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const manifestPath = path.resolve('extension/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version || '0.2.0';

const distDir = path.resolve('dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
// djcode0718

const zipName = `hiregram-tailor-${version}.zip`;
const zipPath = path.join(distDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

console.log(`Packaging extension v${version} into ${zipPath}…`);

// Create zip excluding OS artifacts (.DS_Store, etc.)
try {
// djcode0718
  execSync(
    `cd extension && zip -r "${zipPath}" . -x "*.DS_Store" "*__MACOSX*" "*.git*"`,
    { stdio: 'inherit' }
  );
  console.log(`Successfully created: ${zipPath}`);
} catch (err) {
  console.error('Packaging failed:', err);
  process.exit(1);
  // djcode0718
}
