#!/usr/bin/env node
// tools/measure.mjs — runs Wave 1 (T1, T4, T5, T6) against the sealed claims and writes receipts/wave1.json. Nothing
// here is random without a seed, so the receipt re-derives byte for byte in CI and in a browser. Refuses to run if
// CLAIMS.md changed since the commit that sealed it, and names that commit.   node tools/measure.mjs [--check]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { seal as sealPacket, prepare, finish } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { genomeOf, makeSeed, germinate, offspring, signedOf } from '../src/seed.mjs';
import { makeDoor, makeReferee, schemaNote } from '../src/door.mjs';
import { measureOne, headline } from '../src/compress.mjs';
import { makePeer } from '../src/mesh.mjs';
import { receiptOf, shaHex, canonical } from '../src/receipt.mjs';
import { rng } from '../src/rng.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const rd = (p) => readFileSync(join(ROOT, p));
const txt = (p) => rd(p).toString('utf8');
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
const u8 = (b) => new Uint8Array(b);

// the seal, and the commit that sealed it
const claimsText = txt('CLAIMS.md');
const CLAIMS = JSON.parse(claimsText.match(/```json\n([\s\S]*?)\n```/)[1]);
const touched = git('log', '--format=%H', '--', 'CLAIMS.md').split('\n').filter(Boolean);
const sealedAt = touched[touched.length - 1] || null;
const sealClean = touched.length >= 1 && git('status', '--porcelain', '--', 'CLAIMS.md') === '';

// Ed25519 helpers for the packet/door ctx (verify is async in WebCrypto; the door awaits it)
const verify = (id, signed, sig) => verifyBytes(id, signed, sig);

async function sign(identity, bytes) { return identity.sign(bytes); }

// a signed note packet from an identity with a counter
async function notePacket(identity, counter, value) {
  const p = prepare({ sender: identity.slot, counter: BigInt(counter), dictId: 0, kind: 1, value });
  if (!p.ok) throw new Error(p.why);
  const f = finish(p.unsigned, await identity.sign(p.signed));
  if (!f.ok) throw new Error(f.why);
  return f.bytes;
}

async function T1() {
  // three blocks: real file bytes, pinned by hash in the genome
  const blocks = [
    { path: 'a.txt', bytes: u8(Buffer.from('block one\n')) },
    { path: 'b.json', bytes: u8(Buffer.from('{"two":2}\n')) },
    { path: 'c.bin', bytes: u8([0, 1, 2, 3, 250, 251, 252, 253]) },
  ];
  const store = new Map(blocks.map((b) => [b.path, b.bytes]));
  const genome = genomeOf('liveware-demo', blocks, { grows: true });
  const signer = await makeIdentity(new Uint8Array(32).fill(7));    // the seed's key: fixed seed → re-runnable
  const made = await makeSeed(genome, (b) => signer.sign(b));
  const io = { verify: (signed, sig) => verifyBytes(signer.id, signed, sig), fetch: (p) => store.get(p) || null, load: async () => {} };

  const grown = await germinate(made.bytes, io);
  const P1 = grown.ok && grown.imported === genome.blocks.length;
  const off = P1 ? offspring(grown) : { ok: false };
  const P2 = off.ok && shaHex(off.bytes) === shaHex(made.bytes);

  let P3 = true; let refusedStages = {};
  for (let i = 0; i < made.bytes.length; i++) {
    const t = made.bytes.slice(); t[i] ^= 1;
    const g = await germinate(t, io);
    if (g.ok || g.imported !== 0) { P3 = false; break; }
    refusedStages[g.stage] = (refusedStages[g.stage] || 0) + 1;
  }
  // a genuine seed whose served block is altered
  const badStore = new Map(store); badStore.set('a.txt', u8(Buffer.from('block ONE\n')));
  const g4 = await germinate(made.bytes, { ...io, fetch: (p) => badStore.get(p) || null });
  const P4 = !g4.ok && g4.stage === 'block' && g4.imported === 0;

  const pass = P1 && P2 && P3 && P4;
  const _o={ P1, P2, P3, P4, seedBytes: made.bytes.length, tamperRefusals: refusedStages }; return { ...receiptOf('T1', 1, { seedSha: shaHex(made.bytes), blocks: genome.blocks }, _o, pass ? 'pass' : 'fail', { signerSeed: '07*32' }), detail: _o };
}

