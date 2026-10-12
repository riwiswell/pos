-- Keep shopping list update timestamps consistent with other Personal OS records.
-- set_updated_at() is introduced by 20261004090000_personal_os_life_graph.sql.
drop trigger if exists shopping_lists_updated_at on public.shopping_lists;
create trigger shopping_lists_updated_at
before update on public.shopping_lists
for each row execute function public.set_updated_at();
