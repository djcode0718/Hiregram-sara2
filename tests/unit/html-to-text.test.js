import test from 'node:test';
import assert from 'node:assert/strict';
import {
  htmlToText,
  decodeHtmlEntities,
  cleanWhitespace
} from '../../extension/src/lib/html-to-text.js';

test('decodeHtmlEntities handles common entities and numeric references', () => {
  assert.equal(decodeHtmlEntities('&amp; &lt; &gt; &quot; &#39; &nbsp;'), '& < > " \'  ');
  assert.equal(decodeHtmlEntities('&#65;&#66;&#67;'), 'ABC');
  assert.equal(decodeHtmlEntities('&#x41;&#x42;&#x43;'), 'ABC');
});

test('cleanWhitespace normalizes newlines and spaces, removing control/zero-width chars', () => {
  const dirty = 'Hello \u200Bworld!\r\n\r\n\r\n\r\nLine 2   with   spaces\u0000.';
  const cleaned = cleanWhitespace(dirty);
  assert.equal(cleaned, 'Hello world!\n\nLine 2 with spaces.');
});

test('htmlToText converts paragraphs, breaks, and list items to formatted markdown-style text', () => {
  const html = `
    <div>
      <h1>Software Engineer</h1>
      <p>We are looking for a <b>talented</b> engineer.<br>Remote friendly.</p>
      <ul>
        <li>5+ years of Node.js</li>
        <li>Experience with Chrome Extensions</li>
      </ul>
    </div>
  `;
  const result = htmlToText(html);
  assert.match(result, /Software Engineer/);
  assert.match(result, /Remote friendly\./);
  assert.match(result, /- 5\+ years of Node\.js/);
  assert.match(result, /- Experience with Chrome Extensions/);
});

test('htmlToText strips scripts, styles, noscript and svg', () => {
  const html = `
    <div>
      <script>console.log('secret')</script>
      <style>body { color: red; }</style>
      <noscript>Please enable JS</noscript>
      <svg><circle cx="5" cy="5" r="5"/></svg>
      <p>Clean text only.</p>
    </div>
  `;
  const result = htmlToText(html);
  assert.equal(result, 'Clean text only.');
});
