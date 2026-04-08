-- Brahma v0.1.0 — Schema inicial do banco de dados
-- Ref: Issue #3 / PRD #1

-- ============================================================
-- 1. Tabelas
-- ============================================================

-- Personagem (characters)
create table if not exists characters (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  age integer not null,
  description_pt text not null,
  prompt_base_en text not null,
  created_at timestamp with time zone default now()
);

-- Imagem de referência (character_references)
create table if not exists character_references (
  id uuid default gen_random_uuid() primary key,
  character_id uuid not null references characters(id) on delete cascade,
  image_url text not null,
  approved boolean default false,
  created_at timestamp with time zone default now()
);

-- Episódio (episodes)
create table if not exists episodes (
  id uuid default gen_random_uuid() primary key,
  character_id uuid not null references characters(id) on delete cascade,
  title text not null,
  script text,
  format text not null default '16:9' check (format in ('16:9', '9:16', '1:1')),
  "order" integer not null default 0,
  created_at timestamp with time zone default now()
);

-- Shot (shots)
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

-- ============================================================
-- 2. Row Level Security (RLS)
-- ============================================================

alter table characters enable row level security;
alter table character_references enable row level security;
alter table episodes enable row level security;
alter table shots enable row level security;

-- Políticas públicas — cada usuário roda sua própria instância Supabase
drop policy if exists "Allow all on characters" on characters;
create policy "Allow all on characters" on characters for all using (true) with check (true);
drop policy if exists "Allow all on character_references" on character_references;
create policy "Allow all on character_references" on character_references for all using (true) with check (true);
drop policy if exists "Allow all on episodes" on episodes;
create policy "Allow all on episodes" on episodes for all using (true) with check (true);
drop policy if exists "Allow all on shots" on shots;
create policy "Allow all on shots" on shots for all using (true) with check (true);

-- ============================================================
-- 3. Storage — bucket público para imagens
-- ============================================================

insert into storage.buckets (id, name, public)
values ('brahma-images', 'brahma-images', true)
on conflict (id) do nothing;

-- Política: leitura pública
drop policy if exists "Public read access on brahma-images" on storage.objects;
create policy "Public read access on brahma-images"
  on storage.objects for select
  using (bucket_id = 'brahma-images');

-- Política: upload público (instância single-user)
drop policy if exists "Public upload access on brahma-images" on storage.objects;
create policy "Public upload access on brahma-images"
  on storage.objects for insert
  with check (bucket_id = 'brahma-images');

-- Política: update público
drop policy if exists "Public update access on brahma-images" on storage.objects;
create policy "Public update access on brahma-images"
  on storage.objects for update
  using (bucket_id = 'brahma-images');

-- Política: delete público
drop policy if exists "Public delete access on brahma-images" on storage.objects;
create policy "Public delete access on brahma-images"
  on storage.objects for delete
  using (bucket_id = 'brahma-images');
