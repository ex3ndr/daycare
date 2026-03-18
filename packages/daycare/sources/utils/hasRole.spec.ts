import { afterEach, describe, expect, it, vi } from "vitest";

const DAYCARE_ROLES_ENV = "DAYCARE_ROLES";
const originalDaycareRoles = process.env.DAYCARE_ROLES;

async function rolesModuleLoad() {
    vi.resetModules();
    return import("./hasRole.js");
}

describe("hasRole", () => {
    afterEach(() => {
        if (originalDaycareRoles === undefined) {
            delete process.env[DAYCARE_ROLES_ENV];
            return;
        }
        process.env[DAYCARE_ROLES_ENV] = originalDaycareRoles;
    });

    it("returns false when DAYCARE_ROLES is not set", async () => {
        delete process.env[DAYCARE_ROLES_ENV];

        const { hasRole, rolesCurrentList } = await rolesModuleLoad();

        expect(rolesCurrentList()).toEqual([]);
        expect(hasRole("api")).toBe(false);
    });

    it("matches comma-separated roles resolved on boot", async () => {
        process.env.DAYCARE_ROLES = "api, tasks";

        const { hasRole, rolesCurrentList } = await rolesModuleLoad();

        expect(rolesCurrentList()).toEqual(["api", "tasks"]);
        expect(hasRole("api")).toBe(true);
        expect(hasRole("tasks")).toBe(true);
        expect(hasRole("signals")).toBe(false);
    });

    it("keeps the boot-resolved roles even if env changes later", async () => {
        process.env.DAYCARE_ROLES = "agents";

        const { hasRole } = await rolesModuleLoad();
        process.env.DAYCARE_ROLES = "tasks";

        expect(hasRole("agents")).toBe(true);
        expect(hasRole("tasks")).toBe(false);
    });

    it("rejects unknown roles during boot resolution", async () => {
        process.env.DAYCARE_ROLES = "api, cron";

        await expect(rolesModuleLoad()).rejects.toThrow("Unknown DAYCARE_ROLES entry: cron.");
    });
});
