#!/usr/bin/env python3
"""Restore public development template parents; publish hashes, not source text."""
import hashlib
import io
import json
import re
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "datasets/receipt-engine"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def fingerprint(data):
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert("L")
        decoded = sha(f"{image.width}x{image.height}:".encode()+image.tobytes())
        small = image.resize((9, 16))
        signature = sum(int(small.getpixel((x, y)) > small.getpixel((x+1, y))) << (y*8+x) for y in range(16) for x in range(8))
        return decoded, signature

def main():
    import pyarrow.parquet as pq
    source = json.loads((DATA / "sources/phase4-sroie.json").read_text())
    archive = DATA / "local/raw/sroie" / Path(source["archive"]["path"]).name
    if sha(archive.read_bytes()) != source["archive"]["sha256"]:
        raise ValueError("Pinned archive checksum mismatch")
    pilot = [json.loads(line) for line in (DATA / "manifests/phase4-development-real.jsonl").read_text().splitlines()]
    excluded = {r["merchant_group"] for r in pilot}
    known = []
    for row in pilot:
        data = (ROOT / row["image_path"]).read_bytes()
        if sha(data) != row["sha256"]:
            raise ValueError("Pilot image changed")
        known.append((row["id"], sha(data), *fingerprint(data)))
    candidates = {}
    for batch in pq.ParquetFile(archive).iter_batches(batch_size=4):
        for row in batch.to_pylist():
            group = re.sub(r"[^A-Z0-9]", "", row["entities"]["company"].upper())
            if int(sha(group.encode())[:8], 16) % 5 == 0 or group in excluded:
                continue
            rank = sha(str(row["key"]).encode())
            if group not in candidates or rank < candidates[group][0]:
                candidates[group] = (rank, row)
    parents, near = [], []
    for group in sorted(candidates, key=lambda g: sha(g.encode()))[:8]:
        row = candidates[group][1]
        key, data = str(row["key"]), row["image"]["bytes"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", key):
            raise ValueError("Invalid source identifier")
        parent_id, encoded = f"sroie:train:{key}", sha(data)
        decoded, signature = fingerprint(data)
        for other_id, other_encoded, other_decoded, other_signature in known:
            if encoded == other_encoded or decoded == other_decoded:
                raise ValueError(f"Exact duplicate parent: {parent_id}, {other_id}")
            distance = (signature ^ other_signature).bit_count()
            if distance <= 6:
                near.append({"parent": parent_id, "other": other_id, "dhash128_distance": distance})
        known.append((parent_id, encoded, decoded, signature))
        image = DATA / f"local/phase4/template-parents/{key}.img"
        image.parent.mkdir(parents=True, exist_ok=True)
        image.write_bytes(data)
        annotation = image.with_suffix(".json")
        annotation.write_text(json.dumps({k: v for k, v in row.items() if k != "image"}, indent=2)+"\n")
        parents.append({"id": parent_id, "source": "sroie", "source_revision": source["revision"],
                        "split": "development", "original_split": "train", "purpose": "template_training",
                        "merchant_group_sha256": sha(group.encode()), "image_path": str(image.relative_to(ROOT)),
                        "sha256": encoded, "decoded_gray_sha256": decoded,
                        "source_annotation": str(annotation.relative_to(ROOT)), "source_annotation_sha256": sha(annotation.read_bytes()),
                        "license": "CC-BY-4.0", "annotation_review": "source_provided_not_independently_verified"})
    manifest = DATA / "manifests/phase4-template-parents.jsonl"
    manifest.write_text("".join(json.dumps(r, sort_keys=True)+"\n" for r in parents))
    audit = {"parents": len(parents), "pilot_receipts": len(pilot), "manifest_sha256": sha(manifest.read_bytes()),
             "parent_ids_disjoint": True, "merchant_groups_disjoint": True, "exact_duplicates": [],
             "dhash128_pairs_at_most_6": near, "source_revision": source["revision"],
             "selection": "First 8 development merchant hashes outside the fixed pilot; lowest source-ID hash per merchant.",
             "limits": ["Development cohorts, not held-out evaluation.", "dHash screening is incomplete.", "Source full receipts are not independently verified."]}
    (DATA / "reports/phase4-template-parent-audit.json").write_text(json.dumps(audit, indent=2)+"\n")
    print(f"Prepared {len(parents)} development training parents; {len(near)} near-duplicate screen flags")

if __name__ == "__main__":
    main()
