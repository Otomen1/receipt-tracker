# Custom Receipt Recognition Engine — Project Reference

Updated: 22 October 2026 (Asia/Kuala_Lumpur). Repository: https://github.com/Otomen1/receipt-tracker.
Base application revision: `ee29cac5c039f23f5bb548b0cf735015a2ef3bb6`.

## Current state

Phase 4 has started. A standalone classical offline prototype is implemented, with separate preprocessing, segmentation, character recognition, layout, extraction, validation, and output modules. It is **not accurate enough to replace the app's OCR**. Read [the Phase 4 report](docs/RECEIPT_ENGINE_PHASE_4.md), [engine instructions](docs/RECEIPT_ENGINE_OFFLINE.md), and [failure log](datasets/receipt-engine/FAILURES.md) before continuing.

The new engine does not import Mistral or any OCR/AI service. The existing deployed upload route still uses its original recognizer because cutover belongs to Phase 6 after accuracy and integration gates. Missing Mistral credentials do not block custom-engine development. They only leave the original-system baseline unavailable.

The earlier uncommitted Phase 1–3 documents, scripts, manifests, and downloaded cache were lost when this scratch workspace reset. They were not present in GitHub. This reference is reconstructed from the conversation and current source inspection, not a byte-for-byte recovery. The old reported 2,155-image preparation and 31-test results cannot be rechecked from their missing artifacts. Do not present them as results reproduced by this revision.

This revision re-materializes **20 source-labeled SROIE development receipts**, creates **40 synthetic development images from eight parents**, and bundles two clean PNG fixtures. It does not restore CORD or the full prior dataset. No held-out recognition evaluation has run.

## Agreed scope

- Improve receipt recognition within the existing Next.js application; preserve its UI, API contracts, saved transactions, storage, and unrelated features.
- Develop from classical computer vision and deterministic recognition. No third-party OCR engine, pretrained recognition model, cloud AI recognition, or external OCR service in the replacement.
- Generic local image decoding and licensed font rendering are permitted infrastructure. The current engine uses existing Sharp for decoding and Pillow for development asset generation.
- Prioritize Malaysian grocery, restaurant, retail, and shopping receipts in English/Malay. Unknown layouts, unreadable content, and unsupported scripts require explicit review.
- Character templates may use development data only. Never derive templates or tune recognition from validation/test glyphs. Real glyph imports must record parent IDs, file hashes, split and review provenance.
- Never manufacture unreadable names, prices, taxes, dates, or balancing entries. Keep candidates and evidence. Decimal-safe arithmetic may validate values; it must not silently rewrite them to match a total.
- Preserve the existing recognizer/dependencies until replacement accuracy and integration tests pass. Do not rewrite historical receipts or connect experiments to production storage.

## Roadmap

| Phase | Current status | Exit gate |
| --- | --- | --- |
| 1. Understand existing app | Previous inspection completed; relevant contracts rechecked | Trace existing scanner/review/save flow and preserve compatibility. |
| 2. Research/design | Prior design recorded in conversation; current module contracts implemented | Independent deterministic core; explicit uncertainty, local input adapters, fixed scoring policies. |
| 3. Dataset/baseline | Earlier preparation lost; smaller development working set rebuilt | Restore/freeze licensed sources, independent label review, duplicate audit, target-domain item coverage, and an actual unchanged-system baseline where available. |
| 4. Independent engine | **In progress: initial prototype implemented** | Strengthen real-image segmentation/recognition, exercise remaining geometry/degradation cases, and document supported inputs. Initial real-pilot performance fails a usable-recognition gate. |
| 5. Accuracy improvement | Development diagnostics started; no held-out evaluation | Iterate on documented failures, add verified development glyphs, calibrate review thresholds using validation data, then evaluate unseen receipts honestly. |
| 6. Integration | Not started | Passing accuracy/compatibility tests, explicit rollback, unchanged review/storage/history workflows; verify images and PDFs separately. |
| 7. Final verification | Not started | Offline/no-network checks, full upload/review/save/reload integration in isolated storage, deployment/runtime checks, appropriate builds, and final measured report. |

