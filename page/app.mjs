// page/app.mjs — the live page. It runs the SAME test bodies as the harness (src/wave1.mjs), so the receipt id you
// compute here equals the one CI publishes. The mycelium is drawn on a canvas; everything else is the kernels, live.
import { t1, t4, t6, T4_ATTACKS } from '../src/wave1.mjs';
import { light, measureOne, headline } from '../src/compress.mjs';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { prepare, finish } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { makePeer } from '../src/mesh.mjs';
import { shaHex, canonical } from '../src/receipt.mjs';
import { t11, T11_IDS, T11_FILES, SEALED } from '../src/t11.mjs';
import { RUNS as MINT_RUNS, rowsOf, splitOf, majorityOf, distil, score, flipped } from '../vendor/ai-first-company/src/distill.mjs';
import { mintCase, sourcesOf } from '../src/mintcase.mjs';

const $ = (id) => document.getElementById(id);
const el = (tag, attrs, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c instanceof Node ? c : String(c)); return e; };
const fmt = (n) => n.toLocaleString('en-GB');
const ratioStr = (x) => (x != null ? x.toFixed(2) + '×' : '—');

// ── theme + tabs ──────────────────────────────────────────────────────────────────────────────
(() => {
  const root = document.documentElement;
  try { const t = localStorage.getItem('lw-theme'); if (t) root.dataset.theme = t; } catch {}
  $('theme').addEventListener('click', () => { root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light'; try { localStorage.setItem('lw-theme', root.dataset.theme); } catch {} });
  const links = [...document.querySelectorAll('#tabs a')], secs = links.map((a) => document.querySelector(a.getAttribute('href')));
  const on = () => { let k = 0; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < 120) k = i; }); links.forEach((a, i) => a.classList.toggle('on', i === k)); };
  addEventListener('scroll', on, { passive: true }); on();
})();

