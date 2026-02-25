import { describe, expect, it } from "vitest";
import { profileRender } from "./profileRender.js";

describe("profileRender", () => {
    it("renders all profile fields and avatar image", () => {
        const rendered = profileRender(
            {
                telegramUserId: "123",
                firstName: "Ada",
                lastName: "Lovelace",
                username: "ada",
                bio: "Math pioneer",
                phone: "+1-555-0100",
                fetchedAt: Date.now()
            },
            ["/tmp/downloads/profile-telegram-123-avatar-a.jpg", "/tmp/downloads/profile-telegram-123-avatar-b.jpg"]
        );

        expect(rendered.text).toContain("## Telegram Profile");
        expect(rendered.text).toContain("Name: Ada Lovelace");
        expect(rendered.text).toContain("Telegram user id: 123");
        expect(rendered.text).toContain("Username: @ada");
        expect(rendered.text).toContain("Bio: Math pioneer");
        expect(rendered.text).toContain("Phone: +1-555-0100");
        expect(rendered.text).toContain("Profile photos:");
        expect(rendered.text).toContain("- ~/downloads/profile-telegram-123-avatar-a.jpg");
        expect(rendered.text).toContain("- ~/downloads/profile-telegram-123-avatar-b.jpg");
        expect(rendered.images).toEqual([
            "/tmp/downloads/profile-telegram-123-avatar-a.jpg",
            "/tmp/downloads/profile-telegram-123-avatar-b.jpg"
        ]);
    });

    it("renders required fields when optional values are missing", () => {
        const rendered = profileRender({
            telegramUserId: "456",
            firstName: "OnlyName",
            fetchedAt: Date.now()
        });

        expect(rendered.text).toContain("Name: OnlyName");
        expect(rendered.text).toContain("Telegram user id: 456");
        expect(rendered.text).not.toContain("Username:");
        expect(rendered.text).not.toContain("Bio:");
        expect(rendered.text).not.toContain("Phone:");
        expect(rendered.images).toBeUndefined();
    });
});
