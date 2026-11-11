-- Finalize the Bible book linkage after the legacy cycle schema has been extended.
-- Preserve pre-existing cycles and free-reading entries.

create or replace function public.ensure_bible_learning_item_owner()
returns trigger
language plpgsql
as $$
begin
  if new.learning_item_id is null or not exists (
    select 1
      from public.learning_items li
     where li.id = new.learning_item_id
       and li.user_id = new.user_id
       and li.kind = 'book'
       and lower(trim(li.title)) in ('la biblia','biblia')
  ) then
    raise exception 'El registro debe estar vinculado a La Biblia de tu propia cuenta.';
  end if;
  return new;
end;
$$;

drop trigger if exists bible_reading_cycles_validate_owner on public.bible_reading_cycles;
create trigger bible_reading_cycles_validate_owner
before insert or update of user_id, learning_item_id
on public.bible_reading_cycles
for each row execute function public.ensure_bible_learning_item_owner();

drop trigger if exists bible_free_readings_validate_owner on public.bible_free_readings;
create trigger bible_free_readings_validate_owner
before insert or update of user_id, learning_item_id
on public.bible_free_readings
for each row execute function public.ensure_bible_learning_item_owner();

-- Attach legacy free-reading history to the user's Bible book when one exists.
update public.bible_free_readings f
set learning_item_id = (
  select li.id
    from public.learning_items li
   where li.user_id = f.user_id
     and li.kind = 'book'
     and lower(trim(li.title)) in ('la biblia','biblia')
   order by li.created_at asc
   limit 1
)
where f.learning_item_id is null
  and exists (
    select 1
      from public.learning_items li
     where li.user_id = f.user_id
       and li.kind = 'book'
       and lower(trim(li.title)) in ('la biblia','biblia')
  );

create unique index if not exists bible_reading_one_active_cycle_per_book
  on public.bible_reading_cycles(user_id,learning_item_id)
  where status = 'active';

-- Existing default users start with the annual preference, but explicit choices
-- are never overwritten.
insert into public.bible_reading_preferences(user_id,mode)
select u.id,'annual_plan'
from auth.users u
where lower(coalesce(u.email,'')) in ('riwiswell@gmail.com','angiediaz456@gmail.com')
on conflict (user_id) do nothing;
