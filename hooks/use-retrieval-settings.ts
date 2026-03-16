"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RetrievalRangePreset } from "@/components/chat-header";

const RANGE_PRESET_STORAGE_KEY = "synergy_retrieval_range_preset";
const SETTINGS_CHANGED_EVENT = "synergy:retrieval-settings-changed";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(
      new CustomEvent(SETTINGS_CHANGED_EVENT, { detail: { key } })
    );
  } catch {
    // ignore
  }
}

function sanitizeRangePreset(value: unknown): RetrievalRangePreset | null {
  return value === "all" ||
    value === "1d" ||
    value === "7d" ||
    value === "30d" ||
    value === "90d"
    ? value
    : null;
}

function readRangePresetFromStorage(): RetrievalRangePreset | null {
  return sanitizeRangePreset(readJson(RANGE_PRESET_STORAGE_KEY));
}

export function useRetrievalSettings() {
  const subscribe = useCallback((onStoreChange: () => void) => {
    if (typeof window === "undefined") return () => {};

    const onSettingsChanged = (event: Event) => {
      const custom = event as CustomEvent<{ key?: unknown }>;
      const key =
        typeof custom.detail?.key === "string" ? custom.detail.key : null;
      if (key === null || key === RANGE_PRESET_STORAGE_KEY) {
        onStoreChange();
      }
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === RANGE_PRESET_STORAGE_KEY) {
        onStoreChange();
      }
    };

    window.addEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SETTINGS_CHANGED_EVENT, onSettingsChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const retrievalRangePreset = useSyncExternalStore<RetrievalRangePreset>(
    subscribe,
    () => readRangePresetFromStorage() ?? "all",
    () => "all"
  );

  const setRetrievalRangePreset = useCallback((next: RetrievalRangePreset) => {
    writeJson(RANGE_PRESET_STORAGE_KEY, next);
  }, []);

  return {
    retrievalRangePreset,
    setRetrievalRangePreset,
  };
}
