# CourseCraft

CourseCraft turns dense PDFs into focused, interactive learning experiences. Upload a research paper, book, study guide, or technical document and the platform produces a structured course with grounded lessons, citations, quizzes, progress tracking, semantic search, and an AI companion that answers from the source.

This repository is the submission for the **Full Stack AI Assignment — PDF to E-Course Learning Platform**.

## What makes this submission different

- A premium, original learning interface built for sustained focus—not a generic admin template.
- A zero-configuration demo mode that presents the full product without requiring private credentials.
- A production-shaped FastAPI service with validated uploads, PDF extraction, course generation, grounded chat, quizzes, and progress APIs.
- A relational PostgreSQL/Supabase schema with row-level security and pgvector semantic retrieval.
- Provider-agnostic, OpenAI-compatible AI integration for Groq and OpenRouter.
- Source-aware responses and page citations to keep AI explanations inspectable.
- Bonus study modes: flashcards, translation/simplification, audio lessons, exam sprints, summaries, and dark mode.

## Product experience

| Surface | Highlights |
| --- | --- |
| Overview | Resume learning, personal metrics, streak, weekly pulse, AI learning insight |
| PDF conversion | Drag-and-drop, quick/balanced/mastery depth, visible generation stages |
| Course library | Progress, difficulty, time estimates, search, responsive cards |
| Learning room | Structured outline, rich lesson content, citations, notes, completion state |
| AI companion | Lesson-aware chat, grounded citations, follow-up prompts, quiz-on-demand |
| Checkpoints | Multiple choice flow, scoring, explanations, retry and continue states |
| AI studio | Cross-library questions, flashcards, translation, audio, revision planning |

## Architecture

```text
Browser / Next.js + Vinext
        │
        ├── Supabase Auth (Google, GitHub, email/password)
        │
        ▼
FastAPI service ───── Groq / OpenRouter
        │                    │
        ├── PDF extraction   └── structured generation + grounded answers
        │
        ▼
Supabase PostgreSQL + pgvector ─── Supabase Storage
  courses, lessons, progress,       original PDFs
  chat, quizzes, embeddings
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the detailed data and request flows.

## Run locally

### Web application

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

The product opens in zero-config demo mode. Every key interaction is available: create from PDF, course navigation, learning room, chatbot, quiz, course library, and AI studio.

### API

Requirements: Python 3.12.

```bash
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload --port 8000
```

Interactive API documentation is available at `http://localhost:8000/docs`.

### Full local stack

```bash
copy .env.example .env
docker compose up --build
```

## Configure real services

Copy `.env.example` to `.env` and provide:

- Supabase URL, anon key, service-role key, and JWT secret.
- A Groq or OpenRouter API key.
- `LLM_PROVIDER=groq` or `LLM_PROVIDER=openrouter`.
- `DEMO_MODE=false`.

Apply `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor. Create a private Storage bucket named `documents`, then enable the desired Auth providers.

No secrets are committed. The web experience and API both have deterministic demo behavior when credentials are absent.

## API summary

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/documents` | Validate, extract, and chunk a PDF |
| `POST` | `/api/v1/courses/generate` | Generate a structured, cited course |
| `GET` | `/api/v1/courses` | List the signed-in user's courses |
| `GET` | `/api/v1/courses/{id}` | Return the complete course tree |
| `PUT` | `/api/v1/progress` | Persist completion, time, and reading position |
| `POST` | `/api/v1/chat` | Answer from retrieved PDF evidence |
| `POST` | `/api/v1/quizzes/generate` | Create a chapter checkpoint |
| `POST` | `/api/v1/quizzes/attempts` | Persist a scored quiz attempt |
| `GET` | `/api/v1/search` | Search courses, chapters, lessons, and keywords |
| `GET` | `/api/v1/history` | Return documents, courses, progress, chats, and quizzes |
| `POST` | `/api/v1/ai/flashcards` | Generate a source-aware flashcard deck |
| `GET` | `/api/v1/dashboard` | Return learning metrics and recent courses |

## Quality checks

```bash
npm run build
npm test
npm run lint

cd backend
pytest
```

The frontend includes server-render smoke tests and a health-route test. The backend includes API health, validation, and dashboard tests.

## Deployment plan

- Web: GitHub Pages through `.github/workflows/deploy-pages.yml` and Vinext static export.
- API: Railway using `backend/Dockerfile`, with `COURSECRAFT_API_URL` configured as a GitHub repository variable.
- Database, Auth, Storage, vector search: Supabase.
- AI: Groq for fast inference, with OpenRouter as a drop-in alternative.

The deployment workflow keeps frontend configuration in GitHub repository variables and backend secrets in Railway.

## Demo presentation

Use [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a concise 6–8 minute walkthrough that covers every required evaluation area without losing the narrative.
