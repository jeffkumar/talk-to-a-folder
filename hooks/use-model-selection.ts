"use client";

import { useCallback, useEffect, useState } from "react";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
import { chatModels, DEFAULT_CHAT_MODEL } from "@/lib/ai/models";

function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(";").shift();
  }
  return undefined;
}

export function useModelSelection() {
  const [selectedModelId, setSelectedModelId] = useState<string>(
    DEFAULT_CHAT_MODEL
  );

  useEffect(() => {
    const cookieValue = getCookie("chat-model");
    const validModelIds = chatModels.map((m) => m.id);
    if (cookieValue && validModelIds.includes(cookieValue)) {
      setSelectedModelId(cookieValue);
    }
  }, []);

  const setModel = useCallback((modelId: string) => {
    setSelectedModelId(modelId);
    void saveChatModelAsCookie(modelId);
  }, []);

  return {
    selectedModelId,
    setModel,
  };
}
