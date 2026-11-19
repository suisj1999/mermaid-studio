import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { LlmMessage } from "~/lib/conversations/types";

import { readLlmConfig, type LlmConfig } from "./config";
import { MAX_OUTPUT_TOKENS } from "./constants";

/**
 * Provider-agnostic chat call.
 *
 * Both supported endpoints are protocol-compatible with a mainstream API but
 * differ in two details: Anthropic takes the system prompt as a top-level
 * parameter while OpenAI takes it as the first message, and Anthropic
 * requires the turns to alternate. Both differences are absorbed here so
 * the rest of the server only deals with one message shape.
 */
export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LlmResponse {
  text: string;
  provider: LlmConfig["provider"];
  model: string;
}

export async function callLlm(request: LlmRequest): Promise<LlmResponse> {
  const config = readLlmConfig();

  const text =
    config.provider === "anthropic-compatible"
      ? await callAnthropicCompatible(config, request)
      : await callOpenAICompatible(config, request);

  return { text, provider: config.provider, model: config.model };
}

async function callAnthropicCompatible(
  config: Extract<LlmConfig, { provider: "anthropic-compatible" }>,
  request: LlmRequest,
): Promise<string> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const response = await client.messages.create({
    model: config.model,
    max_tokens: request.maxTokens ?? MAX_OUTPUT_TOKENS,
    system: request.system,
    messages: request.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })),
  });

  const block = response.content.find((entry) => entry.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic-compatible endpoint returned no text content");
  }
  return block.text;
}

async function callOpenAICompatible(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  request: LlmRequest,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: request.system },
      ...request.messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    temperature: request.temperature ?? 0.2,
    max_tokens: request.maxTokens ?? MAX_OUTPUT_TOKENS,
  });

  const text = response.choices[0]?.message?.content ?? "";
  if (!text) {
    throw new Error("OpenAI-compatible endpoint returned empty content");
  }
  return text;
}
