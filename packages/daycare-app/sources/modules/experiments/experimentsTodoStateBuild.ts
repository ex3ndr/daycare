import type { ExperimentsTodo } from "./experimentsTodoTypes";

/**
 * Builds JSON-pointer updates for the renderer store from the todo rows.
 * Expects: todos are already normalized for id/title/done/createdAt.
 */
export function experimentsTodoStateBuild(todos: ExperimentsTodo[]): Record<string, unknown> {
    const completed = todos.filter((todo) => todo.done).length;
    const total = todos.length;

    return {
        "/todos": todos,
        "/stats/total": total,
        "/stats/completed": completed,
        "/stats/open": total - completed
    };
}
