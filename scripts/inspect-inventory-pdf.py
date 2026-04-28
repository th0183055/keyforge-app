from pathlib import Path
import json
import re
import sys

from pypdf import PdfReader

pdf_path = Path(sys.argv[1])
out_dir = Path("data")
out_dir.mkdir(exist_ok=True)
out_path = out_dir / "inventory-labels-extract.txt"
summary_path = out_dir / "inventory-labels-summary.json"

reader = PdfReader(str(pdf_path))
pages = []

for index, page in enumerate(reader.pages):
    text = page.extract_text() or ""
    pages.append({"page": index + 1, "text": text})

full_text = "\n\n--- PAGE BREAK ---\n\n".join(page["text"] for page in pages)
out_path.write_text(full_text, encoding="utf-8")

lines = [line.strip() for line in full_text.splitlines() if line.strip()]
tokens = re.findall(r"[A-Z0-9][A-Z0-9.-]{2,}", full_text.upper())
token_counts = {}
for token in tokens:
    token_counts[token] = token_counts.get(token, 0) + 1

summary = {
    "source": str(pdf_path),
    "pages": len(reader.pages),
    "nonEmptyLines": len(lines),
    "sampleLines": lines[:80],
    "frequentTokens": sorted(
        [{"token": token, "count": count} for token, count in token_counts.items()],
        key=lambda item: (-item["count"], item["token"]),
    )[:80],
}

summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
