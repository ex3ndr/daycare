#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
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

await mkdir(dataDirectory, { recursive: true });
await writeFile(
    settingsPath,
    `${JSON.stringify(
        {
            engine: {
                dataDir: dataDirectory
            },
            plugins: [
                {
                    instanceId: "daycare-app-server",
                    pluginId: "daycare-app-server",
                    enabled: true,
                    settings: {
                        host: "127.0.0.1",
                        port: apiPort
                    }
                }
            ]
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
