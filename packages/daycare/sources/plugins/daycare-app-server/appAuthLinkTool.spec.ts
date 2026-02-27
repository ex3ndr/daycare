import { describe, expect, it } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { contextForUser } from "../../engine/agents/context.js";
import { jwtVerify } from "../../util/jwt.js";
import { appAuthLinkGenerate, appAuthLinkTool, appAuthLinkUrlBuild } from "./appAuthLinkTool.js";

describe("appAuthLinkUrlBuild", () => {
    it("builds auth URL", () => {
        const url = appAuthLinkUrlBuild("127.0.0.1", 7332, "token-1");
        const parsed = new URL(url);
        expect(parsed.origin).toBe("http://127.0.0.1:7332");
        expect(parsed.pathname).toBe("/auth");
        expect(appAuthLinkPayloadDecode(url)).toEqual({
            backendUrl: "http://127.0.0.1:7332",
            token: "token-1"
        });
    });

    it("uses public domain in generated URL and payload backend", () => {
        const url = appAuthLinkUrlBuild("0.0.0.0", 7332, "token-1", "app.example.com");
        const parsed = new URL(url);
        expect(parsed.origin).toBe("https://app.example.com");
        expect(parsed.pathname).toBe("/auth");
        expect(appAuthLinkPayloadDecode(url)).toEqual({
            backendUrl: "https://app.example.com",
            token: "token-1"
        });
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

        expect(result.url.startsWith("http://127.0.0.1:7332/auth#")).toBe(true);
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

function appAuthLinkPayloadDecode(url: string): { backendUrl: string; token: string } {
    const parsed = new URL(url);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    return JSON.parse(Buffer.from(hash, "base64url").toString("utf8")) as {
        backendUrl: string;
        token: string;
    };
}
