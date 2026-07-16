import asyncio
import json
from statistics import mean

from fastapi import Depends, FastAPI, File, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .auth import CurrentUser, get_current_user
from .config import get_settings
from .schemas import CertificateRequest, ChatRequest, CourseToolRequest, FlashcardRequest, GenerateCourseRequest, HealthResponse, ProgressUpdate, QuizAttemptRequest, QuizRequest
from .services.ai import AIProvider
from .services.course_generator import generate_course
from .services.pdf import chunk_pages, extract_pdf
from .services.learning_tools import build_diagram, build_mind_map, certificate_pdf, export_json, export_markdown, summarize_course
from .services.rag import answer_question, stream_answer
from .services.semantic import cosine, embed_text, with_embeddings
from .store import demo_store


settings = get_settings()
if settings.preview_gcs_bucket:
    demo_store.configure_gcs(settings.preview_gcs_bucket, settings.preview_gcs_object)
elif settings.preview_data_path:
    demo_store.configure_persistence(settings.preview_data_path)
if settings.preview_firestore_collection:
    demo_store.configure_firestore(settings.preview_firestore_collection, settings.preview_firestore_document)
provider = AIProvider(settings)
app = FastAPI(title=settings.app_name, version="1.2.0", docs_url="/docs", redoc_url="/redoc")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _without_private_document_fields(document: dict) -> dict:
    return {key: value for key, value in document.items() if key not in {"text", "chunks"}}


def _course_summary(course: dict, user_id: str) -> dict:
    detailed = demo_store.get_course(course["id"], user_id) or course
    lessons = [lesson for chapter in detailed.get("chapters", []) for lesson in chapter.get("lessons", [])]
    completed = sum(1 for lesson in lessons if lesson.get("completed"))
    total = len(lessons)
    document = demo_store.get_document(course["document_id"], user_id)
    return {
        "id": course["id"],
        "document_id": course["document_id"],
        "title": course["title"],
        "description": course["description"],
        "difficulty": course.get("difficulty", "Intermediate"),
        "estimated_minutes": course.get("estimated_minutes", sum(item.get("estimated_minutes", 0) for item in lessons)),
        "language": course.get("language", "en"),
        "status": course.get("status", "ready"),
        "objectives": course.get("objectives", []),
        "prerequisites": course.get("prerequisites", []),
        "chapter_count": len(course.get("chapters", [])),
        "lesson_count": total,
        "completed_lessons": completed,
        "progress_percent": round(completed / total * 100) if total else 0,
        "filename": document.get("filename") if document else None,
        "page_count": document.get("page_count", 0) if document else 0,
        "created_at": course["created_at"],
        "updated_at": course["updated_at"],
    }


def _owned_course(course_id: str, user_id: str) -> dict:
    course = demo_store.get_course(course_id, user_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    document = demo_store.get_document(course["document_id"], user_id)
    course["document"] = _without_private_document_fields(document) if document else None
    course["summary"] = _course_summary(course, user_id)
    return course


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="healthy",
        service=settings.app_name,
        mode="preview" if settings.demo_mode else "live",
        ai_provider=settings.llm_provider,
        persistence="firestore+gcs" if settings.preview_firestore_collection and settings.preview_gcs_bucket else "gcs" if settings.preview_gcs_bucket else "local",
    )


@app.get(f"{settings.api_prefix}/documents", tags=["documents"])
async def list_documents(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    return [_without_private_document_fields(item) for item in demo_store.list_documents(user.id)]


@app.post(f"{settings.api_prefix}/documents", status_code=201, tags=["documents"])
async def upload_document(file: UploadFile = File(...), user: CurrentUser = Depends(get_current_user)) -> dict:
    filename = file.filename or "document.pdf"
    if file.content_type != "application/pdf" and not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF documents are supported")
    payload = await file.read()
    if not payload.startswith(b"%PDF"):
        raise HTTPException(status_code=422, detail="The selected file is not a valid PDF")
    if len(payload) > settings.max_pdf_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"PDF exceeds the {settings.max_pdf_mb} MB limit")
    try:
        extracted = await asyncio.to_thread(extract_pdf, payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail="The PDF is encrypted, damaged, or could not be read") from exc
    if extracted.page_count == 0 or not extracted.text.strip():
        raise HTTPException(status_code=422, detail="No readable text was found in this PDF. Scanned PDFs require OCR.")
    chunks = with_embeddings(chunk_pages(extracted.pages))
    record = demo_store.create_document(
        user_id=user.id,
        filename=filename,
        storage_key=f"{user.id}/{filename}",
        size_bytes=len(payload),
        page_count=extracted.page_count,
        status="processed",
        text=extracted.text,
        chunks=chunks,
    )
    return _without_private_document_fields(record)


