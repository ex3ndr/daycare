export function toCamelCase(input: string): string {
    const words = input
        .replace(/[^\w\s-]/g, "")
        .split(/[\s-_]+/)
        .filter((word) => word.length > 0);

    if (words.length === 0) {
        return "";
    }

    return words
        .map((word, index) => {
            const lowercased = word.toLowerCase();
            if (index === 0) {
                return lowercased;
            }
            return lowercased.charAt(0).toUpperCase() + lowercased.slice(1);
        })
        .join("");
}

export function toSafeFileName(input: string): string {
    return input
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase()
        .substring(0, 100);
}
