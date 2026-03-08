ALTER TABLE users
ADD COLUMN configuration JSONB NOT NULL DEFAULT '{"showHome": false, "showApp": false}'::jsonb;
