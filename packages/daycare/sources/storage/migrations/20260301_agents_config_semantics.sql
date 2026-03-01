ALTER TABLE agents ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_role text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connector_name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS foreground integer;

UPDATE agents
SET kind = 'agent'
WHERE kind IS NULL OR trim(kind) = '';

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

UPDATE agents
SET connector_name = NULL
WHERE connector_name IS NOT NULL
  AND trim(connector_name) = '';

UPDATE agents
SET parent_agent_id = NULL
WHERE parent_agent_id IS NOT NULL
  AND trim(parent_agent_id) = '';

UPDATE agents
SET connector_name = NULL
WHERE kind <> 'connector';

UPDATE agents
SET parent_agent_id = NULL
WHERE kind NOT IN ('sub', 'search', 'memory');

UPDATE agents
SET foreground = 0
WHERE foreground IS NULL;

ALTER TABLE agents ALTER COLUMN path SET NOT NULL;
ALTER TABLE agents ALTER COLUMN kind SET DEFAULT 'agent';
ALTER TABLE agents ALTER COLUMN kind SET NOT NULL;
ALTER TABLE agents ALTER COLUMN foreground SET DEFAULT 0;
ALTER TABLE agents ALTER COLUMN foreground SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_agents_parent_agent_id ON agents (parent_agent_id) WHERE valid_to IS NULL;
