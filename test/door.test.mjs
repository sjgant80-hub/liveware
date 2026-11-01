import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { prepare, finish } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { makeDoor, makeReferee, schemaNote } from '../src/door.mjs';
import { shaHex } from '../src/receipt.mjs';

const u8 = (b) => new Uint8Array(b);
const verify = (id, signed, sig) => verifyBytes(id, signed, sig);
async function pkt(identity, counter, value) {
  const p = prepare({ sender: identity.slot, counter: BigInt(counter), dictId: 0, kind: 1, value });
  if (!p.ok) throw new Error(p.why);
  const f = finish(p.unsigned, await identity.sign(p.signed));
  return f.bytes;
}
async function setup() {
  const sender = await makeIdentity(u8(new Array(32).fill(9)));
  const outsider = await makeIdentity(u8(new Array(32).fill(66)));
  const keyset = shaHex([sender.id].join('|'));
  const door = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset, verify, schema: schemaNote });
  return { sender, outsider, door };
}

test('schemaNote accepts only { op:"note", n, text<=200 }', () => {
  assert.ok(schemaNote({ op: 'note', n: 1, text: 'hi' }).ok);
  assert.ok(!schemaNote({ op: 'note', n: 1, text: 'x'.repeat(201) }).ok);
  assert.ok(!schemaNote({ op: 'drop', n: 1, text: 'hi' }).ok);
  assert.ok(!schemaNote({ op: 'note', n: -1, text: 'hi' }).ok);
  assert.ok(!schemaNote({ op: 'note', n: 1 }).ok);
  assert.ok(!schemaNote({ op: 'note', n: 1, text: 'hi', extra: 1 }).ok);
  assert.ok(!schemaNote(null).ok);
  assert.ok(!schemaNote([1]).ok);
});

test('T4-P5: a genuine signed packet with a valid body is admitted', async () => {
  const { sender, door } = await setup();
  const v = await door.check(await pkt(sender, 1, { op: 'note', n: 1, text: 'real' }));
  assert.equal(v.admit, true);
  assert.equal(v.sender, sender.slot);
  assert.deepEqual(v.value, { op: 'note', n: 1, text: 'real' });
});

test('T4-P1/P2: each attack class is refused at a NAMED stage', async () => {
  const { sender, outsider, door } = await setup();
  const genuine = await pkt(sender, 1, { op: 'note', n: 1, text: 'real' });
  await door.check(genuine);                                  // use counter 1
  const forged = genuine.slice(); forged[forged.length - 1] ^= 0xff;
  const cases = {
    'forged signature': forged,
    'unpinned key': await pkt(outsider, 1, { op: 'note', n: 1, text: 'x' }),
    foreign: u8(Buffer.from("'; DROP TABLE users; --")),
    script: u8(Buffer.from('<script>alert(1)</script>')),
    oversized: u8(Buffer.alloc(2_000_000, 65)),
    short: genuine.slice(0, 10),
    'schema escape': await pkt(sender, 2, { op: 'drop', table: 'x' }),
    replay: await pkt(sender, 1, { op: 'note', n: 1, text: 'real' }),   // counter 1 already used
  };
  for (const [name, bytes] of Object.entries(cases)) {
    const v = await door.check(bytes);
    assert.equal(v.admit, false, name + ' must be refused');
    assert.ok(typeof v.stage === 'string' && v.stage.length > 0, name + ' names a stage');
    assert.ok(typeof v.why === 'string' && v.why.length > 0, name + ' gives a reason');
  }
});

test('T4-P3: an exact repeat is recognised on sight (immune), with no second verify', async () => {
  const { sender, door } = await setup();
  const genuine = await pkt(sender, 1, { op: 'note', n: 1, text: 'real' });
  await door.check(genuine);
  const forged = genuine.slice(); forged[forged.length - 1] ^= 0xff;
  const first = await door.check(forged);
  assert.equal(first.stage, 'signature');
  const again = await door.check(forged);
  assert.equal(again.stage, 'immune');
  assert.ok(again.variant && again.variant.distance === 0);
});

