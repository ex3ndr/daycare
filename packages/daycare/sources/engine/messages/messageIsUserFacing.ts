/**
 * Detects whether a message contains a <message_for_user> tag.
 * Returns true when the trimmed text starts with `<message_for_user`.
 */
export function messageIsUserFacing(text: string): boolean {
    const trimmed = text.trim();
    return trimmed.startsWith("<message_for_user");
}
