"""Small, dependency-free semantic index used by the free deployment.

The production Supabase migration also provisions pgvector. The hosted preview
uses deterministic feature-hashed embeddings so retrieval and semantic search
remain fast, private, and free without downloading a model at cold start.
"""

from __future__ import annotations

from hashlib import blake2b
import math
import re


DIMENSIONS = 192


def embed_text(text: str, dimensions: int = DIMENSIONS) -> list[float]:
    vector = [0.0] * dimensions
    tokens = re.findall(r"[a-z0-9]{2,}", text.casefold())
    features = tokens + [f"{left}_{right}" for left, right in zip(tokens, tokens[1:])]
    for feature in features:
        digest = blake2b(feature.encode("utf-8"), digest_size=8).digest()
        slot = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] & 1 else -1.0
        vector[slot] += sign * (1.35 if "_" in feature else 1.0)
    norm = math.sqrt(sum(value * value for value in vector))
    return [round(value / norm, 8) for value in vector] if norm else vector


def cosine(left: list[float], right: list[float]) -> float:
    if not left or not right or len(left) != len(right):
        return 0.0
    return sum(a * b for a, b in zip(left, right))


def with_embeddings(chunks: list[dict]) -> list[dict]:
    return [{**chunk, "embedding": embed_text(str(chunk.get("text", "")))} for chunk in chunks]

