ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parameters text;
ALTER TABLE tasks_cron ADD COLUMN IF NOT EXISTS parameters text;
ALTER TABLE tasks_heartbeat ADD COLUMN IF NOT EXISTS parameters text;