// ── the mycelium canvas: nodes joined by hyphae that grow and pulse; a spore drifts along a live edge ──
(() => {
  const cv = $('myc'), ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-color-scheme: reduce)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W, H, DPR, nodes = [], t = 0;
  const theme = () => (document.documentElement.dataset.theme === 'light');
  function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = cv.width = innerWidth * DPR; H = cv.height = innerHeight * DPR; cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
    const n = Math.max(26, Math.min(70, Math.floor((innerWidth * innerHeight) / 26000)));
    nodes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.12 * DPR, vy: (Math.random() - 0.5) * 0.12 * DPR, r: (1 + Math.random() * 1.8) * DPR, ph: Math.random() * 6.28 })); }
  function frame() {
    t += 0.016; ctx.clearRect(0, 0, W, H);
    const light = theme();
    const linkMax = 170 * DPR;
    for (const p of nodes) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
    // hyphae
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j], dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
      if (d > linkMax) continue;
      const o = (1 - d / linkMax);
      const pulse = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 1.4 + (a.ph + b.ph));
      ctx.strokeStyle = light ? `rgba(10,155,118,${0.10 * o})` : `rgba(45,224,255,${0.16 * o * (0.5 + 0.5 * pulse)})`;
      ctx.lineWidth = DPR * (0.6 + o * 0.7);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    // spores
    for (const p of nodes) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6);
      const a = reduce ? 0.5 : 0.5 + 0.5 * Math.sin(t * 2 + p.ph);
      g.addColorStop(0, light ? `rgba(10,155,118,${0.5})` : `rgba(56,255,198,${0.5 + 0.4 * a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 6, 0, 6.283); ctx.fill();
      ctx.fillStyle = light ? '#0a9b76' : '#aeffec'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
    }
    if (!reduce) raf = requestAnimationFrame(frame);
  }
  let raf; addEventListener('resize', resize); resize();
  if (reduce) frame(); else frame();
})();

// ── capability panel ───────────────────────────────────────────────────────────────────────────
(() => {
  const caps = [
    ['WebCrypto', !!(globalThis.crypto && crypto.subtle)],
    ['WASM', typeof WebAssembly === 'object'],
    ['BroadcastChannel', typeof BroadcastChannel === 'function'],
    ['CompressionStream', typeof CompressionStream === 'function'],
    ['WebGPU', !!navigator.gpu],
    ['Service Worker', 'serviceWorker' in navigator],
  ];
  $('caps').append(...caps.map(([k, ok]) => el('span', { class: 'c ' + (ok ? 'yes' : 'no') }, (ok ? '✓ ' : '· ') + k)));
  $('capline').textContent = caps.filter((c) => c[1]).length + ' of ' + caps.length + ' capabilities present — every Wave 1 test runs on plain CPU; nothing here needs WebGPU.';
})();

// ── load the sealed expected ids, the measured detail, and the samples ──────────────────────────
const getJSON = (p) => fetch(p, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [expected, detail, manifest] = await Promise.all([getJSON('receipts/wave1.json'), getJSON('receipts/wave1-detail.json'), getJSON('samples/MANIFEST.json')]);
$('sealat').innerHTML = expected && expected.sealedAt ? 'Sealed at commit <b>' + expected.sealedAt.slice(0, 10) + '</b>' : '';
if ($('claimscommit') && expected && expected.sealedAt) $('claimscommit').innerHTML = 'Locked at commit <b>' + expected.sealedAt.slice(0, 10) + '</b>.';
const expId = (t) => (expected && expected[t] ? expected[t].id : null);
// T11 is sealed on its own (CLAIMS-T11.md), so its expected id and measured detail have their own receipts
const [exp11, det11] = await Promise.all([getJSON('receipts/t11.json'), getJSON('receipts/t11-detail.json')]);
if ($('sealat11') && exp11 && exp11.sealedAt) $('sealat11').innerHTML = 'T11 sealed on its own at commit <b>' + exp11.sealedAt.slice(0, 10) + '</b>';

// ── scoreboard ───────────────────────────────────────────────────────────────────────────────
const TESTS = [['T5', 'Compression'], ['T4', 'Attack it'], ['T1', 'The seed'], ['T6', 'The mesh'], ['T11', 'The guarantee']];
const chips = {};
$('board').append(...TESTS.map(([id, name]) => {
  const state = el('span', { class: 'state' }, el('span', { class: 'dot' }), el('span', {}, 'not run'));
  const bar = el('span', { class: 'bar' });
  chips[id] = { state, bar };
  return el('div', { class: 'chip' }, el('div', { class: 'k' }, id), el('div', { class: 't' }, name), state, bar);
}));
function setState(id, s, label) { const c = chips[id]; if (!c) return; c.state.className = 'state ' + s; c.state.lastChild.textContent = label; c.bar.style.width = s === 'pass' ? '100%' : s === 'fail' ? '100%' : s === 'run' ? '60%' : '0'; c.bar.style.background = s === 'fail' ? 'var(--bad)' : ''; }

function receiptLine(host, ran, expId, whose) {
  const match = expId && ran.id === expId;
  host.innerHTML = '';
  host.append(
    el('div', {}, el('span', { class: 'verdict ' + (ran.record.verdict === 'pass' ? 'pass' : 'fail') }, ran.record.verdict.toUpperCase()), ' ', el('span', { class: 'pill' }, ran.record.verdict === 'pass' ? 'every criterion met' : 'a criterion failed — kept on the record')),
    el('p', { class: 'rhash' }, (whose || 'your receipt') + '  ', el('b', {}, ran.id.slice(0, 24)), '…'),
    expId ? el('p', { class: 'rhash' }, 'expected      ', el('b', {}, expId.slice(0, 24)), '… ', match ? '✓ matches' : '✗ differs') : null,
  );
}

// ══ T5 · compression ══════════════════════════════════════════════════════════════════════════
const te = new TextEncoder();
async function gzipLive(bytes) {
  if (typeof CompressionStream !== 'function') return null;
  try { const cs = new CompressionStream('gzip'); const w = cs.writable.getWriter(); w.write(bytes); w.close(); const buf = await new Response(cs.readable).arrayBuffer(); return buf.byteLength; } catch { return null; }
}
let sampleBytes = {};   // file → Uint8Array
async function loadSamples() {
  if (!manifest) return;
  await Promise.all(manifest.samples.map(async (s) => { try { const r = await fetch('samples/' + s.file, { cache: 'no-cache' }); sampleBytes[s.file] = new Uint8Array(await r.arrayBuffer()); } catch {} }));
  const pick = $('t5pick'); pick.innerHTML = '';
  for (const s of manifest.samples) pick.append(el('option', { value: s.file }, s.type + ' · ' + fmt(s.bytes) + ' B'));
}
// CI's detail rows are keyed by sample type, so resolve the file to its type through the manifest first
function detailRow(file) {
  const s = manifest && manifest.samples.find((x) => x.file === file);
  return s && detail && detail.T5 && detail.T5.rows.find((r) => r.type === s.type);
}
async function runRace(file) {
  const bytes = sampleBytes[file]; if (!bytes) return;
  const row = detailRow(file);
  const l = light(bytes);
  const gz = await gzipLive(bytes);
  // LIGHT + gzip measured live here; zstd + brotli from the CI detail (the browser can't run them)
  const bars = [
    ['LIGHT', 'light', l.size, l.ratio, 'live'],
    ['gzip', 'gzip', gz, gz ? Math.round((bytes.length / gz) * 100) / 100 : (row && row.gzip ? row.gzip.ratio : null), gz ? 'live' : 'CI'],
    ['zstd', 'zstd', row && row.zstd ? row.zstd.size : null, row && row.zstd ? row.zstd.ratio : null, 'CI'],
    ['brotli', 'brotli', row && row.brotli ? row.brotli.size : null, row && row.brotli ? row.brotli.ratio : null, 'CI'],
  ];
  const max = Math.max(...bars.map((b) => b[2] || 0), bytes.length * 0.02);
  const race = $('t5race'); race.innerHTML = '';
  for (const [name, cls, size, r, src] of bars) {
    const fill = el('span', { class: 'fill ' + cls });
    const track = el('span', { class: 'track' }, fill);
    const val = el('span', { class: 'val' }, size != null ? el('b', {}, ratioStr(r)) : '—', size != null ? el('span', { class: 'out' }, '  ' + src) : '');
    race.append(el('div', { class: 'row' }, el('span', { class: 'name' }, name), track, val));
    requestAnimationFrame(() => { fill.style.width = (size != null ? Math.max(4, (size / max) * 100) : 0) + '%'; });
  }
  $('t5rt').textContent = 'round-trip ' + (l.roundTrip ? '✓ byte-identical' : '✗');
  const same = row && row.light ? (l.size === row.light.size ? ' · LIGHT ' + fmt(l.size) + ' B here = ' + fmt(row.light.size) + ' B on GitHub’s run ✓' : ' · LIGHT ' + fmt(l.size) + ' B here ≠ ' + fmt(row.light.size) + ' B on GitHub’s run ✗') : '';
  $('t5round').innerHTML = 'SHA-256 original <b>' + l.origSha.slice(0, 16) + '…</b> → restored <b>' + l.backSha.slice(0, 16) + '…</b> ' + (l.roundTrip ? '· identical' : '· DIFFERS') + same;
}
function renderT5Table() {
  const tb = $('t5table').querySelector('tbody'); tb.innerHTML = '';
  const rows = (detail && detail.T5 && detail.T5.rows) || [];
  for (const r of rows) {
    const best = Math.max(r.light.ratio, r.gzip ? r.gzip.ratio : 0, r.zstd ? r.zstd.ratio : 0, r.brotli ? r.brotli.ratio : 0);
    const cell = (o) => { if (!o) return el('td', { class: 'num' }, '—'); const b = o.ratio === best; return el('td', { class: 'num' }, b ? el('span', { class: 'best' }, ratioStr(o.ratio)) : ratioStr(o.ratio)); };
    tb.append(el('tr', {}, el('td', {}, r.type), el('td', { class: 'num' }, fmt(r.orig)), cell(r.light), cell(r.gzip), cell(r.zstd), cell(r.brotli), el('td', {}, r.roundTrip ? '✓' : '✗')));
  }
  const h = detail && detail.T5 && detail.T5.headline;
  if (h) $('t5head').innerHTML = '<b>Honest range:</b> LIGHT runs from ' + ratioStr(h.lowLight) + ' on the ' + h.lowType + ' (gzip ' + ratioStr(h.lowGzip) + ') to ' + ratioStr(h.highLight) + ' on the ' + h.highType + ' (gzip ' + ratioStr(h.highGzip) + '). Every row is measured; the best of the four is lit.';
  const rw = (type) => { const r = rows.find((x) => x.type === type); return r ? r.light.ratio : null; };
  const log = rw('structured JSON log'), cat = rw('structured catalogue');
  if ($('t5realworld')) $('t5realworld').innerHTML =
    'An AI agent’s answer log packs ' + (log ? '<b>' + ratioStr(log) + '</b>' : '—') +
    ' smaller; the estate’s public repo catalogue, ' + (cat ? '<b>' + ratioStr(cat) + '</b>' : '—') +
    ' — both restored byte-identical on unpack. Every number is pulled live from the table above.';
}
$('t5run').addEventListener('click', () => runRace($('t5pick').value));
$('t5pick').addEventListener('change', () => runRace($('t5pick').value));
function addDropped(name, bytes) {
  const l = light(bytes);
  gzipLive(bytes).then((gz) => {
    const tb = $('t5table').querySelector('tbody');
    tb.append(el('tr', {}, el('td', {}, 'your file · ' + name.slice(0, 20)), el('td', { class: 'num' }, fmt(bytes.length)), el('td', { class: 'num' }, el('span', { class: 'best' }, ratioStr(l.ratio))), el('td', { class: 'num' }, gz ? ratioStr(bytes.length / gz) : '—'), el('td', { class: 'num' }, '—'), el('td', { class: 'num' }, '—'), el('td', {}, l.roundTrip ? '✓' : '✗')));
  });
}
const drop = $('t5drop'), file = $('t5file');
drop.addEventListener('click', () => file.click());
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', async (e) => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) addDropped(f.name, new Uint8Array(await f.arrayBuffer())); });
file.addEventListener('change', async () => { const f = file.files[0]; if (f) addDropped(f.name, new Uint8Array(await f.arrayBuffer())); });
async function scoreT5() {
  setState('T5', 'run', 'running');
  if (detail && detail.T5) { const v = detail.T5.verdict; setState('T5', v === 'pass' ? 'pass' : 'fail', v === 'pass' ? 'pass' : 'fail'); receiptLine($('t5receipt'), { id: detail.T5.id, record: { verdict: v } }, expId('T5'), "GitHub's receipt"); $('t5receipt').append(el('p', { class: 'scope' }, 'zstd and brotli can’t run inside a browser, so this receipt is the one GitHub’s run computed. Your browser re-measures LIGHT and gzip live in the race above, checks the round-trip, and checks LIGHT’s size against GitHub’s row — the codec is integer-only, so the two must agree to the byte.')); }
  await runRace($('t5pick').value);
}

// ══ T4 · attack it ════════════════════════════════════════════════════════════════════════════
const FAMILIES = ['malformed', 'foreign', 'forged', 'escape'];
$('t4fams').append(...FAMILIES.map((f) => el('span', { class: 'fam', 'data-fam': f }, f)));
$('t4buttons').append(...T4_ATTACKS.map((a) => el('button', { 'data-a': a }, a)));
let t4counts = { att: 0, brk: 0, del: 0 };
function t4set() { $('t4att').textContent = t4counts.att; const b = $('t4brk'); b.textContent = t4counts.brk; b.className = 'n ' + (t4counts.brk === 0 ? 'bad0' : 'hot'); $('t4del').textContent = t4counts.del; }
function litFamily(f) { const n = document.querySelector('.fam[data-fam="' + f + '"]'); if (n) n.classList.add('lit'); }
function feed(line, cls) { const f = $('t4feed'); f.prepend(el('div', { class: 'ln ' + (cls || '') }, line)); while (f.childNodes.length > 60) f.lastChild.remove(); }
async function runT4All() {
  $('t4all').disabled = true; setState('T4', 'run', 'running'); feed('running every attack, ' + fmt(Number($('t4n').value) || 10000) + ' fuzz inputs, and the swarm…');
  const ran = await t4(Math.max(100, Math.min(100000, Number($('t4n').value) || 10000)));
  const d = ran.detail;
  const fuzzN = Math.max(100, Math.min(100000, Number($('t4n').value) || 10000));
  // total messages put at the core: 100 genuine + one per attack class + the fuzz run + the 1,000-mutant swarm
  t4counts = { att: 100 + Object.keys(d.refusals).length + fuzzN + 1000, brk: d.breaches, del: d.delivered };
  t4set();
  for (const [name, stage] of Object.entries(d.refusals)) { feed(name + ' → refused at ' + '«' + stage + '»', stage === 'ADMITTED' ? 'breach' : ''); const fam = name.startsWith('foreign') ? 'foreign' : /forg|unpinned|replay/.test(name) ? 'forged' : name === 'schema escape' ? 'escape' : 'malformed'; litFamily(fam); }
  feed('100 genuine packets delivered: ' + d.delivered + '/100', 'admit');
  feed('swarm: ' + d.swarmRecognised + '/1000 mutants recognised; exact repeat ' + (d.exactRepeat ? 'caught on sight' : 'missed'));
  feed(d.breaches + ' breaches, ' + d.crashes + ' crashes on ' + fmt(Number($('t4n').value) || 10000) + ' fuzz', d.breaches ? 'breach' : 'admit');
  setState('T4', ran.record.verdict === 'pass' ? 'pass' : 'fail', ran.record.verdict);
  receiptLine($('t4receipt'), ran, expId('T4'));
  $('t4all').disabled = false;
  return ran;
}
$('t4all').addEventListener('click', runT4All);
$('t4buttons').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; feed('“' + b.dataset.a + '” is one of the classes in the full run below — press “Run every attack”.'); });

// ══ T1 · the seed ═════════════════════════════════════════════════════════════════════════════
const T1_LAMPS = [['P1', 'germinates'], ['P2', 'reproduces byte-identical'], ['P3', 'every tamper refused'], ['P4', 'altered block refused']];
function renderLamps(host, defs, d) { host.innerHTML = ''; host.append(...defs.map(([k, label]) => { const on = d && d[k]; return el('span', { class: 'lamp ' + (d ? (on ? 'ok' : 'no') : '') }, el('span', { class: 'd' }), label); })); }
renderLamps($('t1lamps'), T1_LAMPS, null);
let t1ran = null;
async function runT1() {
  $('t1grow').disabled = true; setState('T1', 'run', 'running'); $('t1out').textContent = 'germinating, then flipping every one of the seed\'s bytes…';
  t1ran = await t1(); const d = t1ran.detail;
  renderLamps($('t1lamps'), T1_LAMPS, d);
  $('t1out').innerHTML = 'the seed is ' + d.seedBytes + ' bytes; all ' + d.seedBytes + ' single-byte tampers refused (' + Object.entries(d.tamperRefusals).map(([k, v]) => v + ' at «' + k + '»').join(', ') + ').';
  setState('T1', t1ran.record.verdict === 'pass' ? 'pass' : 'fail', t1ran.record.verdict);
  receiptLine($('t1receipt'), t1ran, expId('T1'));
  $('t1grow').disabled = false; $('t1off').disabled = false; $('t1tamper').disabled = false;
  return t1ran;
}
$('t1grow').addEventListener('click', runT1);
$('t1off').addEventListener('click', () => { if (t1ran) $('t1out').innerHTML = 'the offspring seed is byte-identical to its parent (P2 ' + (t1ran.detail.P2 ? '✓' : '✗') + '): the same signature verifies on it.'; });
$('t1tamper').addEventListener('click', () => { if (t1ran) $('t1out').innerHTML = 'every byte flipped, every one refused before a block loaded: ' + Object.entries(t1ran.detail.tamperRefusals).map(([k, v]) => v + ' at «' + k + '»').join(', ') + '.'; });

// ══ T6 · the mesh (real BroadcastChannel between tabs) ═════════════════════════════════════════
let meshPeer = null, meshId = null, meshCtr = { v: 1 }, meshChan = null;
async function startMesh() {
  if (!('BroadcastChannel' in globalThis)) { $('t6out').textContent = 'this browser has no BroadcastChannel; the in-memory version runs in the receipt below.'; return; }
  meshId = await makeIdentity();   // a fresh key for this tab
  meshChan = new BroadcastChannel('liveware-mesh');
  const sign = async (k, v) => { const p = prepare({ sender: meshId.slot, counter: BigInt(meshCtr.v++), dictId: 0, kind: 1, value: v }); const f = finish(p.unsigned, await meshId.sign(p.signed)); return f.bytes; };
  meshPeer = makePeer({ self: meshId, docId: 'live', verify: (id, s, sig) => verifyBytes(id, s, sig), frameBody: sign, send: (b) => meshChan.postMessage(Array.from(b)) });
  meshChan.onmessage = async (e) => {
    const before = meshPeer.peers().length;
    const r = await meshPeer.onMessage(new Uint8Array(e.data));
    // greet back the moment a NEW peer says hello, so two tabs find each other whichever opened first (settles in one round-trip)
    if (r && r.in === 'hello' && meshPeer.peers().length > before) await meshPeer.hello();
    paintMesh(r);
  };
  $('t6self').classList.add('on'); $('t6self').lastChild.textContent = 'live · key ' + meshId.id.slice(0, 6);
  await meshPeer.hello();
  $('t6out').innerHTML = 'this tab is a live node. <b>Open this same page in a second tab</b> — they will find each other here.';
  $('t6task').disabled = false; $('t6forge').disabled = false;
  setState('T6', 'run', 'peering');
}
function paintMesh(r) {
  if (!meshPeer) return;
  const peers = meshPeer.peers();
  const wasConnected = $('t6peer').classList.contains('on');
  if (peers.length) { $('t6peer').classList.add('on'); $('t6peer').lastChild.textContent = 'peer · slot ' + peers[0]; setState('T6', 'pass', 'connected'); }
  if (peers.length && !wasConnected) $('t6out').innerHTML = 'a second node appeared — the two pinned each other’s key. Hand a task across, or inject a forged peer.';
  if (r && r.in === 'result') $('t6out').innerHTML = 'a task was handed across and the result came back signed and re-computed. ✓';
  if (r && r.in === 'refused') $('t6out').innerHTML = 'a message was refused at «' + (r.stage || r.why) + '» — a forged or replayed peer cannot get in.';
}
$('t6open').addEventListener('click', async () => { if (!meshPeer) await startMesh(); else { const w = open(location.href, '_blank'); if (!w) $('t6out').textContent = 'allow the pop-up, or open this page in a second tab yourself.'; } });
$('t6task').addEventListener('click', async () => { if (!meshPeer) return; const res = await meshPeer.ask([3, 4, 5]); $('t6out').innerHTML = res.ok ? 'asked the peer to sum [3,4,5]; it returned ' + res.out.sum + ', and this tab re-computed the same. ✓' : 'no peer answered yet — open a second tab first.'; });
$('t6forge').addEventListener('click', async () => { if (!meshChan) return; const forger = await makeIdentity(); const p = prepare({ sender: (meshPeer.peers()[0] ?? 7), counter: 999n, dictId: 0, kind: 1, value: { t: 'op', doc: { docId: 'live', lamport: 9, entries: {} } } }); const f = finish(p.unsigned, await forger.sign(p.signed)); const r = await meshPeer.onMessage(f.bytes); $('t6out').innerHTML = 'injected a peer signing with a key no one pinned → refused at «' + (r.stage || r.why) + '». The forged peer never joins.'; });
async function scoreT6() {
  // the deterministic in-memory version writes the receipt that matches CI; the live two-tab version is the demo above
  setState('T6', 'run', 'running'); const ran = await t6();
  if (!(meshPeer && meshPeer.peers().length)) setState('T6', ran.record.verdict === 'pass' ? 'pass' : 'fail', ran.record.verdict);
  receiptLine($('t6receipt'), ran, expId('T6'));
  return ran;
}

// ══ T11 · the guarantee, run for real ═════════════════════════════════════════════════════════
// Renders only from a run — GitHub's published one until the visitor presses run, then the visitor's own. The words
// below are the datasets' codebooks and the runs' names; every accuracy, count and receipt comes from the run.
const T11_NAMES = { v1: ['Run 1', 'UCI Car Evaluation', 'one-condition rules'], v2: ['Run 2', 'UCI Car Evaluation', 'rules of up to three conditions'], v3: ['Run 3', 'UCI Mushroom', 'one-condition rules'] };
const CLASS_WORD = { unacc: 'unacceptable', acc: 'acceptable', good: 'good', vgood: 'very good', e: 'edible', p: 'poisonous' };
const FEATURE_WORD = { buying: 'buying price', maint: 'upkeep cost', doors: 'doors', persons: 'seats', lug_boot: 'boot size', safety: 'safety', odor: 'odour', 'gill-color': 'gill colour', 'cap-color': 'cap colour', 'veil-color': 'veil colour', 'spore-print-color': 'spore print colour', 'stalk-color-above-ring': 'stalk colour above the ring', 'stalk-color-below-ring': 'stalk colour below the ring', 'ring-type': 'ring type', 'ring-number': 'number of rings', 'cap-shape': 'cap shape', 'cap-surface': 'cap surface', 'gill-size': 'gill size', 'gill-spacing': 'gill spacing', 'gill-attachment': 'gill attachment', 'stalk-root': 'stalk root', 'stalk-shape': 'stalk shape', 'veil-type': 'veil type' };
const CAR_WORD = { vhigh: 'very high', high: 'high', med: 'medium', low: 'low', small: 'small', big: 'big', more: 'more than 4', '5more': '5 or more' };
// the UCI Mushroom codebook (agaricus-lepiota.names, UCI Machine Learning Repository)
const MUSHROOM_WORD = {
  'cap-shape': { b: 'bell', c: 'conical', x: 'convex', f: 'flat', k: 'knobbed', s: 'sunken' },
  'cap-surface': { f: 'fibrous', g: 'grooved', y: 'scaly', s: 'smooth' },
  'cap-color': { n: 'brown', b: 'buff', c: 'cinnamon', g: 'grey', r: 'green', p: 'pink', u: 'purple', e: 'red', w: 'white', y: 'yellow' },
  bruises: { t: 'bruises', f: 'no bruising' },
  odor: { a: 'almond', l: 'anise', c: 'creosote', y: 'fishy', f: 'foul', m: 'musty', n: 'none', p: 'pungent', s: 'spicy' },
  'gill-attachment': { a: 'attached', d: 'descending', f: 'free', n: 'notched' },
  'gill-spacing': { c: 'close', w: 'crowded', d: 'distant' },
  'gill-size': { b: 'broad', n: 'narrow' },
  'gill-color': { k: 'black', n: 'brown', b: 'buff', h: 'chocolate', g: 'grey', r: 'green', o: 'orange', p: 'pink', u: 'purple', e: 'red', w: 'white', y: 'yellow' },
  'stalk-shape': { e: 'enlarging', t: 'tapering' },
  'stalk-root': { b: 'bulbous', c: 'club', u: 'cup', e: 'equal', z: 'rhizomorphs', r: 'rooted', '?': 'missing' },
  'stalk-surface-above-ring': { f: 'fibrous', y: 'scaly', k: 'silky', s: 'smooth' },
  'stalk-surface-below-ring': { f: 'fibrous', y: 'scaly', k: 'silky', s: 'smooth' },
  'stalk-color-above-ring': { n: 'brown', b: 'buff', c: 'cinnamon', g: 'grey', o: 'orange', p: 'pink', e: 'red', w: 'white', y: 'yellow' },
  'stalk-color-below-ring': { n: 'brown', b: 'buff', c: 'cinnamon', g: 'grey', o: 'orange', p: 'pink', e: 'red', w: 'white', y: 'yellow' },
  'veil-type': { p: 'partial', u: 'universal' },
  'veil-color': { n: 'brown', o: 'orange', w: 'white', y: 'yellow' },
  'ring-number': { n: 'none', o: 'one', t: 'two' },
  'ring-type': { c: 'cobwebby', e: 'evanescent', f: 'flaring', l: 'large', n: 'none', p: 'pendant', s: 'sheathing', z: 'zone' },
  'spore-print-color': { k: 'black', n: 'brown', b: 'buff', h: 'chocolate', r: 'green', o: 'orange', u: 'purple', w: 'white', y: 'yellow' },
  population: { a: 'abundant', c: 'clustered', n: 'numerous', s: 'scattered', v: 'several', y: 'solitary' },
  habitat: { g: 'grasses', l: 'leaves', m: 'meadows', p: 'paths', u: 'urban', w: 'waste ground', d: 'woods' },
};
const T11_LAMPS = [['P1', 'inputs are the committed ones'], ['P2', 'every number re-derives'], ['P3', 'the whole record, losses included'], ['P4', 'the exam never picks a rule'], ['P5', 'one changed answer changes the receipt']];
const pct = (x) => (x * 100).toFixed(1) + '%';
const pts = (x) => (x < 0 ? '−' : '+') + Math.abs(x * 100).toFixed(1) + ' pts';
const short = (h) => String(h || '').slice(0, 12) + '…';
const commit = (sha) => el('a', { class: 'link', href: 'https://github.com/sjgant80-hub/ai-first-company/commit/' + sha, target: '_blank', rel: 'noopener' }, sha);
const word = (c) => CLASS_WORD[c] || c;
const valueWord = (f, v) => (MUSHROOM_WORD[f] && MUSHROOM_WORD[f][v]) || CAR_WORD[v] || v;
// a kept rule as its run file wrote it: 'f==v[ AND f==v]=>c (p=0.98,fires=404)'
function parseKept(s) {
  const m = /^(.*?) ?=> ?(\S+) \(p=([\d.]+),fires=(\d+)\)$/.exec(s);
  return m ? { conds: m[1].split(' AND ').map((x) => x.split('==')), c: m[2], p: Number(m[3]), fires: Number(m[4]) } : null;
}
const plain = (k) => k.conds.map(([f, v]) => (FEATURE_WORD[f] || f) + ' is ' + valueWord(f, v)).join(' and ') + ' → ' + word(k.c);

function whyLine(r, kept) {
  if (r.charge === 'due') return 'The kept rules beat the baseline on the exam by more than the guarantee demands, by a clear margin — so the charge is due.';
  if (!kept.length) return 'None of its rules held up on the check split, so nothing was kept and the exam was answered by the baseline itself. No gain, no charge.';
  if (kept.every((k) => k.c === r.trainMajority)) return 'Every rule it kept only ever predicted the commonest answer (“' + word(r.trainMajority) + '”) — exactly what the baseline already guesses. No gain, no charge.';
  return 'The kept rules did not beat the baseline by enough. No charge.';
}
function renderT11(d, live) {
  if (!d || !Array.isArray(d.runs)) return;
  const host = $('t11runs'); host.innerHTML = '';
  for (const r of d.runs) {
    const [title, data, how] = T11_NAMES[r.id] || [r.id, '', ''];
    const kept = (r.rulesKept || []).map(parseKept).filter(Boolean);
    const match = r.receipt && r.receipt === r.committedReceipt;
    host.append(el('div', { class: 'run ' + (r.charge || 'none') },
      el('div', { class: 'runtop' }, el('b', {}, title), el('span', { class: 'charge ' + (r.charge || '') }, r.charge === 'due' ? 'CHARGE DUE' : r.charge === 'waived' ? 'CHARGE WAIVED' : 'DID NOT RUN')),
      el('p', { class: 'meta' }, data + ' · ' + how),
      r.charge ? el('div', { class: 'stats' },
        el('span', { class: 'stat' }, el('small', {}, 'baseline'), el('b', {}, pct(r.baselineAccuracy))),
        el('span', { class: 'arrow' }, '→'),
        el('span', { class: 'stat grown' }, el('small', {}, 'kept rules'), el('b', {}, pct(r.grownAccuracy))),
        el('span', { class: 'imp' }, pts(r.improvement))) : el('p', { class: 'nums' }, r.why || 'no result'),
      r.charge ? el('p', { class: 'meta' }, 'The AI wrote ' + r.rulesParsed + ' usable rules; the gate kept ' + kept.length + '. Exam: ' + fmt(r.exam) + ' rows.') : null,
      r.charge ? el('p', { class: 'why' }, whyLine(r, kept)) : null,
      el('p', { class: 'rhash' }, 'sealed ', commit(r.seal || MINT_RUNS[r.id].seal), ' before it ran · result ', commit(r.run || MINT_RUNS[r.id].run)),
      r.receipt ? el('p', { class: 'rhash' }, 'receipt ', el('b', {}, short(r.receipt)), live ? (match ? ' ✓ equals the one published with the result' : ' ✗ differs from the one published with the result') : ' (GitHub’s run)') : null,
    ));
  }
  const w = d.runs.find((r) => r.id === 'v3');
  if (w && w.charge) {
    $('t11sub').textContent = '— UCI Mushroom, ' + fmt(w.exam) + ' exam rows the rules never saw';
    const race = $('t11race'); race.innerHTML = '';
    for (const [name, cls, acc, note] of [['baseline', 'base', w.baselineAccuracy, 'always “' + word(w.trainMajority) + '”'], ['kept rules', 'grown', w.grownAccuracy, 'no AI at answer time']]) {
      const fill = el('span', { class: 'fill ' + cls, title: note, style: 'width:0' });
      race.append(el('div', { class: 'row' }, el('span', { class: 'name' }, name), el('span', { class: 'track' }, fill), el('span', { class: 'val' }, el('b', {}, pct(acc)))));
      void fill.offsetWidth;                                  // a reflow, so the width animates without waiting on a frame
      fill.style.width = Math.max(2, acc * 100) + '%';
    }
    $('t11head').innerHTML = '<b>' + fmt(w.grown.hits) + ' of ' + fmt(w.grown.n) + '</b> exam answers right with the kept rules, against <b>' + fmt(w.base.hits) + '</b> for always guessing “' + word(w.trainMajority) + '” — ' + pts(w.improvement) + (w.improvement >= 0.08 ? ', clear of the guarantee’s 8-point bar.' : ', short of the guarantee’s 8-point bar.');
    const kept = (w.rulesKept || []).map(parseKept).filter(Boolean);
    const tb = $('t11rules').querySelector('tbody'); tb.innerHTML = '';
    for (const k of kept) tb.append(el('tr', {}, el('td', { class: 'mono' }, k.conds.map(([f, v]) => f + ' == ' + v).join(' AND ') + ' → ' + k.c), el('td', {}, plain(k)), el('td', { class: 'num' }, Math.round(k.p * 100) + '%'), el('td', { class: 'num' }, fmt(k.fires) + '×')));
    $('t11dropped').textContent = 'The AI wrote ' + w.rulesParsed + ' usable rules; ' + (w.rulesParsed - kept.length) + ' did not hold up on the check split and were thrown out. Only the ' + kept.length + ' above ever saw the exam.';
  }
  renderLamps($('t11lamps'), T11_LAMPS, d);
}
// the inputs, fetched once from this site: the pinned datasets and the three committed runs (with the recorded replies)
let t11in = null;
async function loadT11() {
  if (t11in) return t11in;
  const get = (p, as) => fetch(p, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return as === 'json' ? r.json() : r.text(); });
  const [texts, runs] = await Promise.all([Promise.all(T11_FILES.data.map((p) => get(p))), Promise.all(T11_FILES.runs.map((p) => get(p, 'json')))]);
  t11in = { data: Object.fromEntries(Object.keys(SEALED.datasets).map((f, i) => [f, texts[i]])), runs: Object.fromEntries(T11_IDS.map((id, i) => [id, runs[i]])) };
  return t11in;
}
// the AI missed the strongest single clue? measured here from the data, never typed in
function missedClue(inputs) {
  const spec = MINT_RUNS.v3, sp = splitOf(rowsOf(inputs.data[spec.dataset], spec)), reply = inputs.runs.v3.teacherReply || '', maj = majorityOf(sp.train);
  let best = null;
  for (const f of spec.names) {
    const by = {};
    for (const r of sp.train) { by[r[f]] = by[r[f]] || {}; by[r[f]][r.class] = (by[r[f]][r.class] || 0) + 1; }
    const pick = (v) => (by[v] ? Object.entries(by[v]).sort((a, b) => b[1] - a[1])[0][0] : maj);
    const acc = sp.final.filter((r) => pick(r[f]) === r.class).length / sp.final.length;
    if (!best || acc > best.acc) best = { f, acc };
  }
  return best && !new RegExp('^\\s*' + best.f + '\\s*==', 'im').test(reply) ? best : null;
}
// T11 in a module worker so the page never freezes; inline only where this browser can't start one
function t11Inline(inputs) { const t0 = performance.now(), ran = t11(inputs); return { ran, ms: Math.round(performance.now() - t0) }; }
function t11OffThread(inputs) {
  return new Promise((resolve) => {
    let w = null;
    try { w = new Worker(new URL('./t11-worker.mjs', import.meta.url), { type: 'module' }); } catch { return resolve(t11Inline(inputs)); }
    const fallback = () => { w.terminate(); resolve(t11Inline(inputs)); };
    w.onmessage = (e) => { if (!e.data || !e.data.ok) return fallback(); w.terminate(); resolve({ ran: e.data.ran, ms: e.data.ms }); };
    w.onerror = (e) => { e.preventDefault(); fallback(); };
    w.postMessage(inputs);
  });
}
function publishedLine(host, id, verdict) {
  host.innerHTML = '';
  host.append(
    el('div', {}, el('span', { class: 'verdict ' + (verdict === 'pass' ? 'pass' : 'fail') }, verdict.toUpperCase()), ' ', el('span', { class: 'pill' }, 'GitHub’s published run')),
    el('p', { class: 'rhash' }, 'published receipt  ', el('b', {}, id.slice(0, 24)), '…  press re-run to compute your own — it must match'),
  );
}
async function runT11() {
  $('t11run').disabled = true; setState('T11', 'run', 'running');
  try {
    $('t11src').textContent = 'fetching the pinned data and the recorded runs…';
    const inputs = await loadT11();
    $('t11src').textContent = 're-running all three, then attacking every receipt…';
    const { ran, ms } = await t11OffThread(inputs);
    renderT11(ran.detail, true);
    const tampers = ran.detail.runs.reduce((n, r) => n + (r.exam || 0), 0);
    $('t11src').textContent = 'your browser’s run · ' + fmt(ms) + ' ms · ' + fmt(tampers) + ' tampered exams tried';
    const miss = missedClue(inputs);
    if (miss) $('t11dropped').textContent += ' It never even proposed the strongest single clue in the data — ' + (FEATURE_WORD[miss.f] || miss.f) + ', which on its own gets ' + pct(miss.acc) + ' of the exam right. The guarantee didn’t need the AI to be brilliant: the gate let through only what held up, and the charge is only for what that earned.';
    setState('T11', ran.record.verdict === 'pass' ? 'pass' : 'fail', ran.record.verdict);
    receiptLine($('t11receipt'), ran, exp11 && exp11.id);
    return ran;
  } catch (e) {
    $('t11src').textContent = 'could not load the pinned files (' + e.message + ') — reconnect and press again';
    setState('T11', 'fail', 'not loaded');
  } finally { $('t11run').disabled = false; }
}
$('t11run').addEventListener('click', runT11);
// try to break it: the winning run, re-scored with the same kept rules on an exam the visitor changes
let t11ctx = null, t11next = 0;
async function winCtx() {
  if (t11ctx) return t11ctx;
  const inputs = await loadT11(), spec = MINT_RUNS.v3, split = splitOf(rowsOf(inputs.data[spec.dataset], spec));
  t11ctx = { spec, split, d: distil(spec, split, inputs.runs.v3.teacherReply), committed: inputs.runs.v3.receipt };
  t11next = Math.floor(Math.random() * split.final.length);
  return t11ctx;
}
function t11say(lines) { const o = $('t11out'); o.innerHTML = ''; o.append(...lines.map(([cls, html]) => el('p', { class: cls || '', html }))); }
$('t11one').addEventListener('click', async () => {
  try {
    const c = await winCtx(), n = c.split.final.length, i = t11next; t11next = (t11next + 211) % n;
    const row = c.split.final[i], to = flipped(row.class, c.spec, c.d.trainMajority), exam = c.split.final.slice();
    exam[i] = { ...row, class: to };
    const s = score(c.spec, exam, c.d.kept, c.d.trainMajority);
    t11say([
      ['', 'Exam row <b>' + fmt(i + 1) + '</b> of ' + fmt(n) + ': its answer changed from “' + word(row.class) + '” to “' + word(to) + '”. Nothing else touched.'],
      ['', 'Kept rules now get <b>' + fmt(s.grown.hits) + '</b> of ' + fmt(n) + ' right (signed: ' + fmt(c.d.grown.hits) + '); always guessing “' + word(c.d.trainMajority) + '” now gets <b>' + fmt(s.base.hits) + '</b> (signed: ' + fmt(c.d.base.hits) + '). One answer is too small to move a percentage — it is not too small for the receipt.'],
      [s.receipt === c.committed ? 'good' : 'bad', 'New receipt <b>' + short(s.receipt) + '</b> ' + (s.receipt === c.committed ? '— still equals the signed one (this should never happen)' : '✗ no longer matches the signed receipt ' + short(c.committed) + '. One changed answer, and the signature shows it.')],
      ['out', 'Press again for another row. Every one of the ' + fmt(n) + ' is tried in the full run above.'],
    ]);
  } catch (e) { t11say([['bad', 'could not load the pinned files (' + e.message + ')']]); }
});
$('t11every').addEventListener('click', async () => {
  try {
    const c = await winCtx(), n = c.split.final.length;
    const exam = c.split.final.map((r) => ({ ...r, class: flipped(r.class, c.spec, c.d.trainMajority) }));
    const d2 = distil(c.spec, { ...c.split, final: exam }, t11in.runs.v3.teacherReply);
    const same = canonical(d2.rulesKept) === canonical(c.d.rulesKept);
    t11say([
      ['', 'Every one of the <b>' + fmt(n) + '</b> exam answers changed, then the whole run redone.'],
      [same ? 'good' : 'bad', same ? '✓ The kept rules are exactly the same ' + c.d.rulesKept.length + ' — the exam never chose a rule, so rigging the exam can’t change what was built.' : '✗ The kept rules changed — the exam leaked into the build.'],
      ['', 'The rules now score <b>' + pct(d2.grownAccuracy) + '</b> against a baseline of ' + pct(d2.baselineAccuracy) + ' — the charge would be <b>' + d2.charge + '</b>.'],
      [d2.receipt === c.committed ? 'good' : 'bad', 'Receipt <b>' + short(d2.receipt) + '</b> ' + (d2.receipt === c.committed ? '— equals the signed one (this should never happen)' : '✗ not the signed one. A different exam is a different receipt.')],
    ]);
  } catch (e) { t11say([['bad', 'could not load the pinned files (' + e.message + ')']]); }
});
$('t11reply').closest('details').addEventListener('toggle', async (e) => {
  if (!e.target.open || $('t11reply').dataset.done) return;
  try { const inputs = await loadT11(); $('t11reply').textContent = inputs.runs.v3.teacherReply; $('t11reply').dataset.done = '1'; } catch (err) { $('t11reply').textContent = 'could not load the recorded run (' + err.message + ')'; }
});

// ══ For business · the cost case, computed by src/mintcase.mjs from the sourced basis ══════════
const BASIS_PATH = 'vendor/ai-first-company/vendor/sovereign-enterprise/data/basis.json';
const gbp = (n) => '£' + Math.round(n).toLocaleString('en-GB');
const basis = await getJSON(BASIS_PATH);
function renderCost() {
  if (!basis) { $('c-head').textContent = 'the sourced basis could not be loaded — reconnect and reload'; return; }
  const v = (id) => Number($(id).value);
  const r = mintCase(basis, { hoursPerWeek: v('c-hours'), share: v('c-share') / 100, seats: v('c-seats'), casesPerWeek: v('c-cases'), years: v('c-years') });
  if (!r.ok) { $('c-head').textContent = 'Check the inputs: ' + r.why + '.'; return; }
  const n = r.inputs.years, yrs = n + (n === 1 ? ' year' : ' years');
  $('c-overh').textContent = 'Over ' + yrs;
  $('c-head').innerHTML = 'This process costs you <b>' + gbp(r.perYear.today) + '</b> a year in staff time today. Owning it: <b>' + gbp(r.perYear.own) + '</b> a year — <b class="win">' + gbp(r.savingPerYear) + ' a year back</b>, ' + gbp(r.savingOver) + ' over ' + yrs + '.';
  const rows = [
    ['Today', 'Your team does all of it.', 'today'],
    ['Rent AI assistant seats', 'Microsoft 365 Copilot for ' + r.inputs.seats + ' people (' + gbp(r.lines.seats) + ' a year). It helps each person; the work, and the staff time, stay.', 'rentSeats'],
    ['Call a cloud AI on every case', 'Takes the same share off, billed per case at Claude Sonnet 5 API rates (' + gbp(r.lines.api) + ' a year at your volume) — and every case leaves your building.', 'cloudApi'],
    ['Own it — mint-a-department', 'Takes the same share off on a machine you already have, for about ' + gbp(r.lines.power) + ' a year of electricity, always on. No seats, no meter, nothing leaves.', 'own'],
  ];
  const tb = $('c-table').querySelector('tbody'); tb.innerHTML = '';
  for (const [route, what, k] of rows) tb.append(el('tr', { class: k === 'own' ? 'ownrow' : '' }, el('td', {}, el('b', {}, route)), el('td', { class: 'wrap' }, what), el('td', { class: 'num', 'data-label': 'a year' }, gbp(r.perYear[k])), el('td', { class: 'num', 'data-label': 'over ' + yrs }, gbp(r.over[k]))));
  $('c-note').innerHTML = 'Owning beats the cloud route by <b>' + gbp(r.versusCloudOver) + '</b> over ' + yrs + ' at this volume — at low volumes the per-case bill is small, and the real difference is that nothing leaves your building. The cloud route assumes ' + r.inputs.tokensIn.toLocaleString('en-GB') + ' tokens in and ' + r.inputs.tokensOut.toLocaleString('en-GB') + ' out per case (a short document and a short answer). Staff time is priced at the median wage with no employer on-costs, so every saving here is a floor. <b>Our fee is not in this table:</b> it is written into your baseline agreement before any work, beside the number it has to beat, and it is due only if the receipt says due. Weigh it against the saving above — ' + gbp(r.savingOver) + ' over ' + yrs + ' on your inputs.';
  $('c-board').innerHTML = 'Pick one process. Today it costs <b>' + gbp(r.perYear.today) + '</b> a year in staff time — a floor, at the UK median wage. If an owned system takes off the share you estimate, that is <b>' + gbp(r.savingPerYear) + '</b> a year back, ' + gbp(r.savingOver) + ' over ' + yrs + ' with inflation, for about ' + gbp(r.lines.power) + ' a year of electricity. Renting AI seats instead would add ' + gbp(r.lines.seats) + ' a year and leave the work where it is. The downside is capped: if the signed receipt says it doesn’t beat today, the charge is waived. The board isn’t being asked to believe a vendor — only to sign a test.';
}
if (basis) {
  $('c-src').append(...sourcesOf(basis).map((s) => el('li', {}, s.what + (s.source ? ' — ' : ''), s.source ? el('a', { class: 'link', href: s.source, target: '_blank', rel: 'noopener' }, new URL(s.source).hostname) : '')));
}
for (const id of ['c-hours', 'c-share', 'c-seats', 'c-cases', 'c-years']) $(id).addEventListener('input', renderCost);
renderCost();

// ══ the page explains itself: START HERE ids, How-it-works traces, the blueprint, the white paper's results ══════════
// Every figure here is read from a committed receipt or manifest that GitHub's run re-derives; none is typed in.
const [gate, srcFall, srcAfc, wbase] = await Promise.all([getJSON('receipts/gate.json'), getJSON('vendor/SOURCES.json'), getJSON('vendor/SOURCES-ai-first-company.json'), getJSON('src/witness.baseline.json')]);
const id12 = (h) => String(h || '').slice(0, 12);
const REPO = 'https://github.com/sjgant80-hub/liveware/blob/main/';
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

(() => {
  const s1 = expId('T1');
  if ($('st-ids') && s1) $('st-ids').innerHTML = 'For the seed test, the expected receipt on this page starts <b>' + id12(s1) + '</b> — look for those same characters after “T1 pass”.' + (exp11 && exp11.id ? ' The guarantee has its own step, starting “T11”, which prints <b>' + id12(exp11.id) + '</b>.' : '');
})();

(() => {
  if (!detail) return;
  const t1 = detail.T1, t4 = detail.T4, t5 = detail.T5, t6 = detail.T6;
  if (t1 && t1.tamperRefusals) $('tr-t1').innerHTML = 'a <b>' + fmt(t1.seedBytes) + '</b>-byte seed, <b>' + t1.blocks + '</b> blocks · tampers refused, by the check that caught them: ' + Object.entries(t1.tamperRefusals).map(([k, n]) => k + ' <b>' + fmt(n) + '</b>').join(' · ');
  if (t4 && t4.refusals) $('tr-t4').innerHTML = '<b>' + t4.breaches + '</b> breaches · <b>' + t4.crashes + '</b> crashes · <b>' + t4.delivered + '</b> genuine delivered · <b>' + fmt(t4.swarmRecognised) + '</b> swarm mutants recognised · ' + ['forged signature', 'replay', 'unpinned key', 'foreign:sql'].filter((k) => t4.refusals[k]).map((k) => k + ' → «' + t4.refusals[k] + '»').join(' · ');
  if (t5 && t5.headline) { const h = t5.headline; $('tr-t5').innerHTML = 'LIGHT <b>' + ratioStr(h.lowLight) + '</b> on the ' + h.lowType + ' (gzip ' + ratioStr(h.lowGzip) + ') up to <b>' + ratioStr(h.highLight) + '</b> on the ' + h.highType + ' (gzip ' + ratioStr(h.highGzip) + ') · every round-trip byte-identical: ' + (t5.rows.every((r) => r.roundTrip) ? '<b>yes</b>' : '<b>no</b>'); }
  if (t6 && t6.state) $('tr-t6').innerHTML = 'shared document after both tabs edited it: ' + Object.entries(t6.state).map(([k, v]) => k + ' = “' + v + '”').join(', ') + ' · task handed across and re-computed: ' + Object.entries(t6.taskResult || {}).map(([k, v]) => k + ' <b>' + v + '</b>').join(', ') + ' · verdict <b>' + t6.verdict + '</b>';
})();

const KERNEL_TEXT = {
  receipt: ['The receipt', 'Writes the record every test leaves — inputs, outputs, verdict — and fingerprints it with SHA-256 over canonical JSON, so the same run gives the same id in Node, in CI and in your browser.'],
  rng: ['The seeded random stream', 'One seed gives the same numbers on every engine, so the fuzz and the swarm in the attack test are identical here and on GitHub.'],
  compress: ['LIGHT against the standard tools', 'Runs the compression race on the pinned samples, checks every round-trip byte for byte, and writes the compression test’s record.'],
  seed: ['The seed', 'Builds, signs, reads and grows the seed — magic, length, decode, shape, seal, signature, then every block’s hash, before anything loads — and re-emits a byte-identical copy.'],
  door: ['The door and the referee', 'Stands the signed-packet door and the immune system in front of a deliberately naive core, and keeps the independent referee’s ledger of what the genuine sender really signed.'],
  mesh: ['The mesh', 'Makes two copies peers: pins each other’s key, merges one shared document by a conflict-free law, hands a task across, refuses a forged or replayed peer.'],
  t11: ['The guarantee, re-run', 'Re-derives the three committed distillation runs from their recorded replies, must land on their signed receipts, then attacks every receipt with every single-answer exam tamper.'],
  mintcase: ['The cost case', 'Works out what one process costs today and on each route, from the sourced basis and your own inputs. Bad input gets a reason back, never a crash.'],
};
const PLAIN = [
  ['The four Wave 1 tests', 'src/wave1.mjs', 'Composes the kernels into the seed, attack, compression and mesh tests — the one body both this page and the harness run.', 'not mutation-gated itself: its four receipts must re-derive byte for byte on every push'],
  ['The harness', 'tools/', 'measure.mjs and measure-t11.mjs re-derive every receipt and refuse to run if a sealed claim has changed; measure-t11 also fails the build if a re-derived result is typed into the page; gate-receipt.mjs re-derives this blueprint’s figures.', 'run by GitHub on every push'],
  ['The page', 'page/app.mjs', 'Buttons, drawing and the scoreboard. Test results come from the test bodies above; the guarantee runs in a worker (page/t11-worker.mjs) so the page never freezes.', 'page glue, not mutation-gated'],
];
(() => {
  const host = $('bp-organs'); if (!host) return;
  const ks = gate && gate.record && gate.record.kernels;
  if (!ks) { $('bp-total').textContent = 'The gate receipt could not be loaded — reconnect and reload.'; return; }
  const n = (f) => sum(ks.map(f));
  $('bp-total').innerHTML = 'From the gate receipt <b>' + id12(gate.id) + '</b>, re-derived by <a class="link" href="https://github.com/sjgant80-hub/liveware/actions/workflows/gate.yml" target="_blank" rel="noopener">GitHub’s run</a> on every push (witness ' + gate.record.witness + '): <b>' + ks.length + '</b> gated kernels, <b>' + fmt(n((k) => k.tests)) + '</b> tests, <b>' + fmt(n((k) => k.killed)) + '</b> of <b>' + fmt(n((k) => k.mutants)) + '</b> planted bugs caught, <b>' + n((k) => k.baselined.length) + '</b> let through with a written reason, <b>' + n((k) => k.survived) + '</b> survived.';
  for (const k of ks) {
    const [name, what] = KERNEL_TEXT[k.kernel] || [k.kernel, ''];
    const b = k.baselined.length;
    host.append(el('div', { class: 'panel role' }, el('b', {}, name), el('a', { class: 'file', href: REPO + k.src, target: '_blank', rel: 'noopener' }, k.src), el('p', {}, what),
      el('p', { class: 'gate', html: '<b>' + k.tests + '</b> tests · <b>' + k.killed + '</b> of ' + k.mutants + ' planted bugs caught' + (b ? ' · ' + b + ' reviewed-equivalent, let through with a written reason' : '') + ' · <b>' + k.survived + '</b> survived' })));
  }
  for (const [name, path, what, status] of PLAIN) host.append(el('div', { class: 'panel role' }, el('b', {}, name), el('a', { class: 'file', href: (path.endsWith('/') ? REPO.replace('/blob/', '/tree/') : REPO) + path, target: '_blank', rel: 'noopener' }, path), el('p', {}, what), el('p', { class: 'gate plain' }, status)));
  const bl = $('bp-baseline');
  const why = (k, e) => ((wbase || []).find((w) => w.line === e.line && w.mutation === e.mutation) || {}).reason || 'reason in src/witness.baseline.json';
  const lines = ks.flatMap((k) => k.baselined.map((e) => el('p', { html: '<b>' + k.src + ', line ' + e.line + ', <code>' + e.mutation.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></b>' }, el('br'), why(k, e))));
  bl.append(...(lines.length ? lines : [el('p', {}, 'None — every planted bug was caught.')]));
})();
(() => {
  const tb = $('bp-vendor') && $('bp-vendor').querySelector('tbody'); if (!tb) return;
  for (const m of [srcFall, srcAfc]) {
    if (!m) continue;
    const name = m.repo.split('/')[1];
    for (const f of m.files) tb.append(el('tr', {}, el('td', { class: 'mono' }, f.path.replace('vendor/', '')), el('td', { class: 'wrap' }, f.what), el('td', {}, el('a', { class: 'link', href: 'https://github.com/' + m.repo + '/blob/' + m.commit + '/' + f.src, target: '_blank', rel: 'noopener' }, name + ' @ ' + m.commit.slice(0, 7))), el('td', { class: 'num mono' }, id12(f.sha256))));
  }
})();

(() => {
  const host = $('wp-results'); if (!host) return;
  const items = [];
  if (detail && detail.T1) { const t = detail.T1, n = sum(Object.values(t.tamperRefusals || {})); items.push('<b>The seed</b> — a ' + fmt(t.seedBytes) + '-byte signed seed grows ' + t.blocks + ' blocks and copies itself byte for byte; ' + fmt(n) + ' of its ' + fmt(t.seedBytes) + ' bytes, each flipped in turn, refused before a block loads. Verdict: ' + t.verdict + '.'); }
  if (detail && detail.T4) { const t = detail.T4; items.push('<b>Attack it</b> — ' + t.breaches + ' breaches and ' + t.crashes + ' crashes under the classic attacks, the seeded fuzz and the swarm; ' + t.delivered + ' genuine packets still delivered; ' + fmt(t.swarmRecognised) + ' swarm mutants recognised as a known attack’s variant. Verdict: ' + t.verdict + '.'); }
  if (detail && detail.T5 && detail.T5.headline) { const h = detail.T5.headline; items.push('<b>Compression</b> — LIGHT from ' + ratioStr(h.lowLight) + ' on the ' + h.lowType + ' to ' + ratioStr(h.highLight) + ' on the ' + h.highType + ', against gzip’s ' + ratioStr(h.lowGzip) + ' and ' + ratioStr(h.highGzip) + '; every sample restored byte for byte. Verdict: ' + detail.T5.verdict + '.'); }
  if (detail && detail.T6) items.push('<b>The mesh</b> — two copies pin each other’s key, converge one shared document, hand a task across and get it back re-computed; a forged or replayed peer is refused. Verdict: ' + detail.T6.verdict + '.');
  if (det11 && det11.runs) {
    const runs = det11.runs, won = runs.filter((r) => r.charge === 'due'), w = won[0];
    items.push('<b>The guarantee</b> — ' + runs.length + ' committed runs re-derived and landed on their signed receipts: ' + runs.map((r) => r.id + ' (' + ((String(r.dataset).match(/mint-demo-([a-z]+).data/) || [])[1] || r.dataset) + ') ' + r.charge).join(', ') + '.' + (w ? ' The win: ' + pct(w.baselineAccuracy) + ' → ' + pct(w.grownAccuracy) + ' on ' + fmt(w.exam) + ' exam rows nobody used to choose a rule.' : '') + ' Of the ' + fmt(sum(runs.map((r) => r.exam))) + ' single-answer exam tampers, ' + fmt(sum(runs.map((r) => r.changed))) + ' changed the receipt. Verdict: ' + det11.verdict + '.');
  }
  if (gate && gate.record) { const ks = gate.record.kernels; items.push('<b>The gate</b> — ' + fmt(sum(ks.map((k) => k.killed))) + ' of ' + fmt(sum(ks.map((k) => k.mutants))) + ' planted bugs caught across ' + ks.length + ' kernels, ' + sum(ks.map((k) => k.baselined.length)) + ' let through with a written reason, ' + sum(ks.map((k) => k.survived)) + ' survived.'); }
  host.innerHTML = '';
  host.append(...(items.length ? items.map((h) => el('li', { html: h })) : [el('li', {}, 'The receipts could not be loaded — reconnect and reload.')]));
})();

// ── run all ──────────────────────────────────────────────────────────────────────────────────
$('runall').addEventListener('click', async () => {
  $('runall').disabled = true;
  await scoreT5();
  await runT4All();
  await runT1();
  await scoreT6();
  await runT11();
  $('runall').disabled = false;
});

// ── boot ────────────────────────────────────────────────────────────────────────────────────
await loadSamples();
renderT5Table();
scoreT5();
// the receipts for the other three show their expected verdict immediately; pressing a button recomputes live
if (detail) { for (const t of ['T1', 'T4', 'T6']) if (detail[t]) setState(t, detail[t].verdict === 'pass' ? 'pass' : 'fail', detail[t].verdict + ' (press to run)'); }
if (det11) {
  renderT11(det11, false);
  setState('T11', det11.verdict === 'pass' ? 'pass' : 'fail', det11.verdict + ' (press to run)');
  publishedLine($('t11receipt'), det11.id, det11.verdict);
  $('t11src').textContent = 'showing GitHub’s run — press to redo it yourself';
} else $('t11src').textContent = 'no published run yet — press to run it yourself';
$('boot').style.display = 'none';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
$('offline').textContent = 'Installable · works offline after first load · nothing you run here leaves your device.';
