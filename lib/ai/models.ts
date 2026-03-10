export const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "openai",
    description: "Schnell und kostengünstig für einfache Aufgaben",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "openai",
    description: "Leistungsstarkes OpenAI-Modell",
  },
  {
    id: "anthropic/claude-haiku-4-5",
    name: "Claude Haiku 4.5",
    provider: "anthropic",
    description: "Schnell und erschwinglich",
  },
  {
    id: "anthropic/claude-sonnet-4-5",
    name: "Claude Sonnet 4.5",
    provider: "anthropic",
    description: "Ausgewogenes Anthropic-Modell",
  },
  {
    id: "ollama/llama3.2",
    name: "Llama 3.2 (lokal)",
    provider: "ollama",
    description: "Lokales Modell – keine API-Kosten",
  },
  {
    id: "ollama/mistral",
    name: "Mistral (lokal)",
    provider: "ollama",
    description: "Lokales Mistral-Modell",
  },
];

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
