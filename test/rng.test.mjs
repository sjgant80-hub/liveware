import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../src/rng.mjs';

test('rng is deterministic by seed and differs across seeds', () => {
  const a = rng(1), b = rng(1), c = rng(2);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  const seqC = [c.next(), c.next(), c.next()];
  assert.deepEqual(seqA, seqB);
  assert.notDeepEqual(seqA, seqC);
  assert.ok(seqA.every((n) => Number.isInteger(n) && n >= 0 && n < 2 ** 32));
});

test('int is bounded and total; bytes is seeded and the right length', () => {
  const r = rng(7);
  for (let i = 0; i < 100; i++) { const n = r.int(10); assert.ok(n >= 0 && n < 10); }
  assert.equal(rng(7).int(0), 0);
  assert.equal(rng(7).int(-5), 0);
  assert.equal(rng(7).int(1.5), 0);
  const x = rng(9).bytes(16), y = rng(9).bytes(16);
  assert.equal(x.length, 16);
  assert.deepEqual([...x], [...y]);
  assert.ok(x instanceof Uint8Array && x.every((v) => v >= 0 && v <= 255));
  assert.equal(rng(9).bytes(0).length, 0);
  assert.equal(rng(9).bytes(-3).length, 0);
  // bytes(n) advances the stream exactly n steps (catches an off-by-one loop bound)
  const g1 = rng(5); g1.bytes(3); const g2 = rng(5); g2.next(); g2.next(); g2.next();
  assert.equal(g1.next(), g2.next());
});

test('a non-integer seed is treated as 0', () => {
  assert.deepEqual([...rng(0).bytes(8)], [...rng(undefined).bytes(8)]);
});
