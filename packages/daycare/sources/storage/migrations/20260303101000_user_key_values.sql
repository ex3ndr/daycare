CREATE TABLE "key_values" (
    "user_id" text NOT NULL,
    "key" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "value" jsonb,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "key_values_user_id_key_version_pk" PRIMARY KEY("user_id", "key", "version")
);

CREATE UNIQUE INDEX "idx_key_values_user_key_active" ON "key_values" USING btree ("user_id", "key") WHERE "key_values"."valid_to" IS NULL;
CREATE INDEX "idx_key_values_user" ON "key_values" USING btree ("user_id");
CREATE INDEX "idx_key_values_user_key_valid_to" ON "key_values" USING btree ("user_id", "key", "valid_to");
CREATE INDEX "idx_key_values_user_updated" ON "key_values" USING btree ("user_id", "updated_at");
