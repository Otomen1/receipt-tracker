# Phase 4 — Initial Offline Receipt Engine

Date: 22 October 2026 (Asia/Kuala_Lumpur)  
Application base: `ee29cac5c039f23f5bb548b0cf735015a2ef3bb6`  
Status: **in progress; standalone prototype implemented, production replacement rejected by current accuracy evidence**.

The initial seven-part classical engine now runs from actual image pixels to the existing receipt output contract without Mistral, another OCR engine, pretrained recognition models, or external AI services. Its custom templates work on controlled font examples, but its real-receipt recognition is currently very poor. This is an implementation milestone, not completion of the requested accuracy upgrade.

The upload route, UI, saved history, original OCR/dependencies, API schemas and storage code remain unchanged. Only isolated engine/input modules, build/test commands, assets, tooling, documentation and ignored cache paths were added. No production upload, database operation, saved-data migration, deployment or Mistral request was performed.

## What is implemented

| Component | Implemented behavior | Remaining evidence/limitations |
| --- | --- | --- |
| Preprocessing | Contrast, optional median denoising, global Otsu/adaptive local thresholding, connected border/rule suppression, skew estimation/rotation, explicit projective correction and opt-in conservative boundary detection | Perspective/degradation behavior is not validated broadly; suppressing a component joined to text can lose content and generates review warnings. |
| Detection/segmentation | Connected components, projection-based line/glyph segmentation, disconnected-dot grouping, geometric word spacing, touching-span split proposals | Severe failures on real ruled, damaged, condensed, mixed-font and long receipts. No claim of robust fragment/touching-character recovery. |
| Recognition | 492 original bitmap templates, 82 characters, six rendering sizes, aspect/height features, pixel/distance matching, ranked alternatives and abstention | Only one development font; no independently reviewed real receipt glyphs. Scores and margins are heuristic, not calibrated probabilities. |
| Layout | Header, column, item, summary, payment/footer roles; geometry retained | Generic rules are limited; unfamiliar summary labels and column layouts remain problematic. |
| Extraction | English/Malay totals/discount/SST/payment labels, strict four-digit-year dates, quantities, separate unit/line amounts and wrapped item rows | Missing unit prices/names remain unresolved. No automatic century guess or arbitrary character replacement. Real extraction currently fails. |
| Validation | Decimal-safe calculations, zero preservation, item/summary checks, conflicting-value abstention, warnings; high confidence disabled | Arithmetic checks warn rather than invent balancing amounts. Review thresholds need separate calibration. |
| Output/execution | Existing `ExtractedReceiptData` mapping plus evidence/candidates/boxes; bounded local decoder, isolated worker with hard deadline and abort, standalone CLI | No PDF renderer, browser execution, actual Next/Vercel worker packaging or app workflow integration yet. |

Runtime is TypeScript/Node with existing Sharp for JPEG/PNG/WebP decoding. Python/Pillow is optional development asset tooling. All recognition logic is our own classical implementation. The template bank is not a neural model and has not been trained on the full real dataset.

## Dataset/training state and recovery

The scratch workspace reset after the earlier turn; its uncommitted Phase 1–3 artifacts and cache were absent, and the GitHub repository had only the original app. The previous documents were reconstructed as the current project reference. The old reported 2,155-image preparation/31-test artifacts were not recovered and are not represented as reproduced results.

This revision downloads the immutable `jsdnrs/ICDAR2019-SROIE` official training archive at `bffe40c26759f3376ec2b3ae9031dbba54cd587c`, verifies its LFS SHA-256, byte size and 626 source rows, and retains the published CC BY 4.0 license/card/NOTICE. Only 20 project-development images from separate normalized merchant groups are materialized. The training archive also contains rows assigned to project validation; those images are not materialized as the pilot and no held-out recognition result is computed. CORD/full Phase 3 recovery remains outstanding.

Source-provided transcriptions/fields are not independently verified by this project. The pilot is a deterministic development sample, not a statistically representative Malaysian test cohort. Visual review found at least one non-Malaysian/non-English example; country/language/currency cannot be assumed from a source-level description. SROIE source case/reading order also limits transcription scoring.

An additional eight new synthetic development parents produce 40 clean/blurred/faded/3.5°-rotated/upside-down images. These include English/Malay names, wrapped layouts, fractional quantities, tax/discount and gifts. They use the same development font as the template bank, so their results do not demonstrate unseen-font generalization. Two clean images and their exact renderer labels are versioned regression fixtures.

Only the explicitly bundled, hash-pinned DejaVu Sans Mono development face was used for the bank. Its exact Bitstream/DejaVu notices are retained; it is not described as OFL. Real reviewed glyph imports are supported with parent/hash/split/reviewer/evidence checks, but **zero real glyphs have been imported**. Benchmarking a receipt does not train the bank on that receipt.

## Measured development diagnostics

