import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeIdentity, verifyBytes } from '../vendor/fall-kit/core/identity.mjs';
import { prepare, finish } from '../vendor/fall-kit/core/vendor/light/packet.mjs';
import { makePeer, runTask } from '../src/mesh.mjs';
import { canonical } from '../src/receipt.mjs';

const u8 = (b) => new Uint8Array(b);
const verify = (id, s, sig) => verifyBytes(id, s, sig);
async function pktOf(identity, ctr, value) {
  const p = prepare({ sender: identity.slot, counter: BigInt(ctr.v++), dictId: 0, kind: 1, value });
  if (!p.ok) throw new Error(p.why);
  return finish(p.unsigned, await identity.sign(p.signed)).bytes;
}
async function pair() {
  const A = await makeIdentity(u8(new Array(32).fill(1)));
  const B = await makeIdentity(u8(new Array(32).fill(2)));
  const ctrA = { v: 1 }, ctrB = { v: 1 };
  let peerA, peerB;
  peerA = makePeer({ self: A, docId: 'd', verify, frameBody: (k, v) => pktOf(A, ctrA, v), send: (b) => peerB.onMessage(b) });
  peerB = makePeer({ self: B, docId: 'd', verify, frameBody: (k, v) => pktOf(B, ctrB, v), send: (b) => peerA.onMessage(b) });
  return { A, B, peerA, peerB, ctrB };
}

test('runTask sums whole numbers and is total on garbage', () => {
  assert.deepEqual(runTask({ nums: [1, 2, 3] }), { sum: 6 });
  assert.deepEqual(runTask({ nums: [] }), { sum: 0 });
  assert.deepEqual(runTask({ nums: [1, 'x'] }), { sum: null });
  assert.deepEqual(runTask(null), { sum: null });
  assert.deepEqual(runTask({ nums: 'x' }), { sum: null });
});

test('T6-P1: the two peers discover and pin each other', async () => {
  const { A, B, peerA, peerB } = await pair();
  await peerA.hello();
  await peerB.hello();
  assert.deepEqual(peerA.peers(), [B.slot]);
  assert.deepEqual(peerB.peers(), [A.slot]);
});

test('T6-P2: concurrent edits converge to the same state', async () => {
  const { peerA, peerB } = await pair();
  await peerA.hello();
  await peerB.hello();
  await peerA.setLocal('title', 'from A');
  await peerB.setLocal('note', 'from B');
  assert.equal(canonical(peerA.state()), canonical(peerB.state()));
  assert.equal(peerA.state().title, 'from A');
  assert.equal(peerA.state().note, 'from B');
});

test('T6-P3: a task handed across completes and the asker re-computes the result', async () => {
  const { peerA, peerB } = await pair();
  await peerA.hello();
  await peerB.hello();
  const res = await peerA.ask([3, 4, 5]);
  assert.equal(res.ok, true);
  assert.equal(res.out.sum, 12);
  assert.deepEqual(res.want, { sum: 12 });
});

test('T6-P4: a forged peer is refused at the sender/signature, and the state is unchanged', async () => {
  const { A, B, peerA, peerB } = await pair();
  await peerA.hello();
  await peerB.hello();
  await peerB.setLocal('note', 'from B');
  const before = canonical(peerA.state());
  const forger = await makeIdentity(u8(new Array(32).fill(3)));
  const ctrF = { v: 50 };
  const forged = await pktOf({ ...forger, slot: B.slot }, ctrF, { t: 'op', doc: peerB.doc() });
  const r = await peerA.onMessage(forged);
  assert.equal(r.in, 'refused');
  assert.equal(canonical(peerA.state()), before);
});

test('T6-P4: a replayed message is refused at the counter', async () => {
  const { B, peerA, peerB, ctrB } = await pair();
  await peerA.hello();          // B not needed to hello first; A pins B from its first message
  await peerB.hello();
  await peerB.setLocal('x', 1);
  // replay B's hello counter (1), which A has already passed
  const replay = await pktOf(B, { v: 1 }, { t: 'op', doc: peerB.doc() });
  const r = await peerA.onMessage(replay);
  assert.equal(r.in, 'refused');
});

test('a peer handles non-object and unknown messages without changing state (|| and && guards)', async () => {
  const { A, B, peerA, peerB } = await pair();
  await peerA.hello(); await peerB.hello();
  await peerA.setLocal('k', 1);
  const before = canonical(peerA.state());
  // a signed OP with no doc must not merge (v.t===OP && v.doc); a signed TASK with no task must not reply (&& v.task)
  const ctrB2 = { v: 50 };
  const noDoc = await pktOf(B, ctrB2, { t: 'op' });            // OP, but no doc
  const r1 = await peerA.onMessage(noDoc);
  assert.equal(canonical(peerA.state()), before, 'an OP without a doc must not change state');
  const noTask = await pktOf(B, ctrB2, { t: 'task' });         // TASK, but no task
  const r2 = await peerA.onMessage(noTask);
  assert.ok(r2.in === 'dropped' || r2.in === 'refused');
  // a non-object body is dropped
  const notObj = await pktOf(B, ctrB2, 42);
  const r3 = await peerA.onMessage(notObj);
  assert.equal(r3.in, 'dropped');
});

