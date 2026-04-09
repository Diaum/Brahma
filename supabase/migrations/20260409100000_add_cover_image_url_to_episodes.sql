-- Adicionar coluna cover_image_url na tabela episodes
alter table episodes add column if not exists cover_image_url text;
