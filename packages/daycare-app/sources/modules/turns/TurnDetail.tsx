import * as React from "react";
import { ChatMessageList } from "../chat/ChatMessageList";
import type { AgentTurn } from "./turnTypes";

export type TurnDetailProps = {
    turn: AgentTurn;
};

/**
 * Shows all records in a turn using the standard chat message list.
 * Renders as an inverted FlatList with markdown support (newest at bottom).
 */
export const TurnDetail = React.memo(({ turn }: TurnDetailProps) => {
    return <ChatMessageList records={turn.records} loading={false} />;
});
