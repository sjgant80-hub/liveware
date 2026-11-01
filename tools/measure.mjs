#!/usr/bin/env node
// tools/measure.mjs — runs Wave 1 (T1, T4, T5, T6) from src/wave1.mjs (the same bodies the page runs) and writes
// receipts/wave1.json (records + ids, the CI comparison) and receipts/wave1-detail.json (the measured numbers the page
// reads). Refuses to run if CLAIMS.md changed since the commit that sealed it, and names that commit.
//   node tools/measure.mjs            write the receipts
//   node tools/measure.mjs --check    re-derive and compare to the committed receipts; mismatch exits non-zero
//   node tools/measure.mjs --fast     a smaller fuzz count, for a quick local check (changes T4's id)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { t1, t4, t5, t6 } from '../src/wave1.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p));
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };

const claimsText = rd('CLAIMS.md').toString('utf8');
const touched = git('log', '--format=%H', '--', 'CLAIMS.md').split('\n').filter(Boolean);
const sealedAt = touched[touched.length - 1] || null;
const sealClean = touched.length >= 1 && git('status', '--porcelain', '--', 'CLAIMS.md') === '';

function samples() {
  const manifest = JSON.parse(rd('samples/MANIFEST.json').toString('utf8'));
  return manifest.samples.map((s) => ({ type: s.type, file: s.file, sha256: s.sha256, bytes: new Uint8Array(rd('samples/' + s.file)) }));
}
const baselines = {
  gzip: (b) => zlib.gzipSync(b, { level: 9 }).length,
  zstd: (b) => zlib.zstdCompressSync(b, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }).length,
  brotli: (b) => zlib.brotliCompressSync(b).length,
};

async function main() {
  if (!sealClean) { console.error('CLAIMS.md differs from the commit that sealed it'); process.exit(1); }
  const check = process.argv.includes('--check');
  const fuzzN = process.argv.includes('--fast') ? 2000 : 10000;
  const ran = { T1: await t1(), T4: await t4(fuzzN), T5: t5(samples(), baselines), T6: await t6() };
  const results = { kind: 'liveware.receipts', wave: 1, sealedAt };
  const detail = { kind: 'liveware.detail', wave: 1, sealedAt };
  for (const t of ['T1', 'T4', 'T5', 'T6']) { results[t] = { record: ran[t].record, id: ran[t].id }; detail[t] = { id: ran[t].id, verdict: ran[t].record.verdict, ...ran[t].detail }; }
  const summary = ['T1', 'T4', 'T5', 'T6'].map((t) => t + ' ' + results[t].record.verdict + ' ' + results[t].id.slice(0, 12)).join(' · ');

  if (check) {
    const prev = existsSync(join(ROOT, 'receipts/wave1.json')) ? JSON.parse(rd('receipts/wave1.json').toString('utf8')) : {};
    let ok = true;
    for (const t of ['T1', 'T4', 'T5', 'T6']) if (!prev[t] || prev[t].id !== results[t].id) { ok = false; console.error(t + ' RECEIPT MISMATCH: expected ' + (prev[t] && prev[t].id) + ', got ' + results[t].id); }
    console.log(summary);
    process.exit(ok ? 0 : 1);
  }
  mkdirSync(join(ROOT, 'receipts'), { recursive: true });
  writeFileSync(join(ROOT, 'receipts/wave1.json'), JSON.stringify(results, null, 1) + '\n');
  writeFileSync(join(ROOT, 'receipts/wave1-detail.json'), JSON.stringify(detail, null, 1) + '\n');
  for (const t of ['T1', 'T4', 'T5', 'T6']) console.log((results[t].record.verdict === 'pass' ? 'PASS ' : 'FAIL ') + t + ' · ' + results[t].id.slice(0, 16));
  console.log(summary);
}
main().catch((e) => { console.error('measure failed:', e.stack || e.message); process.exit(1); });
