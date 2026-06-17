-- 1. Create ocr_benchmarks table
create table if not exists ocr_benchmarks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create ocr_benchmark_results table
create table if not exists ocr_benchmark_results (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid references ocr_benchmarks(id) on delete cascade,
  engine_name text not null,
  
  -- Scores
  speed_score float check (speed_score between 0 and 100),
  extraction_score float check (extraction_score between 0 and 100),
  chunk_quality_score float check (chunk_quality_score between 0 and 100),
  retrieval_score float check (retrieval_score between 0 and 100),
  resource_score float check (resource_score between 0 and 100),
  overall_score float check (overall_score between 0 and 100),
  
  -- Raw values
  processing_time float,
  character_count int,
  word_count int,
  chunk_count int,
  memory_usage float, -- RAM peak MB
  cpu_usage float, -- CPU average %
  
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Enable RLS (Row Level Security)
alter table ocr_benchmarks enable row level security;
alter table ocr_benchmark_results enable row level security;

-- 4. RLS Policies for ocr_benchmarks
create policy "Users can view their own ocr benchmarks"
  on ocr_benchmarks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own ocr benchmarks"
  on ocr_benchmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own ocr benchmarks"
  on ocr_benchmarks for delete
  using (auth.uid() = user_id);

-- 5. RLS Policies for ocr_benchmark_results
create policy "Users can view ocr benchmark results for their own benchmarks"
  on ocr_benchmark_results for select
  using (
    exists (
      select 1 from ocr_benchmarks
      where ocr_benchmarks.id = ocr_benchmark_results.benchmark_id
        and ocr_benchmarks.user_id = auth.uid()
    )
  );

create policy "Users can insert ocr benchmark results for their own benchmarks"
  on ocr_benchmark_results for insert
  with check (
    exists (
      select 1 from ocr_benchmarks
      where ocr_benchmarks.id = ocr_benchmark_results.benchmark_id
        and ocr_benchmarks.user_id = auth.uid()
    )
  );

-- 6. Helper Indexes for performance optimization
create index if not exists idx_ocr_benchmarks_user_id on ocr_benchmarks(user_id);
create index if not exists idx_ocr_benchmark_results_benchmark_id on ocr_benchmark_results(benchmark_id);
