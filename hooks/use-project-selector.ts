"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useLocalStorage } from "usehooks-ts";
import type { ProjectWithRole } from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";
import { fetcher } from "@/lib/utils";

export function useProjectSelector() {
  const storageKey = "flowchat-selected-project-id";

  const [selectedProjectId, setSelectedProjectIdRaw] = useLocalStorage<
    string | null
  >(storageKey, null, { initializeWithValue: false });

  const [hasCheckedStorage, setHasCheckedStorage] = useState(false);

  // Track if user explicitly set a project ID to prevent auto-selection race conditions
  const pendingSelectionRef = useRef<string | null>(null);

  const { data, isLoading, isValidating, mutate } = useSWR<{
    projects: ProjectWithRole[];
  }>("/api/projects", fetcher, {
    onErrorRetry: (error, _key, _config, revalidate, opts) => {
      // If DB is unreachable locally, don't retry forever (it makes dev look "stuck").
      if (error instanceof ChatSDKError && error.type === "offline") return;
      if (opts.retryCount >= 3) return;
      setTimeout(() => revalidate({ retryCount: opts.retryCount + 1 }), 2000);
    },
  });

  const projects = data?.projects || [];

  // Consider "loading" if either initial load or revalidating without cached data
  const isActuallyLoading =
    isLoading || (isValidating && projects.length === 0);

  // Wrapper to track pending selections and avoid race conditions
  const setSelectedProjectId = useCallback(
    (id: string | null) => {
      pendingSelectionRef.current = id;
      setSelectedProjectIdRaw(id);
    },
    [setSelectedProjectIdRaw]
  );

  // Ensure we read from localStorage once after mount before auto-selecting defaults.
  // `useLocalStorage(..., { initializeWithValue: false })` starts as `null`, which can
  // otherwise race with a fast `/api/projects` response and overwrite the user's selection.
  useEffect(() => {
    const storedRaw = window.localStorage.getItem(storageKey);
    if (storedRaw) {
      try {
        const parsed = JSON.parse(storedRaw) as unknown;
        if (typeof parsed === "string" && parsed.length > 0) {
          setSelectedProjectId(parsed);
        }
      } catch {
        // Ignore invalid storage contents; fallback selection logic will handle it.
      }
    }
    setHasCheckedStorage(true);
  }, [setSelectedProjectId, storageKey]);

  // Filter out default projects - these are the ones shown in the UI
  const visibleProjects = projects.filter((p) => !p.isDefault);

  // Auto-select first project if nothing selected or selected ID invalid
  // But respect pending selections to avoid race conditions when creating new projects
  useEffect(() => {
    if (!hasCheckedStorage) return;
    if (isActuallyLoading) return;

    // Check if there's a pending selection that exists in the projects list
    if (pendingSelectionRef.current) {
      const pendingExists = projects.find(
        (p) => p.id === pendingSelectionRef.current
      );
      if (pendingExists) {
        // Pending selection is now valid, ensure it's set
        if (selectedProjectId !== pendingSelectionRef.current) {
          setSelectedProjectIdRaw(pendingSelectionRef.current);
        }
        pendingSelectionRef.current = null;
        return;
      }
      // If pending selection doesn't exist yet, DON'T clear it if we're revalidating
      // This prevents the race condition where we clear the pending selection
      // before the optimistic update has been applied
      if (isValidating) {
        return;
      }
      // Only clear pending selection if we're not revalidating and have projects
      if (visibleProjects.length > 0) {
        pendingSelectionRef.current = null;
        setSelectedProjectIdRaw(visibleProjects[0].id);
        return;
      }
      return;
    }

    // Check if current selection is valid (exists in visible projects, not default)
    const currentExistsInVisible = visibleProjects.find(
      (p) => p.id === selectedProjectId
    );

    if (!selectedProjectId || !currentExistsInVisible) {
      // Current selection is invalid - select the first visible project
      if (visibleProjects.length > 0) {
        setSelectedProjectIdRaw(visibleProjects[0].id);
      }
    }
  }, [
    hasCheckedStorage,
    projects,
    visibleProjects,
    isActuallyLoading,
    isValidating,
    selectedProjectId,
    setSelectedProjectIdRaw,
  ]);

  const selectedProject = visibleProjects.find(
    (p) => p.id === selectedProjectId
  );

  // Determine if user needs to create their first project
  // (exclude default projects from this check since they're hidden)
  // Use isActuallyLoading to prevent flash of FirstProjectPrompt during initial load
  const needsFirstProject =
    !isActuallyLoading && hasCheckedStorage && visibleProjects.length === 0;

  return {
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    projects,
    isLoading,
    mutate,
    needsFirstProject,
  };
}
