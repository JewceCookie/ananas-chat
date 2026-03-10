/**
 * Document processing worker.
 *
 * Runs as a standalone process alongside the Next.js app.
 * Polls the ProcessingJob queue in PostgreSQL, processes documents from
 * Nextcloud via WebDAV, and stores vector embeddings in Qdrant.
 *
 * Start with: npm run worker
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { generateId } from "ai";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  claimNextProcessingJob,
  completeProcessingJob,
  failProcessingJob,
  updateKnowledgeSourceStatus,
} from "@/lib/db/queries";
import { downloadFile, listDirectory } from "@/lib/nextcloud/client";
import {
  chunkText,
  extractText,
  isImageType,
} from "./extractor";
import { embedBatch } from "./embedder";
import { upsertPoints, deletePointsBySource } from "./qdrant";

const POLL_INTERVAL_MS = 5_000;

async function describeImage(buffer: Buffer, mimeType: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            image: `data:${mimeType};base64,${base64}`,
          },
          {
            type: "text",
            text: "Beschreibe den Inhalt dieses Bildes detailliert auf Deutsch. Extrahiere alle sichtbaren Texte, Diagramme und relevante Informationen.",
          },
        ],
      },
    ],
  });
  return text;
}

async function processIndexSource(payload: Record<string, unknown>) {
  const { knowledgeSourceId, userId, path, accessToken } = payload as {
    knowledgeSourceId: string;
    userId: string;
    path: string;
    accessToken: string;
  };

  await updateKnowledgeSourceStatus({
    id: knowledgeSourceId,
    status: "processing",
  });

  try {
    // Determine the Nextcloud username from sub stored in payload
    const username = String(payload.nextcloudUsername ?? userId);

    // Get all files recursively (for simplicity, one level here)
    const files = await listDirectory(accessToken, username, path);
    const fileEntries = files.filter((f) => f.type === "file");

    const allPoints: Parameters<typeof upsertPoints>[0] = [];

    for (const file of fileEntries) {
      const filePath = decodeURIComponent(file.filename).replace(
        `/remote.php/dav/files/${username}`,
        ""
      );

      const buffer = await downloadFile(accessToken, username, filePath);
      const mimeType = file.mime ?? "application/octet-stream";

      let text: string;

      if (isImageType(mimeType)) {
        text = await describeImage(buffer, mimeType);
      } else {
        text = await extractText(buffer, mimeType, file.basename);
      }

      if (!text.trim()) continue;

      const chunks = chunkText(text);
      const embeddings = await embedBatch(chunks);

      for (let i = 0; i < chunks.length; i++) {
        allPoints.push({
          id: generateId(),
          vector: embeddings[i],
          payload: {
            userId,
            knowledgeSourceId,
            sourceFile: filePath,
            chunkIndex: i,
            text: chunks[i],
            shareId: String(payload.shareId ?? ""),
          },
        });
      }
    }

    if (allPoints.length > 0) {
      await upsertPoints(allPoints);
    }

    await updateKnowledgeSourceStatus({
      id: knowledgeSourceId,
      status: "ready",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await updateKnowledgeSourceStatus({
      id: knowledgeSourceId,
      status: "error",
      errorMessage: msg,
    });
    throw error;
  }
}

async function processDeleteSource(payload: Record<string, unknown>) {
  const { knowledgeSourceId } = payload as { knowledgeSourceId: string };
  await deletePointsBySource(knowledgeSourceId);
}

async function runOnce(): Promise<boolean> {
  const job = await claimNextProcessingJob();
  if (!job) return false;

  console.log(`[worker] Processing job ${job.id} (type: ${job.type})`);

  try {
    const payload = job.payload as Record<string, unknown>;

    if (job.type === "index_source" || job.type === "reindex_source") {
      await processIndexSource(payload);
    } else if (job.type === "delete_source") {
      await processDeleteSource(payload);
    }

    await completeProcessingJob({ id: job.id });
    console.log(`[worker] Job ${job.id} completed`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await failProcessingJob({ id: job.id, error: msg });
    console.error(`[worker] Job ${job.id} failed:`, msg);
  }

  return true;
}

async function main() {
  console.log("[worker] Starting document processing worker...");

  while (true) {
    try {
      const didWork = await runOnce();
      if (!didWork) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    } catch (error) {
      console.error("[worker] Unexpected error:", error);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

main();
