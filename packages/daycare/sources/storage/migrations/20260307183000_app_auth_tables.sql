CREATE TABLE IF NOT EXISTS "app_auth_users" (
    "id" text PRIMARY KEY,
    "email" text NOT NULL,
    "email_verified" boolean NOT NULL DEFAULT false,
    "name" text NOT NULL,
    "image" text,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_auth_users_email" ON "app_auth_users" ("email");
CREATE INDEX IF NOT EXISTS "idx_app_auth_users_created_at" ON "app_auth_users" ("created_at");

CREATE TABLE IF NOT EXISTS "app_auth_sessions" (
    "id" text PRIMARY KEY,
    "user_id" text NOT NULL REFERENCES "app_auth_users"("id") ON DELETE CASCADE,
    "token" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "ip_address" text,
    "user_agent" text,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_auth_sessions_token" ON "app_auth_sessions" ("token");
CREATE INDEX IF NOT EXISTS "idx_app_auth_sessions_user_id" ON "app_auth_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_app_auth_sessions_expires_at" ON "app_auth_sessions" ("expires_at");

CREATE TABLE IF NOT EXISTS "app_auth_accounts" (
    "id" text PRIMARY KEY,
    "provider_id" text NOT NULL,
    "account_id" text NOT NULL,
    "user_id" text NOT NULL REFERENCES "app_auth_users"("id") ON DELETE CASCADE,
    "access_token" text,
    "refresh_token" text,
    "id_token" text,
    "access_token_expires_at" timestamp with time zone,
    "refresh_token_expires_at" timestamp with time zone,
    "scope" text,
    "password" text,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_auth_accounts_provider_account"
    ON "app_auth_accounts" ("provider_id", "account_id");
CREATE INDEX IF NOT EXISTS "idx_app_auth_accounts_user_id" ON "app_auth_accounts" ("user_id");

CREATE TABLE IF NOT EXISTS "app_auth_verifications" (
    "id" text PRIMARY KEY,
    "identifier" text NOT NULL,
    "value" text NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_app_auth_verifications_identifier"
    ON "app_auth_verifications" ("identifier");
CREATE INDEX IF NOT EXISTS "idx_app_auth_verifications_expires_at" ON "app_auth_verifications" ("expires_at");
