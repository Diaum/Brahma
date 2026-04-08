-- Atualizar todos os episódios existentes para formato vertical (Instagram)
update episodes set format = '9:16' where format = '16:9';
