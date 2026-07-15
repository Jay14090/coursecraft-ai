# Demo script — 6 to 8 minutes

## 1. Open with the outcome (30 seconds)

“CourseCraft turns any dense PDF into a guided learning experience you can actually finish. It does more than summarize: it creates a structured curriculum, remembers progress, tests understanding, and keeps every AI answer grounded in the source.”

Start on **Overview**. Briefly point out resume state, learning streak, time, quiz average, and the personalized learning insight.

## 2. Create a course (60 seconds)

Select **Create from PDF** → **Try the demo document** → **Balanced** → **Generate course**.

Explain the hidden pipeline while the progress state runs: page-aware extraction, semantic chunking, structured generation, citations, quizzes, and pgvector indexing.

## 3. Show the course library (45 seconds)

Open **My courses**. Point out persistent progress, time estimates, difficulty, and cross-course search. Mention that every record is user-owned through Supabase Auth and row-level security.

## 4. Teach inside the learning room (2 minutes)

Open **Building Reliable Generative AI Systems**. Show:

- Chapter/topic/lesson hierarchy.
- Resume position and completion state.
- Explanation, diagram, code example, key takeaway, and page citation.
- Responsive reading surface and notes action.

Mark the lesson complete to demonstrate progress persistence.

## 5. Ask the companion (60 seconds)

Ask: “Explain this with a real-world analogy.”

Call out that the answer is retrieved from the uploaded PDF, carries page citations, preserves recent conversation context, and explicitly declines when evidence is missing.

## 6. Complete a checkpoint (60 seconds)

Select **Take chapter quiz**, answer the three questions, and show the result state. Mention the full API supports multiple choice, true/false, and short-answer formats with explanations and stored attempts.

## 7. Show bonus depth (45 seconds)

Open **AI studio**. Show cross-library questioning, flashcards, translation/simplification, audio lessons, and exam sprints. These are intentionally presented as workflows instead of scattered novelty features.

## 8. Close on engineering quality (30 seconds)

Show the API documentation and repository structure. Mention FastAPI, PostgreSQL/Supabase, pgvector RAG, provider adapters for Groq/OpenRouter, row-level security, deterministic demo mode, automated tests, Docker, and deployment configuration.

Close with: “The goal was not only to make course generation work—it was to make the result feel like a product people would choose to learn in.”
