import { describe, expect, it } from "vitest";
import { workspaceCurrentIdResolve, workspaceRouteIdResolve } from "./workspaceIdResolve";
import type { WorkspaceListItem } from "./workspacesFetch";

const selfWorkspace: WorkspaceListItem = {
    userId: "self",
    nametag: "self",
    firstName: "Self",
    lastName: null,
    emoji: null,
    isSelf: true
};

const teamWorkspace: WorkspaceListItem = {
    userId: "team",
    nametag: "team",
    firstName: "Team",
    lastName: null,
    emoji: null,
    isSelf: false
};

describe("workspaceRouteIdResolve", () => {
    it("returns the workspace id for workspace-scoped routes", () => {
        expect(workspaceRouteIdResolve("/team/documents")).toBe("team");
        expect(workspaceRouteIdResolve("/self/agents/agent-1")).toBe("self");
    });

    it("does not treat modal routes as workspace ids", () => {
        expect(workspaceRouteIdResolve("/routine/task-1")).toBeNull();
        expect(workspaceRouteIdResolve("/file-preview/path")).toBeNull();
    });
});

describe("workspaceCurrentIdResolve", () => {
    it("prefers the workspace from the route", () => {
        expect(workspaceCurrentIdResolve("team", undefined, [selfWorkspace])).toBe("team");
    });

    it("falls back to the workspace query param", () => {
        expect(workspaceCurrentIdResolve(null, "team", [selfWorkspace])).toBe("team");
        expect(workspaceCurrentIdResolve(null, ["", "team"], [selfWorkspace])).toBe("team");
    });

    it("falls back to the personal workspace when no route workspace exists", () => {
        expect(workspaceCurrentIdResolve(null, undefined, [teamWorkspace, selfWorkspace])).toBe("self");
    });

    it("falls back to the first workspace when there is no personal workspace", () => {
        expect(workspaceCurrentIdResolve(null, undefined, [teamWorkspace])).toBe("team");
        expect(workspaceCurrentIdResolve(null, undefined, [])).toBeNull();
    });
});
