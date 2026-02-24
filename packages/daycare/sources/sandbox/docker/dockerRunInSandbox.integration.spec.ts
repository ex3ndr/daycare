import { execSync } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DockerContainers } from "./dockerContainers.js";
import type { DockerContainerConfig } from "./dockerTypes.js";

const IMAGE = "daycare-runtime";
const TAG = "latest";

/** Returns true when Docker is reachable and daycare-runtime:latest exists locally. */
function dockerAvailable(): boolean {
    try {
        const output = execSync(`docker image inspect ${IMAGE}:${TAG}`, {
            stdio: ["pipe", "pipe", "pipe"],
            timeout: 5000
        });
        return output.length > 0;
    } catch {
        return false;
    }
}

const describeIfDocker = process.env.CI || !dockerAvailable() ? describe.skip : describe;

describeIfDocker("dockerRunInSandbox integration (live Docker)", () => {
    const userId = `test-${process.pid}`;
    let rootDir: string;
    let homeDir: string;
    let skillsActiveDir: string;
    let containers: DockerContainers;
    let config: DockerContainerConfig;

    beforeEach(async () => {
        rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-docker-integration-"));
        homeDir = path.join(rootDir, "home");
        skillsActiveDir = path.join(rootDir, "skills", "active");
        await fs.mkdir(homeDir, { recursive: true });
        await fs.mkdir(skillsActiveDir, { recursive: true });

        containers = new DockerContainers();
        config = {
            image: IMAGE,
            tag: TAG,
            unconfinedSecurity: false,
            userId,
            hostHomeDir: homeDir,
            hostSkillsActiveDir: skillsActiveDir
        };
    });

    afterEach(async () => {
        // Stop and remove the test container
        try {
            execSync(`docker rm -f daycare-sandbox-${userId}`, {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 10_000
            });
        } catch {
            // Container may not exist
        }
        await fs.rm(rootDir, { recursive: true, force: true });
    });

    it("runs a simple command and returns stdout", async () => {
        const result = await containers.exec(config, {
            command: ["echo", "hello from docker"],
            timeoutMs: 30_000
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe("hello from docker");
    });

    it("returns non-zero exit code for failing commands", async () => {
        const result = await containers.exec(config, {
            command: ["sh", "-c", "exit 42"],
            timeoutMs: 10_000
        });

        expect(result.exitCode).toBe(42);
    });

    it("captures stderr from commands", async () => {
        const result = await containers.exec(config, {
            command: ["sh", "-c", "echo err >&2"],
            timeoutMs: 10_000
        });

        expect(result.stderr.trim()).toBe("err");
    });

    // nvm is sourced via /etc/profile — use login shell for node commands
    it("runs node inside the container", async () => {
        const result = await containers.exec(config, {
            command: ["bash", "-lc", 'node -e "console.log(JSON.stringify({v: process.version, ok: true}))"'],
            timeoutMs: 30_000
        });

        expect(result.exitCode).toBe(0);
        const parsed = JSON.parse(result.stdout.trim());
        expect(parsed.ok).toBe(true);
        expect(parsed.v).toMatch(/^v\d+/);
    });

    it("has runnable srt binary", async () => {
        const result = await containers.exec(config, {
            command: ["bash", "-lc", "srt --help >/dev/null"],
            timeoutMs: 30_000
        });

        expect(result.exitCode).toBe(0);
    });

    it("mounts host home directory into container", async () => {
        const marker = `marker-${Date.now()}`;
        await fs.writeFile(path.join(homeDir, "test.txt"), marker, "utf8");

        const result = await containers.exec(config, {
            command: ["cat", "/home/test.txt"],
            timeoutMs: 10_000
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(marker);
    });

    it("writes from container are visible on host", async () => {
        await containers.exec(config, {
            command: ["sh", "-c", "echo written-by-container > /home/output.txt"],
            timeoutMs: 10_000
        });

        const content = await fs.readFile(path.join(homeDir, "output.txt"), "utf8");
        expect(content.trim()).toBe("written-by-container");
    });

    it("respects cwd option", async () => {
        const subDir = path.join(homeDir, "subdir");
        await fs.mkdir(subDir, { recursive: true });

        const result = await containers.exec(config, {
            command: ["pwd"],
            cwd: "/home/subdir",
            timeoutMs: 10_000
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe("/home/subdir");
    });

    it("passes environment variables to the container", async () => {
        const result = await containers.exec(config, {
            command: ["sh", "-c", "echo $DAYCARE_TEST_VAR"],
            env: { DAYCARE_TEST_VAR: "hello-env" },
            timeoutMs: 10_000
        });

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe("hello-env");
    });
});
