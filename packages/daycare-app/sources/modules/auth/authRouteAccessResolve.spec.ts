import { describe, expect, it } from "vitest";
import { authRouteAccessResolve } from "./authRouteAccessResolve";

describe("authRouteAccessResolve", () => {
    it("keeps auth routes open for unauthenticated users", () => {
        expect(authRouteAccessResolve("unauthenticated", null)).toEqual({
            allowApp: false,
            allowAuth: true
        });
    });

    it("keeps only app routes open for authenticated users without a deep link", () => {
        expect(authRouteAccessResolve("authenticated", "http://app.daycare.local/home")).toEqual({
            allowApp: true,
            allowAuth: false
        });
    });

    it("keeps auth routes open for authenticated users entering through connect-email links", () => {
        const payload = Buffer.from(
            JSON.stringify({
                backendUrl: "http://api.daycare.local",
                token: "token-1",
                kind: "connect-email"
            }),
            "utf8"
        ).toString("base64url");

        expect(authRouteAccessResolve("authenticated", `http://app.daycare.local/auth#${payload}`)).toEqual({
            allowApp: true,
            allowAuth: true
        });
    });
});
