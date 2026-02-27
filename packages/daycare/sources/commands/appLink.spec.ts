import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configLoad } from "../config/configLoad.js";
import { appAuthLinkGenerate } from "../plugins/daycare-app-server/appAuthLinkTool.js";
import { appJwtSecretResolve } from "../plugins/daycare-app-server/appJwtSecretResolve.js";
import { appLinkCommand } from "./appLink.js";

vi.mock("../config/configLoad.js", () => ({
    configLoad: vi.fn()
}));

vi.mock("../plugins/daycare-app-server/appAuthLinkTool.js", () => ({
    APP_AUTH_EXPIRES_IN_SECONDS: 3600,
    appAuthLinkGenerate: vi.fn()
}));

vi.mock("../plugins/daycare-app-server/appJwtSecretResolve.js", () => ({
    appJwtSecretResolve: vi.fn()
}));

describe("appLinkCommand", () => {
    const configLoadMock = vi.mocked(configLoad);
    const appJwtSecretResolveMock = vi.mocked(appJwtSecretResolve);
    const appAuthLinkGenerateMock = vi.mocked(appAuthLinkGenerate);

    beforeEach(() => {
        process.exitCode = undefined;
        configLoadMock.mockReset();
        appJwtSecretResolveMock.mockReset();
        appAuthLinkGenerateMock.mockReset();
        vi.spyOn(console, "log").mockImplementation(() => undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);

        configLoadMock.mockResolvedValue({
            settingsPath: "/tmp/settings.json",
            configDir: "/tmp",
            dataDir: "/tmp/data",
            agentsDir: "/tmp/agents",
            usersDir: "/tmp/users",
            path: "/tmp/daycare.sqlite",
            url: null,
            dbAutoMigrate: true,
            authPath: "/tmp/auth.json",
            socketPath: "/tmp/daycare.sock",
            docker: {
                enabled: false,
                image: "none",
                tag: "none",
                enableWeakerNestedSandbox: false,
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                allowLocalNetworkingForUsers: [],
                isolatedDnsServers: [],
                localDnsServers: []
            },
            settings: {
                engine: {},
                assistant: {},
                agents: { emergencyContextLimit: 100 },
                security: { appReviewerEnabled: true },
                plugins: [
                    {
                        instanceId: "daycare-app-server",
                        pluginId: "daycare-app-server",
                        settings: {
                            host: "127.0.0.1",
                            port: 7332,
                            jwtSecret: "settings-secret"
                        }
                    }
                ],
                providers: [],
                inference: {},
                cron: {},
                memory: {},
                models: {}
            },
            verbose: false
        } as never);

        appJwtSecretResolveMock.mockResolvedValue("resolved-secret");
        appAuthLinkGenerateMock.mockResolvedValue({
            url: "http://127.0.0.1:7332/auth?token=token-1",
            token: "token-1",
            userId: "user-1",
            expiresAt: 123
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("generates an app auth link and prints it", async () => {
        await appLinkCommand("user-1", {});

        expect(appJwtSecretResolveMock).toHaveBeenCalledWith("settings-secret", expect.any(Object));
        expect(appAuthLinkGenerateMock).toHaveBeenCalledWith({
            host: "127.0.0.1",
            port: 7332,
            userId: "user-1",
            secret: "resolved-secret",
            expiresInSeconds: 3600
        });
        expect(console.log).toHaveBeenCalledWith("http://127.0.0.1:7332/auth?token=token-1");
        expect(process.exitCode).toBeUndefined();
    });

    it("prints json payload when json option is enabled", async () => {
        await appLinkCommand("user-1", { json: true });

        expect(console.log).toHaveBeenCalledWith(
            JSON.stringify(
                {
                    url: "http://127.0.0.1:7332/auth?token=token-1",
                    token: "token-1",
                    userId: "user-1",
                    expiresAt: 123
                },
                null,
                2
            )
        );
    });

    it("sets non-zero exit code for empty user id", async () => {
        await appLinkCommand("   ", {});

        expect(appAuthLinkGenerateMock).not.toHaveBeenCalled();
        expect(process.exitCode).toBe(1);
        expect(console.error).toHaveBeenCalledWith("Failed to generate app link: userId is required.");
    });
});
