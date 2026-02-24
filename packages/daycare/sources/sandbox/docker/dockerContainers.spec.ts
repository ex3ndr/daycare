import { describe, expect, it, vi } from "vitest";
import { dockerContainerEnsure } from "./dockerContainerEnsure.js";
import { dockerContainerExec } from "./dockerContainerExec.js";
import { DockerContainers } from "./dockerContainers.js";
import { dockerNetworkNameResolveForUser } from "./dockerNetworkNameResolveForUser.js";
import { dockerNetworksEnsure } from "./dockerNetworksEnsure.js";

vi.mock("dockerode", () => ({
    default: vi.fn().mockImplementation(() => ({}))
}));

vi.mock("./dockerContainerEnsure.js", () => ({
    dockerContainerEnsure: vi.fn()
}));

vi.mock("./dockerContainerExec.js", () => ({
    dockerContainerExec: vi.fn()
}));

vi.mock("./dockerNetworkNameResolveForUser.js", () => ({
    dockerNetworkNameResolveForUser: vi.fn()
}));

vi.mock("./dockerNetworksEnsure.js", () => ({
    dockerNetworksEnsure: vi.fn()
}));

describe("DockerContainers", () => {
    it("ensures networks and resolves user network before container ensure", async () => {
        const facade = new DockerContainers();
        vi.mocked(dockerNetworkNameResolveForUser).mockReturnValue("daycare-isolated");
        vi.mocked(dockerContainerEnsure).mockResolvedValue({ id: "container" } as never);
        vi.mocked(dockerContainerExec).mockResolvedValue({
            stdout: "ok",
            stderr: "",
            exitCode: 0
        });

        const config = {
            image: "daycare-sandbox",
            tag: "latest",
            readOnly: false,
            unconfinedSecurity: false,
            capAdd: [],
            capDrop: [],
            userId: "user-1",
            hostHomeDir: "/tmp/home",
            hostSkillsActiveDir: "/tmp/skills",
            allowLocalNetworkingForUsers: ["user-2"]
        };
        const args = {
            command: ["echo", "ok"]
        };

        const result = await facade.exec(config, args);
        await facade.exec(config, args);

        expect(result.exitCode).toBe(0);
        expect(dockerNetworksEnsure).toHaveBeenCalledTimes(1);
        expect(dockerNetworkNameResolveForUser).toHaveBeenCalledWith("user-1", ["user-2"]);
        expect(dockerContainerEnsure).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                userId: "user-1",
                networkName: "daycare-isolated"
            })
        );
    });

    it("defaults to isolated network when allowlist is omitted", async () => {
        const facade = new DockerContainers();
        vi.mocked(dockerNetworkNameResolveForUser).mockReturnValue("daycare-isolated");
        vi.mocked(dockerContainerEnsure).mockResolvedValue({ id: "container" } as never);
        vi.mocked(dockerContainerExec).mockResolvedValue({
            stdout: "ok",
            stderr: "",
            exitCode: 0
        });

        await facade.exec(
            {
                image: "daycare-sandbox",
                tag: "latest",
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                userId: "user-1",
                hostHomeDir: "/tmp/home",
                hostSkillsActiveDir: "/tmp/skills"
            },
            {
                command: ["echo", "ok"]
            }
        );

        expect(dockerNetworkNameResolveForUser).toHaveBeenCalledWith("user-1", []);
    });
});
