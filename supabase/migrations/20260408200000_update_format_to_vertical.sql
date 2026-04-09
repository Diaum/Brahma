-- Atualizar todos os episódios existentes para formato 16:9
update episodes set format = '16:9' where format = '9:16';
