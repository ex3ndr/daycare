import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForUser } from "../../engine/agents/context.js";
import { jwtVerify } from "../../util/jwt.js";
import { appAuthLinkGenerate, appAuthLinkTool, appAuthLinkUrlBuild } from "./appAuthLinkTool.js";

describe("appAuthLinkUrlBuild", () => {
    it("builds auth URL", () => {
        const url = appAuthLinkUrlBuild("127.0.0.1", 7332, "token-1");
        expect(url).toBe("http://127.0.0.1:7332/auth?token=token-1");
    });
});

describe("appAuthLinkGenerate", () => {
    it("generates signed URL with token", async () => {
        const result = await appAuthLinkGenerate({
            host: "127.0.0.1",
            port: 7332,
            userId: "user-7",
            secret: "test-secret"
        });

        expect(result.url.startsWith("http://127.0.0.1:7332/auth?token=")).toBe(true);
        const payload = await jwtVerify(result.token, "test-secret");
        expect(payload.userId).toBe("user-7");
    });
});

describe("appAuthLinkTool", () => {
    it("uses context userId for tool execution", async () => {
        const tool = appAuthLinkTool({
            host: "127.0.0.1",
            port: 7332,
            secretResolve: async () => "test-secret"
        });

        const result = await tool.execute(
            {},
            {
                ctx: contextForUser({ userId: "user-11" })
            } as unknown as ToolExecutionContext,
            {
                id: "tool-call-1",
                name: "app_auth_link"
            }
        );

        expect(result.typedResult.userId).toBe("user-11");
        const token = result.typedResult.token;
        if (typeof token !== "string") {
            throw new Error("Expected tool token to be a string.");
        }
        const payload = await jwtVerify(token, "test-secret");
        expect(payload.userId).toBe("user-11");
    });
});
