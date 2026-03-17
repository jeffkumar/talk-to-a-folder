"use client";

import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";

type PendingUpload = {
  docId: string;
  filename: string;
  toastId: string | number;
  projectId: string;
};

// Global state to track pending uploads across component remounts
const pendingUploads = new Map<string, PendingUpload>();

/**
 * Hook for showing upload processing notifications.
 * Shows a persistent toast when a file is uploaded and updates it when processing completes.
 */
export function useUploadNotifications() {
  const { mutate } = useSWRConfig();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Start polling when we have pending uploads
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      if (pendingUploads.size === 0) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        return;
      }

      // Check status of each pending upload
      for (const [docId, upload] of pendingUploads.entries()) {
        try {
          const response = await fetch(
            `/api/projects/${upload.projectId}/docs/${docId}/status`
          );
          if (!response.ok) {
            continue;
          }

          const data = (await response.json()) as { parseStatus?: string };
          const status = data.parseStatus;

          if (status === "parsed") {
            toast.success(`${upload.filename} is ready`, {
              id: upload.toastId,
              duration: 4000,
            });
            pendingUploads.delete(docId);
            // Refresh the docs list
            mutate(`/api/projects/${upload.projectId}/docs`);
          } else if (status === "failed") {
            toast.error(`${upload.filename} processing failed`, {
              id: upload.toastId,
              duration: 6000,
            });
            pendingUploads.delete(docId);
          }
          // If still pending, keep polling
        } catch {
          // Ignore errors, will retry on next poll
        }
      }
    }, 3000); // Poll every 3 seconds
  }, [mutate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Track a newly uploaded file for processing status.
   */
  const trackUpload = useCallback(
    (docId: string, filename: string, projectId: string) => {
      // Show persistent loading toast
      const toastId = toast.loading(`Processing ${filename}...`, {
        duration: Number.POSITIVE_INFINITY,
        description: "File is being indexed for search",
      });

      pendingUploads.set(docId, {
        docId,
        filename,
        toastId,
        projectId,
      });

      startPolling();
    },
    [startPolling]
  );

  return { trackUpload };
}
