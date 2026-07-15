# Architecture

## Design goals

CourseCraft is designed around four qualities: grounded output, fast perceived progress, durable learning state, and replaceable infrastructure. Demo mode is deliberately isolated from the production path so reviewers can explore the product without keys while the production architecture remains credible.

## Document-to-course pipeline

1. The API validates file type and size before processing.
2. `pypdf` extracts each page independently so page provenance is never lost.
3. The chunker uses page boundaries, semantic break points, and controlled overlap.
4. The original file is stored privately; metadata and status live in PostgreSQL.
5. An LLM receives the normalized document and a strict instructional-design schema.
6. The generated course is validated, then persisted as course → chapters → lessons.
7. Lesson source-page references are preserved for explanations and citations.
8. Chunk embeddings are written to pgvector for semantic retrieval.

Long-running generation should move to a background queue in production. The API already exposes a `202 Accepted` contract so a worker can be added without changing the client flow.

## Grounded companion

The companion does not ask a model to answer from memory. It:

1. Embeds the current question.
2. Retrieves a broad evidence set from the user's course document.
3. Reranks for relevance and source diversity.
4. Creates the smallest sufficient context package.
5. Generates within a source-only system instruction.
6. Returns page-level citations and suggested follow-ups.

Demo mode uses a deterministic lexical retriever. Production uses the included pgvector schema and `match_document_chunks` function.

## Security and ownership

- Supabase Auth issues access tokens; FastAPI validates the JWT.
- Every data table is user-owned and protected with row-level security.
- PDFs live in a private Storage bucket and are addressed by opaque keys.
- The service-role key is backend-only.
- Upload limits and content-type checks run before extraction.
- Course and chat lookups verify ownership server-side.
- Secrets are loaded exclusively through environment variables.

## Failure handling

- Unreadable and encrypted PDFs return an actionable `422` response.
- Oversized PDFs return `413`; non-PDF uploads return `415`.
- Generation state is explicit: uploaded, processing, ready, or failed.
- AI providers are accessed through a small adapter, enabling retries and fallback.
- A deterministic demo provider keeps the product testable when external AI is unavailable.

## Scale path

- Move extraction/generation to a queue (Cloud Tasks, Celery, or Supabase Queues).
- Store chunk embeddings in pgvector with IVFFlat/HNSW indexes.
- Cache generated course trees at the API edge.
- Stream chat tokens over Server-Sent Events.
- Track model latency, token use, retrieval hit rate, and citation coverage.
- Partition high-volume chat and analytics tables by month.
