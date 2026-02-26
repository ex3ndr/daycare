import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220ImportTasks } from "./20260220_import_tasks.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";

describe("migration20260220ImportTasks", () => {
    it("imports legacy cron and heartbeat files into sqlite tables", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-import-tasks-"));
        const dbPath = path.join(dir, "daycare.db");
        const cronTaskUid = createId();
        const ownerFallbackCronTaskUid = createId();
        const emptyPromptCronTaskUid = createId();

        try {
            const cronTaskDir = path.join(dir, "cron", "daily-report");
            await mkdir(cronTaskDir, { recursive: true });
            await writeFile(
                path.join(cronTaskDir, "TASK.md"),
                `---\ntaskId: ${cronTaskUid}\nname: Daily Report\nschedule: "0 9 * * *"\ndescription: Daily status\nagentId: agent-123\nuserId: user-123\ngate:\n  command: echo gate\n  permissions:\n    - "@network"\nenabled: true\ndeleteAfterRun: true\n---\n\nSummarize yesterday.\n`,
                "utf8"
            );
            await writeFile(
                path.join(cronTaskDir, "STATE.json"),
                JSON.stringify({ lastRunAt: "2026-02-19T10:00:00.000Z" }, null, 2),
                "utf8"
            );
            await mkdir(path.join(cronTaskDir, "files"), { recursive: true });
            await writeFile(path.join(cronTaskDir, "MEMORY.md"), "legacy memory", "utf8");

            const ownerFallbackCronTaskDir = path.join(dir, "cron", "owner-fallback");
            await mkdir(ownerFallbackCronTaskDir, { recursive: true });
            await writeFile(
                path.join(ownerFallbackCronTaskDir, "TASK.md"),
                `---\ntaskId: ${ownerFallbackCronTaskUid}\nname: Owner fallback\nschedule: "0 12 * * *"\n---\n\nUse owner fallback.\n`,
                "utf8"
            );
            const emptyPromptCronTaskDir = path.join(dir, "cron", "empty-prompt");
            await mkdir(emptyPromptCronTaskDir, { recursive: true });
            await writeFile(
                path.join(emptyPromptCronTaskDir, "TASK.md"),
                `---\ntaskId: ${emptyPromptCronTaskUid}\nname: Empty prompt\nschedule: "0 13 * * *"\n---\n`,
                "utf8"
            );

            const invalidCronDir = path.join(dir, "cron", "invalid-task");
            await mkdir(invalidCronDir, { recursive: true });
            await writeFile(
                path.join(invalidCronDir, "TASK.md"),
                `---\nname: Invalid\nschedule: "* * * * *"\n---\n\nShould not import.\n`,
                "utf8"
            );

            const heartbeatDir = path.join(dir, "heartbeat");
            await mkdir(heartbeatDir, { recursive: true });
            await writeFile(
                path.join(heartbeatDir, "morning-check.md"),
                `---\ntitle: Morning Check\ngate:\n  command: echo hb\n---\n\nCheck status.\n`,
                "utf8"
            );
            await writeFile(path.join(heartbeatDir, "with-heading.md"), "# Heading title\n\nBody prompt\n", "utf8");
            await writeFile(
                path.join(heartbeatDir, ".heartbeat-state.json"),
                JSON.stringify({ lastRunAt: "2026-02-18T12:34:56.000Z" }, null, 2),
                "utf8"
            );

            const db = databaseOpenTest(dbPath);
            try {
                migration20260219Initial.up(db);
                migration20260220AddUsers.up(db);
                migration20260220UsersBootstrap.up(db);
                migration20260220AddTasks.up(db);
                migration20260220ImportTasks.up(db);

                const ownerRow = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
                    | { id: string }
                    | undefined;
                const ownerUserId = ownerRow?.id ?? "";

                const cronRows = db.prepare("SELECT * FROM tasks_cron ORDER BY id ASC").all() as Array<{
                    id: string;
                    task_uid: string;
                    name: string;
                    description: string | null;
                    schedule: string;
                    prompt: string;
                    enabled: number;
                    delete_after_run: number;
                    agent_id: string | null;
                    user_id: string | null;
                    last_run_at: number | null;
                }>;
                const heartbeatRows = db.prepare("SELECT * FROM tasks_heartbeat ORDER BY id ASC").all() as Array<{
                    id: string;
                    title: string;
                    prompt: string;
                    last_run_at: number | null;
                }>;

                expect(cronRows).toHaveLength(2);
                expect(cronRows[0]?.id).toBe("daily-report");
                expect(cronRows[0]?.task_uid).toBe(cronTaskUid);
                expect(cronRows[0]?.name).toBe("Daily Report");
                expect(cronRows[0]?.description).toBe("Daily status");
                expect(cronRows[0]?.schedule).toBe("0 9 * * *");
                expect(cronRows[0]?.prompt).toBe("Summarize yesterday.");
                expect(cronRows[0]?.agent_id).toBe("agent-123");
                expect(cronRows[0]?.user_id).toBe("user-123");
                expect(cronRows[0]?.enabled).toBe(1);
                expect(cronRows[0]?.delete_after_run).toBe(1);
                expect(cronRows[0]?.last_run_at).toBe(Date.parse("2026-02-19T10:00:00.000Z"));
                expect(cronRows[1]?.id).toBe("owner-fallback");
                expect(cronRows[1]?.task_uid).toBe(ownerFallbackCronTaskUid);
                expect(cronRows[1]?.name).toBe("Owner fallback");
                expect(cronRows[1]?.description).toBeNull();
                expect(cronRows[1]?.schedule).toBe("0 12 * * *");
                expect(cronRows[1]?.prompt).toBe("Use owner fallback.");
                expect(cronRows[1]?.user_id).toBe(ownerUserId);
                expect(cronRows[1]?.enabled).toBe(1);
                expect(cronRows[1]?.delete_after_run).toBe(0);
                expect(cronRows[1]?.last_run_at).toBeNull();

                expect(heartbeatRows).toHaveLength(2);
                expect(heartbeatRows.map((row) => row.id)).toEqual(["morning-check", "with-heading"]);
                expect(heartbeatRows[0]?.title).toBe("Morning Check");
                expect(heartbeatRows[0]?.prompt).toBe("Check status.");
                expect(heartbeatRows[1]?.title).toBe("Heading title");
                expect(heartbeatRows[1]?.prompt).toBe("Body prompt");
                expect(heartbeatRows.every((row) => row.last_run_at === Date.parse("2026-02-18T12:34:56.000Z"))).toBe(
                    true
                );
            } finally {
                db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
