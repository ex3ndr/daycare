import { getLogger } from "../log.js";
import type { TranscriptionProvider, TranscriptionOptions, TranscriptionResult } from "./types.js";

type RegisteredTranscriptionProvider = TranscriptionProvider & { pluginId: string };

export class TranscriptionRegistry {
  private providers = new Map<string, RegisteredTranscriptionProvider>();
  private logger = getLogger("transcription.registry");

  /**
   * Register a transcription provider.
   */
  register(pluginId: string, provider: TranscriptionProvider): void {
    this.logger.debug(
      `register: Registering transcription provider pluginId=${pluginId} providerId=${provider.id} label=${provider.label}`
    );
    this.providers.set(provider.id, { ...provider, pluginId });
    this.logger.debug(
      `register: Transcription provider registered totalProviders=${this.providers.size}`
    );
  }

  /**
   * Unregister a transcription provider by ID.
   */
  unregister(id: string): void {
    this.logger.debug(`unregister: Unregistering transcription provider providerId=${id}`);
    this.providers.delete(id);
  }

  /**
   * Unregister all transcription providers associated with a plugin.
   */
  unregisterByPlugin(pluginId: string): void {
    this.logger.debug(
      `unregister: Unregistering transcription providers by plugin pluginId=${pluginId}`
    );
    let count = 0;
    for (const [id, entry] of this.providers.entries()) {
      if (entry.pluginId === pluginId) {
        this.providers.delete(id);
        count++;
      }
    }
    this.logger.debug(
      `unregister: Transcription providers unregistered by plugin pluginId=${pluginId} unregisteredCount=${count}`
    );
  }

  /**
   * Get a transcription provider by ID.
   */
  get(id: string): TranscriptionProvider | null {
    const provider = this.providers.get(id) ?? null;
    this.logger.debug(`event: get() transcription provider providerId=${id} found=${!!provider}`);
    return provider;
  }

  /**
   * List all registered transcription providers.
   */
  list(): TranscriptionProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Transcribe audio using a specific provider.
   */
  async transcribe(
    providerId: string,
    audio: Buffer | string,
    mimeType: string,
    options?: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const provider = this.get(providerId);
    if (!provider) {
      throw new Error(`Transcription provider not found: ${providerId}`);
    }
    this.logger.debug(
      `transcribe: Starting transcription providerId=${providerId} mimeType=${mimeType}`
    );
    const result = await provider.transcribe({ audio, mimeType, options });
    this.logger.debug(
      `transcribe: Transcription complete providerId=${providerId} textLength=${result.text.length}`
    );
    return result;
  }
}