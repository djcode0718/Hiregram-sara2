import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { findDefaultResumeTarget } from '../../extension/src/lib/default-resume.js';

test('findDefaultResumeTarget: default row first among rows', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <div><h2 id="rh-index">All resumes</h2><span>3 resumes</span></div>
      <ul>
        <li class="group">
          <a data-row-link="true" href="/resume/11111111-2222-3333-4444-555555555555"></a>
          <p><span class="text-[var(--rh-ink)]">Default · </span>Single Column · edited 2 hours ago</p>
        </li>
        <li class="group">
          <a data-row-link="true" href="/resume/22222222-3333-4444-5555-666666666666"></a>
          <p>Modern · edited 5 hours ago</p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'found');
  assert.equal(result.href, '/resume/11111111-2222-3333-4444-555555555555');
  assert.equal(result.source, 'list-default-marker');
});

test('findDefaultResumeTarget: default row in the middle of 34 rows with decoys', () => {
  let listItems = '';
  for (let i = 1; i <= 34; i++) {
    const uuid = `aaaaaaaa-bbbb-cccc-dddd-${String(i).padStart(12, '0')}`;
    if (i === 17) {
      // Default row
      listItems += `
        <li class="group">
          <a data-row-link="true" href="/resume/${uuid}"></a>
          <p><span class="text-[var(--rh-ink)]">Default · </span>Single Column · edited 21 hours ago</p>
        </li>
      `;
    } else {
      // Decoys: "Set as default" button, "Make this your default?" group
      listItems += `
        <li class="group">
          <a data-row-link="true" href="/resume/${uuid}"></a>
          <p>Variant ${i} · edited 1 day ago</p>
          <button type="button">Set as default</button>
          <div role="group" aria-label="Make Resume ${i} your default?">
            <span>Make this your default?</span>
            <button type="button">Keep current</button>
            <button type="button">Make default</button>
          </div>
        </li>
      `;
    }
  }

  const html = `
    <!-- Hero card decoy -->
    <div class="card">
      <span>YOUR DEFAULT</span>
      <button type="button">Open in editor</button>
    </div>
    <section aria-labelledby="rh-index">
      <div><h2 id="rh-index">All resumes</h2><span>34 resumes</span></div>
      <ul>${listItems}</ul>
    </section>
  `;

  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'found');
  assert.equal(result.href, '/resume/aaaaaaaa-bbbb-cccc-dddd-000000000017');
});

test('findDefaultResumeTarget: default row last among rows', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
          <p>Resume 1</p>
        </li>
        <li>
          <a data-row-link="true" href="/resume/99999999-9999-9999-9999-999999999999"></a>
          <p><span>Default</span> · edited recently</p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'found');
  assert.equal(result.href, '/resume/99999999-9999-9999-9999-999999999999');
});

test('findDefaultResumeTarget: decoy-only list with no real marker returns no-default (nothing clicked)', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
          <button>Set as default</button>
          <div role="group"><span>Make this your default?</span></div>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'no-default');
});

test('findDefaultResumeTarget: multiple default markers returns ambiguous', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
          <p><span>Default</span></p>
        </li>
        <li>
          <a data-row-link="true" href="/resume/22222222-2222-2222-2222-222222222222"></a>
          <p><span>Default</span></p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.href, '/resume/11111111-1111-1111-1111-111111111111');
});

test('findDefaultResumeTarget: empty list returns empty', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul></ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'empty');
});

test('findDefaultResumeTarget: loading state when container not yet rendered', () => {
  const html = `<div>Loading...</div>`;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'loading');
});

test('findDefaultResumeTarget: rejects invalid hrefs (external host, javascript, bare /resume, query strings)', () => {
  const html = `
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="https://malicious.com/resume/11111111-1111-1111-1111-111111111111"></a>
          <p><span>Default</span></p>
        </li>
        <li>
          <a data-row-link="true" href="javascript:alert(1)"></a>
          <p><span>Default</span></p>
        </li>
        <li>
          <a data-row-link="true" href="/resume"></a>
          <p><span>Default</span></p>
        </li>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111?foo=bar"></a>
          <p><span>Default</span></p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  // All rows have invalid hrefs, so validRows is empty -> empty
  assert.equal(result.status, 'empty');
});

test('findDefaultResumeTarget: hero card fallback when list has no marker', () => {
  const html = `
    <div class="card">
      <h3>YOUR DEFAULT</h3>
      <a href="/resume/77777777-8888-9999-0000-111122223333">Open resume</a>
    </div>
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
          <p>No default marker here</p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'found');
  assert.equal(result.href, '/resume/77777777-8888-9999-0000-111122223333');
  assert.equal(result.source, 'hero-anchor');
});

test('findDefaultResumeTarget: hero card button fallback when no href', () => {
  const html = `
    <div class="card">
      <h3>YOUR DEFAULT</h3>
      <button type="button" aria-label="Open in editor">Open in editor</button>
    </div>
    <section aria-labelledby="rh-index">
      <ul>
        <li>
          <a data-row-link="true" href="/resume/11111111-1111-1111-1111-111111111111"></a>
          <p>No default marker here</p>
        </li>
      </ul>
    </section>
  `;
  const dom = new JSDOM(html, { url: 'https://hiregram.ai/resume' });
  const result = findDefaultResumeTarget(dom.window.document);
  assert.equal(result.status, 'found');
  assert.equal(result.source, 'hero-button');
  assert.ok(result.element);
});
