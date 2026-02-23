import { generateUsername } from "unique-username-generator";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nametagGenerate } from "./nametagGenerate.js";

vi.mock("unique-username-generator", () => ({
    generateUsername: vi.fn()
}));

describe("nametagGenerate", () => {
    const generateUsernameMock = vi.mocked(generateUsername);

    beforeEach(() => {
        generateUsernameMock.mockReset();
    });

    it("delegates to unique-username-generator with no separator and 3 digits", () => {
        generateUsernameMock.mockReturnValue("sample123");
        expect(nametagGenerate()).toBe("sample123");
        expect(generateUsernameMock).toHaveBeenCalledWith("", 3);
    });
});
