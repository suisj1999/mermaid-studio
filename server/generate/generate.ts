import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import { MAX_OUTPUT_TOKENS } from "./constants";
import { readLlmConfig, type LlmConfig } from "./config";
import { toTaggedMessage } from "./format";
import { SYSTEM_PROMPT } from "./prompts";

export interface GenerateResult {
  mermaid: string;
  provider: LlmConfig["provider"];
  model: string;
}

export async function generateMermaidDiagram(
  userPrompt: string,
): Promise<GenerateResult> {
  const config = readLlmConfig();
  const userMessage = toTaggedMessage({ description: userPrompt });

  const mermaid =
    config.provider === "anthropic-compatible"
      ? await callAnthropicCompatible(config, userMessage)
      : await callOpenAICompatible(config, userMessage);

  return { mermaid, provider: config.provider, model: config.model };
}

function extractMermaidBlock(text: string): string {
  const fenced = text.match(/```(?:mermaid)?\s*\n?([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

async function callAnthropicCompatible(
  config: Extract<LlmConfig, { provider: "anthropic-compatible" }>,
  userMessage: string,
): Promise<string> {
  const client = new Anthropic({
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });
  const response = await client.messages.create({
    model: config.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content.find((entry) => entry.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Anthropic-compatible endpoint returned no text content");
  }
  return extractMermaidBlock(block.text);
}

async function callOpenAICompatible(
  config: Extract<LlmConfig, { provider: "openai-compatible" }>,
  userMessage: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });
  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.2,
    max_tokens: MAX_OUTPUT_TOKENS,
  });

  const text = response.choices[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI-compatible endpoint returned empty content");
  return extractMermaidBlock(text);
}