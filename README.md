# Liveware

**Live page: https://sjgant80-hub.github.io/liveware/** — start at its **Start here** section; it also carries How it works,
the Blueprint (every file with its own test and mutation-gate figures), the white paper, Adoption and the For business brochure.

A living software system you verify in your own browser in about ten minutes. Every claim on the page is a button;
every number has a baseline; GitHub's own runner reproduces the same receipts. Don't trust it — run it.

Wave 1, all four claims measured and passing (receipts in `receipts/wave1.json`, re-derivable):

- **T1 · the seed** grows the whole system from a small signed file, reproduces a byte-identical copy of itself, and
  refuses to grow if a single byte is changed — every one of the seed's bytes flipped, every one refused before a block loads.
- **T4 · attack it** stands a door in front of a deliberately naive core: forgeries, replays, foreign payloads, 10,000
  seeded fuzz inputs and a 1,000-strong mutating swarm — **zero breaches, zero crashes**, 999 of 1,000 swarm mutants
  recognised, and 100 of 100 genuine packets still delivered. An independent referee defines "breach".
- **T5 · compression** races LIGHT against gzip, zstd and brotli on real files, and decompresses back byte-for-byte —
  LIGHT is the smallest of the four on every sample, from an honest near-tie on an already-compressed JPEG up to 11× on
  a structured catalogue. Drop your own file in.
- **T6 · the mesh** turns two browser tabs into peers: they find each other, pin each other's key, converge a shared
  document, hand a task across, and refuse a forged or replayed peer.

**T11 · the guarantee, run for real** — sealed on its own in [`CLAIMS-T11.md`](CLAIMS-T11.md), receipt in `receipts/t11.json`.
mint-a-department's offer is "beats your signed baseline or you don't pay". Its delivery method — a local AI teacher
writes rules once, a gate keeps only those that hold up on a check split, the kept rules sit a final exam nobody used
to choose anything, and the baseline-agreement engine signs **due** or **waived** — was run three times on public UCI
data in [ai-first-company](https://github.com/sjgant80-hub/ai-first-company), each run sealed before it ran. Two lost
(car: +0.0 points, waived — kept on the record), one won (mushroom: 51.5% → 93.4% on 2,031 unseen rows, due). The page
re-runs everything after the AI from the recorded replies, lands on all three committed signed receipts, then attacks
them: every one of the 2,895 single-answer exam tampers changes the receipt, and flipping the whole exam leaves the kept
rules untouched (the exam never chooses a rule). The AI step itself is not re-run — its reply was recorded the one time
it answered.

Everything runs client-side — WebCrypto, WASM, the LIGHT codec — offline after first load; nothing you run leaves your device.

## Re-run it yourself

```
node --test test/*.test.mjs        # the kernels: unit, edge and garbage suites
node tools/measure.mjs --check     # re-derive the four receipts, byte for byte, against the sealed claims
node tools/measure-t11.mjs --check # T11: re-derive the three mint runs, attack every receipt, refuse typed-in numbers
```

The claims were sealed in [`CLAIMS.md`](CLAIMS.md) before the code that measures them; the measurement refuses to run if
that file changed since the commit that sealed it. Each kernel is mutation-gated by the witness (`.github/workflows/gate.yml`);
the two reviewed-equivalent mutants are documented in `src/witness.baseline.json`. T11's body (`src/t11.mjs`) and the
kernel it vendors (`distill.mjs`, gated in ai-first-company) are both clean with nothing baselined.
The gate's own figures — per kernel: tests, mutants planted, caught, baselined, survived — are a receipt too,
`receipts/gate.json`, written from the witness's output by `tools/gate-receipt.mjs`; CI re-derives it on every push
(`--from /tmp --check`) and fails if it differs, and the page's blueprint reads it. `test/vendor.test.mjs` holds every
file under `vendor/` to the SHA-256 its sources manifest pins, and fails if anything there is unpinned.

## Layout

- `index.html` + `page/` — the live page; it runs the same test bodies the harness runs (`src/wave1.mjs`), so a
  visitor's receipt id equals CI's.
- `src/` — the kernels: `seed`, `door`, `mesh`, `compress`, plus `receipt` and `rng`. `wave1.mjs` composes them into the
  four tests. `vendor/fall-kit/` holds the LIGHT codec, the signed-packet door, the CRDT merge law, the immune system and
  the Ed25519 identity, copied byte-for-byte from `fall-kit` (see `vendor/SOURCES.json`). `vendor/ai-first-company/` holds
  the distillation kernel, the baseline-agreement engine, the two pinned UCI datasets, and the three recorded runs with
  their seals, copied byte-for-byte from `ai-first-company` (see `vendor/SOURCES-ai-first-company.json`).
- `src/t11.mjs` — T11, run by both `tools/measure-t11.mjs` and the page (in a worker: `page/t11-worker.mjs`).
- `src/mintcase.mjs` — the "For business" cost case for one process: staff time at the ONS median wage (a floor),
  CPI on later years, the rented-seat and per-call cloud routes against owning it — every figure read from the vendored,
  sourced basis (`vendor/ai-first-company/vendor/sovereign-enterprise/data/basis.json`), the inputs the reader's own.
  Mutation-gated, nothing baselined. No price of ours appears anywhere on the page.
- `samples/` — the pinned files T5 compresses, each by SHA-256. `receipts/` — what was measured.
- `CLAIMS.md`, `CLAIMS-T11.md` — the sealed pass criteria. `EXPLAINER.md` — every piece in plain English.
- `tools/gate-receipt.mjs` → `receipts/gate.json` — the mutation gate's figures as a re-derived receipt. `test/vendor.test.mjs` — the vendored pins.

Wave 2 (gated self-improvement, persistent memory, KV-cache recycling, structural alignment, the organism thinking) is
added one test at a time, each only when its own sealed claim passes.

Powered by the Konomi architecture, created by Thomas Frumkin; the LIGHT language: Thomas Frumkin. The Guided Entropy
Principle and Behavioral Entropy Signatures, where used: Gary W. Floyd, Lumiea Systems Research Division — ThunderStruck
Service LLC — "The Laws of Entropy-Time: Rewriting Thermodynamics with the Guided Entropy Principle," February 2026, and
"GEP-Based Security: Behavioral Entropy Signatures for Cybersecurity and DevOps," 2025 (CC BY 4.0).
Built by Simon Gant, AI Native Solutions. Code MIT (`LICENSE`). T11's datasets: Car Evaluation and Mushroom, UCI Machine Learning Repository.
