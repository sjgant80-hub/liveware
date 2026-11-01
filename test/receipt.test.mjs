import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonical, shaHex, receiptOf } from '../src/receipt.mjs';

test('canonical: keys sorted at every level; non-JSON becomes null', () => {
  assert.equal(canonical({ b: 1, a: 2 }), '{"a":2,"b":1}');
  assert.equal(canonical({ z: { y: 1, x: 2 }, a: [3, 2, 1] }), '{"a":[3,2,1],"z":{"x":2,"y":1}}');
  assert.equal(canonical(NaN), 'null');
  assert.equal(canonical(Infinity), 'null');
  assert.equal(canonical(undefined), 'null');
  assert.equal(canonical(1.5), '1.5');
  assert.equal(canonical('a"b'), '"a\\"b"');
  assert.equal(canonical(null), 'null');
  assert.equal(canonical(true), 'true');
  assert.equal(canonical([{ b: 1, a: 2 }]), '[{"a":2,"b":1}]');
});

test('shaHex is stable and 64 hex chars', () => {
  const h = shaHex('abc');
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(shaHex('abc'), h);
  assert.notEqual(shaHex('abd'), h);
  assert.equal(shaHex({ a: 1, b: 2 }), shaHex({ b: 2, a: 1 }));   // canonical before hash
  assert.equal(shaHex(new Uint8Array([97, 98, 99])), h);          // 'abc' bytes == string 'abc'
});

test('receiptOf: fixed shape, verdict normalised, id is the hash of the canonical record', () => {
  const r = receiptOf('T9', 2, { in: 1 }, { out: 2 }, 'pass', { seed: 7 });
  assert.deepEqual(Object.keys(r.record).sort(), ['inputs_sha256', 'outputs_sha256', 'params', 'test', 'verdict', 'version']);
  assert.equal(r.record.test, 'T9');
  assert.equal(r.record.version, '2');
  assert.equal(r.record.verdict, 'pass');
  assert.deepEqual(r.record.params, { seed: 7 });
  assert.equal(r.id, shaHex(canonical(r.record)));
  assert.equal(receiptOf('T9', 2, { in: 1 }, { out: 2 }, 'anything-else', { seed: 7 }).record.verdict, 'fail');
  assert.deepEqual(receiptOf('T', 1, null, null, 'fail', [1, 2]).record.params, {});   // non-object params → {}
  assert.deepEqual(receiptOf('T', 1, null, null, 'fail', null).record.params, {});
});

test('receiptOf: same inputs → same id; any change → different id', () => {
  const a = receiptOf('T', 1, { x: 1 }, { y: 2 }, 'pass', {});
  assert.equal(receiptOf('T', 1, { x: 1 }, { y: 2 }, 'pass', {}).id, a.id);
  assert.notEqual(receiptOf('T', 1, { x: 2 }, { y: 2 }, 'pass', {}).id, a.id);
  assert.notEqual(receiptOf('T', 1, { x: 1 }, { y: 2 }, 'fail', {}).id, a.id);
  // the OUTPUTS go into the id: two receipts differing only in outputs must differ (catches outputs being dropped)
  assert.notEqual(receiptOf('T', 1, { x: 1 }, { y: 3 }, 'pass', {}).id, a.id);
  assert.notEqual(receiptOf('T', 1, { x: 1 }, { y: 2, z: 9 }, 'pass', {}).record.outputs_sha256, a.record.outputs_sha256);
});
