import { describe, expect, it, vi } from "vitest";
import { emailSend } from "./emailSend.js";

const sendMailMock = vi.hoisted(() => vi.fn(async (_message: unknown) => undefined));
const createTransportMock = vi.hoisted(() => vi.fn(() => ({ sendMail: sendMailMock })));

vi.mock("nodemailer", () => ({
    default: {
        createTransport: createTransportMock
    }
}));

describe("emailSend", () => {
    it("creates an smtp transport and forwards the formatted email", async () => {
        const send = emailSend({
            smtpUrl: "smtp://mailer.example.com",
            from: "Daycare <no-reply@example.com>"
        });

        await send({
            to: "user@example.com",
            replyTo: "support@example.com",
            subject: "Sign in to Daycare",
            text: "Open the link",
            html: "<p>Open the link</p>"
        });

        expect(createTransportMock).toHaveBeenCalledWith("smtp://mailer.example.com");
        expect(sendMailMock).toHaveBeenCalledWith({
            from: "Daycare <no-reply@example.com>",
            to: "user@example.com",
            replyTo: "support@example.com",
            subject: "Sign in to Daycare",
            text: "Open the link",
            html: "<p>Open the link</p>"
        });
    });
});
