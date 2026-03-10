import { logUsage } from "@/lib/db/queries";
import { getProviderCost } from "./registry";

export interface UsageRecord {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function trackUsage(record: UsageRecord): Promise<void> {
  const [providerKey] = record.model.split("/");
  const pricing = getProviderCost(record.model);

  const cost =
    (record.inputTokens / 1000) * pricing.inputPer1k +
    (record.outputTokens / 1000) * pricing.outputPer1k;

  await logUsage({
    userId: record.userId,
    model: record.model,
    provider: providerKey,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    cost,
  });
}
