import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { genomeOf, validGenome, safePath, prefixOf, assemble, makeSeed, readSeed, germinate, offspring, MAGIC, HEAD, SEAL, SIG, MAX_SEED } from '../src/seed.mjs';
import { shaHex, canonical } from '../src/receipt.mjs';

const u8 = (b) => new Uint8Array(b);
const BLOCKS = () => [
  { path: 'a.txt', bytes: u8(Buffer.from('block one\n')) },
  { path: 'b.json', bytes: u8(Buffer.from('{"two":2}\n')) },
  { path: 'c.bin', bytes: u8([0, 1, 2, 3, 250, 251, 252, 253]) },
];
async function fixture() {
  const blocks = BLOCKS(), store = new Map(blocks.map((b) => [b.path, b.bytes]));
  const genome = genomeOf('demo', blocks, { grows: true });
  const signer = await makeIdentity(u8(new Array(32).fill(7)));
  const made = await makeSeed(genome, (b) => signer.sign(b));
  const io = { verify: (signed, sig) => verifyBytes(signer.id, signed, sig), fetch: (p) => store.get(p) || null, load: async () => {} };
  return { blocks, store, genome, signer, made, io };
}

test('safePath: relative, no climbing, no odd characters', () => {
  assert.ok(safePath('a/b-c_1.mjs'));
  assert.ok(!safePath('../x'));
  assert.ok(!safePath('/x'));
  assert.ok(!safePath('a/../b'));
  assert.ok(!safePath(''));
  assert.ok(safePath('a' + 'x'.repeat(255)));     // exactly 256 is allowed
  assert.ok(!safePath('a' + 'x'.repeat(256)));    // 257 is not
  assert.ok(!safePath('.hidden'));
});

test('genomeOf drops junk blocks, and the config guard keeps only a plain object', () => {
  const g = genomeOf('n', [{ path: 'ok.txt', bytes: new Uint8Array([1]) }, null, { path: '../bad', bytes: new Uint8Array([2]) }, { path: 'x', bytes: 'notbytes' }], { a: 1 });
  assert.deepEqual(g.blocks.map((b) => b.path), ['ok.txt']);
  assert.deepEqual(g.config, { a: 1 });
  assert.deepEqual(genomeOf('n', [], null).config, {});
  assert.deepEqual(genomeOf('n', [], [1, 2]).config, {});
  assert.deepEqual(genomeOf('n', [], 'x').config, {});
});

test('validGenome is false (never throws) on a null block, and true on a good genome', () => {
  const g = genomeOf('n', BLOCKS(), {});
  assert.equal(validGenome(g), true);
  assert.equal(validGenome({ ...g, blocks: [null] }), false);
  assert.equal(validGenome({ ...g, blocks: [{ path: 'a', sha256: 'x' }] }), false);
});

test('validGenome rejects a genome that violates exactly ONE clause (each guard disjunct bites)', () => {
  const g = genomeOf('n', BLOCKS(), { k: 1 });
  assert.equal(validGenome(null), false);                       // g === null
  assert.equal(validGenome('a genome'), false);                 // typeof !== object
  assert.equal(validGenome({ ...g, kind: 'other' }), false);    // kind
  assert.equal(validGenome({ ...g, v: 2 }), false);             // v !== 1
  assert.equal(validGenome({ ...g, name: 7 }), false);          // name not a string
  assert.equal(validGenome({ ...g, blocks: 'nope' }), false);   // blocks not an array
  assert.equal(validGenome({ ...g, config: null }), false);     // config null
  assert.equal(validGenome({ ...g, config: [1] }), false);      // config an array
  assert.equal(validGenome({ ...g, config: 'x' }), false);      // config not an object
});

