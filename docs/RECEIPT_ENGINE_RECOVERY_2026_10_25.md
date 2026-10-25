# Phase 4 checkpoint recovery — 25 October 2026

The workspace restored the initial `b476875` checkpoint rather than the previously reported local commit `178178c`. That local commit and its reports are unavailable in this restored checkout. The segmentation checkpoint `042fd6824ff027e1feca5378e70d4ee8146129fb` is preserved in draft PR #3 and has been restored locally.

The exact 880-template bank was recovered from GitHub blob `b829afb39ff740e4f724ca27da747135375eb783`. Its SHA-256 is `c0a858f89aeb25ffdc6bf9088a1ae11ab31c3c587d7853761946aa4f7fb75337`. Its 388 receipt-template labels, IDs and raw crop-pixel hashes preserve the prior assistant visual review; they are not independent human verification.

Recovery tooling will regenerate the eight development training parents and candidate crops from the pinned SROIE archive, require every accepted crop's pixels to match that bank's recorded hash, and rebuild the minimal provenance manifest. Source-word text, full receipts and word-context images stay outside Git. Metadata contains character labels, source IDs, boxes, hashes, grouping hashes and review provenance.

Previously reported R2 figures (real CER 64.31%, total 0/20; synthetic total 27/40) are historical conversation results until newly generated reports reproduce them. Do not describe missing old reports as current measured evidence. Preserve both real and synthetic comparisons, including regressions. Production OCR, UI, storage and saved transactions remain unchanged.

The next recognition experiment should address ambiguity across template/font families. Do not infer a quality improvement from a larger bank, and do not integrate this prototype before measured accuracy and workflow gates pass.
