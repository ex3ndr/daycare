import { sendEngineSignal } from "../engine/ipc/client.js";

export async function eventCommand(type: string, payloadJson?: string): Promise<void> {
    intro("daycare event");
    try {
        const payload = eventPayloadParse(payloadJson);
        await sendEngineSignal(type, payload, { type: "process", id: "daycare-cli" });
        outro(`Sent event ${type}.`);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.exitCode = 1;
        console.error(`Failed to send event: ${message}`);
    }
}

function eventPayloadParse(payloadJson?: string): unknown {
    if (!payloadJson) {
        return undefined;
    }
    try {
        return JSON.parse(payloadJson) as unknown;
    } catch (_error) {
        throw new Error("Payload must be valid JSON.");
    }
}

function intro(message: string): void {
    console.log(message);
}

function outro(message: string): void {
    console.log(message);
}
