import { describe, expect, it, vi } from "vitest";

import { exposeCreateToolBuild } from "./exposeCreateToolBuild.js";
import { exposeListToolBuild } from "./exposeListToolBuild.js";
import { exposeRemoveToolBuild } from "./exposeRemoveToolBuild.js";
import { exposeUpdateToolBuild } from "./exposeUpdateToolBuild.js";

function toolContextBuild(
    options: {
        findMany?: () => Promise<unknown[]>;
        findById?: (id: string) => Promise<{ id: string; userId: string } | null>;
    } = {}
) {
    return {
        ctx: {
            agentId: "agent-1",
            userId: "user-1"
        },
        agentSystem: {
            storage: {
                exposeEndpoints: {
                    findMany: options.findMany ?? (async () => []),
                    findById: options.findById ?? (async () => null)
                }
            }
        }
    } as never;
}

describe("expose tools", () => {
    it("creates endpoint with port target and returns password", async () => {
        const create = vi.fn(async () => ({
            endpoint: {
                id: "ep-1",
                target: { type: "port" as const, port: 3000 },
                provider: "provider-a",
                domain: "ep-1.example.com",
                mode: "public" as const,
                auth: { enabled: true as const, passwordHash: "hash" },
                createdAt: 1,
                updatedAt: 1
            },
            password: "secret"
        }));

        const tool = exposeCreateToolBuild({ create } as never);
        const result = await tool.execute(
            {
                port: 3000,
                mode: "public",
                authenticated: true
            },
            toolContextBuild(),
            { id: "tool-1", name: "expose_create" }
        );

        expect(create).toHaveBeenCalledWith(
            {
                target: { type: "port", port: 3000 },
                provider: undefined,
                mode: "public",
                authenticated: true
            },
            "user-1"
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(result.toolMessage.content[0]).toEqual(
            expect.objectContaining({ text: expect.stringContaining("Password: secret") })
        );
    });

    it("rejects create when both target types are provided", async () => {
        const tool = exposeCreateToolBuild({
            create: async () => ({
                endpoint: {} as never
            })
        } as never);

        await expect(
            tool.execute(
                {
                    port: 3000,
                    unixSocket: "/tmp/server.sock"
                },
                toolContextBuild(),
                { id: "tool-1", name: "expose_create" }
            )
        ).rejects.toThrow("Provide exactly one");
    });

    it("removes endpoint by id", async () => {
        const remove = vi.fn(async () => undefined);
        const tool = exposeRemoveToolBuild({ remove } as never);

        const result = await tool.execute(
            { endpointId: "ep-1" },
            toolContextBuild({
                findById: async () => ({ id: "ep-1", userId: "user-1" })
            }),
            { id: "tool-1", name: "expose_remove" }
        );

        expect(remove).toHaveBeenCalledWith("ep-1");
        expect(result.toolMessage.isError).toBe(false);
    });

    it("rejects remove for endpoint outside caller user scope", async () => {
        const remove = vi.fn(async () => undefined);
        const tool = exposeRemoveToolBuild({ remove } as never);

        await expect(
            tool.execute(
                { endpointId: "ep-1" },
                toolContextBuild({
                    findById: async () => ({ id: "ep-1", userId: "user-2" })
                }),
                { id: "tool-1", name: "expose_remove" }
            )
        ).rejects.toThrow("Expose endpoint not found: ep-1");
        expect(remove).not.toHaveBeenCalled();
    });

    it("updates authentication and returns generated password", async () => {
        const update = vi.fn(async () => ({
            endpoint: {
                id: "ep-1",
                target: { type: "port" as const, port: 3000 },
                provider: "provider-a",
                domain: "ep-1.example.com",
                mode: "public" as const,
                auth: { enabled: true as const, passwordHash: "hash2" },
                createdAt: 1,
                updatedAt: 2
            },
            password: "new-secret"
        }));

        const tool = exposeUpdateToolBuild({ update } as never);
        const result = await tool.execute(
            {
                endpointId: "ep-1",
                authenticated: true
            },
            toolContextBuild({
                findById: async () => ({ id: "ep-1", userId: "user-1" })
            }),
            { id: "tool-1", name: "expose_update" }
        );

        expect(update).toHaveBeenCalledWith("ep-1", { authenticated: true });
        expect(result.toolMessage.content[0]).toEqual(
            expect.objectContaining({ text: expect.stringContaining("new-secret") })
        );
    });

    it("rejects update for endpoint outside caller user scope", async () => {
        const update = vi.fn(async () => ({
            endpoint: {} as never,
            password: undefined
        }));

        const tool = exposeUpdateToolBuild({ update } as never);
        await expect(
            tool.execute(
                {
                    endpointId: "ep-1",
                    authenticated: true
                },
                toolContextBuild({
                    findById: async () => ({ id: "ep-1", userId: "user-2" })
                }),
                { id: "tool-1", name: "expose_update" }
            )
        ).rejects.toThrow("Expose endpoint not found: ep-1");
        expect(update).not.toHaveBeenCalled();
    });

    it("lists endpoints and providers", async () => {
        const list = vi.fn(async () => [
            {
                id: "ep-1",
                target: { type: "port" as const, port: 3000 },
                provider: "provider-a",
                domain: "ep-1.example.com",
                mode: "public" as const,
                auth: null,
                createdAt: 1,
                updatedAt: 1
            }
        ]);
        const listProviders = vi.fn(() => [
            {
                instanceId: "provider-a",
                domain: "example.com",
                capabilities: { public: true, localNetwork: false }
            }
        ]);

        const tool = exposeListToolBuild({ list, listProviders } as never);
        const result = await tool.execute(
            {},
            toolContextBuild({
                findMany: async () => [
                    {
                        id: "ep-1",
                        target: { type: "port" as const, port: 3000 },
                        provider: "provider-a",
                        domain: "ep-1.example.com",
                        mode: "public" as const,
                        auth: null,
                        createdAt: 1,
                        updatedAt: 1
                    }
                ]
            }),
            { id: "tool-1", name: "expose_list" }
        );

        expect(list).not.toHaveBeenCalled();
        expect(listProviders).toHaveBeenCalledTimes(1);
        expect(result.toolMessage.content[0]).toEqual(
            expect.objectContaining({ text: expect.stringContaining("Expose endpoints: 1") })
        );
    });
});
