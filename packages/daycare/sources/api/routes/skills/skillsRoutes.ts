import type http from "node:http";
import type { AgentSkill } from "@/types";
import { skillsContent } from "./skillsContent.js";
import { skillsList } from "./skillsList.js";

export type SkillsRouteContext = {
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    skills: {
        list: () => Promise<AgentSkill[]>;
    } | null;
};

/**
 * Routes authenticated skill APIs.
 * Returns true if a /skills endpoint handled the request.
 */
export async function skillsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: SkillsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/skills")) {
        return false;
    }

    if (!context.skills) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Skills runtime unavailable."
        });
        return true;
    }

    if (pathname === "/skills" && request.method === "GET") {
        const result = await skillsList({ skills: context.skills });
        context.sendJson(response, 200, result);
        return true;
    }

    const contentMatch = pathname.match(/^\/skills\/(.+)\/content$/);
    if (contentMatch?.[1] && request.method === "GET") {
        const result = await skillsContent({
            skills: context.skills,
            skillId: decodeURIComponent(contentMatch[1])
        });
        const statusCode = result.ok ? 200 : result.error === "Skill not found." ? 404 : 400;
        context.sendJson(response, statusCode, result);
        return true;
    }

    return false;
}
