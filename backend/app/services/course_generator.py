import json
import re

from .ai import AIProvider


SYSTEM_PROMPT = """You are a senior instructional designer. Convert source material into a rigorous, practical course.
Preserve factual fidelity. Never invent claims. Every lesson must include source page numbers.
Use progressive complexity, concrete examples, concise summaries, and measurable learning objectives.
Return only valid JSON matching the requested structure."""


async def generate_course(provider: AIProvider, text: str, depth: str, language: str) -> dict:
    if not text.strip():
        raise ValueError("Source material is empty")
    limits = {"quick": "3-4 chapters and 8-12 lessons", "balanced": "5-7 chapters and 18-28 lessons", "mastery": "8-12 chapters and 30-50 lessons"}
    prompt = f"""Create a {depth} course in {language}. Target {limits[depth]}.
Return title, description, objectives[], prerequisites[], difficulty, estimated_minutes, and chapters[].
Each chapter needs title, summary, and lessons[]. Each lesson needs title, content_markdown,
takeaways[], important_notes[], examples[], summary, source_pages[], and estimated_minutes.

SOURCE MATERIAL:
{text[:90_000]}"""
    raw = await provider.complete(SYSTEM_PROMPT, prompt, temperature=0.15, json_mode=True)
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.IGNORECASE)
    parsed = json.loads(cleaned)
    required = {"title", "description", "chapters"}
    if not isinstance(parsed, dict) or not required.issubset(parsed) or not isinstance(parsed["chapters"], list) or not parsed["chapters"]:
        raise ValueError("Generated course does not match the required structure")
    normalized_chapters: list[dict] = []
    for chapter in parsed["chapters"]:
        if not isinstance(chapter, dict) or not isinstance(chapter.get("lessons"), list) or not chapter["lessons"]:
            continue
        lessons: list[dict] = []
        for lesson in chapter["lessons"]:
            if not isinstance(lesson, dict) or not str(lesson.get("title", "")).strip():
                continue
            pages = [int(page) for page in lesson.get("source_pages", []) if str(page).isdigit() and int(page) > 0]
            important_notes = [str(item) for item in lesson.get("important_notes", []) if str(item).strip()]
            examples = lesson.get("examples", []) if isinstance(lesson.get("examples", []), list) else []
            lesson_summary = str(lesson.get("summary", "")).strip()
            content = str(lesson.get("content_markdown", "")).strip()
            if important_notes:
                content += "\n\n## Important notes\n\n" + "\n".join(f"- {item}" for item in important_notes)
            if examples:
                rendered_examples = []
                for example in examples:
                    if isinstance(example, dict):
                        rendered_examples.append(f"- **{example.get('title', 'Example')}:** {example.get('content', '')}")
                    elif str(example).strip():
                        rendered_examples.append(f"- {example}")
                if rendered_examples:
                    content += "\n\n## Real-world examples\n\n" + "\n".join(rendered_examples)
            if lesson_summary:
                content += f"\n\n## Lesson summary\n\n{lesson_summary}"
            lessons.append({
                "title": str(lesson["title"]).strip(),
                "content_markdown": content,
                "takeaways": [str(item) for item in lesson.get("takeaways", []) if str(item).strip()],
                "important_notes": important_notes,
                "examples": examples,
                "summary": lesson_summary,
                "source_pages": sorted(set(pages)),
                "estimated_minutes": max(1, min(120, int(lesson.get("estimated_minutes", 10)))),
            })
        if lessons:
            normalized_chapters.append({
                "title": str(chapter.get("title", f"Chapter {len(normalized_chapters) + 1}")).strip(),
                "summary": str(chapter.get("summary", "")).strip(),
                "lessons": lessons,
            })
    if not normalized_chapters:
        raise ValueError("Generated course has no usable lessons")
    return {
        "title": str(parsed["title"]).strip(),
        "description": str(parsed["description"]).strip(),
        "objectives": [str(item) for item in parsed.get("objectives", []) if str(item).strip()],
        "prerequisites": [str(item) for item in parsed.get("prerequisites", []) if str(item).strip()],
        "difficulty": str(parsed.get("difficulty", "Intermediate")).strip(),
        "estimated_minutes": max(1, int(parsed.get("estimated_minutes", sum(item["estimated_minutes"] for chapter in normalized_chapters for item in chapter["lessons"])))),
        "chapters": normalized_chapters,
    }
