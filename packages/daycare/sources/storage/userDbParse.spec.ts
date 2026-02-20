import { describe, expect, it } from "vitest";

import { userDbParse } from "./userDbParse.js";

describe("userDbParse", () => {
    it("maps is_owner 1 to isOwner=true", () => {
        const parsed = userDbParse({
            id: "u1",
            is_owner: 1,
            created_at: 10,
            updated_at: 20
        });
        expect(parsed.isOwner).toBe(true);
    });

    it("maps is_owner 0 to isOwner=false", () => {
        const parsed = userDbParse({
            id: "u1",
            is_owner: 0,
            created_at: 10,
            updated_at: 20
        });
        expect(parsed.isOwner).toBe(false);
    });
});
