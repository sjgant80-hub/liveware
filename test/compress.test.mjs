import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { light, measureOne, headline, ratio } from '../src/compress.mjs';

const u8 = (b) => new Uint8Array(b);
const gzip = (b) => zlib.gzipSync(b, { level: 9 }).length;

test('ratio: orig/out to 2 dp, and 0 when out is not positive', () => {
  assert.equal(ratio(10, 5), 2);
  assert.equal(ratio(100, 3), 33.33);
  assert.equal(ratio(10, 0), 0);
  assert.equal(ratio(10, -2), 0);
});

test('T5-P1: LIGHT round-trips byte-identical and reports a ratio', () => {
  const b = u8(Buffer.from('the quick brown fox '.repeat(200)));
  const r = light(b);
  assert.ok(r.ok);
  assert.equal(r.roundTrip, true);
  assert.equal(r.origSha, r.backSha);
  assert.ok(r.ratio > 1);
  assert.equal(r.orig, b.length);
});

test('light handles empty and tiny inputs without throwing', () => {
  for (const b of [u8([]), u8([1]), u8([1, 2, 3])]) {
    const r = light(b);
    assert.ok(r.ok);
    assert.equal(r.roundTrip, true);
  }
  // non-bytes is treated as empty, not a throw
  assert.equal(light('x').ok, true);
  assert.equal(light(null).ok, true);
});

test('measureOne reports LIGHT and each provided baseline; a missing baseline is null', () => {
  const b = u8(Buffer.from('{"a":1,"b":2,"c":3}\n'.repeat(100)));
  const m = measureOne(b, { gzip });
  assert.ok(m.light.size > 0 && m.light.ratio > 0);
  assert.ok(m.gzip.size > 0 && m.gzip.ratio > 0);
  assert.equal(m.zstd, null);
  assert.equal(m.brotli, null);
  assert.equal(m.roundTrip, true);
  // a null or non-object baselines bag is treated as "no baselines", never a crash
  const mn = measureOne(b, null);
  assert.equal(mn.gzip, null);
  assert.ok(mn.light.ratio > 0);
  assert.equal(measureOne(b, 'x').gzip, null);
  // a throwing baseline becomes null, not a crash
  assert.equal(measureOne(b, { gzip: () => { throw new Error('x'); } }).gzip, null);
  // a baseline returning nonsense becomes null
  assert.equal(measureOne(b, { gzip: () => -1 }).gzip, null);
  assert.equal(measureOne(b, { gzip: () => 0 }).gzip, null);
});

test('headline picks the lowest and highest LIGHT ratio vs gzip, honestly', () => {
  const rows = [
    { type: 'img', light: { ratio: 1.3 }, gzip: { ratio: 1.26 } },
    { type: 'json', light: { ratio: 11.1 }, gzip: { ratio: 8 } },
    { type: 'prose', light: { ratio: 3.4 }, gzip: { ratio: 2.5 } },
  ];
  const h = headline(rows);
  assert.equal(h.lowType, 'img');
  assert.equal(h.lowLight, 1.3);
  assert.equal(h.highType, 'json');
  assert.equal(h.highLight, 11.1);
  assert.equal(headline([]), null);
  assert.equal(headline('x'), null);
  // rows without a gzip baseline are not used
  assert.equal(headline([{ type: 'x', light: { ratio: 2 }, gzip: null }]), null);
  // a zero-ratio row is excluded (catches a >= 0 filter): it must not become the low end
  const h2 = headline([{ type: 'zero', light: { ratio: 0 }, gzip: { ratio: 1 } }, ...rows]);
  assert.equal(h2.lowType, 'img');
  assert.notEqual(h2.lowType, 'zero');
});
