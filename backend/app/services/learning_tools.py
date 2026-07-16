from __future__ import annotations

from io import BytesIO
import json
import re

from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def _lessons(course: dict) -> list[dict]:
    return [lesson for chapter in course.get("chapters", []) for lesson in chapter.get("lessons", [])]


def summarize_course(course: dict) -> dict:
    chapters = course.get("chapters", [])
    takeaways = [item for lesson in _lessons(course) for item in lesson.get("takeaways", [])][:10]
    pages = sorted({page for lesson in _lessons(course) for page in lesson.get("source_pages", [])})
    chapter_lines = [f"{chapter['title']}: {chapter.get('summary') or 'Core ideas and applied lessons.'}" for chapter in chapters]
    markdown = "\n\n".join([
        f"# {course['title']} — executive summary",
        course.get("description", ""),
        "## Chapter map\n" + "\n".join(f"- {line}" for line in chapter_lines),
        "## Essential takeaways\n" + "\n".join(f"- {item}" for item in takeaways),
        "## Recommended next step\nComplete the next unfinished lesson, then use a chapter quiz to check recall.",
    ])
    return {"course_id": course["id"], "title": f"{course['title']} summary", "markdown": markdown, "source_pages": pages[:20]}


def build_mind_map(course: dict) -> dict:
    nodes = [{"id": course["id"], "label": course["title"], "kind": "course"}]
    edges: list[dict] = []
    for chapter in course.get("chapters", []):
        nodes.append({"id": chapter["id"], "label": chapter["title"], "kind": "chapter"})
        edges.append({"source": course["id"], "target": chapter["id"]})
        for lesson in chapter.get("lessons", [])[:4]:
            nodes.append({"id": lesson["id"], "label": lesson["title"], "kind": "lesson"})
            edges.append({"source": chapter["id"], "target": lesson["id"]})
    return {"course_id": course["id"], "title": f"{course['title']} mind map", "nodes": nodes, "edges": edges}


def build_diagram(course: dict) -> dict:
    chapters = course.get("chapters", [])
    steps = [
        {"id": chapter["id"], "label": chapter["title"], "detail": chapter.get("summary", "")}
        for chapter in chapters
    ]
    connections = [{"source": steps[index]["id"], "target": steps[index + 1]["id"], "label": "builds into"} for index in range(max(0, len(steps) - 1))]
    return {"course_id": course["id"], "title": "Learning progression", "steps": steps, "connections": connections}


def export_markdown(course: dict) -> str:
    lines = [f"# {course['title']}", "", course.get("description", ""), "", f"**Difficulty:** {course.get('difficulty', 'Intermediate')}", ""]
    if course.get("objectives"):
        lines.extend(["## Learning objectives", *[f"- {item}" for item in course["objectives"]], ""])
    for chapter_index, chapter in enumerate(course.get("chapters", []), 1):
        lines.extend([f"## {chapter_index}. {chapter['title']}", "", chapter.get("summary", ""), ""])
        for lesson_index, lesson in enumerate(chapter.get("lessons", []), 1):
            lines.extend([f"### {chapter_index}.{lesson_index} {lesson['title']}", "", lesson.get("content_markdown", ""), ""])
            if lesson.get("takeaways"):
                lines.extend(["**Key takeaways**", *[f"- {item}" for item in lesson["takeaways"]], ""])
            if lesson.get("examples"):
                lines.append("**Real-world examples**")
                for example in lesson["examples"]:
                    if isinstance(example, dict):
                        lines.append(f"- **{example.get('title', 'Example')}:** {example.get('content', '')}")
                    else:
                        lines.append(f"- {example}")
                lines.append("")
            if lesson.get("source_pages"):
                lines.extend([f"_Source pages: {', '.join(map(str, lesson['source_pages']))}_", ""])
    return "\n".join(lines).strip() + "\n"


def export_json(course: dict) -> str:
    return json.dumps(course, ensure_ascii=False, indent=2)


def certificate_pdf(course: dict, learner_name: str) -> bytes:
    buffer = BytesIO()
    page = landscape(A4)
    pdf = canvas.Canvas(buffer, pagesize=page)
    width, height = page
    pdf.setFillColor(HexColor("#0b0c11"))
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setStrokeColor(HexColor("#9d7cff"))
    pdf.setLineWidth(2)
    pdf.roundRect(34, 34, width - 68, height - 68, 18, fill=0, stroke=1)
    pdf.setFillColor(HexColor("#b9a1ff"))
    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawCentredString(width / 2, height - 110, "COURSECRAFT · CERTIFICATE OF COMPLETION")
    pdf.setFillColor(HexColor("#ffffff"))
    pdf.setFont("Times-Bold", 34)
    pdf.drawCentredString(width / 2, height - 190, "Awarded to")
    pdf.setFillColor(HexColor("#d7ccff"))
    pdf.setFont("Times-BoldItalic", 30)
    pdf.drawCentredString(width / 2, height - 240, learner_name[:60])
    pdf.setFillColor(HexColor("#8e8998"))
    pdf.setFont("Helvetica", 13)
    pdf.drawCentredString(width / 2, height - 280, "for completing the source-grounded course")
    title = re.sub(r"\s+", " ", course["title"]).strip()
    size = 24
    while stringWidth(title, "Helvetica-Bold", size) > width - 150 and size > 14:
        size -= 1
    pdf.setFillColor(HexColor("#ffffff"))
    pdf.setFont("Helvetica-Bold", size)
    pdf.drawCentredString(width / 2, height - 330, title)
    pdf.setFillColor(HexColor("#716c7c"))
    pdf.setFont("Helvetica", 10)
    pdf.drawCentredString(width / 2, 88, f"{len(course.get('chapters', []))} chapters · {len(_lessons(course))} lessons · Verifiable in CourseCraft")
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
