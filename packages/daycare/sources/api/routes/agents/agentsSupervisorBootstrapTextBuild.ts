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
        "Create vault entries to capture knowledge:",
        '- Create a "mission" vault entry (slug: "mission") describing the mission, goals, and constraints.',
        '- Create an "owner" vault entry (slug: "owner") with what you learn about the owner/user.',
        '- Create a "company" vault entry (slug: "company") if the mission involves a business or organization.',
        "- Create additional vault entries for research findings, competitive landscape, target audience, etc.",
        '- Use vault_write with parentPath under "vault://vault" plus clear titles and descriptions. Keep vault entries focused and well-structured.',
        "",
        "When done, mark the workspace as ready:",
        "- Call user_profile_update with configuration: { homeReady: true, appReady: true }.",
        "- Do this only after the vault is populated.",
        "",
        "<bootstrap_request>",
        text,
        "</bootstrap_request>"
    ].join("\n");
}
