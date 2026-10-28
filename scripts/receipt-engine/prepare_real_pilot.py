#!/usr/bin/env python3
"""Re-materialize a development-only SROIE pilot from a pinned public release.

Only the official training archive is acquired; only project-development images
are materialized. No held-out image is used for recognition tuning/templates.
Source labels are not independently verified. No OCR service is called.
"""
import datetime as dt
import hashlib
import json
import re
import urllib.request
from decimal import Decimal, InvalidOperation
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "datasets/receipt-engine"
REPO = "jsdnrs/ICDAR2019-SROIE"
REVISION = "bffe40c26759f3376ec2b3ae9031dbba54cd587c"
BASE = f"https://huggingface.co/datasets/{REPO}/resolve/{REVISION}"

def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024*1024), b""):
            h.update(block)
    return h.hexdigest()

def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()

def json_write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+"\n")

def date_value(raw):
    for pattern in ["%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y", "%Y-%m-%d"]:
        try:
            return dt.datetime.strptime(raw, pattern).date().isoformat()
        except ValueError:
            pass
    return None

def amount_value(raw):
    text = raw.strip().removeprefix("RM").strip()
    if re.fullmatch(r"\d{1,3}(?:,\d{3})+\.\d{2}", text):
        text = text.replace(",", "")
    try:
        return text if re.fullmatch(r"\d+(?:\.\d{1,2})?", text) and Decimal(text).is_finite() else None
    except InvalidOperation:
        return None

def main():
    import pyarrow.parquet as pq
    metadata = json.loads(fetch(f"https://huggingface.co/api/datasets/{REPO}/revision/{REVISION}"))
    if metadata.get("sha") != REVISION or metadata.get("cardData", {}).get("license") not in ["cc-by-4.0", ["cc-by-4.0"]]:
        raise ValueError("Pinned source revision/published license check failed")
    tree = json.loads(fetch(f"https://huggingface.co/api/datasets/{REPO}/tree/{REVISION}/data?expand=true"))
    shard = next(f for f in tree if Path(f["path"]).name.startswith("train-") and f["path"].endswith(".parquet"))
    raw = DATA / "local/raw/sroie" / Path(shard["path"]).name
    raw.parent.mkdir(parents=True, exist_ok=True)
    expected = shard["lfs"]["oid"]
    if not raw.exists() or raw.stat().st_size != shard["size"] or digest(raw) != expected:
        part = raw.with_suffix(".part")
        with urllib.request.urlopen(f"{BASE}/{shard['path']}?download=true", timeout=60) as response, part.open("wb") as stream:
            count = 0
            while chunk := response.read(1024*1024):
                stream.write(chunk); count += len(chunk)
                if count % (64*1024*1024) == 0:
                    print(f"Downloaded SROIE training archive: {count//(1024*1024)} MiB", flush=True)
        if part.stat().st_size != shard["size"] or digest(part) != expected:
            part.unlink(); raise ValueError("Source archive checksum/size mismatch")
        part.replace(raw)
    documents = []
    for filename in ["README.md", "LICENSE", "NOTICE"]:
        target = DATA / "licenses/sroie" / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(fetch(f"{BASE}/{filename}"))
        documents.append({"path": str(target.relative_to(ROOT)), "sha256": digest(target), "url": f"{BASE}/{filename}"})
    parquet = pq.ParquetFile(raw)
    if parquet.metadata.num_rows != 626:
        raise ValueError("Unexpected source train record count")
    candidates = {}
    for batch in parquet.iter_batches(batch_size=4):
        for row in batch.to_pylist():
            group = re.sub(r"[^A-Z0-9]", "", row["entities"]["company"].upper())
            # Same merchant-group bucket rule recorded in the earlier Phase 3 plan.
            if int(hashlib.sha256(group.encode()).hexdigest()[:8], 16) % 5 == 0:
                continue
            rank = hashlib.sha256(str(row["key"]).encode()).hexdigest()
            if group not in candidates or rank < candidates[group][0]:
                candidates[group] = (rank, row)
    groups = sorted(candidates, key=lambda g: hashlib.sha256(g.encode()).hexdigest())[:20]
    rows = []
    for group in groups:
        row = candidates[group][1]; key = str(row["key"])
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
            raise ValueError("Unexpected source identifier")
        image = DATA / f"local/phase4/sroie/{key}.img"
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(row["image"]["bytes"])
        annotation = DATA / f"local/phase4/sroie/{key}.json"
        json_write(annotation, {k: v for k, v in row.items() if k != "image"})
        entities = row["entities"]
        rows.append({"id": f"sroie:train:{key}", "source": "sroie", "source_revision": REVISION, "original_split": "train",
                     "split": "development", "variant": "original", "merchant_group": group,
                     "image_path": str(image.relative_to(ROOT)), "sha256": digest(image),
                     "source_annotation": str(annotation.relative_to(ROOT)), "source_annotation_sha256": digest(annotation),
                     "ground_truth": {"merchant": entities["company"], "receipt_date": date_value(entities["date"]),
                         "total": amount_value(entities["total"]), "raw_text": "\n".join(row["words"]), "items": None},
                     "annotation_review": "source_provided_not_independently_verified", "license": "CC-BY-4.0"})
    target = DATA / "manifests/phase4-development-real.jsonl"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("".join(json.dumps(row, sort_keys=True)+"\n" for row in rows))
    json_write(DATA / "sources/phase4-sroie.json", {"repo": REPO, "revision": REVISION, "license": "CC-BY-4.0", "documents": documents,
               "archive": {"path": shard["path"], "sha256": expected, "bytes": shard["size"]}, "source_train_rows": 626,
               "pilot_receipts": len(rows), "manifest_sha256": digest(target), "official_test_archive_downloaded": False,
               "project_validation_images_materialized": False, "archive_contains_all_source_training_rows": True,
               "selection": "One lowest-hash source ID per development merchant, then first 20 merchant SHA-256 hashes.",
               "independently_verified_labels": False})
    print(f"Prepared {len(rows)} source-labeled development receipts; no held-out data imported.", flush=True)

if __name__ == "__main__":
    main()