## Existing application contracts

The application uses Next.js 14.2.29, React 18, TypeScript and Tailwind. `POST /api/upload` validates JPEG/PNG/WebP/PDF, uploads the original to Vercel Blob, and uses Sharp to resize/grayscale/normalize/sharpen/re-encode images before Mistral extraction. PDFs use the existing external OCR/text-extraction path. Receipt records are saved separately through receipt APIs to Neon PostgreSQL.

Shared `ExtractedReceiptData` includes merchant/date/total/currency/category/items/raw_text plus optional SST/discount/payment fields. `items[].price` means **unit price**, not line total. The offline core keeps line amounts and evidence separately, and maps only supported values into this existing contract. Missing quantities/unit prices are not silently filled. The API currency default MYR is retained with a warning if currency was not actually read.

Previous inspection found weak heuristic validation, swallowed recognition failures, zero-price loss, permissive date rollover, uncertain unit/line-price semantics, and no full transcript from legacy image extraction. These are code findings, not measured frequencies. The previous cloud baseline was blocked; no valid comparison establishes superiority over it.

## Phase 4 architecture

| Component | Current implementation |
| --- | --- |
| Input | Bounded JPEG/PNG/WebP decoding with existing Sharp, EXIF orientation, alpha flattened to white; PDF explicitly unsupported with no cloud fallback. |
| Preprocessing | Contrast normalization, optional median denoising, Otsu/adaptive thresholding, connected frame/rule suppression, skew correction, projective mapping with recorded coordinates. |
| Segmentation | Connected components and horizontal/vertical projections, dot/body grouping, geometric spacing, conservative touching-glyph split proposals. |
| Recognition | 492 custom templates for 82 characters at six sizes from a pinned licensed development font; aspect/height features, bitmap and symmetric distance matching; ranked candidates and unknown glyphs. |
| Layout/extraction | Receipt roles, English/Malay summary labels, dates, names, explicit quantities/unit/line prices, wrapped rows, discounts, SST, currency/payment evidence. |
| Validation/output | Decimal-safe arithmetic, strict dates, conflicting-value abstention, unresolved-field warnings, compatible output; high confidence disabled pending calibration. |
| Execution | Standalone CLI and isolated Node worker with deadline/abort and bounded pixel/glyph budgets. Actual Next/Vercel worker packaging is not verified. |

Font-generated templates are not a pretrained AI model. This revision has **zero independently reviewed real-receipt glyph templates**. It implements an import path for such labeled development crops; do not call it trained on the entire real dataset.

## Evaluation rules

Reports must distinguish synthetic versus real, development versus validation/test, and source-provided versus independently verified labels. Record image/template/code hashes and actual failures. Only annotated fields enter accuracy denominators; missing predictions are errors. Unannotated items are not empty receipts. Missing/extra item rows are penalized without price-based matching. Metrics with no eligible cases remain null.

Current synthetic CER preserves rendered case, punctuation and whitespace; layout padding may therefore count as character errors. SROIE uses an explicitly uppercase/whitespace-normalized region-order profile because the source labels do not establish strict original case or full-page reading order. Its absent item annotations make real item/complete-receipt scores unavailable.

No numerical release threshold is treated as met. The real development pilot currently fails merchant/date/total extraction. Do not substitute passing parser fixtures or same-font synthetic tests for recognition accuracy on unseen receipts. Retain manual-review warnings and keep production recognition unchanged.

## Immediate next work

1. Read the saved failure log and measured reports; isolate frame/line/character errors before parser tuning.
2. Create independently reviewed real development glyph crops and import them with source/hash/split provenance. Improve matching on thermal/condensed fonts and split/merge alternatives.
3. Restore the broader dataset reproducibly, review target country/language/currency per receipt, resolve duplicate/annotation issues, and add permissioned Malaysian item-level ground truth.
4. Validate perspective, fades, creases, clipped text, large/long images and local PDF rendering. Calibrate confidence on separate validation data.
5. Evaluate untouched test data only after fixing the protocol and engine revision. Consider integration only after evidence supports it.
