/**
 * Thin Anthropic client for SCMS server features.
 * Create from request ctx (`ctx.$config.api.anthropic.apiKey`) and reuse across tasks.
 */

import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';
import type { Context } from '../context.server.js';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Wrapper around the Anthropic SDK (server-only).
 * Construct with request ctx; uses ctx.$config.api.anthropic.apiKey.
 */
export class AnthropicClient {
  private readonly client: Anthropic;
  private model: string;

  constructor(ctx: Context, defaultModel: string = DEFAULT_ANTHROPIC_MODEL) {
    const key = ctx.$config.api?.anthropic?.apiKey;
    if (!key || typeof key !== 'string' || key.trim() === '') {
      throw new Error('AnthropicClient requires api.anthropic.apiKey to be set in config');
    }
    this.client = new Anthropic({ apiKey: key });
    this.model = defaultModel;
  }

  /** Set the model for subsequent calls. */
  setModel(model: string): void {
    this.model = model;
  }

  /** Get the current model. */
  getModel(): string {
    return this.model;
  }

  /**
   * Send a custom message with optional system prompt.
   * Use this for task-specific prompts owned by feature packages.
   */
  async sendMessage(params: {
    system?: string;
    messages: Anthropic.MessageParam[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<Anthropic.Message> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: params.maxTokens ?? 20000,
      temperature: params.temperature ?? 1,
      system: params.system,
      messages: params.messages,
    });
    return response;
  }

  /**
   * Structured Outputs: parse a response against a Zod schema.
   * Returns null when the model produced no parseable output (e.g. refusal).
   */
  async parseWithZod<T extends z.ZodType>(params: {
    system?: string;
    messages: Anthropic.MessageParam[];
    schema: T;
    maxTokens?: number;
    temperature?: number;
  }): Promise<z.infer<T> | null> {
    const message = await this.client.messages.parse({
      model: this.model,
      max_tokens: params.maxTokens ?? 20000,
      temperature: params.temperature ?? 1,
      system: params.system,
      messages: params.messages,
      output_config: {
        format: zodOutputFormat(params.schema),
      },
    });
    return (message.parsed_output as z.infer<T> | null | undefined) ?? null;
  }
}

/**
 * Create an AnthropicClient when api.anthropic.apiKey is set.
 * Returns null when the key is not configured so callers can skip or fallback.
 */
export function createAnthropicClient(ctx: Context, defaultModel?: string): AnthropicClient | null {
  const key = ctx.$config.api?.anthropic?.apiKey;
  if (!key || typeof key !== 'string' || key.trim() === '') return null;
  return new AnthropicClient(ctx, defaultModel);
}

/** Helper to get the first text block from a message's content. */
export function getMessageText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? '';
}

/** Extract JSON from a message that contains <json>...</json> in its text. */
export function extractJsonFromMessage(message: Anthropic.Message): string | null {
  const text = getMessageText(message);
  const match = text.match(/<json>([\s\S]*?)<\/json>/);
  return match ? match[1].trim() : null;
}
