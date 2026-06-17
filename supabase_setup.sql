-- 1. Enable the pgvector extension to support vector data types
create extension if not exists vector;

-- 2. Create the documents table to store uploaded file metadata
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid references chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  mime_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create the document_chunks table to store file text chunks and their embeddings
create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  chat_id uuid references chats(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  embedding vector(768), -- gemini-embedding-2 configured to 768 dimensions
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Enable Row Level Security (RLS) on both tables
alter table documents enable row level security;
alter table document_chunks enable row level security;

-- 5. RLS Policies for documents table
create policy "Users can view their own documents"
  on documents for select
  using (auth.uid() = user_id);

create policy "Users can insert their own documents"
  on documents for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own documents"
  on documents for delete
  using (auth.uid() = user_id);

-- 6. RLS Policies for document_chunks table
create policy "Users can view their own document chunks"
  on document_chunks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own document chunks"
  on document_chunks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own document chunks"
  on document_chunks for delete
  using (auth.uid() = user_id);

-- 7. Define match_document_chunks RPC function for cosine similarity search
create or replace function match_document_chunks (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  filter_chat_id uuid,
  filter_user_id uuid
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  similarity float
)
language sql stable
as $$
  select
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    1 - (document_chunks.embedding <=> query_embedding) as similarity
  from document_chunks
  where document_chunks.chat_id = filter_chat_id
    and document_chunks.user_id = filter_user_id
    and 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  order by document_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- 8. Policies for the "documents" storage bucket (Make sure the bucket 'documents' is created in Supabase Dashboard first)
-- Run these storage policy creations:
create policy "Allow authenticated uploads to documents bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Allow owners to read documents bucket objects"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Allow owners to delete documents bucket objects"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
