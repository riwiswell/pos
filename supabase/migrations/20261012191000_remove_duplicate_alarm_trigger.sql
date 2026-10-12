-- The earlier alarm_notification_job trigger was superseded by
-- alarms_sync_notification_job. Remove the old sender so every alarm mutation
-- regenerates its pending notification exactly once.
drop trigger if exists alarm_notification_job on public.alarms;
