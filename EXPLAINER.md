# Liveware — every piece, in plain English

Each entry: **What** (plain English) · **How** (the mechanism) · **Test it** (where on the page) · **Why it matters**.
Pieces marked **ROADMAP** are designed but not on the page yet; each moves up when its own sealed test passes.

---

## On the page now (Wave 1)

### The seed
- **What:** a small signed file that grows the whole system.
- **How:** `LWS1` · the genome length · the LIGHT-encoded genome (every block the system runs, pinned by SHA-256) · a
  SHA-256 seal of the genome · an Ed25519 signature over everything but the signature itself. Germination checks magic,
  length, decode, the genome's shape, the seal, the signature against the pinned public key, then each block's hash —
  and only when all pass does a block load. The grown system re-emits its seed from the blocks it verified; the encoder
  is deterministic, so the offspring is byte-identical and the parent's signature still verifies on it.
- **Test it:** T1 — germinate, reproduce, and "tamper every byte" (all of them refused).
- **Why it matters:** you carry the recipe, not the system. It grows anywhere, a tampered seed does not grow, and it
  reproduces only verified copies — never on its own; copying is your click.

### The door and the immune system (liveware defence)
- **What:** a gate in front of a deliberately naive core, that learns every attack.
- **How:** the LIGHT packet door checks size, magic, version, length, dictionary, sender, signature and replay counter
  on the raw bytes — before the body is ever decoded — then a schema check. Standard exploit payloads (SQL, script, a
  shell line, an HTTP request) arrive in a language the core does not speak and are refused before any of
  their bytes is read as data: each is shorter than the smallest LIGHT packet, so the receipt names the check «size»
  (a longer one would fail at the magic number). Every refusal
  becomes two antibodies: the exact bytes (recognised on sight, no second signature check) and their shape (a near copy
  is named a variant of a known family). An independent referee holds the ledger of bodies the genuine sender really
  signed; anything else reaching the core, or anything reaching it twice, is a breach.
- **Test it:** T4 — every attack class, a 10,000-input fuzz, and a 1,000-mutant swarm.
- **Why it matters:** walls get weaker under attack; this gets stronger. "Zero breaches" is a real result because the
  core behind the gate is naive on purpose.

### LIGHT compression
- **What:** a compact, lossless encoding of the system's data.
- **How:** a context-mixing arithmetic coder (seven models mixed by weights that learn as they go), integer-only so the
  encoder and decoder agree bit for bit across engines. It decompresses back to byte-identical originals.
- **Test it:** T5 — the live race against gzip, zstd and brotli on real files, a round-trip SHA-256 proof, and your own
  dropped file. The table keeps the rows where LIGHT barely wins (an already-compressed image, a tiny file).
- **Why it matters:** memory, logs and records stored far smaller, so keeping everything is practical. It is slower than
  gzip and zstd; the page shows the time.

### The wisp (the mesh)
- **What:** two instances talk directly, with no server in the middle.
- **How:** each tab has its own Ed25519 key; they meet over the browser's BroadcastChannel (trust-on-first-use pins the
  key), then every message is a signed LIGHT packet checked against that key and a replay counter. They share one
  document by a conflict-free merge law (last-writer-wins over Lamport time) and hand tasks across.
- **Test it:** T6 — open a second tab; hand a task across; inject a forged peer (refused).
- **Why it matters:** no central server to breach, rent or switch off. A forged or replayed peer never joins.

### The guarantee (teacher distillation, signed) — T11
- **What:** mint-a-department's promise — "beats your signed baseline or you don't pay" — run for real on public data,
  three times, with the two losses kept beside the win.
- **How:** a local AI (qwen2.5:7b, no cloud) reads 40 labelled examples once and writes rules; its reply is recorded.
  Plain code keeps a rule only if, on a check split, it applies often enough and is right at least 80% of the time. The
  kept rules — no AI at answer time — sit a final exam split that never chose anything. The baseline agreement, fixed
  before the work, says **due** only for a gain of at least 8 percentage points that a two-proportion z-test calls clear
  (z ≥ 1.96); otherwise **waived**. The receipt is a SHA-256 of that sealed test and both scores.
