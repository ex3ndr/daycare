#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const environmentName = process.argv[2];
if (!environmentName) {
    console.error("Usage: node scripts/envServiceApi.mjs <name>");
    process.exit(1);
}

const dataDirectory = process.env.ENV_DATA_DIR ? path.resolve(process.env.ENV_DATA_DIR) : path.resolve(".data", environmentName);
const settingsPath = process.env.ENV_SETTINGS_PATH
    ? path.resolve(process.env.ENV_SETTINGS_PATH)
    : path.resolve(dataDirectory, "settings.json");
const portFromProxy = Number.parseInt(process.env.PORT ?? "", 10);
const apiPort = Number.isInteger(portFromProxy) && portFromProxy > 0 ? portFromProxy : 7332;
const proxyPort = process.env.ENV_PROXY_PORT?.trim() || process.env.PORTLESS_PORT?.trim() || "1355";
const appEndpoint = `http://app.${environmentName}.localhost:${proxyPort}`;
const serverEndpoint = `http://api.${environmentName}.localhost:${proxyPort}`;

await mkdir(dataDirectory, { recursive: true });
const existingSettings = await settingsRead(settingsPath);
await writeFile(
    settingsPath,
    `${JSON.stringify(
        {
            ...existingSettings,
            engine: {
                dataDir: dataDirectory
            },
            appServer: {
                ...existingSettings.appServer,
                enabled: true,
                host: "127.0.0.1",
                port: apiPort,
                appEndpoint,
                serverEndpoint
            }
        },
        null,
        2
    )}\n`,
    "utf8"
);

const child = spawn(
    "yarn",
    ["workspace", "daycare-cli", "run", "dev", "start", "--settings", settingsPath, "--force"],
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

async function settingsRead(settingsPath) {
    try {
        return JSON.parse(await readFile(settingsPath, "utf8"));
    } catch {
        return {};
    }
}
