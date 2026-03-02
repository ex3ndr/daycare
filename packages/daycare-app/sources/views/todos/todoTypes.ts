export type TodoDueDate = {
    date: string;
};

export type TodoSubtask = {
    id: string;
    text: string;
    rank: string;
    done: boolean;
};

export type TodoItem = {
    id: string;
    title: string;
    done: boolean;
    favorite: boolean;
    magic?: boolean;
    magicProcessed?: boolean;
    notes?: string;
    due?: TodoDueDate | null;
    hint?: string;
    subtasks?: TodoSubtask[];
};
