import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";
// biome-ignore lint/suspicious/noExplicitAny: AI SDK provider types vary across versions
type AnyLanguageModel = any;
import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from "ai";

export interface ProviderCost {
  inputPer1k: number;
  outputPer1k: number;
}

export interface ProviderEntry {
  getModel: (modelName: string) => AnyLanguageModel;
  defaultCost: ProviderCost;
}

function getOllamaClient() {
  return createOllama({
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://ollama:11434",
  });
}

export const providerRegistry: Record<string, ProviderEntry> = {
  openai: {
    getModel: (modelName) => openai(modelName),
    defaultCost: { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  },
  anthropic: {
    getModel: (modelName) => anthropic(modelName),
    defaultCost: { inputPer1k: 0.00025, outputPer1k: 0.00125 },
  },
  ollama: {
    getModel: (modelName) => getOllamaClient()(modelName),
    defaultCost: { inputPer1k: 0, outputPer1k: 0 },
  },
};

export function resolveModel(modelId: string): AnyLanguageModel {
  const [providerKey, ...rest] = modelId.split("/");
  const modelName = rest.join("/");

  const entry = providerRegistry[providerKey];
  if (!entry) {
    throw new Error(`Unknown AI provider: "${providerKey}" in model ID "${modelId}"`);
  }

  const isReasoningModel =
    modelName.endsWith("-thinking") ||
    (modelName.includes("reasoning") && !modelName.includes("non-reasoning"));

  const base = entry.getModel(
    isReasoningModel ? modelName.replace(/-thinking$/, "") : modelName
  );

  if (isReasoningModel) {
    return wrapLanguageModel({
      model: base,
      middleware: extractReasoningMiddleware({ tagName: "thinking" }),
    });
  }

  return base;
}

export function getProviderCost(modelId: string): ProviderCost {
  const [providerKey] = modelId.split("/");
  return providerRegistry[providerKey]?.defaultCost ?? { inputPer1k: 0, outputPer1k: 0 };
}
