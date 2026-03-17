"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Artifact } from "@/components/create-artifact";
import { CopyIcon, DownloadIcon, RedoIcon, UndoIcon } from "@/components/icons";
import {
  downloadSlidesPDF,
  generateSlidesPDF,
} from "@/components/slides-pdf-export";
import { SlidesViewer, safeParseSlides } from "@/components/slides-viewer";

type Metadata = null;

function getSelectedProjectId(): string | null {
  try {
    const stored = localStorage.getItem("flowchat-selected-project-id");
    if (stored) {
      const parsed = JSON.parse(stored);
      if (typeof parsed === "string" && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Ignore errors
  }
  return null;
}

export const slidesArtifact = new Artifact<"slides", Metadata>({
  kind: "slides",
  description: "Useful for creating presentation decks and pitch decks",
  initialize: () => null,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-slidesDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, status, isCurrentVersion, currentVersionIndex }) => {
    return (
      <SlidesViewer
        content={content}
        currentVersionIndex={currentVersionIndex}
        isCurrentVersion={isCurrentVersion}
        status={status}
      />
    );
  },
  actions: [
    {
      icon: <DownloadIcon size={18} />,
      label: "PDF",
      description: "Export as PDF",
      onClick: async ({ content }) => {
        const slidesData = safeParseSlides(content);
        if (!slidesData || slidesData.slides.length === 0) {
          toast.error("No deck to export");
          return;
        }
        try {
          toast.info("Generating PDF...");
          const blob = await generateSlidesPDF(
            slidesData.slides,
            slidesData.slides.at(0)?.title ?? "Presentation"
          );
          const filename = `${slidesData.slides.at(0)?.title?.replaceAll(/[^\d\sA-Za-z-]/g, "") ?? "presentation"}.pdf`;
          downloadSlidesPDF(blob, filename);
          toast.success("PDF downloaded!");
        } catch (_error) {
          toast.error("Failed to generate PDF");
        }
      },
    },
    {
      icon: <UndoIcon size={18} />,
      description: "View Previous version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "View Next version",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }
        return false;
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: "Copy deck as JSON",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("Copied deck to clipboard!");
      },
    },
    {
      icon: <FileText size={18} />,
      label: "Notes",
      description: "Save to Notes",
      onClick: async ({ content }) => {
        const slidesData = safeParseSlides(content);
        if (!slidesData || slidesData.slides.length === 0) {
          toast.error("No deck to save");
          return;
        }

        const projectId = getSelectedProjectId();
        if (!projectId) {
          toast.error("No project selected");
          return;
        }

        const title = slidesData.slides.at(0)?.title ?? "Deck";
        // Save as JSON so the note preview can render the slides viewer
        const jsonContent = JSON.stringify(slidesData);

        try {
          const response = await fetch(`/api/projects/${projectId}/docs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, content: jsonContent }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw new Error(data?.error ?? "Failed to save note");
          }

          toast.success("Saved to Notes!");
        } catch (error) {
          toast.error(
            error instanceof Error ? error.message : "Failed to save note"
          );
        }
      },
    },
  ],
  toolbar: [],
});
