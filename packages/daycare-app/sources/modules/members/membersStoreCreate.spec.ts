import { afterEach, describe, expect, it, vi } from "vitest";
import { membersFetch } from "./membersFetch";
import { membersStoreCreate } from "./membersStoreCreate";

vi.mock("./membersFetch", () => ({
    membersFetch: vi.fn()
}));

describe("membersStoreCreate", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    it("stores fetched members", async () => {
        vi.mocked(membersFetch).mockResolvedValueOnce([
            {
                userId: "owner-1",
                nametag: "owner",
                firstName: "Owner",
                lastName: null,
                joinedAt: 1,
                isOwner: true
            }
        ]);

        const store = membersStoreCreate();
        await store.getState().fetch("http://localhost", "tok", "workspace-a");

        expect(membersFetch).toHaveBeenCalledWith("http://localhost", "tok", "workspace-a");
        expect(store.getState().members).toEqual([
            {
                userId: "owner-1",
                nametag: "owner",
                firstName: "Owner",
                lastName: null,
                joinedAt: 1,
                isOwner: true
            }
        ]);
        expect(store.getState().error).toBeNull();
    });

    it("stores fetch errors and removes kicked members locally", async () => {
        vi.mocked(membersFetch).mockRejectedValueOnce(new Error("network down"));

        const store = membersStoreCreate();
        store.setState({
            members: [
                {
                    userId: "member-1",
                    nametag: "member",
                    firstName: null,
                    lastName: null,
                    joinedAt: 1,
                    isOwner: false
                }
            ]
        });

        store.getState().applyKicked("member-1");
        expect(store.getState().members).toEqual([]);

        await store.getState().fetch("http://localhost", "tok", "workspace-a");
        expect(store.getState().error).toBe("network down");
        expect(store.getState().loading).toBe(false);
    });
});
