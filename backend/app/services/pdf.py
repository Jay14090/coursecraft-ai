import io
import re
from dataclasses import dataclass

from pypdf import PdfReader


@dataclass(frozen=True)
class ExtractedPdf:
    text: str
    pages: list[str]
    page_count: int


def extract_pdf(payload: bytes) -> ExtractedPdf:
    reader = PdfReader(io.BytesIO(payload))
    if reader.is_encrypted:
        raise ValueError("Encrypted PDFs are not supported")
    pages: list[str] = []
    for page in reader.pages:
        raw = page.extract_text() or ""
        cleaned = re.sub(r"[ \t]+", " ", raw)
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned).strip()
        pages.append(cleaned)
    return ExtractedPdf(text="\n\n".join(pages), pages=pages, page_count=len(pages))


def chunk_pages(pages: list[str], target_chars: int = 2_800, overlap_chars: int = 350) -> list[dict]:
    if target_chars < 200 or overlap_chars < 0 or overlap_chars >= target_chars:
        raise ValueError("Invalid chunk sizing")
    chunks: list[dict] = []
    for page_number, page in enumerate(pages, start=1):
        cursor = 0
        while cursor < len(page):
            end = min(len(page), cursor + target_chars)
            if end < len(page):
                boundary = max(page.rfind("\n", cursor, end), page.rfind(". ", cursor, end))
                if boundary > cursor + target_chars // 2:
                    end = boundary + 1
            text = page[cursor:end].strip()
            if text:
                chunks.append({"text": text, "page": page_number, "position": len(chunks)})
            cursor = max(end - overlap_chars, cursor + 1)
    return chunks
