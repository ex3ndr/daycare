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
        expect(workspaceRouteIdResolve("/team/fragment/frag-1")).toBe("team");
        expect(workspaceRouteIdResolve("/team/routine/task-1")).toBe("team");
        expect(workspaceRouteIdResolve("/team/file-preview/path")).toBe("team");
    });

    it("does not treat modal routes as workspace ids", () => {
        expect(workspaceRouteIdResolve("/routine/task-1")).toBeNull();
        expect(workspaceRouteIdResolve("/file-preview/path")).toBeNull();
    });
});

describe("workspaceCurrentIdResolve", () => {
    it("returns null until workspaces are loaded", () => {
        expect(workspaceCurrentIdResolve("team", [selfWorkspace, teamWorkspace], false)).toBeNull();
        expect(workspaceCurrentIdResolve(null, [selfWorkspace], false)).toBeNull();
    });

    it("returns the requested workspace only when it is accessible", () => {
        expect(workspaceCurrentIdResolve("team", [selfWorkspace, teamWorkspace], true)).toBe("team");
        expect(workspaceCurrentIdResolve("missing", [selfWorkspace, teamWorkspace], true)).toBeNull();
    });

    it("falls back to the personal workspace when no specific workspace is requested", () => {
        expect(workspaceCurrentIdResolve(null, [teamWorkspace, selfWorkspace], true)).toBe("self");
    });

    it("falls back to the first workspace when there is no personal workspace", () => {
        expect(workspaceCurrentIdResolve(null, [teamWorkspace], true)).toBe("team");
        expect(workspaceCurrentIdResolve(null, [], true)).toBeNull();
    });
});
