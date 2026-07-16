import re
from collections.abc import AsyncIterator

from .ai import AIProvider
from .semantic import cosine, embed_text


def retrieve(query: str, chunks: list[dict], top_k: int = 6) -> list[dict]:
    query_vector = embed_text(query)
    ranked = sorted(
        chunks,
        key=lambda chunk: cosine(query_vector, chunk.get("embedding") or embed_text(chunk["text"])),
        reverse=True,
    )
    return ranked[:top_k]


def build_grounded_prompt(question: str, chunks: list[dict], history: list[dict]) -> tuple[str, str, list[dict]]:
    matches = retrieve(question, chunks)
    context = "\n\n".join(f"[Page {item['page']}] {item['text']}" for item in matches)
    system = "You are a patient learning companion. Answer only from the supplied sources. Cite pages inline. Say when evidence is insufficient. End with one useful follow-up question."
    history_text = "\n".join(f"{item.get('role')}: {item.get('content')}" for item in history[-8:])
    return system, f"Conversation:\n{history_text}\n\nSources:\n{context}\n\nQuestion: {question}", matches


async def answer_question(provider: AIProvider, question: str, chunks: list[dict], history: list[dict]) -> dict:
    system, prompt, matches = build_grounded_prompt(question, chunks, history)
    if not matches:
        return {"answer": "I could not find readable source evidence for that question.", "citations": [], "suggestions": ["Ask about another topic", "Open the source document"]}
    try:
        answer = await provider.complete(system, prompt, max_tokens=900)
    except RuntimeError:
        # Keep the public preview useful during a transient provider outage or
        # rate limit while remaining strictly grounded in retrieved evidence.
        evidence = []
        for item in matches[:2]:
            excerpt = re.sub(r"\s+", " ", item["text"]).strip()[:420]
            evidence.append(f"{excerpt} [Source: p. {item['page']}]")
        answer = "The strongest available source evidence says:\n\n" + "\n\n".join(evidence)
    return {"answer": answer, "citations": [{"page": item["page"], "excerpt": item["text"][:180]} for item in matches[:3]], "suggestions": ["Explain with an analogy", "Quiz me on this", "Show the source context"]}


async def stream_answer(provider: AIProvider, question: str, chunks: list[dict], history: list[dict]) -> AsyncIterator[tuple[str, list[dict]]]:
    system, prompt, matches = build_grounded_prompt(question, chunks, history)
    if not matches:
        yield "I could not find readable source evidence for that question.", []
        return
    citations = [{"page": item["page"], "excerpt": item["text"][:180]} for item in matches[:3]]
    try:
        async for token in provider.stream(system, prompt):
            yield token, citations
    except RuntimeError:
        fallback = " ".join(re.sub(r"\s+", " ", item["text"]).strip()[:300] + f" [Source: p. {item['page']}]" for item in matches[:2])
        yield fallback, citations
