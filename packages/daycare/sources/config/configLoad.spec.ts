import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { configLoad } from "./configLoad.js";

const DATABASE_URL_ENV = "DATABASE_URL";
const SMTP_URL_ENV = "SMTP_URL";

describe("configLoad", () => {
    afterEach(() => {
        delete process.env[DATABASE_URL_ENV];
        delete process.env[SMTP_URL_ENV];
    });

    it("resolves DATABASE_URL when no settings file exists", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-config-"));
        const settingsPath = path.join(tempDir, "settings.json");

        process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/daycare";

        const config = await configLoad(settingsPath);

        expect(config.db.url).toBe("postgres://postgres:postgres@127.0.0.1:5432/daycare");
    });

    it("resolves SMTP_URL when email.smtpUrl is missing", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-config-"));
        const settingsPath = path.join(tempDir, "settings.json");

        process.env.SMTP_URL = "smtp://mailer.example.com";

        const config = await configLoad(settingsPath);

        expect(config.settings.email?.smtpUrl).toBe("smtp://mailer.example.com");
    });
});
