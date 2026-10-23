# Offline Engine — Development Instructions

This is an initial standalone engine inside the existing application repository. It has no Mistral/OCR-service dependency and does not call the upload route, Blob, Neon, or saved receipt history. The app's active recognition route has not been switched.

## Build and run

Install the existing locked application dependencies with `npm ci`. Use the repository root as the working directory. Node 24.19.0 was used for verification; compatibility with the deployed Node/runtime and worker packaging still requires integration testing.

```bash
npm run build:receipt-engine
npm run recognize:offline -- --image receipt.png --output result.json
```

Use `--upright` to disable quarter-turn orientation search for a diagnostic run. The CLI launches a local worker, not a server/API. It reads the bundled custom template bank, decodes the image with existing Sharp, runs the classical pipeline, and saves structured fields, warnings, line/glyph boxes, alternatives and timing. Never paste credentials into command arguments or source; this engine requires none.

Input is limited to JPEG/PNG/WebP, 20 MiB encoded and eight million decoded pixels. Larger files are rejected rather than silently downscaled. EXIF rotation is applied. PDF input fails explicitly; no external recognizer is used. Worker execution has a 60-second wall deadline and abort support. The 256 MiB V8 heap limit does not impose a complete native/typed-array RSS cap; peak process RSS is reported separately. Actual deployment constraints remain unverified.

## Modules

The TypeScript core is under `lib/receipt-engine/`. It consumes grayscale pixels and a locally supplied template bank. It performs preprocessing, segmentation, recognition, layout/extraction, arithmetic validation and structured output. It has no runtime imports of network/storage/model clients. Types imported from `lib/types.ts` preserve the current receipt contract.

`lib/receipt-input/` owns Sharp decoding and the isolated worker adapter. `recognizeImageIsolated(bytes, bank, options, timeoutMs, signal)` supports cancellation. `recognizeReceipt(pixels, bank, options)` is the synchronous core for bounded local inputs; callers must provide execution isolation when a hard deadline is required.

Perspective correction accepts an explicit ordered top-left/top-right/bottom-right/bottom-left quadrilateral. Conservative automatic detection is opt-in (`autoPerspective`), not the default. Nearest-neighbor rectification and adaptive thresholds need further real-image validation. Median denoising is optional to avoid erasing decimal points by default. All geometry preserves a mapping to decoded-input coordinates; EXIF-to-encoded-file coordinate mapping is not exposed.

Glyph scores are similarity scores, not calibrated probabilities. Up to five candidates are retained. Uncertain glyphs become unknowns, and unreadable names are omitted from the app-compatible item list with warnings while remaining in diagnostics. Numeric context can choose a unique sufficiently close **visual candidate**; it cannot create arbitrary replacement digits. Arithmetic warnings do not rewrite amounts. High confidence is unavailable until separately calibrated.

## Regenerate custom templates

The pinned development font is unmodified DejaVu Sans Mono. Exact font hashes, generator parameters, license text and template-build metadata are versioned under `assets/receipt-engine/`. The bank has 82 supported ASCII characters × six sizes = 492 templates. These are our own font-derived labeled examples, not an imported OCR model. The validation/test Sans faces discussed earlier have not been used.

For the optional Python tooling use a separate environment and `scripts/receipt-engine/requirements.txt` (Pillow 12.3.0, PyArrow 21.0.0). Python is not needed at runtime.

```bash
python3 scripts/receipt-engine/build_templates.py
python3 scripts/receipt-engine/generate_development.py
```

The font's actual Bitstream/DejaVu terms and notices are in `assets/receipt-engine/fonts/LICENSE.txt`; do not call them OFL. Rendering was checked with Pillow 12.3.0 and FreeType 2.14.3. Different renderer builds may change bitmap hashes and must be recorded as a new asset revision.

To add reviewed real glyph templates:

```bash
python3 scripts/receipt-engine/build_templates.py --glyph-manifest reviewed-glyphs.jsonl --dataset-manifest parent-receipts.jsonl
```

Each glyph row needs `parent_id`, `split: "development"`, `character`, repository-relative `image_path`, encoded `sha256`, observed `nominal_height`, `reviewed: true`, `reviewer`, and `evidence`. The parent must exist in the supplied dataset manifest, belong to development, and not have an original validation/test split. Crops must have verified labels and an appropriate line-height reference. Original source images/annotations must remain unchanged. The builder rejects missing review provenance, held-out parents, changed hashes and unsupported labels.

This revision imported zero such real glyphs. Merely benchmarking a dataset does not train the engine on it.

## Re-materialize the real development pilot

```bash
python3 scripts/receipt-engine/prepare_real_pilot.py
```

This downloads only the pinned SROIE official training archive, validates its LFS checksum/size and row count, and retains the published licensing/card/NOTICE. The archive contains all 626 original training rows, including rows assigned to project validation; only 20 project-development images from distinct merchant groups are materialized for this pilot. No official test archive is downloaded, and no held-out recognition result is computed.

Records use the prior deterministic merchant-bucket rule and explicit source-provided/unverified review state. This is a new small working set after workspace loss, not restoration of the previous full Phase 3 preparation. CORD is not materialized in this revision. Some inspected source content is non-Malaysian/non-English; source-level marketing labels must not be assumed true per image.

## Tests and development measurements

```bash
npm run test:receipt-engine
python3 -m unittest discover -s tests/receipt-engine -p 'test_*.py' -v
npx tsc --noEmit --incremental false
node scripts/receipt-engine/benchmark.cjs --manifest datasets/receipt-engine/manifests/phase4-development-real.jsonl --output datasets/receipt-engine/reports/phase4-development-real.json --limit 20
node scripts/receipt-engine/benchmark.cjs --manifest datasets/receipt-engine/manifests/phase4-development-synthetic.jsonl --output datasets/receipt-engine/reports/phase4-development-synthetic.json --limit 40
```

Only development manifests are accepted by this Phase 4 runner. Inputs are hash-verified. Every subprocess receives only an image path and local template bank, never ground truth. JS HTTP/HTTPS/socket/DNS/fetch operations are blocked by a preload guard inherited by its worker, and no Mistral credential is supplied. This is evidence for the exercised Node code path, not a claim of an OS-level network sandbox.

Benchmark reports freeze manifest, template, scorer and engine hashes. They include CER/WER, covered fields, item names/quantities/unit/line prices, complete-receipt eligibility, review rate, processing failures, and per-process timings/RSS. Cold worker startup, decoding and core processing are timed after parent imports; app upload/storage/deployment latency is outside this scope. Failed processes count as misses; no-eligible metrics remain null. Runtime quantiles contain successful processing measurements only, with failures reported separately.

Synthetic fixtures use the same development font as the templates. They are regression diagnostics, not evidence of unseen-font or real-receipt accuracy. SROIE lacks item semantics, so it cannot establish real item/full-receipt accuracy without additional annotation. See the Phase 4 report for current measured failures and integration blockers.
