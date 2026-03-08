ALTER TABLE users
ADD COLUMN configuration JSONB NOT NULL DEFAULT '{"homeReady": false, "appReady": false}'::jsonb;
