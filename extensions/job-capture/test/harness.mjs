/* Loads the real content.js into a jsdom window and returns its public surface.
 *
 * This evaluates the actual file rather than copying or slicing pieces of it, so
 * a test can only pass if the shipped script behaves. `chrome` is stubbed because
 * content.js registers a runtime listener at load time. */
import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// Overridable so the same suite can be pointed at an older revision of the
// script (git show <rev>:... > /tmp/x.js) to bisect a regression.
const CONTENT_JS = process.env.APPLYR_CONTENT_JS || join(here, '..', 'content.js');
const FIXTURES = join(here, 'fixtures');

export function loadFixture(name) {
  return readFileSync(join(FIXTURES, name), 'utf8');
}

export function extractFrom(html, url) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' });
  const { window } = dom;

  window.chrome = {
    runtime: {
      lastError: null,
      sendMessage: () => {},
      onMessage: { addListener: () => {} }
    }
  };

  window.eval(readFileSync(CONTENT_JS, 'utf8'));

  const api = window.ApplyrCapture;
  if (!api?.extractApplicationFields) {
    throw new Error('content.js did not expose ApplyrCapture.extractApplicationFields');
  }
  return api.extractApplicationFields();
}

export function extractFromFixture(name, url) {
  return extractFrom(loadFixture(name), url);
}
