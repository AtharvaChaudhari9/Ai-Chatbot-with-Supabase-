-- Create a new profiles table to store customized user profiles
create table if not exists profiles (
  id uuid primary key, -- maps to the authenticated user UUID
  nickname text,       -- customized user display name
  avatar_url text,     -- customized profile picture URL or base64 data URI
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS) on profiles
alter table profiles enable row level security;

-- Create RLS Policies for secure access
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);
