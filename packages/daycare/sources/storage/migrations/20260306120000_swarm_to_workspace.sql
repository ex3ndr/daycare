-- Rename swarm_contacts table to workspace_contacts
ALTER TABLE "swarm_contacts" RENAME TO "workspace_contacts";

-- Rename columns in workspace_contacts
ALTER TABLE "workspace_contacts" RENAME COLUMN "swarm_user_id" TO "workspace_user_id";
ALTER TABLE "workspace_contacts" RENAME COLUMN "swarm_agent_id" TO "workspace_agent_id";

-- Rename primary key constraint
ALTER TABLE "workspace_contacts" RENAME CONSTRAINT "swarm_contacts_swarm_user_id_contact_agent_id_pk" TO "workspace_contacts_workspace_user_id_contact_agent_id_pk";

-- Rename indexes
ALTER INDEX "idx_swarm_contacts_swarm_user_id" RENAME TO "idx_workspace_contacts_workspace_user_id";
ALTER INDEX "idx_swarm_contacts_swarm_agent_id" RENAME TO "idx_workspace_contacts_workspace_agent_id";

-- Rename is_swarm column in users table
ALTER TABLE "users" RENAME COLUMN "is_swarm" TO "is_workspace";

-- Migrate agent kind from "swarm" to "workspace"
UPDATE "agents" SET "kind" = 'workspace' WHERE "kind" = 'swarm';
