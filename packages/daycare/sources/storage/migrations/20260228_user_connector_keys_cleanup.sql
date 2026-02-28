DELETE FROM "user_connector_keys" AS "keys"
WHERE NOT EXISTS (
    SELECT 1
    FROM "users"
    WHERE "users"."id" = "keys"."user_id"
      AND "users"."valid_to" IS NULL
);
