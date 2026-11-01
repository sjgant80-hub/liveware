# LIVEWARE · sealed claims · Wave 1 (T1 · T4 · T5 · T6)

Written and committed **before any code that runs or measures these tests exists**. The measurement
(`tools/measure.mjs`) refuses to run if this file differs from the commit that sealed it, and the page shows that
commit. A claim that fails is kept as failed and shown on the page. Wave 2 (T2, T3, T7, T9, T10) is sealed separately,
one test at a time, and does not appear on the page until its own seal passes.

**What these are:** testable properties of one piece of software, checked by anyone in their own browser and by
GitHub's runner. They are not claims about anything the tests do not exercise; each test states what it does NOT prove.

The block below is the seal. The tools read it; the prose around it explains it.

```json
{
  "kind": "liveware.claims",
  "wave": 1,
  "seenBeforeSeal": "LIGHT's compression ratio on the full source files behind four samples (prose 3.47x, LIGHT codec source 3.18x, the public estate archive 11.13x, the full 30,000-row credit CSV 3.67x), plus the public registry JSON and a card PNG, against gzip-9, zstd-19 and brotli in Node, in a scratch bench. T5's claims below set no ratio threshold, so this does not bias them. Nothing about T1, T4 or T6 was run.",
  "receipt": "every test writes { test, version, inputs_sha256, outputs_sha256, verdict, params }; its receipt id is the SHA-256 of that record as canonical JSON (keys sorted). Deterministic tests use fixed seeds and pinned inputs, so the receipt id is printed on the page as EXPECTED and a visitor's run must match it",
  "keys": "test keys are Ed25519 keys made from fixed 32-byte seeds (the identity kernel's seeded form), so signatures and receipts re-run byte for byte; the seed of T1 is signed by a key held off this repo, and only its public key is in the page",
  "tests": {
    "T1": {
      "name": "PLANT THE SEED (self-replication, gated)",
      "what": "the seed is the bytes 'LWS1' + a LIGHT-encoded canonical genome + the genome's SHA-256 seal + an Ed25519 signature over the seal. The genome names every block the page runs (each file's path and SHA-256) and its configuration. Germination checks, in order: magic, decode, seal, signature (against the public key pinned in the page), then fetches each block and checks its hash; only after every check passes are blocks imported. The grown system then writes its own seed back out from the blocks it verified",
      "claims": [
        { "id": "T1-P1", "claim": "the bundled genuine seed germinates: every check passes, and the number of blocks imported equals the number the genome names" },
        { "id": "T1-P2", "claim": "the offspring seed the grown system writes is byte-identical to the parent seed (equal SHA-256), so the parent's signature verifies on it" },
        { "id": "T1-P3", "claim": "EVERY single-byte tamper of the seed (each byte position in turn, its lowest bit flipped) is refused at a named check, and for every one of them zero blocks are imported" },
        { "id": "T1-P4", "claim": "a genuine seed whose served block has been altered (one byte of one block changed) is refused at the block check, with zero blocks imported" }
      ],
      "notProven": "autonomous spread: by design it does not copy itself anywhere; copying is a visitor's click. Key compromise: whoever holds the signing key can sign a new seed"
    },
    "T4": {
      "name": "ATTACK IT (liveware defence)",
      "what": "a door in front of a deliberately NAIVE core that does whatever any body it receives says. The door is the LIGHT packet gate (size, magic, version, length, dictionary, sender, signature, counter, on raw bytes, before any decoding) then a schema check; the immune system (exact and shape antibodies) recognises attacks it has seen. An independent referee holds the ledger of packets the genuine sender really signed with a valid body: any body reaching the core that is not in that ledger is a BREACH",
      "attacks": "forged signature · signed by an unpinned key · replay of a genuine packet · tampered body · oversized input · foreign payloads (SQL injection, script injection, a shell command, an HTTP request, plain JSON) · broken length · unknown dictionary · a genuine sender's packet whose body escapes the schema · seeded random fuzz (random bytes, and random 1-8 byte mutations of genuine packets) · a mutating swarm (1,000 mutants of one captured attack)",
      "claims": [
        { "id": "T4-P1", "claim": "zero breaches across every attack class, the fuzz run and the swarm" },
        { "id": "T4-P2", "claim": "every refusal names the check that caught it (a door stage, the schema, or the immune system)" },
        { "id": "T4-P3", "claim": "after one capture, at least 90% of the swarm's 1,000 mutants are recognised by the immune system as variants of a known family, and an exact repeat of a captured attack is recognised every time" },
        { "id": "T4-P4", "claim": "a seeded fuzz run of 10,000 inputs (the page's default; the visitor may raise it) produces zero breaches and zero thrown errors" },
        { "id": "T4-P5", "claim": "all 100 genuine signed packets with valid bodies are delivered to the core, and the immune system never refuses one: the gate is not refusing everything" }
      ],
      "notProven": "key compromise (a stolen signing key signs real packets), a compromised host or browser, physical and social attacks"
    },
    "T5": {
      "name": "COMPRESSION, AGAINST REAL BASELINES (featured)",
      "what": "the pinned samples in samples/MANIFEST.json (prose, source code, a structured JSON log, a structured catalogue, CSV, an already-compressed JPEG, a file under 1 KB) and any file a visitor drops are compressed with LIGHT and decompressed back. Baselines: gzip level 9, zstd level 19 and brotli quality 11 measured by Node's own zlib in CI for every pinned sample; in the browser gzip runs live (the browser's CompressionStream), and zstd or brotli run live only where the browser's CompressionStream offers them",
      "samples": {
        "prose-emerson-essays.txt": "5d9d28c12da8bd9a",
        "code-light-codec.mjs.txt": "4f018272a05989fe",
        "log-agent-answers.json": "e1e311c204baf885",
        "catalogue-public-estate.json": "6fa7498f6058ab94",
        "csv-credit-default-4000.csv": "8297080b2075eb6b",
        "image-mesh.jpg": "ea0454590da5f27a",
        "tiny-receipt.json": "ef412c19a08bd719"
      },
      "claims": [
        { "id": "T5-P1", "claim": "every LIGHT round trip is byte-identical: the SHA-256 of the restored bytes equals the original's, for every pinned sample and for every file a visitor drops" },
        { "id": "T5-P2", "claim": "for every pinned sample the page shows the original size and the LIGHT, gzip, zstd and brotli sizes and ratios" },
        { "id": "T5-P3", "claim": "the table shows every pinned sample, including any where LIGHT is not the smallest of the four; no row is ever dropped, and the samples include an already-compressed file and a file under 1 KB" },
        { "id": "T5-P4", "claim": "every compression number the page quotes, including the headline range, is computed by the page from the pinned table's measured rows, with the data type named; none is typed in" }
      ],
      "notProven": "superiority on every kind of data (shown per type); speed (LIGHT is a context-mixing coder: it is slower than gzip and zstd, and the page shows its time)"
    },
    "T6": {
      "name": "OPEN A SECOND TAB (the wisp / mesh)",
      "what": "two instances of the page, each with its own Ed25519 key, find each other over the browser's same-origin BroadcastChannel, exchange signed LIGHT packets, share a conflict-free document (the estate's CRDT merge law), and hand a task across. In CI the same kernels run as two instances over an in-memory channel with seeded keys",
      "claims": [
        { "id": "T6-P1", "claim": "the two instances discover each other and connect: each pins the other's key from its hello and every later message is checked against it" },
        { "id": "T6-P2", "claim": "after concurrent edits on both instances, their shared documents converge to the same value" },
        { "id": "T6-P3", "claim": "a task handed from one instance completes on the other and comes back with a signed receipt whose result the sender re-computes and matches" },
        { "id": "T6-P4", "claim": "a forged peer's message (signed by a key that was never pinned) is refused at a named check, and a replayed message is refused at the counter" }
      ],
      "notProven": "a second DEVICE without a relay (BroadcastChannel joins tabs of one browser; across devices the estate's relay is needed and is not on this page); first contact is trust-on-first-use; large-scale mesh performance"
    }
  }
}
```

## What is not on the page (and why)

Everything in Wave 2 (gated self-improvement T2, persistent memory T3, KV-cache recycling T7, structural alignment T9,
the organism thinking T10) waits for its own seal and its own passing test. Geometric compute (T8) waits for a
definition precise enough to test. The estate's private measurements (Kar's own memory journal and nightly vault) are
not shown: their receipts are not public, and nothing on this page is claimed without a button.