@app.delete(f"{settings.api_prefix}/documents/{{document_id}}", status_code=204, tags=["documents"])
async def delete_document(document_id: str, user: CurrentUser = Depends(get_current_user)) -> Response:
    if not demo_store.delete_document(document_id, user.id):
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(status_code=204)


@app.post(f"{settings.api_prefix}/courses/generate", status_code=201, tags=["courses"])
async def create_course(request: GenerateCourseRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    document = demo_store.get_document(request.document_id, user.id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    if document["status"] not in {"processed", "ready"}:
        raise HTTPException(status_code=409, detail="Document is not ready for generation")
    demo_store.update_document(document["id"], status="processing")
    try:
        generated = await generate_course(provider, document["text"], request.depth, request.language)
    except Exception as exc:
        demo_store.update_document(document["id"], status="failed")
        raise HTTPException(status_code=502, detail="Course generation failed. Please retry in a moment.") from exc
    generated.update({
        "user_id": user.id,
        "document_id": document["id"],
        "status": "ready",
        "language": request.language,
    })
    course = demo_store.create_course(generated)
    return _owned_course(course["id"], user.id)


@app.get(f"{settings.api_prefix}/courses", tags=["courses"])
async def list_courses(user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    return [_course_summary(course, user.id) for course in demo_store.list_courses(user.id)]


@app.get(f"{settings.api_prefix}/courses/{{course_id}}", tags=["courses"])
async def get_course(course_id: str, user: CurrentUser = Depends(get_current_user)) -> dict:
    return _owned_course(course_id, user.id)


@app.delete(f"{settings.api_prefix}/courses/{{course_id}}", status_code=204, tags=["courses"])
async def delete_course(course_id: str, user: CurrentUser = Depends(get_current_user)) -> Response:
    if not demo_store.delete_course(course_id, user.id):
        raise HTTPException(status_code=404, detail="Course not found")
    return Response(status_code=204)


@app.put(f"{settings.api_prefix}/progress", tags=["learning"])
async def update_progress(request: ProgressUpdate, user: CurrentUser = Depends(get_current_user)) -> dict:
    if not demo_store.find_lesson(request.lesson_id, user.id):
        raise HTTPException(status_code=404, detail="Lesson not found")
    return demo_store.save_progress(user.id, request.lesson_id, request.model_dump(exclude={"lesson_id"}))


@app.get(f"{settings.api_prefix}/courses/{{course_id}}/messages", tags=["ai"])
async def get_messages(course_id: str, user: CurrentUser = Depends(get_current_user)) -> list[dict]:
    _owned_course(course_id, user.id)
    return demo_store.list_messages(user.id, course_id)


@app.post(f"{settings.api_prefix}/chat", tags=["ai"])
async def chat(request: ChatRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    course = demo_store.get_course(request.course_id, user.id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    document = demo_store.get_document(course["document_id"], user.id)
    if not document or not document.get("chunks"):
        raise HTTPException(status_code=409, detail="Course source is not ready for questions")
    response = await answer_question(provider, request.message, document["chunks"], request.history)
    demo_store.add_message(user_id=user.id, course_id=request.course_id, role="user", content=request.message, citations=[])
    demo_store.add_message(user_id=user.id, course_id=request.course_id, role="assistant", content=response["answer"], citations=response["citations"])
    return response


@app.post(f"{settings.api_prefix}/chat/stream", tags=["ai"])
async def chat_stream(request: ChatRequest, user: CurrentUser = Depends(get_current_user)) -> StreamingResponse:
    course = demo_store.get_course(request.course_id, user.id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    document = demo_store.get_document(course["document_id"], user.id)
    if not document or not document.get("chunks"):
        raise HTTPException(status_code=409, detail="Course source is not ready for questions")

    async def events():
        parts: list[str] = []
        citations: list[dict] = []
        async for token, token_citations in stream_answer(provider, request.message, document["chunks"], request.history):
            parts.append(token)
            citations = token_citations
            yield f"event: token\ndata: {json.dumps({'token': token})}\n\n"
        answer = "".join(parts).strip()
        demo_store.add_message(user_id=user.id, course_id=request.course_id, role="user", content=request.message, citations=[])
        demo_store.add_message(user_id=user.id, course_id=request.course_id, role="assistant", content=answer, citations=citations)
        yield f"event: complete\ndata: {json.dumps({'answer': answer, 'citations': citations})}\n\n"

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post(f"{settings.api_prefix}/quizzes/generate", tags=["ai"])
async def generate_quiz(request: QuizRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    located = demo_store.find_chapter(request.chapter_id, user.id)
    if not located:
        raise HTTPException(status_code=404, detail="Chapter not found")
    _, chapter = located
    pages = sorted({page for lesson in chapter["lessons"] for page in lesson.get("source_pages", [])})
    topic = chapter["title"]
    questions = [
        {
            "id": f"{chapter['id']}-1",
            "format": "multiple_choice",
            "question": f"What is the main purpose of the ideas in “{topic}”?",
            "options": ["Ground learning in evidence", "Remove all source context", "Avoid evaluation", "Replace the source document"],
            "answer": 0,
            "explanation": "The chapter uses source evidence to build a reliable learning model.",
            "source_pages": pages[:3],
        },
        {
            "id": f"{chapter['id']}-2",
            "format": "true_false",
            "question": "The largest possible context is always the most precise context.",
            "options": ["True", "False"],
            "answer": 1,
            "explanation": "A smaller sufficient evidence set is often more precise and efficient.",
            "source_pages": pages[:3],
        },
        {
            "id": f"{chapter['id']}-3",
            "format": "multiple_choice",
            "question": "What makes a generated answer inspectable?",
            "options": ["More tokens", "Source citations", "A higher temperature", "A longer title"],
            "answer": 1,
            "explanation": "Citations connect claims to the supporting source passages.",
            "source_pages": pages[:3],
        },
        {
            "id": f"{chapter['id']}-4",
            "format": "short_answer",
            "question": f"In one phrase, what keeps answers in “{topic}” connected to the source?",
            "options": [],
            "answer": "source citations",
            "accepted_answers": ["citations", "source citations", "source evidence", "grounding"],
            "explanation": "Source citations and grounded evidence make generated claims inspectable.",
            "source_pages": pages[:3],
        },
    ]
    enabled = [item for item in questions if item["format"] in request.formats]
    repeated = []
    for position in range(request.question_count):
        item = dict(enabled[position % len(enabled)])
        item["id"] = f"{item['id']}-{position + 1}"
        repeated.append(item)
    return {"chapter_id": request.chapter_id, "title": f"{topic} checkpoint", "questions": repeated}


@app.post(f"{settings.api_prefix}/quizzes/attempts", status_code=201, tags=["learning"])
async def save_quiz_attempt(request: QuizAttemptRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    if not demo_store.find_chapter(request.chapter_id, user.id):
        raise HTTPException(status_code=404, detail="Chapter not found")
    if request.score > request.total:
        raise HTTPException(status_code=422, detail="Score cannot exceed total")
    return demo_store.add_attempt(
        user_id=user.id,
        **request.model_dump(),
        percentage=round(request.score / request.total * 100, 1),
    )


@app.get(f"{settings.api_prefix}/search", tags=["learning"])
async def search_library(q: str = Query(min_length=2, max_length=120), user: CurrentUser = Depends(get_current_user)) -> dict:
    needle = q.casefold()
    query_vector = embed_text(q)
    matches: list[dict] = []
    for course in demo_store.list_courses(user.id):
        course_text = f"{course.get('title', '')} {course.get('description', '')} {' '.join(course.get('objectives', []))}"
        course_score = cosine(query_vector, embed_text(course_text)) + (0.8 if needle in course_text.casefold() else 0)
        if course_score > 0.05:
            matches.append({"type": "course", "course_id": course["id"], "title": course["title"], "excerpt": course["description"][:180], "score": round(course_score, 4)})
        for chapter in course.get("chapters", []):
            chapter_text = f"{chapter.get('title', '')} {chapter.get('summary', '')}"
            chapter_score = cosine(query_vector, embed_text(chapter_text)) + (0.8 if needle in chapter_text.casefold() else 0)
            if chapter_score > 0.05:
                matches.append({"type": "chapter", "course_id": course["id"], "chapter_id": chapter["id"], "title": chapter["title"], "excerpt": chapter.get("summary", "")[:180], "score": round(chapter_score, 4)})
            for lesson in chapter.get("lessons", []):
                haystack = f"{lesson.get('title', '')} {lesson.get('content_markdown', '')}".casefold()
                lesson_score = cosine(query_vector, embed_text(haystack)) + (0.8 if needle in haystack else 0)
                if lesson_score > 0.05:
                    matches.append({
                        "type": "lesson",
                        "course_id": course["id"],
                        "lesson_id": lesson["id"],
                        "title": lesson["title"],
                        "chapter": chapter["title"],
                        "excerpt": lesson.get("content_markdown", "").replace("#", "")[:180],
                        "score": round(lesson_score, 4),
                    })
    matches.sort(key=lambda item: item["score"], reverse=True)
    return {"query": q, "count": len(matches), "mode": "semantic+keyword", "results": matches[:30]}


@app.get(f"{settings.api_prefix}/history", tags=["learning"])
async def learning_history(user: CurrentUser = Depends(get_current_user)) -> dict:
    return {
        "documents": [_without_private_document_fields(item) for item in demo_store.list_documents(user.id)],
        "courses": [_course_summary(item, user.id) for item in demo_store.list_courses(user.id)],
        "progress": [item for item in demo_store.progress.values() if item["user_id"] == user.id],
        "chat_messages": [item for item in demo_store.messages if item["user_id"] == user.id],
        "quiz_attempts": [item for item in demo_store.attempts if item["user_id"] == user.id],
    }


@app.post(f"{settings.api_prefix}/ai/flashcards", tags=["ai"])
async def generate_flashcards(request: FlashcardRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    course = demo_store.get_course(request.course_id, user.id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    lessons = [lesson for chapter in course["chapters"] for lesson in chapter["lessons"] if request.chapter_id in {None, chapter["id"]}]
    cards: list[dict] = []
    for lesson in lessons:
        takeaways = lesson.get("takeaways") or [lesson.get("content_markdown", "").replace("#", " ").strip()[:220]]
        for takeaway in takeaways:
            if takeaway:
                cards.append({
                    "id": f"{lesson['id']}-{len(cards)}",
                    "front": f"What is a key idea from “{lesson['title']}”?",
                    "back": takeaway,
                    "source_pages": lesson.get("source_pages", []),
                })
    if not cards:
        raise HTTPException(status_code=409, detail="No lesson content is available for flashcards")
    repeated = (cards * ((request.count + len(cards) - 1) // len(cards)))[: request.count]
    return {"course_id": request.course_id, "cards": repeated}


@app.post(f"{settings.api_prefix}/ai/summary", tags=["ai"])
async def course_summary_tool(request: CourseToolRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    return summarize_course(_owned_course(request.course_id, user.id))


@app.post(f"{settings.api_prefix}/ai/mind-map", tags=["ai"])
async def course_mind_map(request: CourseToolRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    return build_mind_map(_owned_course(request.course_id, user.id))


@app.post(f"{settings.api_prefix}/ai/diagram", tags=["ai"])
async def course_diagram(request: CourseToolRequest, user: CurrentUser = Depends(get_current_user)) -> dict:
    return build_diagram(_owned_course(request.course_id, user.id))


@app.get(f"{settings.api_prefix}/courses/{{course_id}}/export", tags=["courses"])
async def export_course(course_id: str, format: str = Query(default="markdown", pattern="^(markdown|json)$"), user: CurrentUser = Depends(get_current_user)) -> Response:
    course = _owned_course(course_id, user.id)
    if format == "json":
        return Response(export_json(course), media_type="application/json", headers={"Content-Disposition": f'attachment; filename="coursecraft-{course_id}.json"'})
    return Response(export_markdown(course), media_type="text/markdown; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="coursecraft-{course_id}.md"'})


@app.post(f"{settings.api_prefix}/courses/{{course_id}}/certificate", tags=["learning"])
async def create_certificate(course_id: str, request: CertificateRequest, user: CurrentUser = Depends(get_current_user)) -> Response:
    course = _owned_course(course_id, user.id)
    if course["summary"]["progress_percent"] < 100:
        raise HTTPException(status_code=409, detail="Complete every lesson to unlock the certificate")
    payload = certificate_pdf(course, request.learner_name or user.name or user.email or "CourseCraft learner")
    return Response(payload, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="coursecraft-certificate-{course_id}.pdf"'})


@app.get(f"{settings.api_prefix}/dashboard", tags=["learning"])
async def dashboard(user: CurrentUser = Depends(get_current_user)) -> dict:
    courses = demo_store.list_courses(user.id)
    summaries = [_course_summary(item, user.id) for item in courses]
    progress = [item for item in demo_store.progress.values() if item["user_id"] == user.id]
    attempts = [item for item in demo_store.attempts if item["user_id"] == user.id]
    return {
        "active_courses": len(courses),
        "minutes_learned": round(sum(item.get("seconds_spent", 0) for item in progress) / 60),
        "quiz_average": round(mean(item["percentage"] for item in attempts)) if attempts else 0,
        "streak_days": min(7, len({item["updated_at"][:10] for item in progress})),
        "completed_lessons": sum(item["completed_lessons"] for item in summaries),
        "recent_courses": summaries[:3],
    }
