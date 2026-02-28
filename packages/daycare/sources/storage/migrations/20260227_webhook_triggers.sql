CREATE TABLE "tasks_webhook" (
    "id" text PRIMARY KEY NOT NULL,
    "task_id" text NOT NULL,
    "user_id" text NOT NULL,
    "agent_id" text,
    "created_at" bigint NOT NULL,
    "updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks_webhook" ADD CONSTRAINT "tasks_webhook_user_id_task_id_tasks_user_id_id_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_tasks_webhook_task_id" ON "tasks_webhook" USING btree ("user_id","task_id");
--> statement-breakpoint
CREATE INDEX "idx_tasks_webhook_updated_at" ON "tasks_webhook" USING btree ("updated_at");
--> statement-breakpoint
CREATE INDEX "idx_tasks_webhook_user_id" ON "tasks_webhook" USING btree ("user_id");
