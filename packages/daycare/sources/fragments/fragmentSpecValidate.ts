import { fragmentSchema } from "./_fragmentSchema.js";

export interface FragmentSpecIssue {
    severity: "error" | "warning";
    message: string;
    elementKey?: string;
}

export interface FragmentSpecValidationResult {
    valid: boolean;
    issues: FragmentSpecIssue[];
}

type Spec = {
    root?: unknown;
    elements?: unknown;
    state?: unknown;
    code?: unknown;
};

type Element = {
    type?: unknown;
    props?: unknown;
    children?: unknown;
    [key: string]: unknown;
};

const componentNames = new Set(Object.keys(fragmentSchema));
const componentProps = new Map(
    Object.entries(fragmentSchema).map(([name, meta]) => [name, new Set<string>(meta.props)] as const)
);

/**
 * Validates a fragment spec against the catalog schema.
 * Checks structural integrity, component types, and prop names.
 *
 * Expects: spec is a parsed object (not a string).
 */
export function fragmentSpecValidate(spec: unknown): FragmentSpecValidationResult {
    const issues: FragmentSpecIssue[] = [];

    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        issues.push({ severity: "error", message: "Spec must be an object." });
        return { valid: false, issues };
    }

    const s = spec as Spec;

    // Root validation
    if (typeof s.root !== "string" || !s.root) {
        issues.push({ severity: "error", message: "Spec must have a non-empty 'root' string." });
        return { valid: false, issues };
    }

    // Elements validation
    if (!s.elements || typeof s.elements !== "object" || Array.isArray(s.elements)) {
        issues.push({ severity: "error", message: "Spec must have an 'elements' object." });
        return { valid: false, issues };
    }

    const elements = s.elements as Record<string, unknown>;
    const elementKeys = new Set(Object.keys(elements));

    if (elementKeys.size === 0) {
        issues.push({ severity: "error", message: "Spec 'elements' must not be empty." });
        return { valid: false, issues };
    }

    if (s.code !== undefined) {
        if (typeof s.code !== "string") {
            issues.push({ severity: "error", message: "Spec 'code' must be a string when provided." });
        } else if (!s.code.trim()) {
            issues.push({ severity: "warning", message: "Spec 'code' is empty and will be ignored." });
        }
    }

    // Root must reference an existing element
    if (!elementKeys.has(s.root)) {
        issues.push({
            severity: "error",
            message: `Root "${s.root}" not found in elements.`,
            elementKey: s.root
        });
    }

    // Validate each element
    const reachable = new Set<string>();
    const queue = [s.root];

    while (queue.length > 0) {
        const key = queue.pop()!;
        if (reachable.has(key)) continue;
        reachable.add(key);

        const el = elements[key];
        if (!el || typeof el !== "object" || Array.isArray(el)) continue;

        const element = el as Element;
        validateElement(key, element, elementKeys, issues, queue);
    }

    // Warn about orphaned elements
    for (const key of elementKeys) {
        if (!reachable.has(key)) {
            issues.push({
                severity: "warning",
                message: `Element "${key}" is not reachable from root "${s.root}".`,
                elementKey: key
            });
        }
    }

    const hasErrors = issues.some((i) => i.severity === "error");
    return { valid: !hasErrors, issues };
}

function validateElement(
    key: string,
    element: Element,
    elementKeys: Set<string>,
    issues: FragmentSpecIssue[],
    queue: string[]
): void {
    // Type must be a known component
    if (typeof element.type !== "string" || !element.type) {
        issues.push({ severity: "error", message: `Element "${key}" must have a 'type' string.`, elementKey: key });
        return;
    }

    if (!componentNames.has(element.type)) {
        issues.push({
            severity: "error",
            message: `Element "${key}" has unknown type "${element.type}". Valid: ${[...componentNames].join(", ")}.`,
            elementKey: key
        });
        return;
    }

    // Validate props
    if (element.props !== undefined && element.props !== null) {
        if (typeof element.props !== "object" || Array.isArray(element.props)) {
            issues.push({
                severity: "error",
                message: `Element "${key}" props must be an object.`,
                elementKey: key
            });
        } else {
            const validProps = componentProps.get(element.type)!;
            for (const propName of Object.keys(element.props as Record<string, unknown>)) {
                if (!validProps.has(propName)) {
                    issues.push({
                        severity: "warning",
                        message: `Element "${key}" (${element.type}): unknown prop "${propName}".`,
                        elementKey: key
                    });
                }
            }
        }
    }

    // Check for common misplaced fields
    if (element.props && typeof element.props === "object" && !Array.isArray(element.props)) {
        const props = element.props as Record<string, unknown>;
        if ("visible" in props) {
            issues.push({
                severity: "error",
                message: `Element "${key}": "visible" should be on the element, not inside props.`,
                elementKey: key
            });
        }
        if ("on" in props) {
            issues.push({
                severity: "error",
                message: `Element "${key}": "on" should be on the element, not inside props.`,
                elementKey: key
            });
        }
        if ("repeat" in props) {
            issues.push({
                severity: "error",
                message: `Element "${key}": "repeat" should be on the element, not inside props.`,
                elementKey: key
            });
        }
    }

    // Validate children references
    if (Array.isArray(element.children)) {
        for (const child of element.children) {
            if (typeof child !== "string") {
                issues.push({
                    severity: "error",
                    message: `Element "${key}" has non-string child: ${JSON.stringify(child)}.`,
                    elementKey: key
                });
                continue;
            }
            if (!elementKeys.has(child)) {
                issues.push({
                    severity: "error",
                    message: `Element "${key}" references missing child "${child}".`,
                    elementKey: key
                });
            } else {
                queue.push(child);
            }
        }
    }
}

/**
 * Formats validation issues into a human-readable string for error messages.
 *
 * Expects: issues is a non-empty array.
 */
export function fragmentSpecIssuesFormat(issues: FragmentSpecIssue[]): string {
    return issues.map((i) => `[${i.severity}] ${i.message}`).join("\n");
}
