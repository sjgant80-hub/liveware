// src/t11.mjs — T11, the guarantee run for real (sealed: CLAIMS-T11.md). Written once and run in BOTH places: Node
// (tools/measure-t11.mjs) and the browser (page/app.mjs). It re-runs everything mint-a-department's three committed
// teacher-distillation runs did AFTER the teacher spoke — with the kernel and the baseline engine vendored byte for byte
// from sjgant80-hub/ai-first-company — checks it lands on the committed numbers and signed receipts, then attacks the
// receipts. The dataset texts and the recorded runs are injected (Node reads files, the browser fetches them). No model
// is called: the teacher's reply is the one recorded when the run was made. Deterministic, so CI's receipt id is the
// visitor's. Total: missing or garbage inputs fail the claims, never throw.
import { RUNS, SPLIT_SEED, datasetOk, rowsOf, splitOf, distil, flipped, score } from '../vendor/ai-first-company/src/distill.mjs';
import { receiptOf, shaHex, canonical } from './receipt.mjs';

export const T11_IDS = ['v1', 'v2', 'v3'];

// the values CLAIMS-T11.md seals; test/t11.test.mjs checks they equal the seal's JSON, so neither can drift alone
export const SEALED = {
  datasets: {
    'data/mint-demo-car.data': 'b703a9ac69f11e64ce8c223c0a40de4d2e9d769f7fb20be5f8f2e8a619893d83',
    'data/mint-demo-mushroom.data': 'e65d082030501a3ebcbcd7c9f7c71aa9d28fdfff463bf4cf4716a3fe13ac360e',
  },
  runs: {
    v1: { seal: '364f29a', run: 'f1802f5', file: 'data/mint-demo-run.json', prereg: 'data/mint-demo-prereg.json' },
    v2: { seal: '3620ff0', run: 'a45dd93', file: 'data/mint-demo-v2-run.json', prereg: 'data/mint-demo-v2-prereg.json' },
    v3: { seal: '9ec04b0', run: '71b7d72', file: 'data/mint-demo-v3-run.json', prereg: 'data/mint-demo-v3-prereg.json' },
  },
};

// where each input lives in this repo (the page fetches these; measure reads them)
export const VENDOR = 'vendor/ai-first-company/';
export const T11_FILES = {
  data: Object.keys(SEALED.datasets).map((f) => VENDOR + f),
  runs: T11_IDS.map((id) => VENDOR + SEALED.runs[id].file),
  preregs: T11_IDS.map((id) => VENDOR + SEALED.runs[id].prereg),
};

// the committed fields a re-run must land on exactly (CLAIMS-T11.md, P2)
export const FIELDS = ['splitSizes', 'trainMajority', 'rulesParsed', 'rulesKept', 'baselineAccuracy', 'grownAccuracy', 'improvement', 'decision', 'charge', 'receipt'];

/** one committed run, re-run and attacked. data: { [dataset path]: text }; run: the committed run record */
export function oneRun(id, data, run) {
  try {
    const spec = RUNS[id], text = data[spec.dataset];
    const p1 = spec.sha256 === SEALED.datasets[spec.dataset] && spec.seal === SEALED.runs[id].seal && run.seal === spec.seal && run.dataset.sha256 === spec.sha256 && datasetOk(text, spec);
    const split = splitOf(rowsOf(text, spec));
    const d = distil(spec, split, run.teacherReply);
    if (!d.ok) return { id, p1, p2: false, p4: false, p5: false, why: d.why };
    const p2 = FIELDS.every((k) => canonical(d[k]) === canonical(run[k]));
    // P4 — every exam answer changed: the kept rules must not move
    const exam = split.final.map((r) => ({ ...r, class: flipped(r.class, spec, d.trainMajority) }));
    const p4 = canonical(distil(spec, { ...split, final: exam }, run.teacherReply).rulesKept) === canonical(d.rulesKept);
    // P5 — one exam answer changed, each row in turn, re-scored with the same kept rules: the receipt must change.
    // A flipped exam differs from the original in one label only, so it scores whenever the original did (d.ok above).
    let changed = 0;
    for (let i = 0; i < split.final.length; i++) {
      const one = split.final.slice();
      one[i] = { ...one[i], class: flipped(one[i].class, spec, d.trainMajority) };
      if (score(spec, one, d.kept, d.trainMajority).receipt !== run.receipt) changed++;
    }
    const p5 = changed === split.final.length;
    return {
      id, p1, p2, p4, p5, seal: spec.seal, run: spec.run, dataset: spec.dataset, splitSizes: d.splitSizes, trainMajority: d.trainMajority,
      rulesParsed: d.rulesParsed, rulesKept: d.rulesKept, base: d.base, grown: d.grown, baselineAccuracy: d.baselineAccuracy, grownAccuracy: d.grownAccuracy,
      improvement: d.improvement, decision: d.decision, charge: d.charge, receipt: d.receipt, committedReceipt: run.receipt, exam: split.final.length, changed,
    };
  } catch (e) {
    return { id, p1: false, p2: false, p4: false, p5: false, why: 'refused: ' + String(e.message) };
  }
}

/** T11. inputs: { data: { [dataset path]: text }, runs: { v1, v2, v3 } } */
export function t11(inputs) {
  const data = inputs && inputs.data, runs = (inputs && inputs.runs) || {};
  const rows = T11_IDS.map((id) => oneRun(id, data, runs[id]));
  const P1 = rows.every((r) => r.p1), P2 = rows.every((r) => r.p2), P4 = rows.every((r) => r.p4), P5 = rows.every((r) => r.p5);
  const P3 = rows.map((r) => r.charge).join(',') === 'waived,waived,due';
  const pass = P1 && P2 && P3 && P4 && P5;
  const out = { P1, P2, P3, P4, P5, runs: rows };
  const ins = { datasets: SEALED.datasets, runs: T11_IDS.map((id) => (runs[id] ? shaHex(canonical(runs[id])) : null)) };
  return { ...receiptOf('T11', 1, ins, out, pass ? 'pass' : 'fail', { splitSeed: SPLIT_SEED, teacher: 'qwen2.5:7b, recorded once, never re-run here' }), detail: out };
}
