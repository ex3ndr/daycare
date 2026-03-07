import nodemailer from "nodemailer";
import type { AppEmailAuthMail } from "./appEmailAuth.js";

export type AppEmailAuthMailSendOptions = {
    smtpUrl: string;
    from: string;
};

/**
 * Creates a nodemailer-backed sender for Better Auth magic-link emails.
 * Expects: smtpUrl is a valid connection URL and from is a deliverable mailbox.
 */
export function appEmailAuthMailSend(
    options: AppEmailAuthMailSendOptions
): (message: AppEmailAuthMail) => Promise<void> {
    const transport = nodemailer.createTransport(options.smtpUrl);

    return async (message) => {
        await transport.sendMail({
            from: options.from,
            to: message.to,
            replyTo: message.replyTo,
            subject: message.subject,
            text: message.text,
            html: message.html
        });
    };
}
