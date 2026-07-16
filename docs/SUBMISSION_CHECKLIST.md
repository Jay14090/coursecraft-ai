# Submission checklist

## Links

- [x] Frontend: `https://jay14090.github.io/coursecraft-ai/`
- [x] Backend: `https://coursecraft-api-974359049072.us-central1.run.app`
- [x] API documentation: `https://coursecraft-api-974359049072.us-central1.run.app/docs`
- [x] Repository: `https://github.com/Jay14090/coursecraft-ai`

## Repository deliverables

- [x] Frontend source is included.
- [x] Backend source is included.
- [x] Database schema, pgvector search function, RLS policies, and storage policies are included.
- [x] Docker and deployment configuration are included.
- [x] `.env.example` documents every variable; no credentials are committed.
- [x] README includes setup, architecture, API summary, tests, and deployment notes.
- [x] Exact assignment requirement matrix is included.
- [x] Automated tests cover core and bonus workflows.

## Live demo sequence

- [ ] Open the sign-in page; show Google, GitHub, and email options.
- [ ] Open the preview workspace and point out dashboard/history persistence.
- [ ] Upload the included three-page PDF or a real multi-page PDF.
- [ ] Select a generation depth and language; generate the course.
- [ ] Show objectives, prerequisites, difficulty, outline, lesson content, examples, notes, summary, and citations.
- [ ] Mark a lesson complete and refresh to prove persisted progress.
- [ ] Ask the companion a source question and show streamed text plus page citations.
- [ ] Run a chapter quiz and show MCQ, true/false, short answer, score, correct answers, and explanations.
- [ ] Search for a concept and show course/chapter/lesson semantic results.
- [ ] Open Learning history and show PDFs, progress, chat, and quiz attempts.
- [ ] Open AI studio and demonstrate flashcards, summary, mind map, diagram, translation, audio, export, and certificate lock/unlock.
- [ ] Resize to mobile width and show responsive navigation and learning UI.

## Screenshots / recording

- [ ] Capture dashboard.
- [ ] Capture PDF upload and generation-ready state.
- [ ] Capture lesson view with citation.
- [ ] Capture streamed companion answer.
- [ ] Capture quiz answer review.
- [ ] Capture Learning history.
- [ ] Capture AI studio bonus suite and one generated artifact.
- [ ] Record a 6-8 minute walkthrough using `docs/DEMO_SCRIPT.md`.

## Final verification before sending

- [x] Backend test suite passes.
- [x] Frontend test suite passes.
- [x] Lint passes.
- [x] Production frontend build passes.
- [x] Live API acceptance test passes after the latest deployment (19/19 checks).
- [x] Live GitHub Pages acceptance passes: dashboard, auth screen, semantic search, history, AI studio, and generated summary were verified in-browser.
- [x] Confirmed no credential pattern appears in the Git diff or repository; server secrets remain in Google Secret Manager.
- [ ] Put the four final links and demo video in the Unstop submission form.
