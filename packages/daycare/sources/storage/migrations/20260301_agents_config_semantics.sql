ALTER TABLE agents ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'agent';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_role text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connector_name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id text;

WITH classified AS (
    SELECT
        id,
        version,
        split_part(trim(both '/' from path), '/', 1) AS s1,
        split_part(trim(both '/' from path), '/', 2) AS s2,
        split_part(trim(both '/' from path), '/', 3) AS s3
    FROM agents
)
UPDATE agents AS a
SET kind = CASE
    WHEN c.s1 = 'system' THEN 'system'
    WHEN c.s3 = 'sub' THEN 'sub'
    WHEN c.s3 = 'search' THEN 'search'
    WHEN c.s2 = 'memory' OR c.s3 = 'memory' THEN 'memory'
    WHEN c.s2 = 'agent' AND c.s3 = 'swarm' THEN 'swarm'
    WHEN c.s2 = 'agent' THEN 'agent'
    WHEN c.s2 = 'cron' THEN 'cron'
    WHEN c.s2 = 'task' THEN 'task'
    WHEN c.s2 = 'subuser' THEN 'subuser'
    ELSE 'connector'
END
FROM classified AS c
WHERE a.id = c.id
  AND a.version = c.version;

UPDATE agents
SET model_role = CASE
    WHEN kind IN ('connector', 'agent', 'swarm', 'subuser') THEN 'user'
    WHEN kind = 'sub' THEN 'subagent'
    WHEN kind = 'memory' THEN 'memory'
    WHEN kind = 'search' THEN 'memorySearch'
    WHEN kind = 'task' THEN 'task'
    ELSE NULL
END
WHERE model_role IS NULL;

WITH classified AS (
    SELECT
        id,
        version,
        split_part(trim(both '/' from path), '/', 2) AS s2
    FROM agents
)
UPDATE agents AS a
SET connector_name = CASE
    WHEN a.kind = 'connector' THEN NULLIF(c.s2, '')
    ELSE NULL
END
FROM classified AS c
WHERE a.id = c.id
  AND a.version = c.version;

UPDATE agents AS child
SET parent_agent_id = parent.id
FROM agents AS parent
WHERE child.valid_to IS NULL
  AND parent.valid_to IS NULL
  AND parent.user_id = child.user_id
  AND parent.path = CASE
      WHEN child.kind IN ('sub', 'search') THEN regexp_replace(child.path, '/[^/]+/[^/]+$', '')
      WHEN child.kind = 'memory' AND child.path LIKE '%/memory' THEN regexp_replace(child.path, '/memory$', '')
      ELSE NULL
  END;

UPDATE agents
SET parent_agent_id = NULL
WHERE kind NOT IN ('sub', 'search', 'memory');

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents (parent_agent_id) WHERE valid_to IS NULL;
