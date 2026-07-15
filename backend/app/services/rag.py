import math
import re
from collections import Counter

from .ai import AIProvider


def _vectorize(text: str) -> Counter[str]:
    return Counter(re.findall(r"[a-z0-9]{3,}", text.lower()))


def _cosine(left: Counter[str], right: Counter[str]) -> float:
    shared = set(left) & set(right)
    numerator = sum(left[token] * right[token] for token in shared)
    left_norm = math.sqrt(sum(value * value for value in left.values()))
    right_norm = math.sqrt(sum(value * value for value in right.values()))
    return numerator / (left_norm * right_norm) if left_norm and right_norm else 0.0


def retrieve(query: str, chunks: list[dict], top_k: int = 6) -> list[dict]:
    query_vector = _vectorize(query)
    ranked = sorted(chunks, key=lambda chunk: _cosine(query_vector, _vectorize(chunk["text"])), reverse=True)
    return ranked[:top_k]


async def answer_question(provider: AIProvider, question: str, chunks: list[dict], history: list[dict]) -> dict:
    matches = retrieve(question, chunks)
    if not matches:
        return {"answer": "I could not find readable source evidence for that question.", "citations": [], "suggestions": ["Ask about another topic", "Open the source document"]}
    context = "\n\n".join(f"[Page {item['page']}] {item['text']}" for item in matches)
    system = "You are a patient learning companion. Answer only from the supplied sources. Cite pages inline. Say when evidence is insufficient. End with one useful follow-up question."
    history_text = "\n".join(f"{item.get('role')}: {item.get('content')}" for item in history[-8:])
    answer = await provider.complete(system, f"Conversation:\n{history_text}\n\nSources:\n{context}\n\nQuestion: {question}")
    return {"answer": answer, "citations": [{"page": item["page"], "excerpt": item["text"][:180]} for item in matches[:3]], "suggestions": ["Explain with an analogy", "Quiz me on this", "Show the source context"]}
