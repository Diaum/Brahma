-- Carousels: armazena carrosseis salvos por personagem
create table if not exists carousels (
  id uuid default gen_random_uuid() primary key,
  character_id uuid not null references characters(id) on delete cascade,
  name text not null,
  slides jsonb not null default '[]'::jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table carousels enable row level security;

drop policy if exists "Allow all on carousels" on carousels;
create policy "Allow all on carousels" on carousels for all using (true) with check (true);
