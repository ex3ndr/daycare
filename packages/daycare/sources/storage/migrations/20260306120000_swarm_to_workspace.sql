-- Drop swarm_contacts table (replaced by direct membership via users.is_workspace + parent_user_id)
DROP TABLE IF EXISTS "swarm_contacts";

-- Rename is_swarm column in users table
ALTER TABLE "users" RENAME COLUMN "is_swarm" TO "is_workspace";

-- Remove swarm agent kind (workspace users use regular "agent" kind)
UPDATE "agents" SET "kind" = 'agent' WHERE "kind" = 'swarm';
