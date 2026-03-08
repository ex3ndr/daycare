ALTER TABLE users
ALTER COLUMN configuration SET DEFAULT '{"homeReady": false, "appReady": false}'::jsonb;

UPDATE users
SET configuration = jsonb_build_object(
    'homeReady',
    COALESCE((configuration ->> 'showHome')::boolean, (configuration ->> 'homeReady')::boolean, false),
    'appReady',
    COALESCE((configuration ->> 'showApp')::boolean, (configuration ->> 'appReady')::boolean, false)
)
WHERE configuration IS NOT NULL;
