# Unstop assignment requirements matrix

Audit date: 16 July 2026. This matrix maps the exact brief to implementation and verification evidence.

## Core requirements

| Requirement | Status | Implementation / evidence |
| --- | --- | --- |
| Google, GitHub, email authentication | Complete | Supabase OAuth/password screen, OAuth callback session capture, JWT propagation, backend JWT validation |
| Personal dashboard and history | Complete | `/dashboard`, `/history`, Overview, Learning history; user ownership is enforced in every lookup |
| PDF upload and extraction | Complete | 50 MB validation, PDF signature check, multipage `pypdf` extraction, page metadata, chunking, actionable OCR error |
| AI course generation | Complete | Title, description, time, objectives, prerequisites, difficulty, chapters, lessons, explanations, notes, examples, summaries, takeaways, citations |
| Progress and resume | Complete | Lesson completion, time and last position model, chapter/course percentage, next incomplete lesson, Firestore + GCS persistence |
| Context-aware AI companion | Complete | Source-only RAG prompt, semantic retrieval, history context, citations, suggested prompts, true SSE token streaming |
| Quizzes | Complete | Multiple choice, true/false, short answer, scoring, correct-answer review, explanations, persisted attempts |
| Dashboard analytics | Complete | Active courses, recent courses, completion, time, quiz average, completed lessons, learning streak |
| Search | Complete | Debounced semantic + keyword search across courses, chapters, topics/lessons, objectives, and content |
| Complete history | Complete | PDFs, generated courses, progress, chat messages, and quiz attempts with a dedicated UI |
| Responsive modern frontend | Complete | Premium minimal dark UI; desktop, tablet, and mobile breakpoints; accessible labels and reduced motion |
| Deployment and documentation | Complete | GitHub Pages frontend, Cloud Run API, Firestore/GCS persistence, Docker, OpenAPI, environment/deployment docs |

## Bonus requirements

| Bonus | Status | Implementation |
| --- | --- | --- |
| RAG | Complete | Page-aware retrieval and source-only generation with citations |
| Semantic search | Complete | Deterministic semantic feature embeddings + cosine ranking, blended with keyword matches |
| Vector database/index | Complete | Hosted vector index stored with source chunks; pgvector production migration included |
| Flashcards | Complete | Source-cited recall deck and interactive flip/review modal |
| AI mind maps | Complete | `/ai/mind-map` graph API and responsive map visualization |
| Certificates | Complete | Server-generated PDF certificate, locked until 100% completion |
| Audio narration / TTS | Complete | Browser speech synthesis with controlled overview narration |
| Dark mode | Complete | Purpose-built premium dark design system across all surfaces |
| PDF summarization | Complete | Source-page-aware executive summary endpoint and rendered Markdown modal |
| Multi-language | Complete | Six-language generation selector and multilingual companion workflow |
| Streaming chat | Complete | Provider streaming API to FastAPI SSE to progressive React rendering |
| Course export | Complete | Downloadable Markdown and JSON exports |
| Markdown rendering | Complete | Safe structured renderer for course lessons, chat, and summaries |
| AI diagrams | Complete | Learning-progression diagram API and responsive visualization |

## Automated verification

- Backend: 27 API/service/persistence tests.
- Frontend: 10 build, behavior-contract, SSR, and health tests.
- Static analysis: ESLint clean.
- Production build: Vinext/Vite build clean.
- Live acceptance: health, OpenAPI, upload/generation, semantic search, streaming chat, progress, quiz, bonus APIs, export, and responsive UI.

