-- Install update timestamp triggers only after the shared function and tables exist.
-- Each migration version must be unique for Supabase CLI ordering.
do $$
declare t text;
begin
  foreach t in array array[
    'shopping_lists',
    'journal_entries',
    'medications',
    'medication_doses'
  ] loop
    execute format('drop trigger if exists %I_updated_at on public.%I',t,t);
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t,t
    );
  end loop;
end
$$;
