export function messageIsSystemText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("<system_message");
}