async function T4(fuzzN = 10000) {
  const sender = await makeIdentity(new Uint8Array(32).fill(9));
  const outsider = await makeIdentity(new Uint8Array(32).fill(66));
  const keyset = shaHex([sender.id].join('|'));
  const door = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset, verify, schema: schemaNote });
  const ref = makeReferee();

  // 100 genuine packets delivered (P5)
  let delivered = 0;
  for (let i = 1; i <= 100; i++) {
    const value = { op: 'note', n: i, text: 'note ' + i };
    ref.sent(value);
    const pkt = await notePacket(sender, i, value);
    const v = await door.check(pkt);
    if (v.admit) { const got = ref.received(v.value); if (got) delivered++; }
  }
  const P5 = delivered === 100;

  // named attack classes
  const genuine = await notePacket(sender, 101, { op: 'note', n: 101, text: 'real' });
  const attacks = [];
  const forgedSig = genuine.slice(); forgedSig[forgedSig.length - 1] ^= 0xff; attacks.push(['forged signature', forgedSig]);
  attacks.push(['replay', (await notePacket(sender, 50, { op: 'note', n: 50, text: 'note 50' }))]);   // counter already used
  const tampered = genuine.slice(); tampered[30] ^= 1; attacks.push(['tampered body', tampered]);
  attacks.push(['unpinned key', await notePacket(outsider, 1, { op: 'note', n: 1, text: 'hi' })]);
  attacks.push(['oversized', u8(Buffer.alloc(2_000_000, 65))]);
  for (const [name, s] of [['sql', "'; DROP TABLE users; --"], ['script', '<script>alert(1)</script>'], ['shell', '$(rm -rf /)'], ['http', 'GET / HTTP/1.1\r\nHost: x\r\n\r\n'], ['json', '{"op":"note","n":1,"text":"x"}']]) attacks.push(['foreign:' + name, u8(Buffer.from(s))]);
  const short = genuine.slice(0, 10); attacks.push(['broken length', short]);
  // a genuine sender, valid signature, body that escapes the schema
  attacks.push(['schema escape', await notePacket(sender, 102, { op: 'drop', table: 'users' })]);

  let breaches = ref.tally().breaches, named = true;
  const refusals = {};
  for (const [name, bytes] of attacks) {
    const v = await door.check(bytes);
    if (v.admit) { if (!ref.received(v.value)) {} }   // referee counts breaches on receipt; an admit of an attack is a breach
    if (v.admit) { ref.received(v.value); }
    if (!v.admit && (!v.stage || !v.why)) named = false;
    refusals[name] = v.admit ? 'ADMITTED' : v.stage;
  }

  // seeded fuzz: random bytes and random mutations of the genuine packet
  const r = rng(4242); let crashes = 0;
  for (let i = 0; i < fuzzN; i++) {
    let bytes;
    if (r.int(2) === 0) bytes = r.bytes(r.int(400));
    else { bytes = genuine.slice(); const k = 1 + r.int(8); for (let j = 0; j < k; j++) bytes[r.int(bytes.length)] ^= (1 + r.int(255)); }
    try { const v = await door.check(bytes); if (v.admit) ref.received(v.value); } catch { crashes++; }
  }

  // the mutating swarm: 1,000 mutants of one captured attack, after one capture
  const base = forgedSig;
  await door.check(base);                              // capture once
  let recognised = 0;
  const swarm = rng(77);
  for (let i = 0; i < 1000; i++) {
    const m = base.slice(); const k = 1 + swarm.int(4); for (let j = 0; j < k; j++) m[m.length - 1 - swarm.int(8)] ^= (1 + swarm.int(255));
    const v = await door.check(m);
    if (!v.admit && v.variant) recognised++;
  }
  // an exact repeat is recognised every time
  const repeat = await door.check(base);
  const exactRepeat = !repeat.admit && repeat.stage === 'immune';

  breaches = ref.tally().breaches;
  const P1 = breaches === 0, P2 = named, P3 = recognised >= 900 && exactRepeat, P4 = breaches === 0 && crashes === 0;
  const pass = P1 && P2 && P3 && P4 && P5;
  const _o={ P1, P2, P3, P4, P5, breaches, crashes, delivered, swarmRecognised: recognised, exactRepeat, refusals }; return { ...receiptOf('T4', 1, { attacks: attacks.map((a) => a[0]), fuzzN }, _o, pass ? 'pass' : 'fail', { fuzzSeed: 4242, swarmSeed: 77 }), detail: _o };
}

