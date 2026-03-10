/**
 * Qdrant vector store operations for the knowledge system.
 */

import { QdrantClient } from "@qdrant/js-client-rest";
import { EMBEDDING_DIMENSION } from "./embedder";

const COLLECTION_NAME = "knowledge";

function getClient(): QdrantClient {
  return new QdrantClient({
    url: process.env.QDRANT_URL ?? "http://qdrant:6333",
  });
}

export async function ensureCollection(): Promise<void> {
  const client = getClient();
  const collections = await client.getCollections();
  const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

  if (!exists) {
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: EMBEDDING_DIMENSION,
        distance: "Cosine",
      },
    });
  }
}

export interface VectorPoint {
  id: string;
  vector: number[];
  payload: {
    userId: string;
    knowledgeSourceId: string;
    sourceFile: string;
    chunkIndex: number;
    text: string;
    shareId?: string;
  };
}

export async function upsertPoints(points: VectorPoint[]): Promise<void> {
  const client = getClient();
  await ensureCollection();

  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: points.map((p) => ({
      id: p.id,
      vector: p.vector,
      payload: p.payload,
    })),
  });
}

export async function searchSimilar(
  queryVector: number[],
  userId: string,
  limit = 5
): Promise<Array<{ text: string; sourceFile: string; score: number }>> {
  const client = getClient();

  const results = await client.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    filter: {
      must: [
        {
          key: "userId",
          match: { value: userId },
        },
      ],
    },
    with_payload: true,
  });

  return results.map((r) => ({
    text: String(r.payload?.text ?? ""),
    sourceFile: String(r.payload?.sourceFile ?? ""),
    score: r.score,
  }));
}

export async function deletePointsBySource(
  knowledgeSourceId: string
): Promise<void> {
  const client = getClient();

  await client.delete(COLLECTION_NAME, {
    wait: true,
    filter: {
      must: [
        {
          key: "knowledgeSourceId",
          match: { value: knowledgeSourceId },
        },
      ],
    },
  });
}
