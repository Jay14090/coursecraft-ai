from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.main import app, provider
from app.store import DemoStore, demo_store


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_store() -> None:
    demo_store.reset(seed=True)


def make_pdf(*pages: str) -> bytes:
    buffer = BytesIO()
    document = canvas.Canvas(buffer)
    for page in pages:
        text = document.beginText(48, 790)
        for line in page.splitlines() or [""]:
            text.textLine(line)
        document.drawText(text)
        document.showPage()
    document.save()
    return buffer.getvalue()


def first_course() -> dict:
    response = client.get("/api/v1/courses")
    assert response.status_code == 200
    return response.json()[0]


def first_course_detail() -> dict:
    course = first_course()
    response = client.get(f"/api/v1/courses/{course['id']}")
    assert response.status_code == 200
    return response.json()


def test_health_reports_preview_and_ai_provider() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "CourseCraft API",
        "mode": "preview",
        "ai_provider": "demo",
        "persistence": "local",
    }


def test_dashboard_metrics_are_derived_from_store() -> None:
    response = client.get("/api/v1/dashboard")
    assert response.status_code == 200
    payload = response.json()
    assert payload["active_courses"] == 1
    assert payload["completed_lessons"] == 0
    assert payload["recent_courses"][0]["lesson_count"] == 3


def test_course_list_and_detail_contracts() -> None:
    summary = first_course()
    assert summary["progress_percent"] == 0
    assert summary["page_count"] == 48
    detail = first_course_detail()
    assert detail["summary"]["lesson_count"] == 3
    assert detail["chapters"][1]["lessons"][0]["source_pages"] == [18, 19, 20]
    assert "text" not in detail["document"]


