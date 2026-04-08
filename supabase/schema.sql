-- Brahma Database Schema

-- Characters table
create table if not exists characters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  age integer not null,
  description_pt text not null,
  prompt_base_en text not null,
  created_at timestamp with time zone default now()
);

-- Character reference images
create table if not exists character_references (
  id uuid default gen_random_uuid() primary key,
  character_id uuid not null references characters(id) on delete cascade,
  image_url text not null,
  approved boolean default false,
  created_at timestamp with time zone default now()
);

-- Episodes
create table if not exists episodes (
  id uuid default gen_random_uuid() primary key,
  character_id uuid not null references characters(id) on delete cascade,
  title text not null,
  script text,
  format text not null default '16:9' check (format in ('16:9', '9:16', '1:1')),
  "order" integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Shots
create table if not exists shots (
  id uuid default gen_random_uuid() primary key,
  episode_id uuid not null references episodes(id) on delete cascade,
  prompt_scene text not null,
  prompt_full text not null,
  image_url text,
  reference_image_url text,
  status text not null default 'pending' check (status in ('pending', 'generated', 'approved', 'animated')),
  "order" integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Storage bucket for images (run via Supabase dashboard or API)
-- insert into storage.buckets (id, name, public) values ('brahma-images', 'brahma-images', true);

-- RLS policies
alter table characters enable row level security;
alter table character_references enable row level security;
alter table episodes enable row level security;
alter table shots enable row level security;

-- Public read/write for now (each user has their own Supabase instance)
create policy "Allow all on characters" on characters for all using (true) with check (true);
create policy "Allow all on character_references" on character_references for all using (true) with check (true);
create policy "Allow all on episodes" on episodes for all using (true) with check (true);
create policy "Allow all on shots" on shots for all using (true) with check (true);