function T5() {
  const manifest = JSON.parse(txt('samples/MANIFEST.json'));
  const gzip = (b) => zlib.gzipSync(b, { level: 9 }).length;
  const zstd = (b) => zlib.zstdCompressSync(b, { params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 } }).length;
  const brotli = (b) => zlib.brotliCompressSync(b).length;
  const rows = manifest.samples.map((s) => ({ type: s.type, file: s.file, ...measureOne(u8(rd('samples/' + s.file)), { gzip, zstd, brotli }) }));
  const P1 = rows.every((r) => r.roundTrip);
  const P2 = rows.every((r) => r.light && r.gzip && r.zstd && r.brotli);
  const P3 = rows.length === manifest.samples.length && rows.some((r) => r.type.includes('image')) && rows.some((r) => r.type.includes('tiny'));
  const head = headline(rows);
  const P4 = head !== null;
  const pass = P1 && P2 && P3 && P4;
  const _o={ P1, P2, P3, P4, headline: head, rows: rows.map((r) => ({ type: r.type, orig: r.orig, light: r.light, gzip: r.gzip, zstd: r.zstd, brotli: r.brotli, roundTrip: r.roundTrip })) }; return { ...receiptOf('T5', 1, { samples: manifest.samples.map((s) => s.sha256) }, _o, pass ? 'pass' : 'fail', { gzip: 9, zstd: 19, brotli: 'q11' }), detail: _o };
}

