-- Personal OS: initialize the dashboard widget preference for existing and new profiles.
-- Before these settings existed, an empty JSON array meant "not configured", not "hide everything".
-- The UI stores an empty array only after the user deliberately hides all three widgets.
alter table public.profiles
  alter column dashboard_widgets
  set default '["planner","focus","habits"]'::jsonb;

update public.profiles
   set dashboard_widgets = '["planner","focus","habits"]'::jsonb
 where dashboard_widgets is null
    or dashboard_widgets = '[]'::jsonb;
