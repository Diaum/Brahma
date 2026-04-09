-- Atualizar episódios existentes para terem ordem sequencial baseada em created_at
with ordered as (
  select id, row_number() over (partition by character_id order by created_at asc) - 1 as new_order
  from episodes
)
update episodes
set "order" = ordered.new_order
from ordered
where episodes.id = ordered.id;