test('makeSeed refuses an invalid genome or a non-function signer (its guard bites both ways)', async () => {
  const signer = await makeIdentity(u8(new Array(32).fill(1)));
  const g = genomeOf('n', BLOCKS(), {});
  assert.equal((await makeSeed({ ...g, v: 2 }, (b) => signer.sign(b))).ok, false);   // invalid genome, real signer
  assert.equal((await makeSeed(g, null)).ok, false);                                  // valid genome, no signer
  assert.equal((await makeSeed(g, (b) => signer.sign(b))).ok, true);
});

test('readSeed refuses a seed whose genome is valid JSON but not canonical (the canonical-form guard bites)', () => {
  // a well-formed seed whose body is a NON-canonical serialisation of an otherwise-valid genome
  const g = genomeOf('n', BLOCKS(), {});
  const nonCanon = '{"v":1,"kind":"liveware.genome","name":"n","blocks":' + JSON.stringify(g.blocks) + ',"config":{}}';   // keys out of order
  assert.notEqual(nonCanon, canonical(g));
  const built = assemble(new TextEncoder().encode(nonCanon), u8(new Array(64).fill(0)));
  assert.ok(built.ok);
  const r = readSeed(built.bytes);
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'genome');
});

test('readSeed size upper bound: exactly MAX_SEED passes the size check, one over is refused at size', () => {
  assert.equal(readSeed(u8(new Array(MAX_SEED + 1).fill(0))).stage, 'size');
  assert.notEqual(readSeed(u8(new Array(MAX_SEED).fill(0))).stage, 'size');
});

test('genomeOf sorts blocks by path and hashes their bytes; validGenome accepts it', () => {
  const g = genomeOf('demo', BLOCKS(), { k: 1 });
  assert.deepEqual(g.blocks.map((b) => b.path), ['a.txt', 'b.json', 'c.bin']);
  assert.ok(g.blocks.every((b) => /^[0-9a-f]{64}$/.test(b.sha256)));
  assert.ok(validGenome(g));
  assert.ok(!validGenome({ ...g, kind: 'x' }));
  assert.ok(!validGenome({ ...g, blocks: [{ path: 'a', sha256: 'x' }] }));
  // duplicate paths are rejected
  assert.ok(!validGenome({ ...g, blocks: [g.blocks[0], g.blocks[0]] }));
});

test('T1-P1: a genuine seed germinates and imports exactly the blocks the genome names', async () => {
  const { genome, made, io } = await fixture();
  assert.ok(made.ok);
  const g = await germinate(made.bytes, io);
  assert.ok(g.ok);
  assert.equal(g.imported, genome.blocks.length);
});

test('T1-P2: the offspring seed is byte-identical to the parent', async () => {
  const { made, io } = await fixture();
  const g = await germinate(made.bytes, io);
  const off = offspring(g);
  assert.ok(off.ok);
  assert.equal(shaHex(off.bytes), shaHex(made.bytes));
});

test('T1-P3: EVERY single-byte tamper is refused with zero blocks imported', async () => {
  const { made, io } = await fixture();
  for (let i = 0; i < made.bytes.length; i++) {
    const t = made.bytes.slice(); t[i] ^= 1;
    const g = await germinate(t, io);
    assert.equal(g.ok, false, 'byte ' + i + ' must be refused');
    assert.equal(g.imported, 0, 'byte ' + i + ' imported ' + g.imported);
  }
});

test('T1-P4: a genuine seed whose served block was altered is refused at the block check', async () => {
  const { made, store, io } = await fixture();
  const bad = new Map(store); bad.set('a.txt', u8(Buffer.from('block ONE\n')));
  const g = await germinate(made.bytes, { ...io, fetch: (p) => bad.get(p) || null });
  assert.equal(g.ok, false);
  assert.equal(g.stage, 'block');
  assert.equal(g.imported, 0);
});

test('a seed signed by another key is refused at the signature', async () => {
  const { made } = await fixture();
  const other = await makeIdentity(u8(new Array(32).fill(8)));
  const g = await germinate(made.bytes, { verify: (s, sig) => verifyBytes(other.id, s, sig), fetch: () => u8([]), load: async () => {} });
  assert.equal(g.stage, 'signature');
  assert.equal(g.imported, 0);
});

