import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { Sandbox } from "./sandbox.js";

const itIfDockerSandbox = dockerSandboxAvailable() ? it : it.skip;

describe("Sandbox", () => {
    let rootDir: string;
    let homeDir: string;
    let workingDir: string;
    let writeDir: string;
    let outsideDir: string;
    let userId: string;
    let permissions: SessionPermissions;
    let sandbox: Sandbox;

    beforeEach(async () => {
        userId = `sandbox-test-${randomUUID()}`;
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-sandbox-"));
        homeDir = path.join(rootDir, "home");
        workingDir = path.join(homeDir, "desktop");
        writeDir = path.join(homeDir, "documents");
        outsideDir = path.join(rootDir, "outside");
        await fs.mkdir(workingDir, { recursive: true });
        await fs.mkdir(writeDir, { recursive: true });
        await fs.mkdir(outsideDir, { recursive: true });

        permissions = {
            workingDir,
            writeDirs: [homeDir]
        };

        sandbox = new Sandbox({
            homeDir,
            permissions,
            backend: {
                type: "docker",
                docker: dockerConfigBuild(userId)
            }
        });
    });

    afterEach(async () => {
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("stores homeDir and resolves workingDir from permissions", async () => {
        expect(sandbox.homeDir).toBe(await fs.realpath(homeDir));
        expect(sandbox.workingDir).toBe(await fs.realpath(workingDir));
        expect(sandbox.permissions).toBe(permissions);
    });

    it("uses workingDir from permissions only", async () => {
        const fromPermissions = new Sandbox({
            homeDir,
            permissions: {
                ...permissions,
                workingDir: writeDir
            },
            backend: {
                type: "docker",
                docker: dockerConfigBuild(userId)
            }
        });
        expect(fromPermissions.workingDir).toBe(await fs.realpath(writeDir));
    });

    it("reads text with pagination", async () => {
        const filePath = path.join(workingDir, "notes.txt");
        await fs.writeFile(filePath, "line-1\nline-2\nline-3", "utf8");

        const firstRead = await sandbox.read({ path: filePath, limit: 2 });
        expect(firstRead.type).toBe("text");
        if (firstRead.type !== "text") {
            return;
        }
        expect(firstRead.content).toContain("line-1\nline-2");
        expect(firstRead.content).toContain("Use offset=3 to continue.");
        expect(firstRead.truncated).toBe(false);

        const secondRead = await sandbox.read({ path: filePath, offset: 3, limit: 1 });
        if (secondRead.type !== "text") {
            throw new Error("Expected text read result.");
        }
        expect(secondRead.content).toContain("line-3");
    });

    it("reports home-relative display path outside workingDir", async () => {
        const knowledgePath = path.join(homeDir, "knowledge", "USER.md");
        await fs.mkdir(path.dirname(knowledgePath), { recursive: true });
        await fs.writeFile(knowledgePath, "name: steve", "utf8");

        const read = await sandbox.read({ path: "../knowledge/USER.md", raw: true });
        expect(read.type).toBe("text");
        if (read.type !== "text") {
            return;
        }
        expect(read.content).toBe("name: steve");
        expect(read.displayPath).toBe("~/knowledge/USER.md");
        expect(read.displayPath).not.toContain("/home/");
    });

    it("falls back to home-relative paths when workspace-relative target does not exist", async () => {
        const knowledgePath = path.join(homeDir, "knowledge", "USER.md");
        await fs.mkdir(path.dirname(knowledgePath), { recursive: true });
        await fs.writeFile(knowledgePath, "name: steve", "utf8");

        const read = await sandbox.read({ path: "knowledge/USER.md", raw: true });
        expect(read.type).toBe("text");
        if (read.type !== "text") {
            return;
        }
        expect(read.content).toBe("name: steve");
        expect(read.displayPath).toBe("~/knowledge/USER.md");
    });

    it("reads image files as binary image payloads", async () => {
        const imagePath = path.join(workingDir, "image.png");
        const oneByOnePngBase64 =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5L5f8AAAAASUVORK5CYII=";
        await fs.writeFile(imagePath, Buffer.from(oneByOnePngBase64, "base64"));

        const read = await sandbox.read({ path: imagePath });
        expect(read.type).toBe("image");
        if (read.type !== "image") {
            return;
        }
        expect(read.mimeType).toBe("image/png");
        expect(read.content.length).toBeGreaterThan(0);
    });

    it("rejects reading symbolic links", async () => {
        const target = path.join(workingDir, "target.txt");
        const symlink = path.join(workingDir, "link.txt");
        await fs.writeFile(target, "data", "utf8");
        await fs.symlink(target, symlink);

        await expect(sandbox.read({ path: symlink })).rejects.toThrow("Cannot read symbolic link directly.");
    });

    it("rejects non-app access to app directories", async () => {
        const appPath = path.join(workingDir, "apps", "my-app", "APP.md");
        await fs.mkdir(path.dirname(appPath), { recursive: true });
        await fs.writeFile(appPath, "app", "utf8");

        await expect(sandbox.read({ path: appPath })).rejects.toThrow(`Read permission denied: ${appPath}`);
    });

    it("writes new files and creates parent directories", async () => {
        const outputPath = path.join(writeDir, "nested", "out.txt");

        const writeResult = await sandbox.write({
            path: outputPath,
            content: "hello"
        });
        expect(writeResult.bytes).toBe(5);
        expect(writeResult.resolvedPath).toBe(await fs.realpath(outputPath));
        expect(writeResult.sandboxPath).toBe("~/documents/nested/out.txt");
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("hello");
    });

    it("writes using ~/ path expansion", async () => {
        const outputPath = path.join(writeDir, "tilde.txt");

        const writeResult = await sandbox.write({
            path: "~/documents/tilde.txt",
            content: "hello-tilde"
        });
        expect(writeResult.resolvedPath).toBe(await fs.realpath(outputPath));
        expect(writeResult.sandboxPath).toBe("~/documents/tilde.txt");
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("hello-tilde");
    });

    it("appends to files when append is true", async () => {
        const outputPath = path.join(writeDir, "append.txt");
        await fs.writeFile(outputPath, "start", "utf8");

        await sandbox.write({
            path: outputPath,
            content: "-end",
            append: true
        });

        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("start-end");
    });

    it("writes exclusively and fails when file already exists", async () => {
        const outputPath = path.join(writeDir, "exclusive.txt");
        await sandbox.write({
            path: outputPath,
            content: "first",
            exclusive: true
        });

        await expect(
            sandbox.write({
                path: outputPath,
                content: "second",
                exclusive: true
            })
        ).rejects.toMatchObject({ code: "EEXIST" });
        await expect(fs.readFile(outputPath, "utf8")).resolves.toBe("first");
    });

    it("rejects append and exclusive when both are true", async () => {
        const outputPath = path.join(writeDir, "invalid-flags.txt");

        await expect(
            sandbox.write({
                path: outputPath,
                content: "invalid",
                append: true,
                exclusive: true
            })
        ).rejects.toThrow("append and exclusive cannot both be true.");
    });

    it("rejects writing outside granted directories", async () => {
        const outputPath = path.join(outsideDir, "out.txt");
        await expect(sandbox.write({ path: outputPath, content: "nope" })).rejects.toThrow(
            `Write permission denied: ${outputPath}`
        );
    });

    it("rejects writing to symbolic links", async () => {
        const target = path.join(writeDir, "target.txt");
        const symlink = path.join(writeDir, "link.txt");
        await fs.writeFile(target, "data", "utf8");
        await fs.symlink(target, symlink);

        await expect(sandbox.write({ path: symlink, content: "overwrite" })).rejects.toThrow(
            "Cannot write to symbolic link."
        );
    });

    it("reads binary content when binary mode is enabled", async () => {
        const binaryPath = path.join(workingDir, "file.bin");
        await fs.writeFile(binaryPath, Buffer.from([0, 1, 2, 3]));

        const read = await sandbox.read({ path: binaryPath, binary: true });
        expect(read.type).toBe("binary");
        if (read.type !== "binary") {
            return;
        }
        expect(read.content.equals(Buffer.from([0, 1, 2, 3]))).toBe(true);
    });

    itIfDockerSandbox("allows outbound network by default", async () => {
        const result = await sandbox.execBuffered({
            command: `curl -s -I --max-time 10 "https://microsoft.com"`
        });
        expect(result.failed).toBe(false);
        expect(result.stdout).toContain("HTTP/");
    });

    itIfDockerSandbox("streams stdout and kill removes child processes", async () => {
        const execution = await sandbox.exec({
            command: [
                "node -e ",
                "\"const fs = require('node:fs');",
                "const { spawn } = require('node:child_process');",
                "const child = spawn('bash', ['-lc', 'sleep 300']);",
                "fs.writeFileSync('/home/child.pid', String(child.pid));",
                "console.log('ready');",
                'setInterval(() => {}, 1000);"'
            ].join("")
        });
        const stdout = await streamTextReadUntil(execution.stdout, "ready\n");

        await execution.kill("SIGTERM");
        const result = await execution.wait();
        const check = await sandboxExecWaitForOutput(
            sandbox,
            [
                'pid="$(cat /home/child.pid 2>/dev/null || true)";',
                'if [ -z "$pid" ]; then echo gone;',
                'elif ! ps -p "$pid" >/dev/null 2>&1; then echo gone;',
                "elif ps -o stat= -p \"$pid\" 2>/dev/null | grep -q '^[Zz]'; then echo gone;",
                "else echo alive;",
                "fi"
            ].join(" "),
            "gone"
        );

        expect(stdout).toContain("ready");
        expect(result.signal).toBe("SIGTERM");
        expect(check).toBe("gone");
    });
});

async function streamTextReadUntil(stream: NodeJS.ReadableStream, needle: string): Promise<string> {
    let output = "";
    stream.setEncoding("utf8");
    await new Promise<void>((resolve, reject) => {
        const onData = (chunk: string) => {
            output += chunk;
            if (!output.includes(needle)) {
                return;
            }
            stream.removeListener("data", onData);
            stream.removeListener("error", onError);
            resolve();
        };
        const onError = (error: Error) => {
            stream.removeListener("data", onData);
            stream.removeListener("error", onError);
            reject(error);
        };
        stream.on("data", onData);
        stream.on("error", onError);
    });
    return output;
}

async function sandboxExecWaitForOutput(sandbox: Sandbox, command: string, expected: string): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const check = await sandbox.execBuffered({ command });
        const output = check.stdout.trim();
        if (output === expected) {
            return output;
        }
        await sleep(100);
    }

    const check = await sandbox.execBuffered({ command });
    return check.stdout.trim();
}

function dockerConfigBuild(userId: string) {
    return {
        readOnly: false,
        unconfinedSecurity: false,
        capAdd: [],
        capDrop: [],
        userId
    };
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function dockerSandboxAvailable(): boolean {
    if (process.env.CI) {
        return false;
    }
    try {
        execSync("docker image inspect daycare-runtime:latest", {
            stdio: ["ignore", "ignore", "ignore"],
            timeout: 5000
        });
        return true;
    } catch {
        return false;
    }
}
