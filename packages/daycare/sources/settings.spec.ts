import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { readSettingsFile } from "./settings.js";

const DATABASE_URL_ENV = "DATABASE_URL";
const SMTP_URL_ENV = "SMTP_URL";

describe("readSettingsFile", () => {
    afterEach(() => {
        delete process.env[DATABASE_URL_ENV];
        delete process.env[SMTP_URL_ENV];
    });

    it("allows DATABASE_URL without a settings file", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-settings-"));
        const settingsPath = path.join(tempDir, "settings.json");

        process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/daycare";

        await expect(readSettingsFile(settingsPath)).resolves.toEqual({
            engine: {
                db: {
                    url: "postgres://postgres:postgres@127.0.0.1:5432/daycare"
                }
            }
        });
    });

    it("keeps the settings file database url when it is already provided", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-settings-"));
        const settingsPath = path.join(tempDir, "settings.json");

        await fs.writeFile(
            settingsPath,
            `${JSON.stringify({
                engine: {
                    db: {
                        path: "/tmp/daycare.db",
                        url: "postgres://file:file@127.0.0.1:5432/from-file",
                        autoMigrate: false
                    }
                }
            })}\n`
        );

        process.env.DATABASE_URL = "postgres://env:env@127.0.0.1:5432/from-env";

        await expect(readSettingsFile(settingsPath)).resolves.toEqual({
            engine: {
                db: {
                    path: "/tmp/daycare.db",
                    url: "postgres://file:file@127.0.0.1:5432/from-file",
                    autoMigrate: false
                }
            }
        });
    });

    it("allows SMTP_URL when email.smtpUrl is missing", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-settings-"));
        const settingsPath = path.join(tempDir, "settings.json");

        process.env.SMTP_URL = "smtp://mailer.example.com";

        await expect(readSettingsFile(settingsPath)).resolves.toEqual({
            email: {
                smtpUrl: "smtp://mailer.example.com"
            }
        });
    });

    it("keeps the settings file smtpUrl when it is already provided", async () => {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-settings-"));
        const settingsPath = path.join(tempDir, "settings.json");

        await fs.writeFile(
            settingsPath,
            `${JSON.stringify({
                email: {
                    smtpUrl: "smtp://file.example.com",
                    from: "file@example.com"
                }
            })}\n`
        );

        process.env.SMTP_URL = "smtp://env.example.com";

        await expect(readSettingsFile(settingsPath)).resolves.toEqual({
            email: {
                smtpUrl: "smtp://file.example.com",
                from: "file@example.com"
            }
        });
    });
});
