import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_templates", ROOT / "scripts/receipt-engine/build_templates.py")
templates = importlib.util.module_from_spec(spec)
spec.loader.exec_module(templates)

class ProvenanceTests(unittest.TestCase):
    def test_reproducible_bank_uses_only_pinned_development_font(self):
        first, second = templates.build(), templates.build()
        self.assertEqual(first, second)
        self.assertEqual(first["sourceSplit"], "development")
        self.assertTrue(all(t["provenance"].startswith("development-font:") for t in first["templates"]))

    def test_held_out_and_unreviewed_glyphs_are_rejected_before_image_use(self):
        with tempfile.TemporaryDirectory(prefix="receipt-glyph-test-") as directory:
            glyphs, parents = Path(directory)/"glyphs.jsonl", Path(directory)/"parents.jsonl"
            parents.write_text(json.dumps({"id": "parent", "split": "test", "original_split": "test"})+"\n")
            glyphs.write_text(json.dumps({"parent_id": "parent", "split": "development", "character": "A"})+"\n")
            with self.assertRaisesRegex(ValueError, "leakage rejected"):
                templates.build(glyphs, parents)
            parents.write_text(json.dumps({"id": "parent", "split": "development", "original_split": "train"})+"\n")
            with self.assertRaisesRegex(ValueError, "independent review"):
                templates.build(glyphs, parents)

if __name__ == "__main__":
    unittest.main()
