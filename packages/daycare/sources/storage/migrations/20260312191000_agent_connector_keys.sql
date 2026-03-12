ALTER TABLE "agents" ADD COLUMN "connector_key" text;

WITH resolved_connector_keys AS (
    SELECT
        agent.id,
        agent.version,
        COALESCE(
            (
                SELECT key.connector_key
                FROM "user_connector_keys" AS key
                WHERE
                    key.user_id = agent.user_id
                    AND key.connector_key = agent.connector_name || ':' || substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$')
                LIMIT 1
            ),
            (
                SELECT key.connector_key
                FROM "user_connector_keys" AS key
                WHERE
                    key.user_id = agent.user_id
                    AND key.connector_key = agent.connector_name || ':' || split_part(
                        substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
                        '/',
                        1
                    )
                    AND split_part(
                        substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
                        '/',
                        1
                    ) = split_part(
                        substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
                        '/',
                        2
                    )
                LIMIT 1
            ),
            (
                SELECT MIN(only_key.connector_key)
                FROM "user_connector_keys" AS only_key
                WHERE
                    only_key.user_id = agent.user_id
                    AND only_key.connector_key LIKE agent.connector_name || ':%'
                HAVING COUNT(*) = 1
            )
        ) AS connector_key
    FROM "agents" AS agent
    WHERE agent.kind = 'connector' AND agent.connector_name IS NOT NULL
)
UPDATE "agents" AS agent
SET "connector_key" = resolved.connector_key
FROM resolved_connector_keys AS resolved
WHERE
    agent.id = resolved.id
    AND agent.version = resolved.version
    AND resolved.connector_key IS NOT NULL;

CREATE INDEX "idx_agents_connector_key_active"
ON "agents" USING btree ("connector_key")
WHERE "valid_to" IS NULL AND "connector_key" IS NOT NULL;