test('a first-contact message that is not a proper hello is refused (every conjunct of the hello guard bites)', async () => {
  const { B, peerA } = await pair();
  // each of these is a first-contact packet from an unpinned sender; only a well-formed hello may pin a key
  const cases = [
    { t: 'op', doc: { docId: 'd', lamport: 1, entries: {} } },   // an object, but t !== 'hello'
    42,                                                           // not an object
    'hello',                                                      // a string, not an object
    { t: 'hello', id: 123 },                                      // a hello whose id is not a string
    { t: 'hello' },                                               // a hello with no id at all
  ];
  for (const body of cases) {
    const ctrB = { v: 1 };
    const r = await peerA.onMessage(await pktOf(B, ctrB, body));
    assert.equal(r.in, 'refused', JSON.stringify(body) + ' must be refused');
    assert.deepEqual(peerA.peers(), [], JSON.stringify(body) + ' must not pin a peer');
  }
});

test('a validly-signed NON-hello first contact (carrying a real id) is still refused and pins nobody — the hello guard is load-bearing', async () => {
  const { A, B, peerA } = await pair();
  // B signs a genuine packet, first contact, but its body is an OP that carries B's real id and a state-changing doc.
  // Only a body with t === 'hello' may pin a key; weakening any conjunct of that guard would pin B and merge the doc.
  const doc = { docId: 'd', lamport: 1, entries: { x: { value: 42, ts: 1, nodeId: B.id, deleted: false } } };
  const op = await pktOf(B, { v: 1 }, { t: 'op', id: B.id, doc });
  const r = await peerA.onMessage(op);
  assert.equal(r.in, 'refused');
  assert.deepEqual(peerA.peers(), []);                 // B must NOT be pinned from a non-hello
  assert.equal(peerA.state().x, undefined);            // and its doc must NOT be merged
});

test('a first-contact packet whose body cannot decode is refused (peek.admit false)', async () => {
  const { B, peerA } = await pair();
  const good = await pktOf(B, { v: 1 }, { t: 'hello', id: B.id });
  const broken = good.slice(); broken[good.length - 40] ^= 0xff;   // corrupt a body byte, leave the frame header intact
  const r = await peerA.onMessage(broken);
  assert.equal(r.in, 'refused');
  assert.deepEqual(peerA.peers(), []);
});

test('a pinned sender\'s packet with a null (or non-object) body is dropped, never a crash (L69 guard)', async () => {
  const { A, B, peerA, peerB } = await pair();
  await peerA.hello(); await peerB.hello();      // B is now pinned by A
  const before = canonical(peerA.state());
  const ctrB = { v: 50 };
  const rNull = await peerA.onMessage(await pktOf(B, ctrB, null));
  assert.equal(rNull.in, 'dropped');
  const rNum = await peerA.onMessage(await pktOf(B, ctrB, 7));
  assert.equal(rNum.in, 'dropped');
  assert.equal(canonical(peerA.state()), before);
});

test('the doc id falls back to "mesh" when none is a string; a write is stamped with the identity\'s id', async () => {
  const A = await makeIdentity(u8(new Array(32).fill(5)));
  const p = makePeer({ self: A, docId: 7, verify, frameBody: async () => new Uint8Array(0), send: () => {} });
  await p.setLocal('x', 1);
  assert.equal(p.state().x, 1);                      // nodeId is a non-empty string, so the write lands
  assert.equal(p.doc().docId, 'mesh');               // non-string docId → 'mesh'
  assert.equal(p.doc().entries.x.nodeId, A.id);      // stamped with self.id, not a constant
});

test('nodeId falls back through slot before the constant — a self with no id stamps with its slot, not "node"', async () => {
  // self.id is absent but self.slot is set; the write must be stamped '9' (the slot), not the 'node' fallback.
  // This is the one case that separates `self.id || self.slot || "node"` from any `&&` rewrite of either `||`.
  const p = makePeer({ self: { slot: 9 }, docId: 'd', verify, frameBody: async () => new Uint8Array(0), send: () => {} });
  await p.setLocal('x', 1);
  assert.equal(p.state().x, 1);                      // a non-empty string nodeId, so the write lands
  assert.equal(p.doc().entries.x.nodeId, '9');       // self.id absent → self.slot ('9'), never the constant 'node'
});

test('makePeer is total on a missing io bag (guards hold, nothing throws)', async () => {
  const p = makePeer(null);
  assert.deepEqual(p.peers(), []);
  assert.deepEqual(p.state(), {});
  const r = await p.onMessage(u8(new Array(120).fill(0)));
  assert.equal(r.in, 'refused');
});

test('onMessage never throws on garbage', async () => {
  const { peerA } = await pair();
  for (const b of [null, undefined, u8([]), 'x', u8(new Array(40).fill(0))]) {
    const r = await peerA.onMessage(b);
    assert.equal(r.in, 'refused');
  }
});
