#!/usr/bin/env node
// tools/measure-t11.mjs — runs T11 from src/t11.mjs (the same body the page runs) and writes receipts/t11.json (the
// record and its id, the CI comparison) and receipts/t11-detail.json (the measured runs the page reads before a visitor
// presses run). Refuses to run unless CLAIMS-T11.md is unchanged since the ONE commit that sealed it, and names it.
// Also holds P3's CI half: it fails if index.html or page/app.mjs carries any re-derived result as a literal.
//   node tools/measure-t11.mjs            write the receipts
//   node tools/measure-t11.mjs --check    re-derive and compare to the committed receipt; any mismatch exits non-zero
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { t11, T11_IDS, SEALED, VENDOR } from '../src/t11.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };

const touched = git('log', '--format=%H', '--', 'CLAIMS-T11.md').split('\n').filter(Boolean);
const sealedAt = touched.length === 1 ? touched[0] : null;
if (!sealedAt || git('status', '--porcelain', '--', 'CLAIMS-T11.md') !== '') {
  console.error('CLAIMS-T11.md must be committed exactly once and unchanged since (touched by ' + touched.length + ' commits)');
  process.exit(1);
}

const data = Object.fromEntries(Object.keys(SEALED.datasets).map((f) => [f, rd(VENDOR + f)]));
const runs = Object.fromEntries(T11_IDS.map((id) => [id, JSON.parse(rd(VENDOR + SEALED.runs[id].file))]));
const ran = t11({ data, runs });

// P3, CI half: no re-derived result typed into the page
// a percentage counts as typed in when it stands as a whole number token (so 0.016 does not hold 0.0, but "+0.0" does)
const pct = (x) => (x * 100).toFixed(1);
const token = (l) => new RegExp('(?<![0-9.])' + l.replace('.', '\\.') + '(?![0-9])');
const literals = [...new Set(ran.detail.runs.flatMap((r) => [pct(r.baselineAccuracy), pct(r.grownAccuracy), pct(r.improvement), String(r.receipt).slice(0, 12)]))];
const typedIn = [];
for (const f of ['index.html', 'page/app.mjs']) { const t = rd(f); for (const l of literals) if (token(l).test(t)) typedIn.push(f + ' holds ' + l); }
if (typedIn.length) { console.error('P3: a re-derived result is typed into the page —\n  ' + typedIn.join('\n  ')); process.exit(1); }

const summary = 'T11 ' + ran.record.verdict + ' ' + ran.id.slice(0, 12) + ' · ' + ran.detail.runs.map((r) => r.id + ' ' + r.charge + ' ' + r.changed + '/' + r.exam).join(' · ') + ' · ' + literals.length + ' literals absent from the page';

if (process.argv.includes('--check')) {
  const prev = existsSync(join(ROOT, 'receipts/t11.json')) ? JSON.parse(rd('receipts/t11.json')) : {};
  const ok = prev.id === ran.id && prev.sealedAt === sealedAt;
  if (!ok) console.error('T11 RECEIPT MISMATCH: expected ' + prev.id + ' (sealed ' + prev.sealedAt + '), got ' + ran.id + ' (sealed ' + sealedAt + ')');
  console.log(summary);
  process.exit(ok ? 0 : 1);
}
mkdirSync(join(ROOT, 'receipts'), { recursive: true });
writeFileSync(join(ROOT, 'receipts/t11.json'), JSON.stringify({ kind: 'liveware.receipts', test: 'T11', sealedAt, record: ran.record, id: ran.id }, null, 1) + '\n');
writeFileSync(join(ROOT, 'receipts/t11-detail.json'), JSON.stringify({ kind: 'liveware.detail', test: 'T11', sealedAt, id: ran.id, verdict: ran.record.verdict, ...ran.detail }, null, 1) + '\n');
console.log((ran.record.verdict === 'pass' ? 'PASS ' : 'FAIL ') + summary);
