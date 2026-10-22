# Current Development Data

The earlier Phase 3 scratch artifacts were lost before being committed. This directory contains a smaller **new Phase 4 working set**, not the original 2,155-image preparation.

- `manifests/phase4-development-real.jsonl`: 20 source-labeled SROIE official-training receipts, selected from project-development merchant buckets. Labels are not independently verified. Semantic items remain unannotated.
- `manifests/phase4-development-synthetic.jsonl`: eight original English/Malay synthetic parents × clean/blurred/faded/rotated/upside-down variants = 40 development images. All share the pinned development font; no generalization claim follows from their scores.
- `sources/phase4-sroie.json`: immutable source revision, archive hash/size, retained source-document hashes and selection policy.
- `licenses/sroie/`: exact published CC BY 4.0 license, NOTICE and card. Attribute Huang et al., ICDAR 2019 SROIE competition, and the jsdnrs release/adapter. Keep notices, source links and an indication of changes (pilot selection, normalized dates/amounts, manifests/hashes and diagnostics). Original pixels are unchanged.
- `reports/`: actual custom-engine development scores and integrity checks; no Mistral comparison or held-out result.
- `local/`: ignored archives, materialized images/source annotations and diagnostic predictions. Reproducible from the pinned source and scripts; not included in Git.

The original SROIE organizer access was not independently confirmed. Source labels and per-image country/language/currency must be reviewed; inspected examples include content outside the intended Malaysian domain. No amohseni/Asprise data, production receipts, cloud OCR output or pretrained model is used.

See [instructions](../../docs/RECEIPT_ENGINE_OFFLINE.md), [current report](../../docs/RECEIPT_ENGINE_PHASE_4.md), and [failure log](FAILURES.md). Manual corrections must be versioned with reviewer/evidence provenance, not silently written over original annotations. Never derive templates from a held-out image or relabel missing item fields as empty receipts.
