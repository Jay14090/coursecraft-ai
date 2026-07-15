# Deployment handoff

Deployment is intentionally paused until approval.

## 1. Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Create a private Storage bucket named `documents`.
4. Enable Google, GitHub, and/or email authentication.
5. Record the project URL, anon key, service-role key, and JWT secret.

## 2. AI provider

Create a Groq or OpenRouter API key. Groq is the recommended default for fast demos. Set the provider, model, and key using the environment names in `.env.example`.

## 3. Backend

Create a Render web service from `render.yaml` or deploy `backend/Dockerfile` to Railway/Fly.io. Add all backend secrets, set `DEMO_MODE=false`, and verify `/health` and `/docs`.

## 4. Frontend

Set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Build and publish only after the API and allowed CORS origin use the final domains.

## 5. Acceptance checklist

- Authentication works in a private/incognito window.
- A multi-page PDF uploads and reaches `ready` state.
- The generated lesson cites correct page numbers.
- Chat answers from the document and handles unsupported questions.
- Progress survives sign-out and sign-in.
- Quiz attempts appear on the dashboard.
- Desktop and mobile layouts pass a visual review.
- No secret is present in the frontend bundle or repository.
