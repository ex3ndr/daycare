import { getLogger } from "../../log.js";
import type { PluginEvent } from "./events.js";
import { PluginEventQueue } from "./events.js";

export type PluginEventHandler = (event: PluginEvent) => void | Promise<void>;

export class PluginEventEngine {
  private queue: PluginEventQueue;
  private handlers = new Map<string, Set<PluginEventHandler>>();
  private logger = getLogger("plugins.events");
  private unsubscribe: (() => void) | null = null;
  private chain: Promise<void> = Promise.resolve();
  private started = false;

  constructor(queue: PluginEventQueue) {
    this.queue = queue;
    this.logger.debug("PluginEventEngine initialized");
  }

  register(type: string, handler: PluginEventHandler): () => void {
    this.logger.debug(`Registering event handler eventType=${type}`);
    const set = this.handlers.get(type) ?? new Set<PluginEventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
    this.logger.debug(`Event handler registered eventType=${type} handlerCount=${set.size}`);
    return () => {
      this.logger.debug(`Unregistering event handler eventType=${type}`);
      set.delete(handler);
      if (set.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  start(): void {
    this.logger.debug(`start() called alreadyStarted=${this.started}`);
    if (this.started) {
      return;
    }
    this.started = true;
    const pending = this.queue.drain();
    this.logger.debug(`Processing pending events pendingCount=${pending.length}`);
    for (const event of pending) {
      this.enqueue(event);
    }
    this.unsubscribe = this.queue.onEvent((event) => this.enqueue(event));
    this.logger.debug("Event engine started and subscribed to queue");
  }

  stop(): void {
    this.logger.debug(`stop() called started=${this.started}`);
    if (!this.started) {
      return;
    }
    this.started = false;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.logger.debug("Event engine stopped");
  }

  private enqueue(event: PluginEvent): void {
    this.logger.debug(`Enqueueing event for dispatch eventType=${event.type} pluginId=${event.pluginId}`);
    this.chain = this.chain
      .then(() => this.dispatch(event))
      .catch((error) => {
        this.logger.warn({ error, event }, "Plugin event handler failed");
      });
  }

  private async dispatch(event: PluginEvent): Promise<void> {
    this.logger.debug(`Dispatching event eventType=${event.type} pluginId=${event.pluginId}`);
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      this.logger.debug(`No handlers for event type eventType=${event.type}`);
      return;
    }

    this.logger.debug(`Invoking handlers eventType=${event.type} handlerCount=${handlers.size}`);
    let handlerIndex = 0;
    for (const handler of handlers) {
      this.logger.debug(`Calling handler eventType=${event.type} handlerIndex=${handlerIndex}`);
      await handler(event);
      handlerIndex++;
    }
    this.logger.debug(`All handlers invoked eventType=${event.type}`);
  }
}
