import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("node:fs/promises", () => ({
    access: vi.fn(),
    readFile: vi.fn()
}));

import { access, readFile } from "node:fs/promises";

import { sandboxDockerEnvironmentIs } from "./sandboxDockerEnvironmentIs.js";

describe("sandboxDockerEnvironmentIs", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns true when /.dockerenv is readable", async () => {
        vi.mocked(access).mockResolvedValue(undefined);

        await expect(sandboxDockerEnvironmentIs()).resolves.toBe(true);
        expect(readFile).not.toHaveBeenCalled();
    });

    it("returns true when cgroup indicates a container runtime", async () => {
        vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));
        vi.mocked(readFile).mockResolvedValueOnce("1:name=systemd:/docker/abc123");

        await expect(sandboxDockerEnvironmentIs()).resolves.toBe(true);
    });

    it("returns false when no docker markers are present", async () => {
        vi.mocked(access).mockRejectedValueOnce(new Error("ENOENT"));
        vi.mocked(readFile).mockResolvedValueOnce("1:name=systemd:/");

        await expect(sandboxDockerEnvironmentIs()).resolves.toBe(false);
    });
});
