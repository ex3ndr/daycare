CREATE TABLE "key_values" (
    "user_id" text NOT NULL,
    "key" text NOT NULL,
    "value" jsonb,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "key_values_user_id_key_pk" PRIMARY KEY("user_id", "key")
);

CREATE INDEX "idx_key_values_user" ON "key_values" USING btree ("user_id");
CREATE INDEX "idx_key_values_user_updated" ON "key_values" USING btree ("user_id", "updated_at");
