ALTER TABLE users
ALTER COLUMN configuration SET DEFAULT '{"homeReady": false, "appReady": false, "bootstrapStarted": false}'::jsonb;

UPDATE users
SET configuration = configuration || '{"bootstrapStarted": false}'::jsonb
WHERE NOT (configuration ? 'bootstrapStarted');