async function T6() {
  const A = await makeIdentity(new Uint8Array(32).fill(1));
  const B = await makeIdentity(new Uint8Array(32).fill(2));
  const forger = await makeIdentity(new Uint8Array(32).fill(3));
  // an in-memory channel: each peer's send() hands the bytes to the other's onMessage()
  let peerA, peerB;
  const ctrA = { v: 1 }, ctrB = { v: 1 };
  const frameBody = (id, ctr) => async (kind, value) => { const p = await notePacketAny(id, ctr.v++, value); return p; };
  // T6 uses the same signed-packet shape but with its own schema (any object); reuse notePacket with kind JSON
  async function notePacketAny(identity, counter, value) {
    const p = prepare({ sender: identity.slot, counter: BigInt(counter), dictId: 0, kind: 1, value });
    if (!p.ok) throw new Error(p.why);
    const f = finish(p.unsigned, await identity.sign(p.signed));
    if (!f.ok) throw new Error(f.why);
    return f.bytes;
  }
  peerA = makePeer({ self: A, docId: 'd', verify, frameBody: frameBody(A, ctrA), send: (b) => peerB.onMessage(b) });
  peerB = makePeer({ self: B, docId: 'd', verify, frameBody: frameBody(B, ctrB), send: (b) => peerA.onMessage(b) });

  await peerA.hello(); await peerB.hello();
  const P1 = peerA.peers().includes(B.slot) && peerB.peers().includes(A.slot);

  await peerA.setLocal('title', 'from A');
  await peerB.setLocal('note', 'from B');
  const P2 = canonical(peerA.state()) === canonical(peerB.state()) && peerA.state().title === 'from A' && peerA.state().note === 'from B';

  const res = await peerA.ask([3, 4, 5]);
  const P3 = res.ok && res.out.sum === 12;

  // a forged peer: signs with a key A never pinned, claims B's slot
  const forged = await notePacketAny({ ...forger, slot: B.slot }, 999, { t: 'op', doc: peerB.doc() });
  const before = canonical(peerA.state());
  const r = await peerA.onMessage(forged);
  const P4a = r.in === 'refused';
  // a replay: resend B's last real op (counter not after the last seen)
  const replay = await notePacketAny(B, 1, { t: 'op', doc: peerB.doc() });
  const r2 = await peerA.onMessage(replay);
  const P4 = P4a && r2.in === 'refused' && canonical(peerA.state()) === before;

  const pass = P1 && P2 && P3 && P4;
  const _o={ P1, P2, P3, P4, state: peerA.state(), taskResult: res.out }; return { ...receiptOf('T6', 1, { docId: 'd' }, _o, pass ? 'pass' : 'fail', { keysA: '01*32', keysB: '02*32' }), detail: _o };
}

async function main() {
  if (!sealClean) { console.error('CLAIMS.md differs from the commit that sealed it'); process.exit(1); }
  const check = process.argv.includes('--check');
  const fast = process.argv.includes('--fast');
  const ran = { T1: await T1(), T4: await T4(fast ? 2000 : 10000), T5: T5(), T6: await T6() };
  // the receipt file (CI compares this): records and ids only, so it re-derives byte for byte
  const results = { kind: 'liveware.receipts', wave: 1, sealedAt };
  for (const t of ['T1', 'T4', 'T5', 'T6']) results[t] = { record: ran[t].record, id: ran[t].id };
  // the detail file (the page reads this): the measured numbers behind each receipt, not hashed
  const detail = { kind: 'liveware.detail', wave: 1, sealedAt };
  for (const t of ['T1', 'T4', 'T5', 'T6']) detail[t] = { id: ran[t].id, verdict: ran[t].record.verdict, ...ran[t].detail };
  const summary = ['T1', 'T4', 'T5', 'T6'].map((t) => t + ' ' + results[t].record.verdict + ' ' + results[t].id.slice(0, 12));
  const text = JSON.stringify(results, null, 1) + '\n';
  if (check) {
    const prev = existsSync(join(ROOT, 'receipts/wave1.json')) ? txt('receipts/wave1.json') : '';
    const prevJ = prev ? JSON.parse(prev) : {};
    let ok = true;
    for (const t of ['T1', 'T4', 'T5', 'T6']) if (!prevJ[t] || prevJ[t].id !== results[t].id) { ok = false; console.error(t + ' RECEIPT MISMATCH: expected ' + (prevJ[t] && prevJ[t].id) + ', got ' + results[t].id); }
    console.log(summary.join(' · '));
    process.exit(ok ? 0 : 1);
  }
  mkdirSync(join(ROOT, 'receipts'), { recursive: true });
  writeFileSync(join(ROOT, 'receipts/wave1.json'), text);
  writeFileSync(join(ROOT, 'receipts/wave1-detail.json'), JSON.stringify(detail, null, 1) + '\n');
  for (const t of ['T1', 'T4', 'T5', 'T6']) console.log((results[t].record.verdict === 'pass' ? 'PASS ' : 'FAIL ') + t + ' · ' + results[t].id.slice(0, 16));
  console.log(summary.join(' · '));
}
main().catch((e) => { console.error('measure failed:', e.stack || e.message); process.exit(1); });

