"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getChatHistoryPaginationKey } from "@/components/sidebar-history";

export function useDeleteChats() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteAllChats = async (projectId?: string) => {
    setIsDeleting(true);
    try {
      const url = projectId
        ? `/api/history?projectId=${projectId}`
        : "/api/history";
      const deletePromise = fetch(url, {
        method: "DELETE",
      });

      await toast.promise(deletePromise, {
        loading: projectId
          ? "Deleting project chats..."
          : "Deleting all chats...",
        success: () => {
          if (projectId) {
            mutate(
              unstable_serialize((index, previousPageData) =>
                getChatHistoryPaginationKey(index, previousPageData, projectId)
              )
            );
          } else {
            mutate(
              unstable_serialize((index, previousPageData) =>
                getChatHistoryPaginationKey(index, previousPageData, undefined)
              )
            );
          }
          router.push("/");
          return projectId
            ? "Project chats deleted successfully"
            : "All chats deleted successfully";
        },
        error: projectId
          ? "Failed to delete project chats"
          : "Failed to delete all chats",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteAllChats, isDeleting };
}
