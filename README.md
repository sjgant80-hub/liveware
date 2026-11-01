# Liveware

**Live page: https://sjgant80-hub.github.io/liveware/**

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

Everything runs client-side — WebCrypto, WASM, the LIGHT codec — offline after first load; nothing you run leaves your device.

## Re-run it yourself

```
node --test test/*.test.mjs        # the kernels: unit, edge and garbage suites
node tools/measure.mjs --check     # re-derive the four receipts, byte for byte, against the sealed claims
```

The claims were sealed in [`CLAIMS.md`](CLAIMS.md) before the code that measures them; the measurement refuses to run if
that file changed since the commit that sealed it. Each kernel is mutation-gated by the witness (`.github/workflows/gate.yml`);
the two reviewed-equivalent mutants are documented in `src/witness.baseline.json`.

## Layout

- `index.html` + `page/` — the live page; it runs the same test bodies the harness runs (`src/wave1.mjs`), so a
  visitor's receipt id equals CI's.
- `src/` — the kernels: `seed`, `door`, `mesh`, `compress`, plus `receipt` and `rng`. `wave1.mjs` composes them into the
  four tests. `vendor/fall-kit/` holds the LIGHT codec, the signed-packet door, the CRDT merge law, the immune system and
  the Ed25519 identity, copied byte-for-byte from `fall-kit` (see `vendor/SOURCES.json`).
- `samples/` — the pinned files T5 compresses, each by SHA-256. `receipts/` — what was measured.
- `CLAIMS.md` — the sealed pass criteria. `EXPLAINER.md` — every piece in plain English.

Wave 2 (gated self-improvement, persistent memory, KV-cache recycling, structural alignment, the organism thinking) is
added one test at a time, each only when its own sealed claim passes.

LIGHT language and the Konomi architecture: Thomas Frumkin. GEP / behavioural ideas: Gary W. Floyd (CC BY 4.0), where used.
Built by Simon Gant, AI-Native Solutions. Code MIT.
