import type { InferSelectModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  json,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Core tables (from Vercel AI chatbot, adapted for OIDC auth)
// ---------------------------------------------------------------------------

export const user = pgTable("User", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  nextcloudId: varchar("nextcloudId", { length: 255 }).notNull().unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ---------------------------------------------------------------------------
// Cost tracking
// ---------------------------------------------------------------------------

export const usageLog = pgTable("UsageLog", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  model: varchar("model", { length: 255 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  inputTokens: integer("inputTokens").notNull().default(0),
  outputTokens: integer("outputTokens").notNull().default(0),
  cost: numeric("cost", { precision: 12, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type UsageLog = InferSelectModel<typeof usageLog>;

export const modelPricing = pgTable("ModelPricing", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  provider: varchar("provider", { length: 64 }).notNull(),
  model: varchar("model", { length: 255 }).notNull(),
  inputCostPer1k: numeric("inputCostPer1k", { precision: 12, scale: 8 })
    .notNull()
    .default("0"),
  outputCostPer1k: numeric("outputCostPer1k", { precision: 12, scale: 8 })
    .notNull()
    .default("0"),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type ModelPricing = InferSelectModel<typeof modelPricing>;

// ---------------------------------------------------------------------------
// Knowledge system / RAG
// ---------------------------------------------------------------------------

export const knowledgeSource = pgTable("KnowledgeSource", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  path: text("path").notNull(),
  shareId: varchar("shareId", { length: 255 }),
  label: varchar("label", { length: 255 }),
  status: varchar("status", {
    enum: ["pending", "processing", "ready", "error"],
  })
    .notNull()
    .default("pending"),
  errorMessage: text("errorMessage"),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type KnowledgeSource = InferSelectModel<typeof knowledgeSource>;

export const documentChunk = pgTable("DocumentChunk", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  knowledgeSourceId: uuid("knowledgeSourceId")
    .notNull()
    .references(() => knowledgeSource.id, { onDelete: "cascade" }),
  sourceFile: text("sourceFile").notNull(),
  chunkIndex: integer("chunkIndex").notNull(),
  qdrantPointId: varchar("qdrantPointId", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type DocumentChunk = InferSelectModel<typeof documentChunk>;

export const processingJob = pgTable("ProcessingJob", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  type: varchar("type", {
    enum: ["index_source", "reindex_source", "delete_source"],
  }).notNull(),
  payload: json("payload").notNull(),
  status: varchar("status", {
    enum: ["pending", "processing", "done", "failed"],
  })
    .notNull()
    .default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("lastError"),
  scheduledAt: timestamp("scheduledAt").notNull().defaultNow(),
  processedAt: timestamp("processedAt"),
});

export type ProcessingJob = InferSelectModel<typeof processingJob>;
