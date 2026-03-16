import type { UserType } from "@/app/(auth)/auth";
import type { ChatModel } from "./models";

type Entitlements = {
  maxMessagesPerDay: number;
  availableChatModelIds: ChatModel["id"][];
};

export const entitlementsByUserType: Record<UserType, Entitlements> = {
  /*
   * For users without an account
   */
  guest: {
    maxMessagesPerDay: 0,
    availableChatModelIds: ["deepseek-v3", "glm-4"],
  },

  /*
   * For users with an account
   */
  regular: {
    maxMessagesPerDay: 1000,
    availableChatModelIds: ["deepseek-v3", "glm-4"],
  },

  /*
   * TODO: For users with an account and a paid membership
   */
};
