import { EventEmitter } from "node:events";

export type EngineEvent = {
    type: string;
    userId?: string;
    payload: unknown;
    timestamp: string;
};

type EngineEventListener = (event: EngineEvent) => void;

export class EngineEventBus {
    private emitter = new EventEmitter();

    emit(type: string, payload: unknown, userId?: string): void {
        const event: EngineEvent = {
            type,
            payload,
            timestamp: new Date().toISOString(),
            ...(userId ? { userId } : {})
        };
        this.emitter.emit("event", event);
    }

    onEvent(listener: EngineEventListener): () => void {
        this.emitter.on("event", listener);
        return () => this.emitter.off("event", listener);
    }
}
