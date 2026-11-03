# LIVEWARE · sealed claims · T11 — THE GUARANTEE, RUN FOR REAL

Written and committed **before any code that runs or measures this test exists** — in this repo, and in the kernel it
vendors. `tools/measure-t11.mjs` refuses to run unless this file is unchanged since the one commit that sealed it, and
the page shows that commit. A claim that fails is kept as failed and shown on the page. Wave 1's seal (`CLAIMS.md`) is
not touched: T11 is sealed on its own, as the page promises every new test will be.

**What this is:** mint-a-department's offer is *"beats your signed baseline or you don't pay."* Its delivery method was
run three times on public data in `sjgant80-hub/ai-first-company`, each run sealed before it ran and committed with its
result: a teacher model on our own machine read labelled examples once and wrote rules; plain code kept only the rules
that held up on a check split; the kept rules were scored on a final exam split never used to choose anything; and the
baseline-agreement engine signed the outcome — charge **due** if it beat the baseline, **waived** if not. This test
re-runs, in a visitor's browser and on GitHub's runner, everything those runs did **after** the teacher spoke, checks it
lands on the committed numbers and the committed signed receipts, and then attacks the receipts.

The block below is the seal. The tools read it; the prose around it explains it.

```json
{
  "kind": "liveware.claims",
  "test": "T11",
  "version": 1,
  "name": "THE GUARANTEE, RUN FOR REAL (teacher distillation, signed)",
  "seenBeforeSeal": "The three committed runs' results are known before this seal, because they were made and committed first: v1 (UCI Car Evaluation, single-feature rules; seal 364f29a, run f1802f5) baseline 70.4% and grown 70.4%, charge waived, receipt 8b84bd2c...; v2 (UCI Car Evaluation, conjunction rules; seal 3620ff0, run a45dd93) the same accuracies, charge waived, the same receipt; v3 (UCI Mushroom, single-feature rules; seal 9ec04b0, run 71b7d72) baseline 51.5% and grown 93.4%, charge due, receipt 80120231.... These claims are about re-deriving and binding those results, not producing them. No code for this test exists yet; nothing of P4 or P5 has been run.",
  "sources": {
    "repo": "sjgant80-hub/ai-first-company",
    "runs": {
      "v1": { "seal": "364f29a", "run": "f1802f5", "file": "data/mint-demo-run.json", "prereg": "data/mint-demo-prereg.json" },
      "v2": { "seal": "3620ff0", "run": "a45dd93", "file": "data/mint-demo-v2-run.json", "prereg": "data/mint-demo-v2-prereg.json" },
      "v3": { "seal": "9ec04b0", "run": "71b7d72", "file": "data/mint-demo-v3-run.json", "prereg": "data/mint-demo-v3-prereg.json" }
    },
    "datasets": {
      "data/mint-demo-car.data": "b703a9ac69f11e64ce8c223c0a40de4d2e9d769f7fb20be5f8f2e8a619893d83",
      "data/mint-demo-mushroom.data": "e65d082030501a3ebcbcd7c9f7c71aa9d28fdfff463bf4cf4716a3fe13ac360e"
    },
    "engine": "src/baseline.mjs (the signed baseline agreement), src/experiment.mjs (the verdict it reuses), src/journal.mjs (canonical JSON and SHA-256), and src/distill.mjs — the three demo tools' parse, split, gate and score logic extracted into one pure kernel in that repo, under that repo's mutation gate — all vendored here byte for byte at the commit named in vendor/SOURCES-ai-first-company.json, with the datasets, the three recorded runs and their three seals"
  },
  "receipt": "as Wave 1: { test, version, inputs_sha256, outputs_sha256, verdict, params }, and its id is the SHA-256 of that record as canonical JSON. T11 is deterministic, so the page prints CI's id as EXPECTED and a visitor's run must match it",
  "claims": [
    { "id": "T11-P1", "claim": "the inputs are the committed ones: each pinned dataset's SHA-256 equals the value sealed above, and each of the three recorded runs names that dataset's SHA-256 and its own seal commit" },
    { "id": "T11-P2", "claim": "for each of the three runs, re-running everything after the teacher from its recorded reply reproduces the committed run exactly: the split sizes, the train-majority class, the number of rules parsed, every kept rule with its precision and fire count in order, the baseline accuracy, the grown accuracy, the improvement, the decision, the charge, and the signed receipt id" },
    { "id": "T11-P3", "claim": "the record is whole: the test returns all three runs — the two whose charge is waived and the one whose charge is due — and the page renders every accuracy, count, improvement and receipt from a re-run (the visitor's own, or CI's published one until the visitor presses run). In CI, tools/measure-t11.mjs fails if index.html or page/app.mjs holds any re-derived result as a literal (each accuracy and improvement as a one-decimal percentage, each receipt id's first 12 hex characters)" },
    { "id": "T11-P4", "claim": "the final exam never chooses a rule: for each run, changing EVERY final-split answer (the majority class to the first other class in the run's class list, any other class to the majority) and re-running leaves the kept rules exactly the same" },
    { "id": "T11-P5", "claim": "the signed receipt is bound to the exam: for each run, changing any ONE final-split answer (each row in turn, changed as in P4) and re-scoring gives a receipt id different from the committed one — every row, all three runs" }
  ],
  "verdict": "pass if and only if P1, P2, P3, P4 and P5 all hold",
  "notProven": "The teacher step: the local model (qwen2.5:7b) was run once on one machine and its reply recorded; a model's reply is not reproducible byte for byte, so the page re-runs everything after it — never the model — and fetches nothing but its own files. That the method beats a baseline on any other dataset or on a client's job: two of these three runs did not. Anything about real-world decisions: UCI Mushroom is a classroom dataset, and its rules are not a guide to which wild mushrooms are safe to eat."
}
```

## Why the two waived runs are here

The guarantee only means something if it can say no. Two of the three runs did not beat the baseline — the teacher's
single-feature rules on car only restated the commonest answer, and its conjunctions did not survive the check split —
so their charge is waived, and they stay on the page beside the one that won. A record that keeps its losses is the one
you can believe.
