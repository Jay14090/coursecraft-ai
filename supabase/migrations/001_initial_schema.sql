create extension if not exists vector;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  filename text not null,
  storage_key text not null,
  size_bytes bigint not null,
  page_count integer not null default 0,
  status text not null default 'uploaded' check (status in ('uploaded','processing','ready','failed')),
  created_at timestamptz not null default now()
);

create table public.document_chunks (
  id bigserial primary key,
  document_id uuid not null references public.documents(id) on delete cascade,
  page_number integer not null,
  position integer not null,
  content text not null,
  embedding vector(1536),
  unique(document_id, position)
);
create index document_chunks_embedding_idx on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_id uuid not null unique references public.documents(id) on delete cascade,
  title text not null,
  description text not null,
  objectives jsonb not null default '[]',
  prerequisites jsonb not null default '[]',
  difficulty text not null,
  estimated_minutes integer not null,
  language text not null default 'en',
  status text not null default 'generating',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text not null,
  position integer not null,
  unique(course_id, position)
);

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  content_markdown text not null,
  takeaways jsonb not null default '[]',
  examples jsonb not null default '[]',
  source_pages jsonb not null default '[]',
  estimated_minutes integer not null default 10,
  position integer not null,
  unique(chapter_id, position)
);

create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  seconds_spent integer not null default 0,
  last_position integer not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  score numeric not null,
  total integer not null,
  answers jsonb not null,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger courses_set_updated_at
  before update on public.courses
  for each row execute procedure public.set_updated_at();

create trigger progress_set_updated_at
  before update on public.progress
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;
alter table public.chat_messages enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "Users manage own profiles" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users manage own documents" on public.documents for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own courses" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own document chunks" on public.document_chunks for all
  using (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid()))
  with check (exists (select 1 from public.documents d where d.id = document_id and d.user_id = auth.uid()));
create policy "Users read own chapters" on public.chapters for select
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "Users read own lessons" on public.lessons for select
  using (exists (
    select 1 from public.chapters ch
    join public.courses c on c.id = ch.course_id
    where ch.id = chapter_id and c.user_id = auth.uid()
  ));
create policy "Users manage own progress" on public.progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own chats" on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own quiz attempts" on public.quiz_attempts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.match_document_chunks(
  query_embedding vector(1536), match_document uuid, match_count integer default 6
) returns table(id bigint, page_number integer, content text, similarity float)
language sql stable as $$
  select dc.id, dc.page_number, dc.content, 1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.document_id = match_document
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload own PDFs" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users read own PDFs" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users update own PDFs" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Users delete own PDFs" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
