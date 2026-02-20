export type DebounceOptions<T> = {
    delay: number;
    immediateCount?: number;
    reducer?: (previous: T, current: T) => T;
};

export function createCustomDebounce<T>(fn: (args: T) => void, options: DebounceOptions<T>): (args: T) => void {
    const { delay, immediateCount = 2, reducer } = options;

    let callCount = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingArgs: T | null = null;

    return function debouncedFunction(args: T): void {
        if (callCount < immediateCount) {
            callCount += 1;
            fn(args);
            return;
        }

        if (pendingArgs !== null && reducer) {
            pendingArgs = reducer(pendingArgs, args);
        } else {
            pendingArgs = args;
        }

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            if (pendingArgs !== null) {
                fn(pendingArgs);
                pendingArgs = null;
            }
            timeoutId = null;
        }, delay);
    };
}

export function createAdvancedDebounce<T>(
    fn: (args: T) => void,
    options: DebounceOptions<T>
): {
    debounced: (args: T) => void;
    cancel: () => void;
    reset: () => void;
    flush: () => void;
} {
    const { delay, immediateCount = 2, reducer } = options;

    let callCount = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let pendingArgs: T | null = null;

    const cancel = (): void => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        pendingArgs = null;
    };

    const reset = (): void => {
        cancel();
        callCount = 0;
    };

    const flush = (): void => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (pendingArgs !== null) {
            fn(pendingArgs);
            pendingArgs = null;
        }
    };

    const debounced = (args: T): void => {
        if (callCount < immediateCount) {
            callCount += 1;
            fn(args);
            return;
        }

        if (pendingArgs !== null && reducer) {
            pendingArgs = reducer(pendingArgs, args);
        } else {
            pendingArgs = args;
        }

        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        timeoutId = setTimeout(() => {
            if (pendingArgs !== null) {
                fn(pendingArgs);
                pendingArgs = null;
            }
            timeoutId = null;
        }, delay);
    };

    return { debounced, cancel, reset, flush };
}
