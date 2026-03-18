const DAYCARE_ROLES_ENV = "DAYCARE_ROLES";
export const DAYCARE_ROLE_VALUES = ["api", "agents", "signals", "processes", "tasks"] as const;
export type DaycareRole = (typeof DAYCARE_ROLE_VALUES)[number];
const DAYCARE_ROLE_SET = new Set<string>(DAYCARE_ROLE_VALUES);
const PROCESS_ROLES = rolesResolve(process.env);

/**
 * Returns whether the current Node.js process has the requested runtime role.
 * Expects: roles come from DAYCARE_ROLES as a comma-separated list; unset means no roles.
 */
export function hasRole(role: DaycareRole): boolean {
    return PROCESS_ROLES.includes(role);
}

/**
 * Returns the roles assigned to the current Node.js process at boot time.
 * Expects: DAYCARE_ROLES values are validated when this module loads.
 */
export function rolesCurrentList(): DaycareRole[] {
    return [...PROCESS_ROLES];
}

function rolesResolve(env: NodeJS.ProcessEnv): DaycareRole[] {
    const raw = env[DAYCARE_ROLES_ENV]?.trim();
    if (!raw) {
        return [];
    }

    return Array.from(
        new Set(
            raw
                .split(",")
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
                .map((entry) => roleParse(entry))
        )
    );
}

function roleParse(value: string): DaycareRole {
    if (!DAYCARE_ROLE_SET.has(value)) {
        throw new Error(`Unknown DAYCARE_ROLES entry: ${value}. Expected one of ${DAYCARE_ROLE_VALUES.join(", ")}.`);
    }
    return value as DaycareRole;
}