- **Test it:** press re-run — your browser re-derives all three committed runs from the recorded replies and must land
  on the same signed receipts; then change one exam answer (the receipt changes) or every one (the kept rules don't).
- **Why it matters:** the guarantee is only worth something if it can say no. Here it said no twice, on the record,
  and yes once — and the AI didn't need to be brilliant: it missed the dataset's strongest clue entirely, and the gate
  still only charged for what the rules it did write earned.
- **Doesn't claim:** that the AI step re-runs (it can't, word for word), or that it will beat any other dataset or a
  client's process. The mushroom rules are classroom data, not advice on what is safe to eat.

### The browser platform
- **Web Crypto** — Ed25519 signatures and SHA-256 seals on seeds, packets and receipts.
- **WASM / pure JS** — the LIGHT codec, the packet door, the pattern evaluator, the CRDT merge.
- **IndexedDB, Service Worker / PWA** — installable; works offline after first load.
- **Capability panel** — shows what your browser can run; skips, never fakes, what it can't. Every Wave-1 test runs on
  plain CPU; none needs WebGPU.

---

## How the proof works

- **Sealed claims** — the pass criteria were written and committed before the code that measures them (`CLAIMS.md`); the
  measurement refuses to run if that file changed, and the commit is on the page.
- **Receipts** — each test writes a record of its inputs, outputs and verdict; its id is the SHA-256 of that record.
  Your run's id must match the expected id shown beside each test.
- **CI** — GitHub runs the same tests headlessly on every change and publishes the receipts; a third party
  reproduces the result, not just the author.
- **Mutation testing (the witness)** — a bug is planted in every kernel and the build fails unless a test catches it.
  Two reviewed-equivalent mutants are documented, with their differential check, in `src/witness.baseline.json`.
  The gate's own figures (tests, mutants planted, caught, baselined, survived — per kernel) are a receipt too,
  `receipts/gate.json`, re-derived from the witness's output on every push by `tools/gate-receipt.mjs --check`;
  the page's blueprint reads it.
- **Vendored code pinned** — every file under `vendor/` is checked against the SHA-256 its sources manifest pins
  (`test/vendor.test.mjs`), and nothing may sit there unpinned.
- **Failures kept** — losing compression rows and any failed claim stay visible.

---

## ROADMAP (designed, not on the page yet — Wave 2)

- **Gated self-improvement** — each generation must beat the last on held-out data, or it is rejected and shown.
- **Persistent memory** — an append-only, hash-chained, LIGHT-encoded vault in IndexedDB; recall by meaning; provenance
  on every item; tamper-evident; exportable and regrown identically elsewhere.
- **KV-cache recycling** — reuse of prior context across steps of an in-browser model job, measured on your hardware
  (its precise definition written before the test).
- **Structural alignment** — specific failure modes (abstain-don't-invent, no unsanctioned tools, a separate judge, no
  claim without a receipt, high-stakes waits for a human) shown blocked and caught, with a gates-off control run. Shown
  as testable properties, never as "alignment solved".
- **The organism thinks** — a local language model reads messy input into fields, the deterministic core decides (or
  abstains), the model explains it, and the whole chain is written to memory and synced over the mesh.

---

## Credits
Powered by the Konomi architecture, created by Thomas Frumkin; the LIGHT language: Thomas Frumkin. The Guided Entropy
Principle and Behavioral Entropy Signatures, where used: Gary W. Floyd, Lumiea Systems Research Division — ThunderStruck
Service LLC — "The Laws of Entropy-Time: Rewriting Thermodynamics with the Guided Entropy Principle," February 2026, and
"GEP-Based Security: Behavioral Entropy Signatures for Cybersecurity and DevOps," 2025 (CC BY 4.0). Built by Simon Gant,
AI Native Solutions. Code MIT (`LICENSE`).
