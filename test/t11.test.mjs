// T11 — the guarantee, run for real: the committed runs re-derive, the exam never chooses a rule, one changed answer
// changes the receipt; every check fails on the input that should fail it, and garbage never throws.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { t11, oneRun, T11_IDS, SEALED, VENDOR, T11_FILES, FIELDS } from '../src/t11.mjs';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const DATA = Object.fromEntries(Object.keys(SEALED.datasets).map((f) => [f, read(VENDOR + f)]));
const RUNS = () => Object.fromEntries(T11_IDS.map((id) => [id, JSON.parse(read(VENDOR + SEALED.runs[id].file))]));
const CAR = 'data/mint-demo-car.data';
const FULL = t11({ data: DATA, runs: RUNS() });

test('T11 · on the committed inputs every claim holds and the verdict is pass', () => {
  const d = FULL.detail;
  assert.deepEqual([d.P1, d.P2, d.P3, d.P4, d.P5], [true, true, true, true, true]);
  assert.equal(FULL.record.verdict, 'pass');
  assert.equal(FULL.record.test, 'T11');
  assert.match(FULL.id, /^[0-9a-f]{64}$/);
  assert.deepEqual(d.runs.map((r) => [r.id, r.charge, r.changed, r.exam]), [['v1', 'waived', 432, 432], ['v2', 'waived', 432, 432], ['v3', 'due', 2031, 2031]]);
  assert.deepEqual(d.runs.map((r) => r.receipt === r.committedReceipt), [true, true, true]);
  assert.deepEqual(d.runs[2].grown, { n: 2031, hits: 1897 });
});

test('T11 · the sealed values equal the seal\'s own JSON (CLAIMS-T11.md), and every input file is present', () => {
  const seal = JSON.parse(read('CLAIMS-T11.md').split('```json')[1].split('```')[0]);
  assert.deepEqual(SEALED.datasets, seal.sources.datasets);
  assert.deepEqual(SEALED.runs, seal.sources.runs);
  for (const p of [...T11_FILES.data, ...T11_FILES.runs, ...T11_FILES.preregs]) assert.ok(existsSync(new URL(p, root)), p);
  assert.deepEqual(FIELDS, ['splitSizes', 'trainMajority', 'rulesParsed', 'rulesKept', 'baselineAccuracy', 'grownAccuracy', 'improvement', 'decision', 'charge', 'receipt']);
});

test('T11 · every vendored file is byte for byte the one its sources manifest names', () => {
  const src = JSON.parse(read('vendor/SOURCES-ai-first-company.json'));
  assert.equal(src.repo, 'sjgant80-hub/ai-first-company');
  assert.equal(src.files.length, 13);
  for (const f of src.files) assert.equal(createHash('sha256').update(readFileSync(new URL(f.path, root))).digest('hex'), f.sha256, f.path);
});

// ── one run, attacked: each check fails on exactly the input that should fail it ─────────────────────────────────
const v1 = (patch) => ({ ...RUNS().v1, ...patch });

test('oneRun · a dataset that is not the pinned bytes fails P1 alone (the rows still re-derive)', () => {
  const r = oneRun('v1', { ...DATA, [CAR]: DATA[CAR] + '\n' }, RUNS().v1);
  assert.deepEqual([r.p1, r.p2, r.p4, r.p5], [false, true, true, true]);
});

test('oneRun · a run that names another seal or another dataset fails P1', () => {
  assert.equal(oneRun('v1', DATA, v1({ seal: '0000000' })).p1, false);
  assert.equal(oneRun('v1', DATA, v1({ dataset: { sha256: '0'.repeat(64) } })).p1, false);
  assert.equal(oneRun('v1', DATA, RUNS().v1).p1, true);
});

test('oneRun · any committed field that does not re-derive fails P2', () => {
  assert.equal(oneRun('v1', DATA, v1({ receipt: 'f'.repeat(64) })).p2, false);
  assert.equal(oneRun('v1', DATA, v1({ rulesKept: [] })).p2, false);
  assert.equal(oneRun('v1', DATA, v1({ grownAccuracy: 0.71 })).p2, false);
  const noReply = oneRun('v1', DATA, v1({ teacherReply: undefined }));
  assert.deepEqual([noReply.p2, noReply.rulesParsed, noReply.p4], [false, 0, true]);
});

test('oneRun · data it cannot score fails every claim with the engine\'s reason; a missing run is refused, never thrown', () => {
  assert.deepEqual(oneRun('v1', { ...DATA, [CAR]: '' }, RUNS().v1), { id: 'v1', p1: false, p2: false, p4: false, p5: false, why: 'the agreement: the sealed test: minSample is an integer >= 2 per arm' });
  let msg = ''; try { null.seal; } catch (e) { msg = e.message; }
  assert.deepEqual(oneRun('v1', DATA, null), { id: 'v1', p1: false, p2: false, p4: false, p5: false, why: 'refused: ' + msg });
  assert.equal(oneRun('nope', DATA, RUNS().v1).p1, false);
});

// ── the whole test: one failing claim fails the verdict; incomplete or garbage inputs fail, never throw ───────────
test('t11 · one claim failing (P1 only) fails the verdict', () => {
  const r = t11({ data: { ...DATA, [CAR]: DATA[CAR] + '\n' }, runs: RUNS() });
  assert.deepEqual([r.detail.P1, r.detail.P2, r.detail.P3, r.detail.P4, r.detail.P5], [false, true, true, true, true]);
  assert.equal(r.record.verdict, 'fail');
  assert.notEqual(r.id, FULL.id);
});

test('t11 · a run left out breaks the whole record (P3), and the verdict fails', () => {
  const runs = RUNS(); delete runs.v2;
  const r = t11({ data: DATA, runs });
  assert.deepEqual([r.detail.P2, r.detail.P3, r.record.verdict], [false, false, 'fail']);
  assert.deepEqual(r.detail.runs.map((x) => x.charge), ['waived', undefined, 'due']);
});

test('t11 · garbage inputs fail, never throw', () => {
  for (const g of [null, undefined, {}, 5, 'x', { data: null, runs: null }, { data: DATA }]) {
    const r = t11(g);
    assert.equal(r.record.verdict, 'fail');
    assert.deepEqual([r.detail.P1, r.detail.P2, r.detail.P3], [false, false, false]);
  }
});
