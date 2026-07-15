import json
import asyncio
from collections.abc import AsyncIterator

import httpx

from ..config import Settings


class AIProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def complete(
        self,
        system: str,
        user: str,
        *,
        temperature: float = 0.2,
        json_mode: bool = False,
        max_tokens: int = 8_192,
    ) -> str:
        if self.settings.llm_provider == "demo" or not self.settings.llm_api_key:
            return self._demo_response(user, json_mode)
        headers = {"Authorization": f"Bearer {self.settings.llm_api_key}"}
        if self.settings.llm_provider == "openrouter":
            headers.update({"HTTP-Referer": self.settings.frontend_url, "X-Title": "CourseCraft"})
        payload = {
            "model": self.settings.llm_model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}
        async with httpx.AsyncClient(base_url=self.settings.llm_base_url, timeout=httpx.Timeout(120, connect=15)) as client:
            last_error: Exception | None = None
            for attempt in range(3):
                try:
                    response = await client.post("/chat/completions", headers=headers, json=payload)
                    response.raise_for_status()
                    content = response.json().get("choices", [{}])[0].get("message", {}).get("content", "")
                    if not content.strip():
                        raise ValueError("AI provider returned an empty response")
                    return content
                except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError, ValueError) as exc:
                    last_error = exc
                    retryable = not isinstance(exc, httpx.HTTPStatusError) or exc.response.status_code in {408, 409, 429, 500, 502, 503, 504}
                    if not retryable or attempt == 2:
                        break
                    await asyncio.sleep(0.6 * (2**attempt))
            raise RuntimeError("AI provider request failed") from last_error

    async def stream(self, system: str, user: str) -> AsyncIterator[str]:
        text = await self.complete(system, user)
        for word in text.split(" "):
            yield word + " "

    @staticmethod
    def _demo_response(user: str, json_mode: bool) -> str:
        if json_mode:
            return json.dumps({
                "title": "Building Reliable Generative AI Systems",
                "description": "A practical course on retrieval, evaluation, safety, and production AI architecture.",
                "objectives": ["Design grounded AI workflows", "Evaluate quality systematically", "Ship resilient AI features"],
                "prerequisites": ["Basic Python", "Familiarity with APIs"],
                "difficulty": "Intermediate",
                "estimated_minutes": 240,
                "chapters": [
                    {"title": "Foundations", "summary": "Models, systems, and constraints", "lessons": [
                        {"title": "The model is not the product", "content_markdown": "## Systems over demos\nReliable products combine models with retrieval, evaluation, and observability.", "takeaways": ["Treat the model as one component"], "estimated_minutes": 12, "source_pages": [1, 2]}
                    ]},
                    {"title": "Retrieval systems", "summary": "Ground answers in source evidence", "lessons": [
                        {"title": "Building the retrieval loop", "content_markdown": "## Retrieve before reasoning\nEncode intent, retrieve candidates, rerank, compose context, and cite the evidence.", "takeaways": ["Favor recall, then rerank for precision"], "estimated_minutes": 17, "source_pages": [18, 19, 20]}
                    ]}
                ]
            })
        return "The source explains this as a four-stage retrieval loop: encode the question, retrieve candidate evidence, compose the smallest sufficient context, and generate an answer with citations. [Source: p. 18–20]"
