import nodemailer from "nodemailer";

export type EmailMessage = {
    to: string;
    subject: string;
    text: string;
    html: string;
    replyTo?: string;
};

export type EmailSendOptions = {
    smtpUrl: string;
    from: string;
};

/**
 * Creates a reusable SMTP sender for global Daycare email delivery.
 * Expects: smtpUrl is a valid connection URL and from is a deliverable mailbox.
 */
export function emailSend(options: EmailSendOptions): (message: EmailMessage) => Promise<void> {
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
