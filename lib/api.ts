export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type DocumentRecord = {
  id: string;
  filename: string;
  size_bytes: number;
  page_count: number;
  status: string;
  created_at: string;
};

export type CourseSummary = {
  id: string;
  document_id: string;
  title: string;
  description: string;
  difficulty: string;
  estimated_minutes: number;
  language: string;
  status: string;
  objectives: string[];
  prerequisites: string[];
  chapter_count: number;
  lesson_count: number;
  completed_lessons: number;
  progress_percent: number;
  filename?: string;
  page_count: number;
  created_at: string;
  updated_at: string;
};

export type Lesson = {
  id: string;
  chapter_id: string;
  position: number;
  title: string;
  content_markdown: string;
  takeaways: string[];
  important_notes: string[];
  examples: Array<{ title?: string; content?: string } | string>;
  summary: string;
  source_pages: number[];
  estimated_minutes: number;
  completed: boolean;
  seconds_spent: number;
  last_position: number;
};

export type Chapter = {
  id: string;
  course_id: string;
  position: number;
  title: string;
  summary: string;
  lessons: Lesson[];
};

export type CourseDetail = Omit<CourseSummary, "chapter_count" | "lesson_count" | "completed_lessons" | "progress_percent"> & {
  user_id: string;
  chapters: Chapter[];
  document: DocumentRecord | null;
  summary: CourseSummary;
};

export type DashboardMetrics = {
  active_courses: number;
  minutes_learned: number;
  quiz_average: number;
  streak_days: number;
  completed_lessons: number;
  recent_courses: CourseSummary[];
};

export type Citation = { page: number; excerpt: string };
export type ChatResponse = { answer: string; citations: Citation[]; suggestions: string[] };

export type QuizQuestion = {
  id: string;
  format: "multiple_choice" | "true_false" | "short_answer";
  question: string;
  options: string[];
  answer: number | string;
  accepted_answers?: string[];
  explanation: string;
  source_pages: number[];
};

export type QuizPayload = { chapter_id: string; title: string; questions: QuizQuestion[] };
export type Flashcard = { id: string; front: string; back: string; source_pages: number[] };
export type SearchResult = { type: "course" | "chapter" | "lesson"; course_id: string; chapter_id?: string; lesson_id?: string; title: string; excerpt: string; score: number };
export type LearningHistory = { documents: DocumentRecord[]; courses: CourseSummary[]; progress: Array<{ lesson_id: string; completed: boolean; updated_at: string }>; chat_messages: Array<{ id: string; course_id: string; role: string; content: string; created_at: string }>; quiz_attempts: Array<{ id: string; chapter_id: string; percentage: number; created_at: string }> };
export type CourseSummaryTool = { course_id: string; title: string; markdown: string; source_pages: number[] };
export type MindMap = { course_id: string; title: string; nodes: Array<{ id: string; label: string; kind: "course" | "chapter" | "lesson" }>; edges: Array<{ source: string; target: string }> };
export type CourseDiagram = { course_id: string; title: string; steps: Array<{ id: string; label: string; detail: string }>; connections: Array<{ source: string; target: string; label: string }> };

function sessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.sessionStorage.getItem("coursecraft_session") || window.localStorage.getItem("coursecraft_session");
    return stored ? JSON.parse(stored).access_token ?? null : null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = sessionToken();
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const payload = await response.json();
      message = payload.detail ?? payload.message ?? message;
    } catch {
      // Keep the status-based fallback for non-JSON failures.
    }
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function download(path: string, init: RequestInit, filename: string): Promise<void> {
  const token = sessionToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try { message = (await response.json()).detail ?? message; } catch { /* use fallback */ }
    throw new ApiError(message, response.status);
  }
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export const coursecraftApi = {
  dashboard: () => request<DashboardMetrics>("/dashboard"),
  listCourses: () => request<CourseSummary[]>("/courses"),
  getCourse: (courseId: string) => request<CourseDetail>(`/courses/${courseId}`),
  deleteCourse: (courseId: string) => request<void>(`/courses/${courseId}`, { method: "DELETE" }),
  listDocuments: () => request<DocumentRecord[]>("/documents"),
  uploadDocument: (file: File) => {
    const data = new FormData();
    data.append("file", file);
    return request<DocumentRecord>("/documents", { method: "POST", body: data });
  },
  generateCourse: (documentId: string, depth: "quick" | "balanced" | "mastery", language = "en") =>
    request<CourseDetail>("/courses/generate", {
      method: "POST",
      body: JSON.stringify({ document_id: documentId, depth, language }),
    }),
  updateProgress: (lessonId: string, completed: boolean, secondsSpent = 0, lastPosition = 0) =>
    request<{ lesson_id: string; completed: boolean }>("/progress", {
      method: "PUT",
      body: JSON.stringify({ lesson_id: lessonId, completed, seconds_spent: secondsSpent, last_position: lastPosition }),
    }),
  chat: (courseId: string, message: string, history: Array<{ role: string; content: string }>, lessonId?: string) =>
    request<ChatResponse>("/chat", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, message, lesson_id: lessonId, history }),
    }),
  streamChat: async (courseId: string, message: string, history: Array<{ role: string; content: string }>, lessonId: string | undefined, onToken: (token: string) => void) => {
    const token = sessionToken();
    const response = await fetch(`${API_URL}/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ course_id: courseId, message, lesson_id: lessonId, history }),
    });
    if (!response.ok || !response.body) throw new ApiError(`Streaming chat failed (${response.status})`, response.status);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete: ChatResponse = { answer: "", citations: [], suggestions: [] };
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const kind = event.match(/^event: (.+)$/m)?.[1];
        const raw = event.match(/^data: (.+)$/m)?.[1];
        if (!raw) continue;
        const payload = JSON.parse(raw);
        if (kind === "token") onToken(payload.token);
        if (kind === "complete") complete = { answer: payload.answer, citations: payload.citations, suggestions: [] };
      }
      if (done) break;
    }
    return complete;
  },
  getMessages: (courseId: string) => request<Array<{ id: string; role: string; content: string; citations: Citation[] }>>(`/courses/${courseId}/messages`),
  generateQuiz: (chapterId: string, questionCount = 5) =>
    request<QuizPayload>("/quizzes/generate", {
      method: "POST",
      body: JSON.stringify({ chapter_id: chapterId, question_count: questionCount }),
    }),
  saveQuizAttempt: (chapterId: string, score: number, total: number, answers: Array<{ question_id: string; answer: number | string }>) =>
    request<{ id: string; percentage: number }>("/quizzes/attempts", {
      method: "POST",
      body: JSON.stringify({ chapter_id: chapterId, score, total, answers }),
    }),
  search: (query: string) => request<{ query: string; count: number; mode: string; results: SearchResult[] }>(`/search?q=${encodeURIComponent(query)}`),
  history: () => request<LearningHistory>("/history"),
  flashcards: (courseId: string, chapterId?: string, count = 10) =>
    request<{ course_id: string; cards: Flashcard[] }>("/ai/flashcards", {
      method: "POST",
      body: JSON.stringify({ course_id: courseId, chapter_id: chapterId, count }),
    }),
  summarize: (courseId: string) => request<CourseSummaryTool>("/ai/summary", { method: "POST", body: JSON.stringify({ course_id: courseId }) }),
  mindMap: (courseId: string) => request<MindMap>("/ai/mind-map", { method: "POST", body: JSON.stringify({ course_id: courseId }) }),
  diagram: (courseId: string) => request<CourseDiagram>("/ai/diagram", { method: "POST", body: JSON.stringify({ course_id: courseId }) }),
  exportCourse: (courseId: string, format: "markdown" | "json") => download(`/courses/${courseId}/export?format=${format}`, {}, `coursecraft-course.${format === "markdown" ? "md" : "json"}`),
  certificate: (courseId: string, learnerName = "Jay Chhichhia") => download(`/courses/${courseId}/certificate`, { method: "POST", body: JSON.stringify({ learner_name: learnerName }) }, "coursecraft-certificate.pdf"),
};
