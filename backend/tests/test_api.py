from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

from app.main import app
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
