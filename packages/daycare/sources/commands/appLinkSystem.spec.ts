import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configLoad } from "../config/configLoad.js";
import { workspaceSystemEnsure } from "../engine/workspaces/workspaceSystemEnsure.js";
import { databaseClose } from "../storage/databaseClose.js";
import { storageOpen } from "../storage/storageOpen.js";
import { appLinkCommand } from "./appLink.js";
import { appLinkSystemCommand } from "./appLinkSystem.js";

vi.mock("../commands/appLink.js", () => ({
    appLinkCommand: vi.fn()
}));

vi.mock("../config/configLoad.js", () => ({
    configLoad: vi.fn()
}));

vi.mock("../engine/workspaces/workspaceSystemEnsure.js", () => ({
    workspaceSystemEnsure: vi.fn()
}));

vi.mock("../storage/storageOpen.js", () => ({
    storageOpen: vi.fn()
}));

vi.mock("../storage/databaseClose.js", () => ({
    databaseClose: vi.fn()
}));

describe("appLinkSystemCommand", () => {
    const configLoadMock = vi.mocked(configLoad);
    const workspaceSystemEnsureMock = vi.mocked(workspaceSystemEnsure);
    const storageOpenMock = vi.mocked(storageOpen);
    const databaseCloseMock = vi.mocked(databaseClose);
    const appLinkCommandMock = vi.mocked(appLinkCommand);

    beforeEach(() => {
        process.exitCode = undefined;
        configLoadMock.mockReset();
        workspaceSystemEnsureMock.mockReset();
        storageOpenMock.mockReset();
        databaseCloseMock.mockReset();
        appLinkCommandMock.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        configLoadMock.mockResolvedValue({
            db: {
                path: "/tmp/daycare.sqlite",
                url: null,
                autoMigrate: true
            }
        } as never);
        storageOpenMock.mockResolvedValue({
            users: {
                findByNametag: vi.fn(async () => ({
                    id: "workspace-system-1",
                    isWorkspace: true
                }))
            },
            connection: { close: vi.fn(async () => undefined) }
        } as never);
        appLinkCommandMock.mockResolvedValue(undefined);
        databaseCloseMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("resolves the system workspace and delegates to appLinkCommand", async () => {
        await appLinkSystemCommand({ json: true, settings: "/tmp/settings.json" });

        expect(workspaceSystemEnsureMock).toHaveBeenCalledWith({
            storage: expect.objectContaining({
                users: expect.any(Object)
            })
        });
        expect(appLinkCommandMock).toHaveBeenCalledWith("workspace-system-1", {
            json: true,
            settings: "/tmp/settings.json"
        });
        expect(databaseCloseMock).toHaveBeenCalledWith(expect.objectContaining({ close: expect.any(Function) }));
    });

    it("sets non-zero exit code when the system workspace cannot be resolved", async () => {
        storageOpenMock.mockResolvedValue({
            users: {
                findByNametag: vi.fn(async () => null)
            },
            connection: { close: vi.fn(async () => undefined) }
        } as never);

        await appLinkSystemCommand({});

        expect(appLinkCommandMock).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith(
            "Failed to generate system workspace app link: System workspace not found."
        );
    });
});