def test_rejects_non_pdf_content_type() -> None:
    response = client.post("/api/v1/documents", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert response.status_code == 415


def test_rejects_pdf_extension_with_invalid_signature() -> None:
    response = client.post("/api/v1/documents", files={"file": ("fake.pdf", b"not a pdf", "application/pdf")})
    assert response.status_code == 422
    assert response.json()["detail"] == "The selected file is not a valid PDF"


def test_rejects_pdf_without_readable_text() -> None:
    response = client.post("/api/v1/documents", files={"file": ("blank.pdf", make_pdf(""), "application/pdf")})
    assert response.status_code == 422
    assert "No readable text" in response.json()["detail"]


def test_uploads_and_extracts_real_multi_page_pdf() -> None:
    payload = make_pdf("Retrieval uses source evidence.", "Citations keep claims inspectable.")
    response = client.post("/api/v1/documents", files={"file": ("retrieval.pdf", payload, "application/pdf")})
    assert response.status_code == 201
    document = response.json()
    assert document["filename"] == "retrieval.pdf"
    assert document["page_count"] == 2
    assert document["status"] == "processed"
    assert "text" not in document and "chunks" not in document


def test_document_to_course_generation_end_to_end() -> None:
    upload = client.post(
        "/api/v1/documents",
        files={"file": ("systems.pdf", make_pdf("Reliable systems retrieve, evaluate, and cite evidence."), "application/pdf")},
    )
    response = client.post("/api/v1/courses/generate", json={"document_id": upload.json()["id"], "depth": "quick", "language": "en"})
    assert response.status_code == 201
    course = response.json()
    assert course["title"] == "Building Reliable Generative AI Systems"
    assert course["summary"]["lesson_count"] >= 2
    assert course["document"]["status"] == "ready"


def test_generation_requires_an_owned_document() -> None:
    response = client.post("/api/v1/courses/generate", json={"document_id": "missing", "depth": "balanced"})
    assert response.status_code == 404


def test_progress_updates_course_completion() -> None:
    detail = first_course_detail()
    lesson_id = detail["chapters"][0]["lessons"][0]["id"]
    response = client.put("/api/v1/progress", json={"lesson_id": lesson_id, "completed": True, "seconds_spent": 180, "last_position": 12})
    assert response.status_code == 200
    assert response.json()["completed"] is True
    refreshed = client.get(f"/api/v1/courses/{detail['id']}").json()
    assert refreshed["chapters"][0]["lessons"][0]["completed"] is True
    assert refreshed["summary"]["completed_lessons"] == 1


def test_progress_rejects_unknown_lesson() -> None:
    response = client.put("/api/v1/progress", json={"lesson_id": "missing", "completed": True})
    assert response.status_code == 404


def test_source_grounded_chat_and_history() -> None:
    detail = first_course_detail()
    response = client.post("/api/v1/chat", json={"course_id": detail["id"], "message": "How does retrieval work?", "history": []})
    assert response.status_code == 200
    assert response.json()["citations"][0]["page"] in {18, 19, 20}
    messages = client.get(f"/api/v1/courses/{detail['id']}/messages").json()
    assert [item["role"] for item in messages] == ["user", "assistant"]


def test_chat_stays_grounded_when_the_ai_provider_is_rate_limited(monkeypatch) -> None:
    async def unavailable(*args, **kwargs) -> str:
        raise RuntimeError("provider rate limited")

    monkeypatch.setattr(provider, "complete", unavailable)
    detail = first_course_detail()
    response = client.post(
        "/api/v1/chat",
        json={"course_id": detail["id"], "message": "How does retrieval work?", "history": []},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "source evidence" in payload["answer"].lower()
    assert "Source: p." in payload["answer"]
    assert payload["citations"]


def test_search_finds_course_and_lesson_content() -> None:
    response = client.get("/api/v1/search", params={"q": "retrieval"})
    assert response.status_code == 200
    types = {item["type"] for item in response.json()["results"]}
    assert {"course", "lesson"}.issubset(types)


def test_quiz_generation_and_attempt_validation() -> None:
    detail = first_course_detail()
    chapter_id = detail["chapters"][1]["id"]
    quiz = client.post("/api/v1/quizzes/generate", json={"chapter_id": chapter_id, "question_count": 5})
    assert quiz.status_code == 200
    assert len(quiz.json()["questions"]) == 5
    invalid = client.post("/api/v1/quizzes/attempts", json={"chapter_id": chapter_id, "score": 6, "total": 5, "answers": []})
    assert invalid.status_code == 422
    saved = client.post("/api/v1/quizzes/attempts", json={"chapter_id": chapter_id, "score": 4, "total": 5, "answers": []})
    assert saved.status_code == 201
    assert saved.json()["percentage"] == 80.0


def test_flashcards_are_generated_from_lesson_takeaways() -> None:
    detail = first_course_detail()
    response = client.post("/api/v1/ai/flashcards", json={"course_id": detail["id"], "count": 5})
    assert response.status_code == 200
    assert len(response.json()["cards"]) == 5
    assert response.json()["cards"][0]["source_pages"]


def test_history_collects_learning_activity() -> None:
    detail = first_course_detail()
    lesson_id = detail["chapters"][0]["lessons"][0]["id"]
    client.put("/api/v1/progress", json={"lesson_id": lesson_id, "completed": True, "seconds_spent": 90})
    history = client.get("/api/v1/history")
    assert history.status_code == 200
    assert len(history.json()["documents"]) == 1
    assert len(history.json()["courses"]) == 1
    assert len(history.json()["progress"]) == 1


def test_deleting_course_removes_it_from_library() -> None:
    course = first_course()
    response = client.delete(f"/api/v1/courses/{course['id']}")
    assert response.status_code == 204
    assert client.get("/api/v1/courses").json() == []
    assert client.get(f"/api/v1/courses/{course['id']}").status_code == 404


def test_preview_repository_survives_a_process_restart(tmp_path) -> None:
    data_path = tmp_path / "preview-data.json"
    first = DemoStore()
    first.reset(seed=False)
    first.configure_persistence(str(data_path))
    created = first.create_document(
        user_id="demo-user",
        filename="persistent.pdf",
        size_bytes=512,
        page_count=1,
        status="processed",
        text="Durable state",
        chunks=[{"text": "Durable state", "page": 1, "position": 0}],
    )

    restarted = DemoStore()
    restarted.configure_persistence(str(data_path))

    restored = restarted.get_document(created["id"], "demo-user")
    assert restored is not None
    assert restored["filename"] == "persistent.pdf"
    assert data_path.exists()


def test_cloud_preview_repository_survives_a_serverless_restart() -> None:
    class MemoryBlob:
        payload: str | None = None

        def exists(self) -> bool:
            return self.payload is not None

        def download_as_text(self, encoding: str = "utf-8") -> str:
            assert encoding == "utf-8"
            assert self.payload is not None
            return self.payload

        def upload_from_string(self, payload: str, content_type: str) -> None:
            assert content_type == "application/json"
            self.payload = payload

    blob = MemoryBlob()
    first = DemoStore()
    first.reset(seed=False)
    first.configure_cloud_blob(blob)
    created = first.create_document(
        user_id="demo-user",
        filename="cloud-persistent.pdf",
        size_bytes=640,
        page_count=1,
        status="processed",
        text="Cloud durable state",
        chunks=[{"text": "Cloud durable state", "page": 1, "position": 0}],
    )

    restarted = DemoStore()
    restarted.configure_cloud_blob(blob)

    restored = restarted.get_document(created["id"], "demo-user")
    assert restored is not None
    assert restored["filename"] == "cloud-persistent.pdf"


def test_upload_builds_vector_embeddings_for_semantic_rag() -> None:
    response = client.post(
        "/api/v1/documents",
        files={"file": ("vectors.pdf", make_pdf("Neural retrieval connects meaning with evidence."), "application/pdf")},
    )
    assert response.status_code == 201
    stored = demo_store.get_document(response.json()["id"], "demo-user")
    assert stored is not None
    assert len(stored["chunks"][0]["embedding"]) == 192
    assert any(value != 0 for value in stored["chunks"][0]["embedding"])


def test_semantic_search_indexes_courses_chapters_and_lessons() -> None:
    response = client.get("/api/v1/search", params={"q": "grounded retrieval"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["mode"] == "semantic+keyword"
    assert {item["type"] for item in payload["results"]} >= {"course", "chapter", "lesson"}
    assert payload["results"] == sorted(payload["results"], key=lambda item: item["score"], reverse=True)


def test_quiz_includes_mcq_true_false_and_short_answer_with_review_data() -> None:
    chapter = first_course_detail()["chapters"][0]
    response = client.post("/api/v1/quizzes/generate", json={"chapter_id": chapter["id"], "question_count": 5})
    assert response.status_code == 200
    questions = response.json()["questions"]
    assert {item["format"] for item in questions} == {"multiple_choice", "true_false", "short_answer"}
    short_answer = next(item for item in questions if item["format"] == "short_answer")
    assert short_answer["answer"] == "source citations"
    assert short_answer["accepted_answers"]
    assert short_answer["explanation"]


def test_streaming_chat_emits_tokens_and_persists_complete_message() -> None:
    course = first_course()
    response = client.post("/api/v1/chat/stream", json={"course_id": course["id"], "message": "Explain retrieval", "history": []})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert "event: token" in response.text
    assert "event: complete" in response.text
    messages = client.get(f"/api/v1/courses/{course['id']}/messages").json()
    assert [message["role"] for message in messages[-2:]] == ["user", "assistant"]


def test_complete_bonus_tool_suite_and_exports() -> None:
    course = first_course_detail()
    course_id = course["id"]
    for endpoint, key in [("summary", "markdown"), ("mind-map", "nodes"), ("diagram", "steps")]:
        response = client.post(f"/api/v1/ai/{endpoint}", json={"course_id": course_id})
        assert response.status_code == 200
        assert response.json()[key]
    markdown = client.get(f"/api/v1/courses/{course_id}/export", params={"format": "markdown"})
    assert markdown.status_code == 200
    assert markdown.headers["content-type"].startswith("text/markdown")
    assert course["title"] in markdown.text
    exported_json = client.get(f"/api/v1/courses/{course_id}/export", params={"format": "json"})
    assert exported_json.status_code == 200
    assert exported_json.json()["id"] == course_id


def test_certificate_is_locked_then_downloads_as_valid_pdf_at_completion() -> None:
    course = first_course_detail()
    locked = client.post(f"/api/v1/courses/{course['id']}/certificate", json={"learner_name": "Jay"})
    assert locked.status_code == 409
    for chapter in course["chapters"]:
        for lesson in chapter["lessons"]:
            assert client.put("/api/v1/progress", json={"lesson_id": lesson["id"], "completed": True}).status_code == 200
    certificate = client.post(f"/api/v1/courses/{course['id']}/certificate", json={"learner_name": "Jay Chhichhia"})
    assert certificate.status_code == 200
    assert certificate.headers["content-type"] == "application/pdf"
    assert certificate.content.startswith(b"%PDF")


def test_firestore_mirror_excludes_raw_pdf_text_and_vectors() -> None:
    class MemoryDocument:
        payload: dict | None = None

        def set(self, payload: dict) -> None:
            self.payload = payload

    document = MemoryDocument()
    store = DemoStore()
    store.configure_firestore_document(document)
    assert document.payload is not None
    assert all("text" not in item and "chunks" not in item for item in document.payload["documents"].values())
    assert document.payload["courses"]
