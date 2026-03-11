/**
 * Engine roles for role-based decoupling.
 *
 * Roles control which Engine subsystems are initialized at startup.
 * Multiple roles can be active simultaneously.
 */

/**
 * Available engine roles:
 * - `all`: All subsystems (default, backward-compatible behavior)
 * - `api`: HTTP API server, webhooks, routes
 * - `worker`: Agent execution, inference, tools, sandbox
 * - `scheduler`: Crons, delayed signals, task execution
 * - `connector`: Plugin manager (telegram, whatsapp, etc.)
 */
export type EngineRole = "all" | "api" | "worker" | "scheduler" | "connector";

export const ENGINE_ROLES: readonly EngineRole[] = ["all", "api", "worker", "scheduler", "connector"] as const;

export const DEFAULT_ENGINE_ROLE: EngineRole = "all";

/**
 * Role descriptions for documentation and help text.
 */
export const ENGINE_ROLE_DESCRIPTIONS: Record<EngineRole, string> = {
    all: "All subsystems (default, full engine)",
    api: "HTTP API server, webhooks, and routes",
    worker: "Agent execution, inference, tools, and sandbox",
    scheduler: "Cron jobs, delayed signals, and task execution",
    connector: "Connectors and plugins (Telegram, WhatsApp, etc.)"
};

/**
 * Parse a role string into an EngineRole.
 * Returns undefined for invalid roles.
 */
export function parseEngineRole(value: string): EngineRole | undefined {
    const normalized = value.toLowerCase().trim();
    if (ENGINE_ROLES.includes(normalized as EngineRole)) {
        return normalized as EngineRole;
    }
    return undefined;
}

/**
 * Resolve roles from input. If "all" is present or no roles specified, returns ["all"].
 */
export function resolveEngineRoles(roles: EngineRole[] | undefined): EngineRole[] {
    if (!roles || roles.length === 0 || roles.includes("all")) {
        return ["all"];
    }
    return [...new Set(roles)];
}

/**
 * Check if a specific role is active given the resolved roles array.
 * If "all" is in the array, all roles are considered active.
 */
export function isRoleActive(roles: EngineRole[], role: EngineRole): boolean {
    return roles.includes("all") || roles.includes(role);
}

/**
 * Subsystem categories mapped to their required roles.
 * Used by Engine to gate initialization.
 */
export type SubsystemCategory =
    | "core" // Always initialized
    | "api" // HTTP server, webhooks
    | "worker" // Agents, inference, tools
    | "scheduler" // Crons, delayed signals
    | "connector"; // Plugins, connectors

/**
 * Check if a subsystem category should be initialized given active roles.
 */
export function shouldInitializeSubsystem(roles: EngineRole[], category: SubsystemCategory): boolean {
    if (category === "core") {
        return true; // Core subsystems always initialize
    }
    return isRoleActive(roles, category as EngineRole);
}