These numbers come from actual custom-engine inference, with JS HTTP/HTTPS/socket/DNS/fetch operations blocked and the Mistral credential removed. Images were hash-verified before inference. Each subprocess received only its input path and the local bank, never ground truth. Full reports record source review state, selected IDs, image/manifest/template/scorer/engine hashes and failures.

| Metric | Real SROIE development pilot | Synthetic development variants |
| --- | ---: | ---: |
| Attempted images | 20 | 40 (8 correlated parents) |
| Processing failures | 1: image over pixel budget | 0 |
| Merchant exact match | **0/20 (0%)** | 14/40 (35%) |
| Date exact match | **0/16 eligible (0%)** | 34/40 (85%) |
| Total exact match | **0/20 (0%)** | 33/40 (82.5%) |
| Character error rate | **93.95%** | 6.16% |
| Word error rate | **106.21%** | 20.16% |
| Item name exact match | Unavailable: unannotated | 61/121 scoring rows (50.41%) |
| Item quantity / unit-price / line-price exact match | Unavailable: unannotated | Each 62/121 (51.24%) |
| Complete receipt | Unavailable: item labels absent | 12/40 (30%) |
| Review rate | 100% | 100% |
| Successful-process wall p50 / p95 | 2.055 s / 2.729 s | 1.150 s / 1.433 s |
| Successful-process peak RSS p95 | 278,332 KiB | 135,840 KiB |

The extra predicted item row is included in synthetic denominators. Unsupported ground-truth fields do not enter denominators; failed predictions for annotated fields count as misses. Real full/item accuracy remains null, not zero or perfect. Error rates can exceed 100% because insertions count. Review rate is 100% because high confidence is deliberately unavailable; that is not evidence that all wrong fields are identified individually.

Synthetic variant detail matters: clean/faded/upside-down total match is 8/8 per group; blur is 6/8 and 3.5° rotation is 3/8. Complete synthetic extraction is only 4/8 on each clean/faded/upside-down group and 0/8 for blur/rotation. Passing two controlled end-to-end fixtures is therefore not a claim that the whole development suite succeeds.

Real text uses uppercase/whitespace-normalized source-region order, while synthetic text preserves the renderer's case/punctuation/spacing. Collapsed synthetic column padding can contribute character errors. Different text profiles are not pooled into an accuracy comparison. No held-out benchmark or valid original-Mistral baseline exists. **No improvement over Mistral is claimed.**

Timing covers cold local worker startup, image reading/decoding, preprocessing, recognition, parsing and validation after parent imports. It excludes application upload/storage/deployment request latency and output serialization. Peak RSS includes the parent/worker process lifetime. Runtime quantiles exclude the rejected oversized input, which remains counted as a recognition failure. Host CPU/runtime/concurrency are recorded in the JSON reports. The V8 worker heap setting is not a hard native-memory cap.

Reports:

- [Real development results](../datasets/receipt-engine/reports/phase4-development-real.json)
- [Synthetic development results](../datasets/receipt-engine/reports/phase4-development-synthetic.json)
- [Asset/input integrity checks](../datasets/receipt-engine/reports/phase4-integrity.json)
- [Failures and next experiments](../datasets/receipt-engine/FAILURES.md)

## Checks performed

- **27 Node tests and two Python tests passed**: parser/calendar/decimal behavior, zero gifts, missing/conflicting/uncertain values, candidate constraints, matching/scoring masks, missing/extra items, geometry, budgets, clean English/Malay pixel-to-fields, physically rotated/framed images, hard worker timeout/abort, network-forbidden CLI operation, reproducible templates and held-out/unreviewed glyph rejection.
- Standalone engine compilation and the whole repository's `npx tsc --noEmit --incremental false` passed with the existing application TypeScript configuration unchanged.
- The custom bank regenerated byte-for-byte. Encoded hashes of all 60 materialized development images, hashes of 20 original annotation files, pinned source notices and the font were checked; no exact encoded duplicates were found in this working set. This is not a full perceptual/cross-dataset duplicate audit or independent label verification.
- Existing application source, shared types, original recognizer, package lock, UI/public files and Next configuration remain unchanged. No app production build, hosted workflow, PDF recognition or real-image accuracy gate passed was claimed.

## Next Phase 4 work

Continue from the actual failure log. Prioritize real-image region/line separation, stroke fragmentation, touching-character alternatives, realistic thermal-font matching and independently reviewed development glyphs. Fix the large-image strategy without prematurely discarding fine text. Exercise optional perspective/denoise paths on meaningful fixtures and real development examples. Keep error evidence and template/code hashes for each change.

Then restore the broader dataset and independent target-domain item labels, establish separate validation calibration, and reserve untouched real test receipts. Only after usable recognition evidence and image/PDF/workflow integration tests should a Phase 6 switch be proposed. The current failed real pilot is a clear reason to keep this branch a development prototype.

Run instructions and API boundaries are in [RECEIPT_ENGINE_OFFLINE.md](RECEIPT_ENGINE_OFFLINE.md). The permanent project reference is [RECEIPT_ENGINE_PLAN.md](../RECEIPT_ENGINE_PLAN.md).
