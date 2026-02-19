import { getLogger } from "../log.js";
import type {
  TranscriptionProvider,
  TranscriptionOptions,
  TranscriptionResult
} from "./types.js";

const logger = getLogger("transcription");

/**
 * Registry for transcription providers.
 * Manages provider registration and provides a unified transcription interface.
 */
export class TranscriptionRegistry {
  private providers = new Map<string, TranscriptionProvider>();
  private defaultProviderId: string | null = null;

  /**
   * Register a transcription provider.
   */
  register(provider: TranscriptionProvider): void {
    if (this.providers.has(provider.id)) {
      logger.warn({ providerId: provider.id }, "warn: Replacing existing transcription provider");
    }
    this.providers.set(provider.id, provider);
    logger.debug({ providerId: provider.id, providerName: provider.name }, "event: Transcription provider registered");
    
    // Set first registered provider as default
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }
  }

  /**
   * Unregister a transcription provider.
   */
  unregister(providerId: string): boolean {
    const removed = this.providers.delete(providerId);
    if (removed && this.defaultProviderId === providerId) {
      // Reset default to first available or null
      const first = this.providers.keys().next();
      this.defaultProviderId = first.done ? null : first.value;
    }
    return removed;
  }

  /**
   * Get a provider by ID.
   */
  get(providerId: string): TranscriptionProvider | undefined {
    return this.providers.get(providerId);
  }

  /**
   * List all registered providers.
   */
  list(): TranscriptionProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * List provider IDs.
   */
  listIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Set the default provider.
   */
  setDefault(providerId: string): void {
    if (!this.providers.has(providerId)) {
      throw new Error(`Transcription provider not found: ${providerId}`);
    }
    this.defaultProviderId = providerId;
  }

  /**
   * Get the default provider ID.
   */
  getDefaultId(): string | null {
    return this.defaultProviderId;
  }

  /**
   * Transcribe audio using a specific or default provider.
   */
  async transcribe(
    audio: Buffer | string,
    mimeType: string,
    options?: TranscriptionOptions & { providerId?: string }
  ): Promise<TranscriptionResult> {
    const providerId = options?.providerId ?? this.defaultProviderId;
    if (!providerId) {
      throw new Error("No transcription provider available");
    }
    
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Transcription provider not found: ${providerId}`);
    }

    logger.debug(
      { providerId, mimeType, hasBuffer: Buffer.isBuffer(audio) },
      "event: Starting transcription"
    );

    const result = await provider.transcribe(audio, mimeType, options);

    logger.debug(
      { providerId, textLength: result.text.length, language: result.language },
      "event: Transcription completed"
    );

    return result;
  }

  /**
   * Check if any provider is registered.
   */
  hasProviders(): boolean {
    return this.providers.size > 0;
  }
}