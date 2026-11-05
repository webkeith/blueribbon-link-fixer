import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixHtml, fixHref } from '../lib/fix-links.js';
import { fixItem } from '../lib/webflow.js';

const B = 'https://www.blueribbonseptic.com';

test('removes empty ChatGPT citation links', () => {
  const html = '<p>Pump every 3–5 years.<a href="https://www.epa.gov/septic/how-care-your-septic-system?utm_source=chatgpt.com">&nbsp;</a></p>';
  const { out, changes } = fixHtml(html);
  assert.equal(out, '<p>Pump every 3–5 years.</p>');
  assert.equal(changes.length, 1);
});

test('removes empty link wrapping <strong> </strong>', () => {
  const { out } = fixHtml(`<p>a roots in<a href="${B}/blog/septic-tank-cleaning-guide"><strong> </strong></a><strong>septic</strong></p>`);
  assert.equal(out, '<p>a roots in<strong>septic</strong></p>');
});

test('strips utm_source=chatgpt.com from real links', () => {
  assert.equal(fixHref('https://www.epa.gov/x?utm_source=chatgpt.com'), 'https://www.epa.gov/x');
  assert.equal(fixHref('https://www.epa.gov/x?a=1&utm_source=chatgpt.com'), 'https://www.epa.gov/x?a=1');
});

test('rewrites redirected internal slugs', () => {
  assert.equal(fixHref(`${B}/blog/avoiding-costly-septic-repairs`), `${B}/blog/how-to-care-for-a-septic-tank`);
  assert.equal(fixHref('https://blueribbonseptic.com/services/'), `${B}/services`);
  assert.equal(fixHref(`${B}/services-areas/weimar`), `${B}/service-areas/weimar`);
});

test('unwraps google search links', () => {
  assert.equal(
    fixHref(`https://www.google.com/search?q=${B}/services/septic-tank-pumping-cleaning`),
    `${B}/services/septic-tank-cleaning-pumping`
  );
});

test('fixes merged 404 link', () => {
  const { out } = fixHtml(`<a href="${B}/blog/septic-system-failure-signs%20${B}/blog/how-does-a-septic-system-work">signs</a>`);
  assert.equal(out, `<a href="${B}/blog/septic-system-failure-signs">signs</a>`);
});

test('leaves good links and ?p= links untouched', () => {
  assert.equal(fixHref(`${B}/blog/roots-in-septic-system`), null);
  assert.equal(fixHref('https://www.epa.gov/septic'), null);
  assert.equal(fixHref('https://blueribbonseptic.com/?p=3368'), null);
});

test('is idempotent', () => {
  const html = `<p><a href="${B}/blog/septic-tank-backup">backup</a><a href="https://x.gov/?utm_source=chatgpt.com">&nbsp;</a></p>`;
  const first = fixHtml(html).out;
  const second = fixHtml(first);
  assert.equal(second.changes.length, 0);
  assert.equal(second.out, first);
});

test('fixItem patches rich text and link fields only when changed', () => {
  const item = { fieldData: { body: `<a href="${B}/blog/septic-tank-backup">x</a>`, cta: 'https://blueribbonseptic.com/faq/', clean: `<a href="${B}/faq">ok</a>` } };
  const { patch, changes } = fixItem(item, { rich: ['body', 'clean'], links: ['cta'] });
  assert.deepEqual(Object.keys(patch).sort(), ['body', 'cta']);
  assert.equal(patch.cta, `${B}/faq`);
  assert.equal(changes.length, 2);
});
