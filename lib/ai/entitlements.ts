export type ModelTier = "free" | "basic" | "premium";

type Entitlements = {
  maxMessagesPerHour: number;
  allowedTiers: ModelTier[];
};

const ROLE_ENTITLEMENTS: Record<string, Entitlements> = {
  "ananas-unlimited": {
    maxMessagesPerHour: Number.POSITIVE_INFINITY,
    allowedTiers: ["free", "basic", "premium"],
  },
  "ananas-basic": {
    maxMessagesPerHour: 100,
    allowedTiers: ["free", "basic"],
  },
};

const DEFAULT_ENTITLEMENTS: Entitlements = {
  maxMessagesPerHour: 20,
  allowedTiers: ["free"],
};

export function getEntitlements(roles: string[]): Entitlements {
  if (roles.includes("ananas-unlimited")) {
    return ROLE_ENTITLEMENTS["ananas-unlimited"];
  }
  if (roles.includes("ananas-basic")) {
    return ROLE_ENTITLEMENTS["ananas-basic"];
  }
  return DEFAULT_ENTITLEMENTS;
}
