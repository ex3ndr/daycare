/**
 * Wraps text in a <message_for_user> XML tag for delivery to the foreground agent.
 * The foreground agent is instructed to present this content to the user.
 *
 * Expects: text is non-empty; origin is the sending agent's ID.
 */
export function messageBuildUserFacing(text: string, origin: string): string {
    const trimmed = text.trim();
    return `<message_for_user origin="${origin}">${trimmed}</message_for_user>`;
}
