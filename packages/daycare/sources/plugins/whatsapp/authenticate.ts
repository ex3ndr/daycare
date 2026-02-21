import type { Boom } from "@hapi/boom";
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion } from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import type { AuthStore } from "../../auth/store.js";
import { getLogger } from "../../log.js";
import { useAuthStoreState } from "./authState.js";

const logger = getLogger("plugin.whatsapp");

export type AuthenticateResult = { success: true } | { success: false; reason: string };

export type AuthenticateOptions = {
    authStore: AuthStore;
    instanceId: string;
    timeoutMs?: number;
    onQRCode?: (qr: string) => void;
};

/**
 * Performs WhatsApp authentication during onboarding.
 * Displays QR code and waits for user to scan it.
 *
 * Expects: AuthStore and instanceId for credential storage.
 * Returns: success or failure with reason.
 */
export async function authenticate(options: AuthenticateOptions): Promise<AuthenticateResult> {
    const { authStore, instanceId, timeoutMs = 120_000 } = options;

    const { state, saveCreds } = await useAuthStoreState(authStore, instanceId);
    const { version } = await fetchLatestBaileysVersion();

    return new Promise((resolve) => {
        let resolved = false;
        let socket: ReturnType<typeof makeWASocket> | null = null;

        const cleanup = () => {
            if (socket) {
                socket.end(undefined);
                socket = null;
            }
        };

        const finish = (result: AuthenticateResult) => {
            if (resolved) return;
            resolved = true;
            cleanup();
            resolve(result);
        };

        // Timeout after specified duration
        const timeout = setTimeout(() => {
            finish({ success: false, reason: "Authentication timed out" });
        }, timeoutMs);

        try {
            socket = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: "silent" }) as never,
                printQRInTerminal: false // We'll handle this ourselves
            });

            socket.ev.on("creds.update", saveCreds);

            socket.ev.on("connection.update", (update) => {
                const { connection, lastDisconnect, qr } = update;

                if (qr) {
                    logger.info("event: Scan this QR code with WhatsApp on your phone:");
                    console.log(""); // Empty line before QR
                    qrcodeTerminal.generate(qr, { small: true });
                    console.log(""); // Empty line after QR
                    options.onQRCode?.(qr);
                }

                if (connection === "open") {
                    clearTimeout(timeout);
                    logger.info("event: WhatsApp authenticated successfully!");
                    finish({ success: true });
                }

                if (connection === "close") {
                    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

                    if (statusCode === DisconnectReason.loggedOut) {
                        clearTimeout(timeout);
                        finish({ success: false, reason: "Logged out during authentication" });
                    } else if (statusCode === DisconnectReason.connectionClosed) {
                        // Connection closed, might be temporary
                        logger.debug("event: Connection closed during auth, waiting...");
                    }
                }
            });
        } catch (error) {
            clearTimeout(timeout);
            finish({
                success: false,
                reason: error instanceof Error ? error.message : "Unknown error"
            });
        }
    });
}
