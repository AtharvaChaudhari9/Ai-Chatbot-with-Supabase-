-- 1. Create custom_agents table
create table if not exists custom_agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  avatar_url text, -- Store signed storage path or emoji representation
  system_prompt text,
  preferred_model text not null default 'gemini', -- 'gemini' or 'local'
  local_model_name text, -- Name of Ollama model e.g. 'llama3.2'
  conversation_starters text[] default '{}'::text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS)
alter table custom_agents enable row level security;

-- 3. Create RLS Policies for custom_agents table
create policy "Users can view their own agents"
  on custom_agents for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own agents"
  on custom_agents for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own agents"
  on custom_agents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own agents"
  on custom_agents for delete
  to authenticated
  using (auth.uid() = user_id);

-- 4. Alter chats table to link it to custom_agents
alter table chats 
  add column if not exists agent_id uuid references custom_agents(id) on delete set null;

-- 5. Alter documents table to link it to custom_agents (and make chat_id optional)
alter table documents 
  add column if not exists agent_id uuid references custom_agents(id) on delete cascade;

-- 6. Add policies for documents mapping custom_agents
-- Since documents table policies are already defined as (auth.uid() = user_id),
-- and any documents uploaded for an agent will have user_id set to the owner's id,
-- the existing RLS policies on documents will continue to work perfectly!

-- 7. Helper Indexes for performance optimization
create index if not exists idx_custom_agents_user_id on custom_agents(user_id);
create index if not exists idx_chats_agent_id on chats(agent_id);
create index if not exists idx_documents_agent_id on documents(agent_id);
