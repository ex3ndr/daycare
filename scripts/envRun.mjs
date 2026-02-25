#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const environmentName = process.argv[2];
if (!environmentName || !/^[a-z0-9][a-z0-9-]*$/i.test(environmentName)) {
    console.error("Usage: yarn env <name>");
    console.error("Name must match /^[a-z0-9][a-z0-9-]*$/i.");
    process.exit(1);
}

const rootDirectory = process.cwd();
const dataDirectory = path.resolve(rootDirectory, ".data", environmentName);
const settingsPath = path.join(dataDirectory, "settings.json");
const logPath = path.join(dataDirectory, "env.log");
const proxyPort = process.env.PORTLESS_PORT?.trim() || "1355";
const apiHost = `api.${environmentName}.localhost`;
const appHost = `app.${environmentName}.localhost`;
const commonEnv = {
    ...process.env,
    DAYCARE_ROOT_DIR: dataDirectory,
    ENV_NAME: environmentName,
    ENV_DATA_DIR: dataDirectory,
    ENV_SETTINGS_PATH: settingsPath,
    ENV_PROXY_PORT: proxyPort
};

await mkdir(dataDirectory, { recursive: true });
if (!existsSync(settingsPath)) {
    await writeFile(settingsPath, "{}\n", "utf8");
}

const logStream = spawn("tee", ["-a", logPath], {
    cwd: rootDirectory,
    env: process.env,
    stdio: ["pipe", "inherit", "inherit"]
});
let logStreamClosed = false;

logStream.stdin.on("error", (error) => {
    if (error.code !== "EPIPE") {
        console.error(`env logger error: ${error.message}`);
    }
    logStreamClosed = true;
});
logStream.on("close", () => {
    logStreamClosed = true;
});

const writeLog = (prefix, message) => {
    const line = `[${new Date().toISOString()}] [${prefix}] ${message}`;
    if (logStreamClosed || logStream.stdin.destroyed) {
        process.stdout.write(`${line}\n`);
        return;
    }
    logStream.stdin.write(`${line}\n`);
};

writeLog("env", `starting environment "${environmentName}"`);
writeLog("env", `data directory: ${dataDirectory}`);
writeLog("env", `merged log: ${logPath}`);
writeLog("env", `app url: http://${appHost}:${proxyPort}`);
writeLog("env", `api url: http://${apiHost}:${proxyPort}`);
writeLog("env", `starting portless proxy on port ${proxyPort}`);

await runAndWait("portless", ["proxy", "start", "--port", proxyPort], "proxy", commonEnv);

const services = [
    {
        label: "api",
        args: ["--force", apiHost, "node", "./scripts/envServiceApi.mjs", environmentName]
    },
    {
        label: "app",
        args: ["--force", appHost, "node", "./scripts/envServiceApp.mjs", environmentName]
    }
];

const children = services.map((service) => startService(service.label, service.args, commonEnv));
let shuttingDown = false;

const stopChildren = (signal) => {
    if (shuttingDown) {
        return;
    }
    shuttingDown = true;
    writeLog("env", `shutting down services (${signal})`);
    for (const child of children) {
        if (!child.killed) {
            child.kill(signal);
        }
    }
};

process.on("SIGINT", () => stopChildren("SIGINT"));
process.on("SIGTERM", () => stopChildren("SIGTERM"));

for (const child of children) {
    child.on("exit", (code, signal) => {
        writeLog(child.__label, `exited code=${code ?? "null"} signal=${signal ?? "null"}`);
        if (!shuttingDown && (code !== 0 || signal)) {
            stopChildren("SIGTERM");
            process.exitCode = 1;
        }
    });
}

await Promise.all(children.map((child) => waitForExit(child)));
writeLog("env", "all services stopped");
logStream.stdin.end();

function startService(label, args, env) {
    writeLog(label, `portless ${args.join(" ")}`);
    const child = spawn("portless", args, {
        cwd: rootDirectory,
        env,
        stdio: ["ignore", "pipe", "pipe"]
    });
    child.__label = label;
    pipeOutput(child.stdout, label);
    pipeOutput(child.stderr, label);
    return child;
}

function pipeOutput(stream, label) {
    let buffer = "";
    stream.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
            if (line.trim().length > 0) {
                writeLog(label, line);
            }
        }
    });
    stream.on("end", () => {
        if (buffer.trim().length > 0) {
            writeLog(label, buffer);
        }
    });
}

function waitForExit(child) {
    return new Promise((resolve) => {
        child.on("exit", () => resolve());
    });
}

function runAndWait(command, args, label, env) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: rootDirectory,
            env,
            stdio: ["ignore", "pipe", "pipe"]
        });

        pipeOutput(child.stdout, label);
        pipeOutput(child.stderr, label);

        child.on("error", reject);
        child.on("exit", (code) => {
            if (code === 0) {
                resolve();
                return;
            }
            reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`));
        });
    });
}
