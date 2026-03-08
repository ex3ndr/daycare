/**
 * Wraps a client bootstrap request so the supervisor can treat it as startup context.
 * Expects: text is already trimmed and non-empty.
 */
export function agentsSupervisorBootstrapTextBuild(text: string): string {
    return [
        "A client bootstrap request follows.",
        "Take ownership of supervising the work, executing what you can directly, and delegating focused subtasks when useful.",
        "Extract the goal, constraints, and next concrete actions before proceeding.",
        "",
        "Create documents to capture knowledge:",
        '- Create a "mission" document (slug: "mission") describing the mission, goals, and constraints.',
        '- Create an "owner" document (slug: "owner") with what you learn about the owner/user.',
        '- Create a "company" document (slug: "company") if the mission involves a business or organization.',
        "- Create additional documents for research findings, competitive landscape, target audience, etc.",
        "- Use document_write with clear titles and descriptions. Keep documents focused and well-structured.",
        "",
        "Use todos to track progress:",
        "- Break the mission into concrete, actionable todos using todo_create.",
        "- Nest subtasks under parent todos for structure.",
        "- Update todo status as work progresses (unstarted → started → finished).",
        "- The user sees todos in the app, so keep titles clear and descriptive.",
        "",
        "When done, mark the workspace as ready:",
        "- Call user_profile_update with configuration: { homeReady: true, appReady: true }.",
        "- Do this only after documents and todos are populated.",
        "",
        "<bootstrap_request>",
        text,
        "</bootstrap_request>"
    ].join("\n");
}
