import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { resolveModel } from "./registry";

export function getLanguageModel(modelId: string) {
  return resolveModel(modelId);
}

export function getTitleModel() {
  return openai("gpt-4o-mini");
}

export function getArtifactModel() {
  return anthropic("claude-haiku-4-5");
}

export function getEmbeddingModel() {
  return openai.embedding("text-embedding-3-small");
}
