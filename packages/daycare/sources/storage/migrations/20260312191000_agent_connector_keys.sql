ALTER TABLE "agents" ADD COLUMN "connector_key" text;

WITH connector_agents AS (
    SELECT
        agent.id,
        agent.version,
        agent.user_id,
        agent.connector_name,
        NULLIF(
            substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
            ''
        ) AS path_connector_value,
        NULLIF(
            split_part(
                substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
                '/',
                1
            ),
            ''
        ) AS path_connector_value_first,
        NULLIF(
            split_part(
                substring(trim(leading '/' FROM agent.path) FROM '^[^/]+/[^/]+/(.+)$'),
                '/',
                2
            ),
            ''
        ) AS path_connector_value_second
    FROM "agents" AS agent
    WHERE agent.kind = 'connector' AND agent.connector_name IS NOT NULL
),
single_connector_keys AS (
    SELECT
        key.user_id,
        split_part(key.connector_key, ':', 1) AS connector_name,
        MIN(substring(key.connector_key FROM '^[^:]+:(.+)$')) AS connector_key
    FROM "user_connector_keys" AS key
    GROUP BY
        key.user_id,
        split_part(key.connector_key, ':', 1)
    HAVING COUNT(*) = 1
),
single_connector_keys_consistent AS (
    SELECT
        single_key.user_id,
        single_key.connector_name,
        single_key.connector_key
    FROM single_connector_keys AS single_key
    WHERE NOT EXISTS (
        SELECT 1
        FROM connector_agents AS related
        WHERE
            related.user_id = single_key.user_id
            AND related.connector_name = single_key.connector_name
            AND related.path_connector_value IS NOT NULL
            AND related.path_connector_value <> single_key.connector_key
            AND NOT (
                related.path_connector_value_first IS NOT NULL
                AND related.path_connector_value_first = related.path_connector_value_second
                AND related.path_connector_value_first = single_key.connector_key
            )
    )
),
resolved_connector_keys AS (
    SELECT
        agent.id,
        agent.version,
        COALESCE(
            (
                SELECT substring(key.connector_key FROM '^[^:]+:(.+)$')
                FROM "user_connector_keys" AS key
                WHERE
                    key.user_id = agent.user_id
                    AND key.connector_key = agent.connector_name || ':' || agent.path_connector_value
                LIMIT 1
            ),
            (
                SELECT substring(key.connector_key FROM '^[^:]+:(.+)$')
                FROM "user_connector_keys" AS key
                WHERE
                    key.user_id = agent.user_id
                    AND key.connector_key = agent.connector_name || ':' || agent.path_connector_value_first
                    AND agent.path_connector_value_first = agent.path_connector_value_second
                LIMIT 1
            ),
            (
                SELECT single_key.connector_key
                FROM single_connector_keys_consistent AS single_key
                WHERE
                    single_key.user_id = agent.user_id
                    AND single_key.connector_name = agent.connector_name
                LIMIT 1
            )
        ) AS connector_key
    FROM connector_agents AS agent
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
