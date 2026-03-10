type Entitlements = {
  maxMessagesPerHour: number;
};

export const entitlementsByUserType: Record<string, Entitlements> = {
  regular: {
    maxMessagesPerHour: 100,
  },
};
