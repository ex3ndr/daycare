import * as React from "react";
import { Platform, View } from "react-native";
import { ReorderingList } from "@/components/ReorderingList";
import { ReorderingList2 } from "@/components/ReorderingList2";
import { TaskHeaderView } from "./TaskHeaderView";
import { TODO_HEIGHT, TodoView } from "./TodoView";
import type { TodoItem } from "./todoTypes";

export type TodoListProps = {
    todos: TodoItem[];
    onToggleTodo?: (id: string, newValue: boolean) => void;
    onToggleFavorite?: (id: string, newValue: boolean) => void;
    onReorderTodo?: (id: string, newIndex: number) => void;
    onUpdateTodo?: (id: string, newValue: string) => void;
    onTaskPress?: (id: string) => void;
    footer?: React.ReactNode;
    editable?: boolean;
    contentInsetTop?: number;
};

const ITEM_SPACING = Platform.OS === "web" ? 4 : 8;

export const TodoList = React.memo<TodoListProps>((props) => {
    const handleItemPress = React.useCallback(
        (id: string) => {
            props.onTaskPress?.(id);
        },
        [props.onTaskPress]
    );

    const handleToggleTodo = React.useCallback(
        (id: string, newValue: boolean) => {
            props.onToggleTodo?.(id, newValue);
        },
        [props.onToggleTodo]
    );

    const handleToggleFavorite = React.useCallback(
        (id: string, newValue: boolean) => {
            props.onToggleFavorite?.(id, newValue);
        },
        [props.onToggleFavorite]
    );

    const renderItem = React.useCallback(
        (todo: TodoItem) => {
            if (todo.title.startsWith("# ")) {
                return <TaskHeaderView id={todo.id} value={todo.title} onPress={handleItemPress} />;
            }

            return (
                <TodoView
                    id={todo.id}
                    done={todo.done}
                    favorite={todo.favorite}
                    magic={todo.magic}
                    magicProcessed={todo.magicProcessed}
                    value={todo.title}
                    notes={todo.notes}
                    due={todo.due}
                    hint={todo.hint}
                    subtasks={todo.subtasks}
                    onToggle={handleToggleTodo}
                    onToggleFavorite={handleToggleFavorite}
                    onValueChange={props.onUpdateTodo}
                    onPress={handleItemPress}
                    editable={props.editable}
                />
            );
        },
        [handleItemPress, handleToggleTodo, handleToggleFavorite, props.onUpdateTodo, props.editable]
    );

    const keyExtractor = React.useCallback((todo: TodoItem) => todo.id, []);

    const header = <View style={{ paddingTop: 12 }} />;

    const footer = <View style={{ paddingTop: 16 }}>{props.footer}</View>;

    const ReorderComponent = Platform.OS === "web" ? ReorderingList : ReorderingList2;

    return (
        <View style={{ flexGrow: 1, flexBasis: 0 }}>
            <ReorderComponent
                items={props.todos}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                itemHeight={TODO_HEIGHT}
                gap={ITEM_SPACING}
                onMove={props.onReorderTodo}
                header={header}
                footer={footer}
                contentInsetTop={props.contentInsetTop}
            />
        </View>
    );
});
