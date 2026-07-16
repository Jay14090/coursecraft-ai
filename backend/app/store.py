from copy import deepcopy
from datetime import datetime, timezone
import json
from pathlib import Path
from threading import RLock
from typing import Any
from uuid import uuid4


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class DemoStore:
    """Thread-safe local repository used by preview mode and automated tests.

    The public API mirrors the production repository contract so the frontend
    exercises the same workflow in local preview mode: PDF -> document ->
    generated course -> lessons -> progress, chat, quizzes, and history.
    """

    def __init__(self) -> None:
        self._lock = RLock()
        self._persist_path: Path | None = None
        self._cloud_blob: Any | None = None
        self._firestore_document: Any | None = None
        self.reset(seed=True)

    def _restore(self, payload: dict) -> None:
        self.documents = payload.get("documents", {})
        self.courses = payload.get("courses", {})
        self.progress = payload.get("progress", {})
        self.messages = payload.get("messages", [])
        self.attempts = payload.get("attempts", [])

    def configure_persistence(self, path: str) -> None:
        with self._lock:
            self._persist_path = Path(path).expanduser().resolve()
            if self._persist_path.exists():
                try:
                    payload = json.loads(self._persist_path.read_text(encoding="utf-8"))
                    self._restore(payload)
                    return
                except (OSError, json.JSONDecodeError, TypeError):
                    pass
            self._persist()

    def configure_cloud_blob(self, blob: Any) -> None:
        """Attach a small JSON object store used by serverless preview deployments."""
        with self._lock:
            self._cloud_blob = blob
            try:
                if blob.exists():
                    self._restore(json.loads(blob.download_as_text(encoding="utf-8")))
                    return
            except (OSError, json.JSONDecodeError, TypeError, ValueError):
                pass
            self._persist()

    def configure_gcs(self, bucket_name: str, object_name: str) -> None:
        from google.cloud import storage

        client = storage.Client()
        self.configure_cloud_blob(client.bucket(bucket_name).blob(object_name))

    def configure_firestore(self, collection_name: str, document_name: str) -> None:
        """Mirror durable learning metadata to a managed document database.

        Raw PDF text and vector chunks stay in object storage so the Firestore
        document remains comfortably below its size limit.
        """
        from google.cloud import firestore

        self._firestore_document = firestore.Client().collection(collection_name).document(document_name)
        self._persist()

    def configure_firestore_document(self, document: Any) -> None:
        self._firestore_document = document
        self._persist()

    def _database_snapshot(self) -> dict:
        documents = {
            identifier: {key: value for key, value in record.items() if key not in {"text", "chunks"}}
            for identifier, record in self.documents.items()
        }
        return {
            "documents": documents,
            "courses": self.courses,
            "progress": self.progress,
            "messages": self.messages[-500:],
            "attempts": self.attempts[-500:],
            "updated_at": _now(),
            "schema_version": 1,
        }

    def _persist(self) -> None:
        if not self._persist_path and not self._cloud_blob and not self._firestore_document:
            return
        serialized = json.dumps({
            "documents": self.documents,
            "courses": self.courses,
            "progress": self.progress,
            "messages": self.messages,
            "attempts": self.attempts,
        }, ensure_ascii=False)
        if self._persist_path:
            self._persist_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = self._persist_path.with_suffix(self._persist_path.suffix + ".tmp")
            temporary.write_text(serialized, encoding="utf-8")
            temporary.replace(self._persist_path)
        if self._cloud_blob:
            self._cloud_blob.upload_from_string(serialized, content_type="application/json")
        if self._firestore_document:
            self._firestore_document.set(self._database_snapshot())

    def reset(self, *, seed: bool = True) -> None:
        with self._lock:
            self.documents: dict[str, dict] = {}
            self.courses: dict[str, dict] = {}
            self.progress: dict[str, dict] = {}
            self.messages: list[dict] = []
            self.attempts: list[dict] = []
            if seed:
                self._seed_course()
            self._persist()

    def _seed_course(self) -> None:
        document = self.create_document(
            user_id="demo-user",
            filename="building-reliable-generative-ai-systems.pdf",
            size_bytes=428_640,
            page_count=48,
            status="processed",
            text="Reliable AI systems combine retrieval, evaluation, observability, and safety.",
            chunks=[
                {"text": "A retrieval loop encodes intent, retrieves evidence, composes context, and generates a cited answer.", "page": 18, "position": 0},
                {"text": "The smallest sufficient context is usually more precise than the largest available context.", "page": 19, "position": 1},
                {"text": "Grounded answers should connect important claims to inspectable source citations.", "page": 20, "position": 2},
            ],
        )
        self.create_course({
            "user_id": "demo-user",
            "document_id": document["id"],
            "title": "Building Reliable Generative AI Systems",
            "description": "Architecture, retrieval, evaluation, and the production patterns behind dependable AI products.",
            "objectives": ["Design grounded retrieval workflows", "Evaluate quality systematically", "Ship resilient AI features"],
            "prerequisites": ["Basic Python", "Familiarity with APIs"],
            "difficulty": "Advanced",
            "estimated_minutes": 240,
            "language": "en",
            "status": "ready",
            "chapters": [
                {
                    "title": "Foundations",
                    "summary": "Models, systems, and constraints",
                    "lessons": [
                        {
                            "title": "The model is not the product",
                            "content_markdown": "## Systems over demos\n\nReliable products combine models with retrieval, evaluation, observability, and careful failure handling.",
                            "takeaways": ["Treat the model as one component", "Design failure states deliberately"],
                            "examples": [],
                            "source_pages": [1, 2],
                            "estimated_minutes": 12,
                        }
                    ],
                },
                {
                    "title": "Retrieval systems",
                    "summary": "Ground answers in source evidence",
                    "lessons": [
                        {
                            "title": "Building the retrieval loop",
                            "content_markdown": "## Retrieve before reasoning\n\nEncode intent, retrieve candidates, rerank for precision, compose the smallest sufficient context, and generate an answer with citations.\n\n## Coverage before precision\n\nThe first pass should favor recall. A reranker then narrows the evidence package to the passages that most directly answer the question.",
                            "takeaways": ["Favor recall, then rerank for precision", "Keep citations attached to source pages"],
                            "examples": [{"title": "Four-stage loop", "content": "Question -> Retrieve -> Compose -> Generate"}],
                            "source_pages": [18, 19, 20],
                            "estimated_minutes": 17,
                        },
                        {
                            "title": "Evaluating grounded answers",
                            "content_markdown": "## Evidence first\n\nA useful evaluation checks retrieval coverage, citation correctness, faithfulness, and answer relevance.",
                            "takeaways": ["Measure retrieval and generation separately"],
                            "examples": [],
                            "source_pages": [21, 22],
                            "estimated_minutes": 14,
                        },
                    ],
                },
            ],
        })

    def create_document(self, **values) -> dict:
        with self._lock:
            identifier = str(uuid4())
            record = {"id": identifier, "created_at": _now(), **values}
            self.documents[identifier] = record
            self._persist()
            return deepcopy(record)

    def update_document(self, document_id: str, **values) -> dict | None:
        with self._lock:
            record = self.documents.get(document_id)
            if not record:
                return None
            record.update(values)
            self._persist()
            return deepcopy(record)

    def get_document(self, document_id: str, user_id: str) -> dict | None:
        record = self.documents.get(document_id)
        return deepcopy(record) if record and record["user_id"] == user_id else None

    def list_documents(self, user_id: str) -> list[dict]:
        return deepcopy([item for item in self.documents.values() if item["user_id"] == user_id])

    def delete_document(self, document_id: str, user_id: str) -> bool:
        with self._lock:
            document = self.documents.get(document_id)
            if not document or document["user_id"] != user_id:
                return False
            course_ids = [item["id"] for item in self.courses.values() if item["document_id"] == document_id]
            for course_id in course_ids:
                self.delete_course(course_id, user_id)
            del self.documents[document_id]
            self._persist()
            return True

    def create_course(self, course: dict) -> dict:
        with self._lock:
            identifier = str(uuid4())
            created_at = _now()
            chapters: list[dict] = []
            for chapter_position, chapter in enumerate(course.get("chapters", [])):
                chapter_id = str(uuid4())
                lessons: list[dict] = []
                for lesson_position, lesson in enumerate(chapter.get("lessons", [])):
                    lessons.append({
                        "id": str(uuid4()),
                        "chapter_id": chapter_id,
                        "position": lesson_position,
                        "title": lesson.get("title") or f"Lesson {lesson_position + 1}",
                        "content_markdown": lesson.get("content_markdown", ""),
                        "takeaways": lesson.get("takeaways", []),
                        "important_notes": lesson.get("important_notes", []),
                        "examples": lesson.get("examples", []),
                        "summary": lesson.get("summary", ""),
                        "source_pages": lesson.get("source_pages", []),
                        "estimated_minutes": max(1, int(lesson.get("estimated_minutes", 10))),
                    })
                chapters.append({
                    "id": chapter_id,
                    "course_id": identifier,
                    "position": chapter_position,
                    "title": chapter.get("title") or f"Chapter {chapter_position + 1}",
                    "summary": chapter.get("summary", ""),
                    "lessons": lessons,
                })
            record = {
                "id": identifier,
                "created_at": created_at,
                "updated_at": created_at,
                **{key: value for key, value in course.items() if key != "chapters"},
                "chapters": chapters,
            }
            self.courses[identifier] = record
            self.update_document(record["document_id"], status="ready")
            self._persist()
            return self.get_course(identifier, record["user_id"]) or deepcopy(record)

    def list_courses(self, user_id: str | None = None) -> list[dict]:
        items = list(self.courses.values())
        if user_id is not None:
            items = [item for item in items if item["user_id"] == user_id]
        return deepcopy(sorted(items, key=lambda item: item["updated_at"], reverse=True))

    def get_course(self, course_id: str, user_id: str) -> dict | None:
        course = self.courses.get(course_id)
        if not course or course["user_id"] != user_id:
            return None
        result = deepcopy(course)
        for chapter in result["chapters"]:
            for lesson in chapter["lessons"]:
                saved = self.progress.get(f"{user_id}:{lesson['id']}", {})
                lesson["completed"] = bool(saved.get("completed", False))
                lesson["seconds_spent"] = int(saved.get("seconds_spent", 0))
                lesson["last_position"] = int(saved.get("last_position", 0))
        return result

    def delete_course(self, course_id: str, user_id: str) -> bool:
        with self._lock:
            course = self.courses.get(course_id)
            if not course or course["user_id"] != user_id:
                return False
            lesson_ids = {lesson["id"] for chapter in course["chapters"] for lesson in chapter["lessons"]}
            for key in list(self.progress):
                if key.split(":", 1)[-1] in lesson_ids:
                    del self.progress[key]
            self.messages = [item for item in self.messages if item["course_id"] != course_id]
            del self.courses[course_id]
            self._persist()
            return True

    def find_lesson(self, lesson_id: str, user_id: str) -> tuple[dict, dict, dict] | None:
        for course in self.courses.values():
            if course["user_id"] != user_id:
                continue
            for chapter in course["chapters"]:
                for lesson in chapter["lessons"]:
                    if lesson["id"] == lesson_id:
                        return course, chapter, lesson
        return None

    def find_chapter(self, chapter_id: str, user_id: str) -> tuple[dict, dict] | None:
        for course in self.courses.values():
            if course["user_id"] != user_id:
                continue
            for chapter in course["chapters"]:
                if chapter["id"] == chapter_id:
                    return course, chapter
        return None

    def save_progress(self, user_id: str, lesson_id: str, values: dict) -> dict:
        with self._lock:
            key = f"{user_id}:{lesson_id}"
            previous = self.progress.get(key, {})
            self.progress[key] = {
                "user_id": user_id,
                "lesson_id": lesson_id,
                "completed": values.get("completed", previous.get("completed", False)),
                "seconds_spent": values.get("seconds_spent", previous.get("seconds_spent", 0)),
                "last_position": values.get("last_position", previous.get("last_position", 0)),
                "updated_at": _now(),
            }
            self._persist()
            return deepcopy(self.progress[key])

    def add_message(self, **values) -> dict:
        with self._lock:
            record = {"id": str(uuid4()), "created_at": _now(), **values}
            self.messages.append(record)
            self._persist()
            return deepcopy(record)

    def list_messages(self, user_id: str, course_id: str) -> list[dict]:
        return deepcopy([item for item in self.messages if item["user_id"] == user_id and item["course_id"] == course_id])

    def add_attempt(self, **values) -> dict:
        with self._lock:
            record = {"id": str(uuid4()), "created_at": _now(), **values}
            self.attempts.append(record)
            self._persist()
            return deepcopy(record)


demo_store = DemoStore()
