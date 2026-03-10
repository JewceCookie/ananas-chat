import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { resolveModel } from "./registry";

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment) {
    const { artifactModel, chatModel, reasoningModel, titleModel } =
      // biome-ignore lint/style/noCommonJs: test mocks use CJS
      require("./models.mock");
    const testProvider = customProvider({
      languageModels: {
        "chat-model": chatModel,
        "chat-model-reasoning": reasoningModel,
        "title-model": titleModel,
        "artifact-model": artifactModel,
      },
    });
    return testProvider.languageModel(modelId);
  }

  return resolveModel(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment) {
    const { titleModel } = require("./models.mock");
    return customProvider({ languageModels: { "title-model": titleModel } }).languageModel("title-model");
  }
  return openai("gpt-4o-mini");
}

export function getArtifactModel() {
  if (isTestEnvironment) {
    const { artifactModel } = require("./models.mock");
    return customProvider({ languageModels: { "artifact-model": artifactModel } }).languageModel("artifact-model");
  }
  return anthropic("claude-haiku-4-5");
}

export function getEmbeddingModel() {
  return openai.embedding("text-embedding-3-small");
}
