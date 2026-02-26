import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260222AddProcesses } from "./20260222_add_processes.js";

describe("migration20260222AddProcesses", () => {
    it("creates processes table with expected columns", () => {
        const db = databaseOpenTest();
        try {
            migration20260222AddProcesses.up(db);

            const columns = db.prepare("PRAGMA table_info(processes)").all() as Array<{ name: string }>;
            expect(columns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "name",
                "command",
                "cwd",
                "home",
                "env",
                "package_managers",
                "allowed_domains",
                "allow_local_binding",
                "permissions",
                "owner",
                "keep_alive",
                "desired_state",
                "status",
                "pid",
                "boot_time_ms",
                "restart_count",
                "restart_failure_count",
                "next_restart_at",
                "settings_path",
                "log_path",
                "created_at",
                "updated_at",
                "last_started_at",
                "last_exited_at"
            ]);
        } finally {
            db.close();
        }
    });
});
