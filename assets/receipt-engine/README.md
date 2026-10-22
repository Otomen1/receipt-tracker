# Custom Template Assets

`fonts/DejaVuSansMono.ttf` is an unmodified licensed development font with SHA-256 `c805f9436dbc268644c1d9584f01a601a653e028e08fd74b9b949f6cf8304d88`. It was copied from the system's DejaVu font distribution. The full bundled copyright/notice is in `fonts/LICENSE.txt`; upstream terms: https://dejavu-fonts.github.io/License.html. This is not described as an OFL font.

`templates.json` contains 492 original bitmap templates for 82 characters, generated locally at six sizes using `scripts/receipt-engine/build_templates.py`. Feature metadata includes aspect/relative height and provenance. The corresponding template hash and Pillow/FreeType environment are recorded in `template-build.json`. No OCR engine or pretrained model supplied these templates. No validation/test font face was used, and no real reviewed glyph was imported in this revision.

Runtime uses these bitmaps directly and does not download or render fonts. Font rendering is optional development tooling. Keep the asset hash, exact notices, generation settings and split provenance with any future template-bank revision. Rendered font templates are a starting point; the real pilot demonstrates they are insufficient for reliable receipts.
