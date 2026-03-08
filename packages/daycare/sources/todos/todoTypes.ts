export const TODO_STATUSES = ["draft", "unstarted", "started", "finished", "abandoned"] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];
