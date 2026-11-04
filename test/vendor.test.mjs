// vendor/ — every vendored file is byte for byte the one its sources manifest pins, and nothing sits in vendor/ unpinned.
// The blueprint on the page lists these pins; this is the check behind them (it runs in CI with the rest of the suite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const MANIFESTS = { 'vendor/SOURCES.json': 'sjgant80-hub/fall-kit', 'vendor/SOURCES-ai-first-company.json': 'sjgant80-hub/ai-first-company' };
const sha = (p) => createHash('sha256').update(readFileSync(new URL(p, root))).digest('hex');
const walk = (dir) => readdirSync(new URL(dir, root)).flatMap((n) => (statSync(new URL(dir + n, root)).isDirectory() ? walk(dir + n + '/') : [dir + n]));

test('vendor · each manifest names its repo and a full commit, and every file it lists hashes to its pin', () => {
  for (const [m, repo] of Object.entries(MANIFESTS)) {
    const s = JSON.parse(readFileSync(new URL(m, root), 'utf8'));
    assert.equal(s.repo, repo, m);
    assert.match(s.commit, /^[0-9a-f]{40}$/, m);
    assert.ok(Array.isArray(s.files) && s.files.length > 0, m);
    for (const f of s.files) {
      assert.match(f.sha256, /^[0-9a-f]{64}$/, f.path);
      assert.ok(f.path.startsWith('vendor/') && typeof f.src === 'string' && typeof f.what === 'string', f.path);
      assert.equal(sha(f.path), f.sha256, f.path);
    }
  }
});

test('vendor · nothing in vendor/ is unpinned, and no file is pinned twice', () => {
  const pinned = Object.keys(MANIFESTS).flatMap((m) => JSON.parse(readFileSync(new URL(m, root), 'utf8')).files.map((f) => f.path));
  assert.equal(new Set(pinned).size, pinned.length);
  const present = walk('vendor/').filter((p) => !Object.keys(MANIFESTS).includes(p));
  assert.deepEqual(present.sort(), [...pinned].sort());
});

test('vendor · the check bites: a changed byte no longer matches its pin', () => {
  const s = JSON.parse(readFileSync(new URL('vendor/SOURCES.json', root), 'utf8'));
  const bytes = readFileSync(new URL(s.files[0].path, root));
  const flipped = Buffer.from(bytes); flipped[0] ^= 1;
  assert.notEqual(createHash('sha256').update(flipped).digest('hex'), s.files[0].sha256);
});
