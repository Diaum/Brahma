-- Adicionar video_url e video_operation na tabela shots
alter table shots add column if not exists video_url text;
alter table shots add column if not exists video_operation text;
