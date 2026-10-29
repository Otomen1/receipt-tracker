"""
Synthetic Malaysian Receipt Text Line Generator for OCR Training.
Generates thermal receipt-style text crops with Malaysian vocab and annotations.
"""

import os
import json
import random
from pathlib import Path

VOCAB_PATH = Path(__file__).parent / "malaysian_receipt_vocab.json"
OUTPUT_DIR = Path(__file__).parent / "data" / "synthetic"

def load_vocab():
    if not VOCAB_PATH.exists():
        raise FileNotFoundError(f"Missing {VOCAB_PATH}")
    with open(VOCAB_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def generate_random_line(vocab):
    choice_type = random.choices(
        ["merchant", "item", "total", "date", "sst", "payment", "header"],
        weights=[0.15, 0.35, 0.15, 0.10, 0.10, 0.10, 0.05],
        k=1
    )[0]

    if choice_type == "merchant":
        return random.choice(vocab["merchants"])

    if choice_type == "item":
        item = random.choice(vocab["items"])
        qty = random.choice([1, 2, 3, 5])
        price = round(random.uniform(1.50, 45.00), 2)
        if random.random() < 0.5:
            return f"{item}  RM{price:.2f}"
        else:
            return f"{qty}X  {item}  {price:.2f}"

    if choice_type == "total":
        prefix = random.choice(vocab["totals"])
        amt = round(random.uniform(5.00, 350.00), 2)
        return f"{prefix}  RM {amt:.2f}"

    if choice_type == "date":
        day = random.randint(1, 28)
        month = random.randint(1, 12)
        year = random.choice([2024, 2025, 2026])
        sep = random.choice(["/", "-", "."])
        return f"TARIKH: {day:02d}{sep}{month:02d}{sep}{year}"

    if choice_type == "sst":
        prefix = random.choice(vocab["taxes"])
        tax_amt = round(random.uniform(0.30, 25.00), 2)
        return f"{prefix}: RM {tax_amt:.2f}"

    if choice_type == "payment":
        method = random.choice(vocab["payments"])
        amt = round(random.uniform(5.00, 350.00), 2)
        return f"CARA BAYARAN: {method} RM {amt:.2f}"

    return random.choice(vocab["headers"])

def generate_dataset(num_samples=1000):
    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter
    except ImportError:
        print("[-] Pillow is required for rendering images.")
        print("[*] Install with: pip install pillow")
        return

    vocab = load_vocab()
    images_dir = OUTPUT_DIR / "images"
    images_dir.mkdir(parents=True, exist_ok=True)
    labels_file = OUTPUT_DIR / "labels.txt"

    print(f"[*] Generating {num_samples} synthetic receipt text lines...")

    lines_generated = []

    for i in range(num_samples):
        text = generate_random_line(vocab)
        width = max(240, len(text) * 14 + 40)
        height = 40

        # Background: slightly off-white thermal paper
        bg_color = random.randint(240, 255)
        img = Image.new("L", (width, height), color=bg_color)
        draw = ImageDraw.Draw(img)

        # Monospace default font
        font = ImageFont.load_default()

        # Text color: slightly faded thermal ink (dark gray to black)
        ink_color = random.randint(20, 80)
        draw.text((15, 12), text, fill=ink_color, font=font)

        # Thermal fade & noise
        if random.random() < 0.4:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.7)))

        filename = f"synth_{i:06d}.png"
        img.save(images_dir / filename)
        lines_generated.append(f"{filename}\t{text}")

    with open(labels_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines_generated))

    print(f"[+] Finished generating {num_samples} samples in {OUTPUT_DIR.resolve()}")
    print(f"[+] Labels saved to: {labels_file.resolve()}")

if __name__ == "__main__":
    generate_dataset(num_samples=100)
