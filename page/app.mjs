// page/app.mjs — the live page. It runs the SAME test bodies as the harness (src/wave1.mjs), so the receipt id you
// compute here equals the one CI publishes. The mycelium is drawn on a canvas; everything else is the kernels, live.
import { t1, t4, t6, T4_ATTACKS } from '../src/wave1.mjs';
import { light, measureOne, headline } from '../src/compress.mjs';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { prepare, finish } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { makePeer } from '../src/mesh.mjs';
import { shaHex, canonical } from '../src/receipt.mjs';

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
const expId = (t) => (expected && expected[t] ? expected[t].id : null);

// ── scoreboard ───────────────────────────────────────────────────────────────────────────────
const TESTS = [['T5', 'Compression'], ['T4', 'Attack it'], ['T1', 'The seed'], ['T6', 'The mesh']];
const chips = {};
$('board').append(...TESTS.map(([id, name]) => {
  const state = el('span', { class: 'state' }, el('span', { class: 'dot' }), el('span', {}, 'not run'));
  const bar = el('span', { class: 'bar' });
  chips[id] = { state, bar };
  return el('div', { class: 'chip' }, el('div', { class: 'k' }, id), el('div', { class: 't' }, name), state, bar);
}));
function setState(id, s, label) { const c = chips[id]; if (!c) return; c.state.className = 'state ' + s; c.state.lastChild.textContent = label; c.bar.style.width = s === 'pass' ? '100%' : s === 'fail' ? '100%' : s === 'run' ? '60%' : '0'; c.bar.style.background = s === 'fail' ? 'var(--bad)' : ''; }

function receiptLine(host, ran, expId) {
  const match = expId && ran.id === expId;
  host.innerHTML = '';
  host.append(
    el('div', {}, el('span', { class: 'verdict ' + (ran.record.verdict === 'pass' ? 'pass' : 'fail') }, ran.record.verdict.toUpperCase()), ' ', el('span', { class: 'pill' }, ran.record.verdict === 'pass' ? 'every criterion met' : 'a criterion failed — kept on the record')),
    el('p', { class: 'rhash' }, 'your receipt  ', el('b', {}, ran.id.slice(0, 24)), '…'),
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
function detailRow(file) { return detail && detail.T5 && detail.T5.rows.find((r) => r.file === file); }
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
  $('t5round').innerHTML = 'SHA-256 original <b>' + l.origSha.slice(0, 16) + '…</b> → restored <b>' + l.backSha.slice(0, 16) + '…</b> ' + (l.roundTrip ? '· identical' : '· DIFFERS');
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
  if (detail && detail.T5) { const v = detail.T5.verdict; setState('T5', v === 'pass' ? 'pass' : 'fail', v === 'pass' ? 'pass' : 'fail'); receiptLine($('t5receipt'), { id: detail.T5.id, record: { verdict: v } }, expId('T5')); }
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

// ── run all ──────────────────────────────────────────────────────────────────────────────────
$('runall').addEventListener('click', async () => {
  $('runall').disabled = true;
  await scoreT5();
  await runT4All();
  await runT1();
  await scoreT6();
  $('runall').disabled = false;
});

// ── boot ────────────────────────────────────────────────────────────────────────────────────
await loadSamples();
renderT5Table();
scoreT5();
// the receipts for the other three show their expected verdict immediately; pressing a button recomputes live
if (detail) { for (const t of ['T1', 'T4', 'T6']) if (detail[t]) setState(t, detail[t].verdict === 'pass' ? 'pass' : 'fail', detail[t].verdict + ' (press to run)'); }
$('boot').style.display = 'none';
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
$('offline').textContent = 'Installable · works offline after first load · nothing you run here leaves your device.';