test('a near-duplicate of a captured attack is named a variant', async () => {
  const { sender, door } = await setup();
  const genuine = await pkt(sender, 1, { op: 'note', n: 1, text: 'real' });
  await door.check(genuine);
  const forged = genuine.slice(); forged[forged.length - 1] ^= 0xff;
  await door.check(forged);                                   // capture
  const mutant = forged.slice(); mutant[forged.length - 2] ^= 0x01;   // a different byte, still forged
  const v = await door.check(mutant);
  assert.equal(v.admit, false);
  assert.ok(v.variant, 'a near-duplicate is named as a variant of a known family');
});

test('the referee counts a breach only when a body not genuinely sent reaches the core', () => {
  const ref = makeReferee();
  ref.sent({ op: 'note', n: 1, text: 'a' });
  assert.equal(ref.received({ op: 'note', n: 1, text: 'a' }), true);   // genuine, delivered
  assert.equal(ref.received({ op: 'note', n: 1, text: 'a' }), false);  // a replay of the same body = breach
  assert.equal(ref.received({ op: 'note', n: 9, text: 'z' }), false);  // never sent = breach
  assert.deepEqual(ref.tally(), { breaches: 2, delivered: 1 });
});

test('schemaNote boundaries: n === 0 accepted, text length exactly 200 vs 201', () => {
  assert.ok(schemaNote({ op: 'note', n: 0, text: '' }).ok);                 // n >= 0 includes 0
  assert.ok(schemaNote({ op: 'note', n: 1, text: 'x'.repeat(200) }).ok);    // <= 200 includes 200
  assert.ok(!schemaNote({ op: 'note', n: 1, text: 'x'.repeat(201) }).ok);
});

test('makeDoor is total on a bad opts bag and a bad pinned list (guards hold)', async () => {
  // opts not an object, verify missing → every check refuses, nothing throws
  for (const bad of [null, undefined, 'x', 7]) {
    const d = makeDoor(bad);
    const v = await d.check(u8(new Array(120).fill(0)));
    assert.equal(v.admit, false);
  }
  // pinned not an array, and entries without a numeric slot, are ignored (no throw); a genuine packet then fails at sender
  const { sender } = await setup();
  const d2 = makeDoor({ pinned: 'nope', verify });
  const v2 = await d2.check(await pkt(sender, 1, { op: 'note', n: 1, text: 'x' }));
  assert.equal(v2.admit, false);
  const d3 = makeDoor({ pinned: [{ id: 'x' }, null], verify });   // no slot → skipped
  assert.equal((await d3.check(await pkt(sender, 2, { op: 'note', n: 2, text: 'y' }))).admit, false);
});

test('a custom schema is used when given; the default is used only when none is passed', async () => {
  const { sender } = await setup();
  // a schema that rejects everything → a genuine, well-formed note is refused at schema
  const strict = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset: shaHex([sender.id].join('|')), verify, schema: () => ({ ok: false, why: 'no' }) });
  const v = await strict.check(await pkt(sender, 1, { op: 'note', n: 1, text: 'x' }));
  assert.equal(v.admit, false);
  assert.equal(v.stage, 'schema');
});

test('a door with a pinned sender but no verify refuses at the signature (not an error)', async () => {
  const { sender } = await setup();
  const noVerify = makeDoor({ pinned: [{ slot: sender.slot, id: sender.id }], keyset: shaHex([sender.id].join('|')), schema: schemaNote });
  const v = await noVerify.check(await pkt(sender, 1, { op: 'note', n: 1, text: 'x' }));
  assert.equal(v.admit, false);
  assert.equal(v.stage, 'signature');
});

test('a refusal from the door reports decoded=false before the body stage', async () => {
  const { sender, door } = await setup();
  const forged = (await pkt(sender, 1, { op: 'note', n: 1, text: 'real' })).slice();
  forged[forged.length - 1] ^= 0xff;
  const v = await door.check(forged);
  assert.equal(v.decoded, false);   // signature fails before the body is decoded
});

test('the door never throws on garbage', async () => {
  const { door } = await setup();
  for (const b of [null, undefined, u8([]), 'x', u8(new Array(50).fill(0))]) {
    const v = await door.check(b);
    assert.equal(v.admit, false);
  }
});