test('readSeed names each refusal stage; a non-seed is refused at size/magic', async () => {
  const { made } = await fixture();
  assert.equal(readSeed(u8([1, 2, 3])).stage, 'size');
  const wrongMagic = made.bytes.slice(); wrongMagic[0] = 0;
  assert.equal(readSeed(wrongMagic).stage, 'magic');
  const wrongLen = made.bytes.slice(); new DataView(wrongLen.buffer).setUint32(4, 999999);
  assert.equal(readSeed(wrongLen).stage, 'length');
  assert.ok(readSeed(made.bytes).ok);
});

test('germinate never throws on garbage, and refuses a null io at the signature (not a crash)', async () => {
  for (const g of [null, undefined, u8([]), u8(new Array(500).fill(255)), 'x']) {
    const r = await germinate(g, { verify: async () => true, fetch: () => null, load: async () => {} });
    assert.equal(r.ok, false);
    assert.equal(r.imported, 0);
  }
  const { made } = await fixture();
  const r = await germinate(made.bytes, null);   // no verify in a null io → signature refusal, not a throw
  assert.equal(r.ok, false);
  assert.equal(r.stage, 'signature');
});

test('germinate calls load once per block, in order, only after every check passed', async () => {
  const { made, io } = await fixture();
  const loaded = [];
  const g = await germinate(made.bytes, { ...io, load: async (path) => { loaded.push(path); } });
  assert.ok(g.ok);
  assert.deepEqual(loaded, ['a.txt', 'b.json', 'c.bin']);
  assert.equal(g.imported, 3);
  // a load that throws on the 2nd block stops there, with that many imported
  const loaded2 = [];
  const g2 = await germinate(made.bytes, { ...io, load: async (path) => { loaded2.push(path); if (path === 'b.json') throw new Error('x'); } });
  assert.equal(g2.ok, false);
  assert.equal(g2.stage, 'load');
  assert.equal(g2.imported, 1);
});

test('readSeed size boundary: one below the minimum is refused at size; exactly the minimum is not', () => {
  assert.equal(readSeed(u8(new Array(HEAD + 1 + SEAL + SIG - 1).fill(0))).stage, 'size');
  assert.notEqual(readSeed(u8(new Array(HEAD + 1 + SEAL + SIG).fill(0))).stage, 'size');   // min length passes size, fails later
});

test('offspring is false (never throws) when any one of its three requirements is missing', async () => {
  const { genome, signer } = await fixture();
  assert.equal(offspring(null).ok, false);
  assert.equal(offspring(undefined).ok, false);
  assert.equal(offspring({}).ok, false);
  assert.equal(offspring({ genome: null, sig: new Uint8Array(64) }).ok, false);         // no genome
  assert.equal(offspring({ genome: { ...genome, v: 2 }, sig: new Uint8Array(64) }).ok, false);   // invalid genome
  assert.equal(offspring({ genome, sig: 'not-bytes' }).ok, false);                      // bad signature type
});

test('assemble refuses a wrong-length signature; the layout is magic+len+light+seal+sig', async () => {
  const { genome } = await fixture();
  const enc = new TextEncoder();
  const p = prefixOf(enc.encode(JSON.stringify(genome)));
  assert.ok(p.ok);
  assert.equal(assemble(enc.encode('x'), u8([1, 2, 3])).ok, false);
  const made = await (async () => { const s = await makeIdentity(u8(new Array(32).fill(1))); return makeSeed(genome, (b) => s.sign(b)); })();
  for (let i = 0; i < 4; i++) assert.equal(made.bytes[i], MAGIC[i]);
  assert.equal(made.bytes.length, HEAD + new DataView(made.bytes.buffer).getUint32(4) + SEAL + SIG);
});
