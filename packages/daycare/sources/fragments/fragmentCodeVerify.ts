import { Monty, MontyRuntimeError, MontySyntaxError, MontyTypingError } from "@pydantic/monty";

const FRAGMENT_LIMITS = {
    maxDurationSecs: 1,
    maxMemory: 5 * 1024 * 1024
} as const;

const BUILT_IN_ACTIONS = new Set(["setState", "pushState", "removeState", "push", "pop"]);
const PYTHON_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

type FragmentSpec = {
    code?: unknown;
    elements?: unknown;
};

type FragmentElement = {
    on?: unknown;
    watch?: unknown;
};

type ActionBinding = {
    action?: unknown;
};

/**
 * Verifies fragment Python code with Monty and rejects broken custom action references.
 * Expects: spec already passed structural fragmentSpecValidate().
 */
export function fragmentCodeVerify(spec: unknown): string | null {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
        return null;
    }

    const fragment = spec as FragmentSpec;
    if (typeof fragment.code !== "string" || !fragment.code.trim()) {
        return null;
    }

    try {
        const program = new Monty(fragment.code, {
            scriptName: "fragment.py"
        });
        program.run({ limits: FRAGMENT_LIMITS });

        const customActions = fragmentActionNamesCollect(fragment.elements);
        for (const actionName of customActions) {
            if (!PYTHON_IDENTIFIER_PATTERN.test(actionName)) {
                return `Fragment Python action "${actionName}" is not a valid Python identifier.`;
            }

            const actionCheck = new Monty(`${fragment.code}\n\n${actionName}`, {
                scriptName: "fragment.py"
            });
            actionCheck.run({ limits: FRAGMENT_LIMITS });
        }

        return null;
    } catch (error) {
        return fragmentCodeErrorFormat(error);
    }
}

function fragmentActionNamesCollect(elements: unknown): string[] {
    if (!elements || typeof elements !== "object" || Array.isArray(elements)) {
        return [];
    }

    const names = new Set<string>();
    for (const element of Object.values(elements as Record<string, unknown>)) {
        if (!element || typeof element !== "object" || Array.isArray(element)) {
            continue;
        }

        const fragmentElement = element as FragmentElement;
        fragmentActionBindingCollect(fragmentElement.on, names);
        fragmentActionBindingCollect(fragmentElement.watch, names);
    }

    return [...names];
}

function fragmentActionBindingCollect(bindings: unknown, names: Set<string>): void {
    if (!bindings || typeof bindings !== "object" || Array.isArray(bindings)) {
        return;
    }

    for (const binding of Object.values(bindings as Record<string, unknown>)) {
        if (Array.isArray(binding)) {
            for (const entry of binding) {
                fragmentActionNameCollect(entry, names);
            }
            continue;
        }

        fragmentActionNameCollect(binding, names);
    }
}

function fragmentActionNameCollect(binding: unknown, names: Set<string>): void {
    if (!binding || typeof binding !== "object" || Array.isArray(binding)) {
        return;
    }

    const actionName = (binding as ActionBinding).action;
    if (typeof actionName !== "string" || BUILT_IN_ACTIONS.has(actionName)) {
        return;
    }

    names.add(actionName);
}

function fragmentCodeErrorFormat(error: unknown): string {
    if (error instanceof MontySyntaxError) {
        return `Fragment Python syntax error.\n\n${error.display("type-msg")}`;
    }
    if (error instanceof MontyRuntimeError) {
        return `Fragment Python runtime error.\n\n${error.display("type-msg")}`;
    }
    if (error instanceof MontyTypingError) {
        const details = error.displayDiagnostics("concise", false).trim();
        return details ? `Fragment Python type check failed.\n\n${details}` : "Fragment Python type check failed.";
    }
    return error instanceof Error ? error.message : String(error);
}
