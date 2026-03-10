/**
 * Embedding generation using OpenAI text-embedding-3-small.
 * Used by the document processing worker to create vectors for Qdrant.
 */

import { openai } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: texts,
  });
  return embeddings;
}

export const EMBEDDING_DIMENSION = 1536;
