ALTER TABLE agents ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS config text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS next_sub_index integer NOT NULL DEFAULT 0;
--> statement-breakpoint
UPDATE agents
SET path = CASE
    WHEN type = 'system' THEN '/system/' || COALESCE(NULLIF((descriptor::jsonb ->> 'tag'), ''), id)
    WHEN type = 'user' THEN '/' || user_id || '/' || COALESCE(NULLIF((descriptor::jsonb ->> 'connector'), ''), 'connector')
    WHEN type = 'cron' THEN '/' || user_id || '/cron/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'task' THEN '/' || user_id || '/task/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'permanent' THEN '/' || user_id || '/agent/' || COALESCE(NULLIF((descriptor::jsonb ->> 'name'), ''), id)
    WHEN type = 'subuser' THEN '/' || user_id || '/subuser/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'subagent' THEN '/' || user_id || '/sub/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'app' THEN '/' || user_id || '/sub/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-agent' THEN '/' || user_id || '/memory/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-search' THEN '/' || user_id || '/search/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    ELSE '/' || user_id || '/agent/' || id
END
WHERE path IS NULL;
--> statement-breakpoint
UPDATE agents
SET config = descriptor
WHERE config IS NULL;
--> statement-breakpoint
WITH active_ranked AS (
    SELECT
        id,
        version,
        ROW_NUMBER() OVER (
            PARTITION BY path
            ORDER BY updated_at DESC, created_at DESC, version DESC, id DESC
        ) AS row_num
    FROM agents
    WHERE valid_to IS NULL AND path IS NOT NULL AND trim(path) <> ''
),
duplicates AS (
    SELECT id, version
    FROM active_ranked
    WHERE row_num > 1
)
UPDATE agents AS agent
SET valid_to = GREATEST(agent.valid_from, agent.updated_at)
FROM duplicates
WHERE agent.id = duplicates.id
  AND agent.version = duplicates.version
  AND agent.valid_to IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_path_active ON agents (path) WHERE valid_to IS NULL;
