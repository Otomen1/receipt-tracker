#!/usr/bin/env python3
"""Phase 4 controlled development fixtures. Not restored Phase 3 artifacts."""
import hashlib
import io
import json
import math
from decimal import Decimal
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, features

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "datasets/receipt-engine"
FONT = ROOT / "assets/receipt-engine/fonts/DejaVuSansMono.ttf"

def sha(data):
    return hashlib.sha256(data).hexdigest()

def render(index):
    malay = index % 2 == 1
    merchant = "RESTORAN UJIAN CERIA" if malay else "SAMPLE GROCERY STORE"
    products = [("NASI GORENG" if malay else "FRESH MILK 1L", "2", "5.50"),
                ("TEH AIS" if malay else "WHITE RICE 1KG", "1", "8.90"),
                ("HADIAH PERCUMA" if malay else "FREE GIFT", "1", "0.00")]
    if index >= 4:
        products[0] = ("GULA TIMBANG" if malay else "SUGAR BY WEIGHT", "0.75", "4.80")
    subtotal = sum(Decimal(q)*Decimal(u) for _, q, u in products)
    discount = Decimal("1.50") if index % 4 == 0 else Decimal("0.00")
    tax = Decimal("0.60") if malay else Decimal("0.00")
    amount = lambda n: f"{n:.2f}"
    total = subtotal - discount + tax
    lines = [merchant, f"{'TARIKH' if malay else 'DATE'} 28/02/2025", "ITEM QTY UNIT AMOUNT"]
    items = []
    for name, quantity, unit in products:
        line = amount(Decimal(quantity)*Decimal(unit))
        items.append({"name": name, "quantity": quantity, "price": unit, "line_amount": line})
        if index % 3 == 0:
            lines.extend([name, f"{quantity} X {unit} {line}"])
        elif index % 3 == 1:
            lines.append(f"{name}  {quantity}  {unit}  {line}")
        else:
            first, _, last = name.rpartition(" ")
            lines.extend([first, f"{last} QTY {quantity}", f"UNIT {unit} AMOUNT {line}"])
    lines.extend([f"SUBTOTAL {amount(subtotal)}", f"{'DISKAUN' if malay else 'DISCOUNT'} {amount(discount)}",
                  f"SST {amount(tax)}", f"{'JUMLAH' if malay else 'GRAND TOTAL'} RM {amount(total)}",
                  "BAYARAN TUNAI" if malay else "PAID BY CASH", "NOT A PURCHASE / BUKAN PEMBELIAN"])
    font = ImageFont.truetype(str(FONT), 22 if index < 4 else 26)
    width = max(600, math.ceil(max(font.getlength(s) for s in lines))+60)
    pitch = 34 if index < 4 else 40
    image = Image.new("L", (width, pitch*len(lines)+60), 255)
    draw = ImageDraw.Draw(image)
    for i, line in enumerate(lines):
        draw.text((25, 20+i*pitch), line, font=font, fill=0)
    return image, {"merchant": merchant, "receipt_date": "2025-02-28", "total": amount(total), "currency": "MYR", "category": "Restaurant" if malay else "Groceries",
                   "items": items, "sst_amount": amount(tax), "discount": amount(discount), "payment_method": "Cash", "raw_text": "\n".join(lines)}

def variants(image):
    yield "clean", image
    yield "blur", image.filter(ImageFilter.GaussianBlur(.7))
    yield "faded", ImageEnhance.Brightness(ImageEnhance.Contrast(image).enhance(.35)).enhance(1.05)
    yield "rotated", image.rotate(3.5, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=255)
    yield "upside_down", image.transpose(Image.Transpose.ROTATE_180)

if __name__ == "__main__":
    rows = []
    fixture = ROOT / "tests/receipt-engine/fixtures"
    fixture.mkdir(parents=True, exist_ok=True)
    for index in range(8):
        base, gt = render(index)
        for name, image in variants(base):
            stream = io.BytesIO()
            image.save(stream, format="PNG")
            target = DATA / f"local/phase4/synthetic/{index:02d}-{name}.png"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(stream.getvalue())
            rows.append({"id": f"phase4-synthetic:{index:02d}:{name}", "source": "synthetic", "split": "development",
                         "parent_id": f"phase4-synthetic:{index:02d}", "variant": name, "image_path": str(target.relative_to(ROOT)),
                         "sha256": sha(stream.getvalue()), "ground_truth": gt, "annotation_review": "synthetic_render_spec"})
            if index < 2 and name == "clean":
                (fixture / f"receipt-{index}.png").write_bytes(stream.getvalue())
                (fixture / f"receipt-{index}.json").write_text(json.dumps(gt, indent=2)+"\n")
    manifest = DATA / "manifests/phase4-development-synthetic.jsonl"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text("".join(json.dumps(r, sort_keys=True)+"\n" for r in rows))
    report = {"parents": 8, "images": len(rows), "split": "development", "font_sha256": sha(FONT.read_bytes()),
              "generator_sha256": sha(Path(__file__).read_bytes()), "manifest_sha256": sha(manifest.read_bytes()),
              "pillow": Image.__version__, "freetype": features.version_module("freetype2"), "real_accuracy": None,
              "note": "New Phase 4 development fixtures, not the lost Phase 3 dataset or held-out evaluation."}
    (DATA / "reports").mkdir(parents=True, exist_ok=True)
    (DATA / "reports/phase4-synthetic.json").write_text(json.dumps(report, indent=2)+"\n")
    print(json.dumps(report, indent=2))
