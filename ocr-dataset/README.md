# Receipt OCR Dataset & Rule-Based Extractor

This module contains tools for training a custom local receipt OCR engine and running deterministic rule-based information extraction without any external cloud or AI/LLM server.

---

## 1. Directory Structure

```
ocr-dataset/
├── download_sroie.py              # Clones & prepares ICDAR 2019 SROIE Malaysian receipt dataset
├── generate_synthetic_receipts.py # Generates synthetic thermal receipt text crops
├── malaysian_receipt_vocab.json   # Malaysian stores, grocery items, taxes, payment tags
└── data/
    ├── sroie/                     # SROIE Task 1 (detection), Task 2 (recognition), Task 3 (keys)
    └── synthetic/                 # Synthetic thermal receipt text lines + labels.txt
```

---

## 2. Dataset Overview

### A. SROIE (Scanned Receipts OCR and Information Extraction - ICDAR 2019)
- **Origin**: Real-world Malaysian store receipts (Lotus's, Giant, Watsons, etc.).
- **Tasks**:
  - `Task 1`: Text line localization (bounding boxes).
  - `Task 2`: Text recognition (transcription of cropped text lines).
  - `Task 3`: Key information extraction (`company`, `date`, `address`, `total`).

### B. Synthetic Receipt Text Generator
- Generates thermal receipt-style text crops using [TextRecognitionDataGenerator (TRDG)](https://github.com/Belval/TextRecognitionDataGenerator) or `generate_synthetic_receipts.py`.
- Incorporates:
  - Dot-matrix & thermal receipt typography.
  - Malaysian Ringgit (`RM`, `SEN`), SST (6%, 8%), cash/payment lines (`TUNAI`, `BAYARAN`, `TNG`, `DuitNow`).
  - Thermal fading, paper distortion, and low-contrast noise.

---

## 3. Rule-Based Extractor (`lib/rules-extractor.ts`)

Once the local OCR model transcribes bounding boxes and text, the deterministic rule engine extracts:

- **Merchant**: Selects top-header lines with corporate suffixes (`SDN BHD`, `ENTERPRISE`), largest font height, excluding postcodes, phone numbers, and addresses.
- **Date**: Regex matching Malaysian formats (`DD/MM/YYYY`, `YYYY-MM-DD`, `DD MMM YYYY`).
- **Total**: Matches anchor keywords (`TOTAL`, `JUMLAH`, `BAYARAN`, `GRAND TOTAL`), picking the correct payable amount while ignoring subtotal and cash tendered.
- **SST**: Extracts 6% / 8% tax amounts.
- **Category**: Classifies spending category using Malaysian merchant rules from [`lib/classify.ts`](../lib/classify.ts).
- **Payment Method**: Identifies `Touch 'n Go`, `DuitNow`, `GrabPay`, `ShopeePay`, `Card`, or `Cash`.
- **Line Items**: Table parser isolating item names, quantities (`2x`), and line prices.
