export type TodoListIcon = {
    name: string;
    set?: string;
    color?: string;
};

export type TodoListCounter = {
    current: number;
    total: number;
};

export type TodoListToggleIconState = {
    active?: boolean;
};

export type TodoListToggleIconConfig = {
    icon: string;
    activeIcon: string;
    set?: string | null;
    color?: string | null;
    activeColor?: string | null;
};

export type TodoListItem = {
    id: string;
    type?: "item";
    title: string;
    done?: boolean;
    icons?: TodoListIcon[];
    counter?: TodoListCounter;
    toggleIcon?: TodoListToggleIconState;
    pill?: string;
    hint?: string;
};

export type TodoListSeparatorItem = {
    id: string;
    type: "separator";
    title: string;
};

export type TodoListEntry = TodoListItem | TodoListSeparatorItem;
