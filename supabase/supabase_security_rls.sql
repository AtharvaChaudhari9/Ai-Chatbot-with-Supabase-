-- SQL Migration: Enable Row Level Security (RLS) on all tables
-- This blocks public anonymous access (e.g. from the public PostgREST API)
-- while allowing the secure Next.js server (using Service Role Client) to query all rows.

-- 1. Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 2. Enable RLS on Chats
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

-- 3. Enable RLS on Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on Custom Agents
ALTER TABLE public.custom_agents ENABLE ROW LEVEL SECURITY;

-- 5. Enable RLS on Documents (RAG)
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 6. Enable RLS on OCR Benchmarks
ALTER TABLE public.ocr_benchmarks ENABLE ROW LEVEL SECURITY;

-- 7. Enable RLS on OCR Benchmark Results
ALTER TABLE public.ocr_benchmark_results ENABLE ROW LEVEL SECURITY;

-- Note: Because our Next.js backend accesses the database exclusively via the 
-- Supabase Service Role (admin) client, the service role key automatically bypasses 
-- these RLS rules. No individual SELECT/INSERT/UPDATE/DELETE policies are needed, 
-- and all anonymous public queries (via client-side anon key) will be safely blocked.
