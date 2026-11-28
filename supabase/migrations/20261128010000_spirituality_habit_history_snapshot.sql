-- Preserve Ricardo's legacy spirituality habit logs before the habits are removed.
-- Snapshot rows are intentionally NOT foreign-keyed to habits or habit_logs:
-- deleting the old habits later must not cascade into this spiritual history.

alter table public.spiritual_entries
  add column if not exists legacy_source_habit_id uuid,
  add column if not exists legacy_source_log_id uuid,
  add column if not exists legacy_completed boolean;

create unique index if not exists spiritual_entries_legacy_source_log_uidx
  on public.spiritual_entries(legacy_source_log_id)
  where legacy_source_log_id is not null;

-- Idempotent backfill for Ricardo only. Keep completed=false rows too so that
-- the historical record is faithful; the UI labels them as unmarked, not failures.
insert into public.spiritual_entries (
  user_id,
  entry_date,
  kind,
  title,
  content,
  prayer_answered,
  fasting,
  legacy_source_habit_id,
  legacy_source_log_id,
  legacy_completed,
  created_at,
  updated_at
)
select
  hl.user_id,
  hl.date,
  case h.name
    when 'Oración diaria' then 'prayer'
    when 'Ir a la Iglesia' then 'church'
    when 'Servir' then 'service'
  end,
  case h.name
    when 'Oración diaria' then 'Oración (historial anterior)'
    when 'Ir a la Iglesia' then 'Asistencia al culto (historial anterior)'
    when 'Servir' then 'Servicio (historial anterior)'
  end,
  nullif(hl.note, ''),
  null,
  false,
  hl.habit_id,
  hl.id,
  coalesce(hl.completed, false),
  coalesce(hl.created_at, now()),
  coalesce(hl.updated_at, hl.created_at, now())
from public.habit_logs hl
join public.habits h on h.id = hl.habit_id and h.user_id = hl.user_id
where hl.user_id = '524c4bcb-d521-4af2-97c7-032faa1a01f7'::uuid
  and hl.habit_id in (
    '462507cc-d18a-405c-9309-90334b12614a'::uuid,
    '9a770c02-ce5e-43cd-94bd-41305edce959'::uuid,
    '7d07ff1b-742b-485f-b1e2-e125e6d0d0d3'::uuid
  )
on conflict (legacy_source_log_id) where legacy_source_log_id is not null
do nothing;

create index if not exists spiritual_entries_user_date_idx
  on public.spiritual_entries(user_id, entry_date desc);
