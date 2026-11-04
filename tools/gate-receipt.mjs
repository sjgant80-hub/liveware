#!/usr/bin/env node
// tools/gate-receipt.mjs — the gate receipt the page's blueprint reads (receipts/gate.json): for every kernel the CI gate
// mutates, how many tests it has, how many mutants the witness planted, how many the tests caught, how many were
// baselined (reviewed-equivalent, each with its written reason in src/witness.baseline.json) and how many survived.
// It reads the witness's own output, one file per kernel (the CI step tees it to /tmp/w-<kernel>.txt), so no figure on
// the blueprint is typed in: CI re-derives this receipt on every push and fails the build if it differs.
//   node tools/gate-receipt.mjs --from DIR            read DIR/w-<kernel>.txt, count each kernel's tests, write the receipt
//   node tools/gate-receipt.mjs --from DIR --check    the same, compared with the committed receipt; any difference exits 1
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canonical, shaHex } from '../src/receipt.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const KERNELS = ['receipt', 'rng', 'compress', 'seed', 'door', 'mesh', 't11', 'mintcase'];
const WITNESS = 'v0.6';
const fail = (why) => { console.error('gate receipt: ' + why); process.exit(1); };

// the gate's own loop must mutate exactly these kernels, in this order — the receipt can't describe a different gate
const loop = (rd('.github/workflows/gate.yml').match(/for k in ([a-z0-9 ]+); do/) || [])[1];
if (!loop || loop.trim().split(/\s+/).join(' ') !== KERNELS.join(' ')) fail('gate.yml mutates [' + loop + '], this receipt describes [' + KERNELS.join(' ') + ']');
if (!rd('.github/workflows/gate.yml').includes('--branch ' + WITNESS + ' ')) fail('gate.yml does not pin witness ' + WITNESS);

const dirAt = process.argv.indexOf('--from');
const dir = dirAt > 0 ? process.argv[dirAt + 1] : null;
if (!dir) fail('name the folder holding the witness output: --from DIR');

/** the witness's summary object from its output; stray status lines (✓ / ✗) are dropped first */
function witnessOf(text) {
  const clean = text.split('\n').filter((l) => !/^\s*[✓✗]/.test(l)).join('\n');
  const all = clean.match(/\{\s*"total"[\s\S]*?"clean":\s*(?:true|false)\s*\}/g);
  if (!all) return null;
  try { return JSON.parse(all[all.length - 1]); } catch { return null; }
}

/** a test file's count, from the TAP the runner prints */
function testsOf(file) {
  let out;
  try { out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { fail(file + ' does not pass: ' + String(e.stdout || e.message).slice(-400)); }
  const n = (k) => Number((out.match(new RegExp('^# ' + k + ' (\\d+)', 'm')) || [])[1]);
  if (!(n('tests') > 0) || n('pass') !== n('tests') || n('fail') !== 0) fail(file + ': tests ' + n('tests') + ', pass ' + n('pass') + ', fail ' + n('fail'));
  return n('tests');
}

const kernels = KERNELS.map((k) => {
  const p = join(dir, 'w-' + k + '.txt');
  if (!existsSync(p)) fail('no witness output for ' + k + ' at ' + p);
  const w = witnessOf(readFileSync(p, 'utf8'));
  if (!w) fail('the witness output for ' + k + ' holds no summary');
  if (w.clean !== true || w.survived.length !== 0) fail(k + ' is not clean: ' + w.survived.length + ' survived');
  return {
    kernel: k, src: 'src/' + k + '.mjs', test: 'test/' + k + '.test.mjs', tests: testsOf('test/' + k + '.test.mjs'),
    mutants: w.total, killed: w.killed, baselined: w.ignored.map((i) => ({ line: i.line, mutation: i.mutation })), survived: w.survived.length, capped: w.capped, clean: w.clean,
  };
});
for (const k of kernels) if (k.killed + k.baselined.length + k.survived !== k.mutants) fail(k.kernel + ': killed + baselined + survived ≠ mutants');

const record = { test: 'gate', witness: WITNESS, kernels };
const id = shaHex(canonical(record));
const summary = 'gate ' + id.slice(0, 12) + ' · ' + kernels.map((k) => k.kernel + ' ' + k.killed + '/' + k.mutants + (k.baselined.length ? ' (+' + k.baselined.length + ' baselined)' : '') + ' · ' + k.tests + ' tests').join(' · ');

if (process.argv.includes('--check')) {
  const prev = existsSync(join(ROOT, 'receipts/gate.json')) ? JSON.parse(rd('receipts/gate.json')) : {};
  const ok = prev.id === id;
  if (!ok) console.error('GATE RECEIPT MISMATCH: committed ' + prev.id + ', this run ' + id + ' — re-record it from this run\'s witness output');
  console.log(summary);
  process.exit(ok ? 0 : 1);
}
writeFileSync(join(ROOT, 'receipts/gate.json'), JSON.stringify({ kind: 'liveware.receipts', test: 'gate', record, id }, null, 1) + '\n');
console.log(summary);
