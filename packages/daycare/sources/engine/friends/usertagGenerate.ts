import { generateUsername } from "unique-username-generator";

/**
 * Generates a random usertag with no separator and 3 trailing digits.
 * Expects: caller handles uniqueness collisions against persisted users.
 */
export function usertagGenerate(): string {
    return generateUsername("", 3);
}
