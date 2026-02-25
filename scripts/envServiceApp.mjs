#!/usr/bin/env node

import { spawn } from "node:child_process";

const environmentName = process.argv[2];
if (!environmentName) {
    console.error("Usage: node scripts/envServiceApp.mjs <name>");
    process.exit(1);
}

const appPort = Number.parseInt(process.env.PORT ?? "", 10);
if (!Number.isInteger(appPort) || appPort <= 0) {
    console.error("PORT must be provided by portless for app service.");
    process.exit(1);
}

const proxyPort = process.env.ENV_PROXY_PORT?.trim() || process.env.PORTLESS_PORT?.trim() || "1355";
const apiBaseUrl = `http://api.${environmentName}.localhost:${proxyPort}`;

const child = spawn("yarn", ["workspace", "daycare-app", "web", "--port", String(appPort)], {
    env: {
        ...process.env,
        EXPO_PUBLIC_DAYCARE_API_BASE_URL: apiBaseUrl,
        BROWSER: "none"
    },
    stdio: "inherit"
});

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
