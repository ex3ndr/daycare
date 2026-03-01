ALTER TABLE agents ADD COLUMN IF NOT EXISTS kind text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS model_role text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS connector_name text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS parent_agent_id text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS foreground integer;
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
    WHEN type = 'subagent' OR type = 'app' THEN '/' || user_id || '/sub/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-agent' THEN '/' || user_id || '/memory/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'memory-search' THEN '/' || user_id || '/search/' || COALESCE(NULLIF((descriptor::jsonb ->> 'id'), ''), id)
    WHEN type = 'swarm' THEN '/' || user_id || '/agent/swarm'
    ELSE '/' || user_id || '/agent/' || id
END
WHERE path IS NULL OR trim(path) = '';

WITH prepared AS (
    SELECT
        id,
        version,
        lower(trim(COALESCE(type, ''))) AS legacy_type,
        NULLIF(lower(trim(config::jsonb ->> 'kind')), '') AS config_kind,
        NULLIF(trim(config::jsonb ->> 'modelRole'), '') AS config_model_role,
        NULLIF(trim(config::jsonb ->> 'connectorName'), '') AS config_connector_name,
        NULLIF(trim(config::jsonb ->> 'parentAgentId'), '') AS config_parent_agent_id,
        NULLIF(trim(config::jsonb ->> 'name'), '') AS config_name,
        NULLIF(trim(config::jsonb ->> 'description'), '') AS config_description,
        NULLIF(trim(config::jsonb ->> 'systemPrompt'), '') AS config_system_prompt,
        NULLIF(trim(config::jsonb ->> 'workspaceDir'), '') AS config_workspace_dir,
        NULLIF(trim(descriptor::jsonb ->> 'connector'), '') AS descriptor_connector_name,
        NULLIF(trim(descriptor::jsonb ->> 'parentAgentId'), '') AS descriptor_parent_agent_id,
        NULLIF(trim(descriptor::jsonb ->> 'name'), '') AS descriptor_name,
        NULLIF(trim(descriptor::jsonb ->> 'description'), '') AS descriptor_description,
        NULLIF(trim(descriptor::jsonb ->> 'systemPrompt'), '') AS descriptor_system_prompt,
        NULLIF(trim(descriptor::jsonb ->> 'workspaceDir'), '') AS descriptor_workspace_dir,
        CASE
            WHEN lower(COALESCE(config::jsonb ->> 'foreground', '')) IN ('1', 'true', 'yes', 'on') THEN 1
            WHEN lower(COALESCE(config::jsonb ->> 'foreground', '')) IN ('0', 'false', 'no', 'off') THEN 0
            ELSE NULL
        END AS config_foreground
    FROM agents
),
resolved AS (
    SELECT
        id,
        version,
        config_model_role,
        config_connector_name,
        config_parent_agent_id,
        config_name,
        config_description,
        config_system_prompt,
        config_workspace_dir,
        descriptor_connector_name,
        descriptor_parent_agent_id,
        descriptor_name,
        descriptor_description,
        descriptor_system_prompt,
        descriptor_workspace_dir,
        config_foreground,
        COALESCE(
            config_kind,
            CASE legacy_type
                WHEN 'system' THEN 'system'
                WHEN 'user' THEN 'connector'
                WHEN 'cron' THEN 'cron'
                WHEN 'task' THEN 'task'
                WHEN 'subuser' THEN 'subuser'
                WHEN 'subagent' THEN 'sub'
                WHEN 'app' THEN 'sub'
                WHEN 'memory-agent' THEN 'memory'
                WHEN 'memory-search' THEN 'search'
                WHEN 'swarm' THEN 'swarm'
                ELSE 'agent'
            END,
            'agent'
        ) AS resolved_kind
    FROM prepared
)
UPDATE agents AS a
SET
    kind = r.resolved_kind,
    model_role = COALESCE(
        r.config_model_role,
        CASE
            WHEN r.resolved_kind IN ('connector', 'agent', 'swarm', 'subuser') THEN 'user'
            WHEN r.resolved_kind = 'sub' THEN 'subagent'
            WHEN r.resolved_kind = 'memory' THEN 'memory'
            WHEN r.resolved_kind = 'search' THEN 'memorySearch'
            WHEN r.resolved_kind = 'task' THEN 'task'
            ELSE NULL
        END
    ),
    connector_name = CASE
        WHEN r.resolved_kind = 'connector'
            THEN COALESCE(r.config_connector_name, r.descriptor_connector_name, a.connector_name)
        ELSE NULL
    END,
    parent_agent_id = CASE
        WHEN r.resolved_kind IN ('sub', 'search', 'memory')
            THEN COALESCE(r.config_parent_agent_id, r.descriptor_parent_agent_id, a.parent_agent_id)
        ELSE NULL
    END,
    foreground = COALESCE(
        r.config_foreground,
        CASE
            WHEN r.resolved_kind IN ('connector', 'swarm') THEN 1
            ELSE a.foreground
        END,
        0
    ),
    name = COALESCE(r.config_name, r.descriptor_name, a.name),
    description = COALESCE(r.config_description, r.descriptor_description, a.description),
    system_prompt = COALESCE(r.config_system_prompt, r.descriptor_system_prompt, a.system_prompt),
    workspace_dir = COALESCE(r.config_workspace_dir, r.descriptor_workspace_dir, a.workspace_dir)
FROM resolved AS r
WHERE a.id = r.id
  AND a.version = r.version;

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

ALTER TABLE agents DROP COLUMN IF EXISTS type;
ALTER TABLE agents DROP COLUMN IF EXISTS descriptor;
ALTER TABLE agents DROP COLUMN IF EXISTS config;
