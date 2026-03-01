ALTER TABLE agents ADD COLUMN IF NOT EXISTS foreground integer NOT NULL DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS workspace_dir text;

UPDATE agents
SET path = CASE
    WHEN path IS NOT NULL AND trim(path) <> '' THEN path
    WHEN type = 'system' THEN '/system/' || COALESCE(NULLIF((descriptor::jsonb ->> 'tag'), ''), id)
    WHEN type = 'user' THEN '/' || user_id || '/' || COALESCE(NULLIF((descriptor::jsonb ->> 'connector'), ''), 'connector')
    WHEN type = 'cron' THEN '/' || user_id || '/cron/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'task' THEN '/' || user_id || '/task/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'permanent' THEN '/' || user_id || '/agent/' || COALESCE(NULLIF((descriptor::jsonb ->> 'name'), ''), id)
    WHEN type = 'subuser' THEN '/' || user_id || '/subuser/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'subagent' THEN '/' || user_id || '/sub/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-agent' THEN '/' || user_id || '/memory/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-search' THEN '/' || user_id || '/search/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'swarm' THEN '/' || user_id || '/agent/swarm'
    ELSE '/' || user_id || '/agent/' || id
END
WHERE path IS NULL OR trim(path) = '';

UPDATE agents
SET foreground = CASE
    WHEN config IS NOT NULL AND trim(config) <> '' THEN
        CASE
            WHEN lower(COALESCE(config::jsonb ->> 'foreground', '')) IN ('1', 'true', 'yes', 'on') THEN 1
            ELSE 0
        END
    WHEN type = 'user' OR type = 'swarm' THEN 1
    ELSE 0
END,
name = COALESCE(
    NULLIF(config::jsonb ->> 'name', ''),
    NULLIF(descriptor::jsonb ->> 'name', ''),
    name
),
description = COALESCE(
    NULLIF(config::jsonb ->> 'description', ''),
    NULLIF(descriptor::jsonb ->> 'description', ''),
    description
),
system_prompt = COALESCE(
    NULLIF(config::jsonb ->> 'systemPrompt', ''),
    NULLIF(descriptor::jsonb ->> 'systemPrompt', ''),
    system_prompt
),
workspace_dir = COALESCE(
    NULLIF(config::jsonb ->> 'workspaceDir', ''),
    NULLIF(descriptor::jsonb ->> 'workspaceDir', ''),
    workspace_dir
)
WHERE config IS NOT NULL OR descriptor IS NOT NULL;

ALTER TABLE agents ALTER COLUMN path SET NOT NULL;

ALTER TABLE agents DROP COLUMN IF EXISTS type;
ALTER TABLE agents DROP COLUMN IF EXISTS descriptor;
ALTER TABLE agents DROP COLUMN IF EXISTS config;
