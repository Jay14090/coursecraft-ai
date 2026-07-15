from typing import Literal

from pydantic import BaseModel, Field


class GenerateCourseRequest(BaseModel):
    document_id: str
    depth: Literal["quick", "balanced", "mastery"] = "balanced"
    language: str = "en"


class ProgressUpdate(BaseModel):
    lesson_id: str
    completed: bool = True
    seconds_spent: int = Field(default=0, ge=0)
    last_position: int = Field(default=0, ge=0)


class ChatRequest(BaseModel):
    course_id: str
    message: str = Field(min_length=1, max_length=4_000)
    lesson_id: str | None = None
    history: list[dict[str, str]] = Field(default_factory=list, max_length=20)


class QuizRequest(BaseModel):
    chapter_id: str
    question_count: int = Field(default=5, ge=3, le=15)
    formats: list[Literal["multiple_choice", "true_false", "short_answer"]] = Field(default_factory=lambda: ["multiple_choice", "true_false"])


class QuizAttemptRequest(BaseModel):
    chapter_id: str
    score: float = Field(ge=0)
    total: int = Field(ge=1)
    answers: list[dict]


class FlashcardRequest(BaseModel):
    course_id: str
    chapter_id: str | None = None
    count: int = Field(default=10, ge=5, le=30)


class HealthResponse(BaseModel):
    status: Literal["healthy"]
    service: str
    mode: str
    ai_provider: str
