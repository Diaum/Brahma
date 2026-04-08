-- Adicionar coluna cover_image_url na tabela characters
alter table characters add column if not exists cover_image_url text;
