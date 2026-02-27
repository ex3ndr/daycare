ALTER TABLE users ADD COLUMN IF NOT EXISTS timezone text;

ALTER TABLE tasks_cron ADD COLUMN IF NOT EXISTS timezone text;
UPDATE tasks_cron
SET timezone = 'UTC'
WHERE timezone IS NULL OR btrim(timezone) = '';
ALTER TABLE tasks_cron ALTER COLUMN timezone SET DEFAULT 'UTC';
ALTER TABLE tasks_cron ALTER COLUMN timezone SET NOT NULL;
