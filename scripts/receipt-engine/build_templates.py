#!/usr/bin/env python3
"""Create our own bitmap templates from licensed glyphs; no OCR/AI model."""
import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[2]
FONT_SHA = "c805f9436dbc268644c1d9584f01a601a653e028e08fd74b9b949f6cf8304d88"
CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:/%-+()&@'\"#*=!?[]"
WIDTH, HEIGHT = 20, 28
SIZES = [18, 22, 26, 30, 34, 38]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def normalized(image, character, nominal_height, provenance):
    image = image.convert("L")
    binary = image.point(lambda x: 255 if x < 180 else 0)
    box = binary.getbbox()
    if not box:
        raise ValueError("Empty glyph image")
    crop = binary.crop(box)
    scale = min((WIDTH - 2) / crop.width, (HEIGHT - 2) / crop.height)
    w, h = max(1, math.floor(crop.width * scale + .5)), max(1, math.floor(crop.height * scale + .5))
    output = ["0"] * (WIDTH * HEIGHT)
    left, top = (WIDTH - w) // 2, (HEIGHT - h) // 2
    for y in range(h):
        for x in range(w):
            output[(top + y) * WIDTH + left + x] = "1" if crop.getpixel((min(crop.width-1, x*crop.width//w), min(crop.height-1, y*crop.height//h))) else "0"
    return {"character": character, "bitmap": "".join(output), "aspect": crop.width/crop.height,
            "relativeHeight": crop.height/nominal_height, "provenance": provenance}

def build(glyph_manifest=None, dataset_manifest=None):
    font_path = ROOT / "assets/receipt-engine/fonts/DejaVuSansMono.ttf"
    if sha(font_path.read_bytes()) != FONT_SHA:
        raise ValueError("Development font differs from pinned asset")
    templates = []
    for size in SIZES:
        font = ImageFont.truetype(str(font_path), size)
        box = font.getbbox("H")
        nominal = box[3] - box[1]
        for character in CHARSET:
            image = Image.new("L", (size*3, size*3), 255)
            ImageDraw.Draw(image).text((size//2, size//2), character, font=font, fill=0)
            templates.append(normalized(image, character, nominal, f"development-font:{FONT_SHA}:{size}"))
    source = {"fontSha256": FONT_SHA, "fontFile": str(font_path.relative_to(ROOT)),
              "licenseFile": "assets/receipt-engine/fonts/LICENSE.txt", "generator": sha(Path(__file__).read_bytes()), "sizes": SIZES}
    if glyph_manifest:
        if not dataset_manifest:
            raise ValueError("Reviewed real glyphs require a parent dataset manifest for split verification")
        parents = {r["id"]: r for r in [json.loads(line) for line in Path(dataset_manifest).read_text().splitlines() if line]}
        for line in Path(glyph_manifest).read_text().splitlines():
            row = json.loads(line)
            parent = parents.get(row.get("parent_id"))
            if not parent or parent.get("split") != "development" or parent.get("original_split") in ["test", "validation"] or row.get("split") != "development":
                raise ValueError("Glyph parent is not development data; validation/test leakage rejected")
            if row.get("reviewed") is not True or not row.get("reviewer") or not row.get("evidence"):
                raise ValueError("Glyph needs explicit independent review provenance")
            if row.get("character") not in CHARSET or len(row["character"]) != 1:
                raise ValueError("Unsupported glyph label")
            image_path = (ROOT / row["image_path"]).resolve()
            if not image_path.is_relative_to(ROOT) or sha(image_path.read_bytes()) != row["sha256"]:
                raise ValueError("Glyph image path/hash mismatch")
            if not isinstance(row.get("nominal_height"), (int, float)) or row["nominal_height"] <= 0:
                raise ValueError("Glyph requires an observed line-height reference")
            with Image.open(image_path) as image:
                if image.width*image.height > 100000:
                    raise ValueError("Glyph crop is too large")
                templates.append(normalized(image, row["character"], row["nominal_height"], f"reviewed-development:{row['parent_id']}:{row['sha256']}"))
        source["glyphManifestSha256"] = sha(Path(glyph_manifest).read_bytes())
    return {"schema": "receipt-templates/v1", "width": WIDTH, "height": HEIGHT, "sourceSplit": "development", "source": source, "templates": templates}

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--glyph-manifest")
    parser.add_argument("--dataset-manifest")
    args = parser.parse_args()
    result = build(args.glyph_manifest, args.dataset_manifest)
    target = ROOT / "assets/receipt-engine/templates.json"
    target.write_text(json.dumps(result, separators=(",", ":")) + "\n")
    metadata = {"templates": len(result["templates"]), "characters": len(CHARSET), "source_split": "development",
                "real_reviewed_glyphs": len(result["templates"])-len(CHARSET)*len(SIZES), "template_sha256": sha(target.read_bytes()),
                "python_renderer": {"pillow": Image.__version__, "freetype": features.version_module("freetype2")},
                "not_a_pretrained_model": True}
    (target.parent / "template-build.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))
