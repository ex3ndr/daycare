CREATE TABLE IF NOT EXISTS "documents" (
    "id" text NOT NULL,
    "user_id" text NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    "valid_from" bigint NOT NULL,
    "valid_to" bigint,
    "slug" text NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "body" text DEFAULT '' NOT NULL,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL,
    CONSTRAINT "documents_user_id_id_version_pk" PRIMARY KEY("user_id", "id", "version")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_documents_user_id" ON "documents" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_documents_updated_at" ON "documents" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "idx_documents_id_valid_to" ON "documents" USING btree ("id", "valid_to");
CREATE INDEX IF NOT EXISTS "idx_documents_slug_active" ON "documents" USING btree ("user_id", "slug")
    WHERE "documents"."valid_to" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_references" (
    "id" serial PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "source_id" text NOT NULL,
    "source_version" integer NOT NULL,
    "target_id" text NOT NULL,
    "kind" text NOT NULL,
    CONSTRAINT "document_references_kind_valid" CHECK ("document_references"."kind" IN ('parent', 'link', 'body'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_doc_refs_unique"
    ON "document_references" USING btree ("user_id", "source_id", "source_version", "target_id", "kind");
CREATE INDEX IF NOT EXISTS "idx_doc_refs_target" ON "document_references" USING btree ("user_id", "target_id");
CREATE INDEX IF NOT EXISTS "idx_doc_refs_source"
    ON "document_references" USING btree ("user_id", "source_id", "source_version");
CREATE INDEX IF NOT EXISTS "idx_doc_refs_parent" ON "document_references" USING btree ("user_id", "target_id")
    WHERE "document_references"."kind" = 'parent';
