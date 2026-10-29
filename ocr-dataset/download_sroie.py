"""
SROIE (ICDAR 2019) Dataset Downloader and Preprocessor
Downloads the Malaysian Scanned Receipts dataset for OCR training.
"""

import os
import sys
import json
import urllib.request
import zipfile
import subprocess
from pathlib import Path

DATASET_DIR = Path(__file__).parent / "data" / "sroie"

def setup_sroie():
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[*] Target directory: {DATASET_DIR.resolve()}")

    repo_url = "https://github.com/zzzDavid/ICDAR-2019-SROIE.git"
    clone_target = DATASET_DIR / "repo"

    if not clone_target.exists():
        print(f"[*] Cloning SROIE repository from {repo_url}...")
        try:
            subprocess.run(["git", "clone", "--depth", "1", repo_url, str(clone_target)], check=True)
            print("[+] Successfully cloned SROIE dataset repository.")
        except Exception as e:
            print(f"[-] Git clone failed: {e}")
            print("[*] Please run git clone outside sandbox if network access is required.")
            return False
    else:
        print("[+] SROIE repository already exists.")

    # Process and summarize
    task1_dir = clone_target / "task1"
    task2_dir = clone_target / "task2"
    task3_dir = clone_target / "task3"

    print("[*] Dataset status:")
    print(f"    - Task 1 (Text localization): {'Available' if task1_dir.exists() else 'Missing'}")
    print(f"    - Task 2 (Text recognition):  {'Available' if task2_dir.exists() else 'Missing'}")
    print(f"    - Task 3 (Key extraction):    {'Available' if task3_dir.exists() else 'Missing'}")

    return True

if __name__ == "__main__":
    setup_sroie()
