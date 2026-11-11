-- Optional goals for video games in the learning library.
alter table public.learning_items
  add column if not exists goal_description text,
  add column if not exists goal_date date;

alter table public.learning_items
  drop constraint if exists learning_items_goal_description_check;
alter table public.learning_items
  add constraint learning_items_goal_description_check
  check (goal_description is null or length(goal_description) <= 240);
