#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";

const environmentName = process.argv[2];
const userId = process.argv[3] ?? "sy45wijd1hmr03ef2wu7busv";

if (!environmentName || !/^[a-z0-9][a-z0-9-]*$/i.test(environmentName)) {
    console.error("Usage: yarn env:link <name> [userId]");
    process.exit(1);
}

const dataDirectory = path.resolve(".data", environmentName);
const settingsPath = path.resolve(dataDirectory, "settings.json");
const proxyPort = process.env.PORTLESS_PORT?.trim() || "1355";
const appHost = `app.${environmentName}.localhost`;

const child = spawn(
    "yarn",
    [
        "workspace",
        "daycare-cli",
        "run",
        "dev",
        "app-link",
        userId,
        "--settings",
        settingsPath,
        "--host",
        appHost,
        "--port",
        proxyPort,
        "--json"
    ],
    {
        env: {
            ...process.env,
            DAYCARE_ROOT_DIR: dataDirectory
        },
        stdio: "inherit"
    }
);

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
