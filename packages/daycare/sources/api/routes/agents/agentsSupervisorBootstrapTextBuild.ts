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
        "<bootstrap_request>",
        text,
        "</bootstrap_request>"
    ].join("\n");
}
