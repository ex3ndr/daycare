import type http from "node:http";
import type { AgentSkill } from "@/types";
import { skillsContent } from "./skillsContent.js";
import { skillsEject } from "./skillsEject.js";
import { skillsFileDownload } from "./skillsFileDownload.js";
import { skillsList } from "./skillsList.js";

export type SkillsRouteContext = {
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    personalRoot: string;
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

    if (pathname === "/skills/eject" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await skillsEject({
            personalRoot: context.personalRoot,
            skillName: typeof body.name === "string" ? body.name : "",
            destinationPath: typeof body.path === "string" ? body.path : ""
        });
        const statusCode = result.ok ? 200 : result.error.startsWith("Personal skill not found:") ? 404 : 400;
        context.sendJson(response, statusCode, result);
        return true;
    }

    const downloadMatch = pathname.match(/^\/skills\/(.+)\/download$/);
    if (downloadMatch?.[1] && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const result = await skillsFileDownload({
            skills: context.skills,
            skillId: decodeURIComponent(downloadMatch[1]),
            filePath: url.searchParams.get("path") ?? ""
        });
        if (!result.ok) {
            context.sendJson(response, result.statusCode, { ok: false, error: result.error });
            return true;
        }

        response.statusCode = 200;
        response.setHeader("Content-Type", result.file.mimeType);
        response.setHeader("Content-Length", String(result.content.length));
        response.setHeader(
            "Content-Disposition",
            `attachment; filename="${contentDispositionFilename(result.file.filename)}"`
        );
        response.end(result.content);
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

function contentDispositionFilename(filename: string): string {
    return filename.replaceAll("\\", "_").replaceAll('"', "_").replaceAll("\r", "_").replaceAll("\n", "_");
}
