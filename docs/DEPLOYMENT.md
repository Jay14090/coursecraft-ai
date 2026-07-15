# Deployment handoff

## 1. Supabase

1. Create a Supabase project.
2. Run `supabase/migrations/001_initial_schema.sql`.
3. Create a private Storage bucket named `documents`.
4. Enable Google, GitHub, and/or email authentication.
5. Record the project URL, anon key, service-role key, and JWT secret.

## 2. AI provider

Create a Groq or OpenRouter API key. Groq is the recommended default for fast demos. Set the provider, model, and key using the environment names in `.env.example`.

## 3. Backend

Deploy `backend/Dockerfile` to Google Cloud Run. Store `GROQ_API_KEY` in Secret Manager and run the service with a dedicated service account. For the public preview, set `DEMO_MODE=true`, `PREVIEW_GCS_BUCKET`, and `PREVIEW_GCS_OBJECT`; cap the service at one instance so the compact JSON preview repository has a single writer. Use a Cloud SQL or Supabase-backed repository before lifting that ceiling for production traffic.

Recommended guardrails:

- Request-based billing with `--min-instances=0`.
- `--max-instances=1`, `--concurrency=4`, and a 300-second request timeout.
- A private, uniform-access Cloud Storage bucket with only the runtime service account granted object access.
- `FRONTEND_URL=https://jay14090.github.io` so browser API access is limited to the GitHub Pages origin.
- A billing budget alert for the dedicated Google Cloud project.

After deployment, verify `/health`, `/docs`, `/api/v1/courses`, CORS, a real PDF upload, AI generation, chat, progress, and quiz submission against the Cloud Run URL.

## 4. Frontend

Set the GitHub repository variables `COURSECRAFT_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The Pages workflow maps `COURSECRAFT_API_URL` into `NEXT_PUBLIC_API_URL`, performs a static export under `/coursecraft-ai`, and deploys it with GitHub Actions.

## 5. Acceptance checklist

- Authentication works in a private/incognito window.
- A multi-page PDF uploads and reaches `ready` state.
- The generated lesson cites correct page numbers.
- Chat answers from the document and handles unsupported questions.
- Progress survives sign-out and sign-in.
- Quiz attempts appear on the dashboard.
- Desktop and mobile layouts pass a visual review.
- No secret is present in the frontend bundle or repository.
