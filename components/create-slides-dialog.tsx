"use client";

import { Check, ImageIcon, Loader2, Presentation } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useProjectSelector } from "@/hooks/use-project-selector";
import type { ProjectDoc } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import { toast } from "./toast";

type CreateSlidesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docIds: string[];
  docNames: string[];
};

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function isImageDoc(doc: ProjectDoc): boolean {
  return IMAGE_MIME_TYPES.includes(doc.mimeType);
}

export function CreateSlidesDialog({
  open,
  onOpenChange,
  docIds,
  docNames,
}: CreateSlidesDialogProps) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set()
  );
  const { selectedProjectId } = useProjectSelector();

  // Fetch project docs to get available images
  const { data: docsData } = useSWR<{ docs: ProjectDoc[] }>(
    selectedProjectId && open
      ? `/api/projects/${selectedProjectId}/docs?includeAll=true`
      : null,
    fetcher
  );

  const availableImages = docsData?.docs?.filter(isImageDoc) ?? [];

  const toggleImageSelection = (imageId: string) => {
    setSelectedImageIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (isSubmitting || docIds.length === 0 || !selectedProjectId) return;

    setIsSubmitting(true);
    try {
      const slideTitle = title.trim() || "Presentation";
      const userDescription = description.trim();

      // Combine note doc IDs with image doc IDs for targetDocIds
      const allDocIds = [...docIds, ...Array.from(selectedImageIds)];

      // Call the dedicated slides generation endpoint
      const response = await fetch("/api/slides/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          targetDocIds: allDocIds,
          title: slideTitle,
          instructions: userDescription || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to generate slides");
      }

      const data = await response.json();

      if (!data.success || !data.slides) {
        throw new Error("Invalid slides response");
      }

      // Navigate to chat with the pre-generated slides
      const slidesJson = JSON.stringify(data.slides);
      const url = new URL("/chat", window.location.origin);
      url.searchParams.set("slidesData", encodeURIComponent(slidesJson));
      url.searchParams.set("slidesTitle", slideTitle);

      // Close dialog first before navigation
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setSelectedImageIds(new Set());
      router.push(url.toString());
    } catch (error) {
      console.error("Failed to generate slides:", error);
      toast({
        type: "error",
        description:
          error instanceof Error ? error.message : "Failed to generate slides",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const isMultiple = docNames.length > 1;
  const dialogTitle = isMultiple
    ? `Create deck from ${docNames.length} notes`
    : "Create deck from note";
  const dialogDescription = isMultiple
    ? `Create a presentation deck based on these ${docNames.length} notes.`
    : `Create a presentation deck based on "${docNames[0] ?? ""}".`;

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setTitle("");
          setDescription("");
          setSelectedImageIds(new Set());
        }
        onOpenChange(isOpen);
      }}
      open={open}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Presentation className="size-5" />
            {dialogTitle}
          </DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {/* Selected Notes */}
        {isMultiple && (
          <div className="max-h-24 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
            <ul className="space-y-1 text-muted-foreground text-sm">
              {docNames.map((name, i) => (
                <li className="truncate" key={docIds[i]}>
                  • {name}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-4 py-2">
          {/* Presentation Title */}
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="slides-title">
              Presentation Title (optional)
            </label>
            <Input
              autoFocus
              id="slides-title"
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a title for your presentation..."
              value={title}
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="slides-description">
              Instructions (optional)
            </label>
            <Textarea
              className="resize-none"
              id="slides-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe how you want the deck structured, key points to emphasize, tone, audience, etc."
              rows={3}
              value={description}
            />
          </div>

          {/* Image Selection */}
          {availableImages.length > 0 && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 font-medium text-sm">
                <ImageIcon className="size-4" />
                Add Images (optional)
              </label>
              <ScrollArea className="h-32 rounded-md border border-border">
                <div className="grid grid-cols-4 gap-2 p-2">
                  {availableImages.map((img) => {
                    const isSelected = selectedImageIds.has(img.id);
                    return (
                      <button
                        className={cn(
                          "relative aspect-square overflow-hidden rounded-md border-2 transition-all",
                          isSelected
                            ? "border-primary ring-2 ring-primary/20"
                            : "border-transparent hover:border-muted-foreground/30"
                        )}
                        key={img.id}
                        onClick={() => toggleImageSelection(img.id)}
                        type="button"
                      >
                        <img
                          alt={img.description || img.filename}
                          className="size-full object-cover"
                          src={img.blobUrl}
                        />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                            <div className="rounded-full bg-primary p-1">
                              <Check className="size-3 text-primary-foreground" />
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
              <p className="text-muted-foreground text-xs">
                {selectedImageIds.size > 0
                  ? `${selectedImageIds.size} image${selectedImageIds.size > 1 ? "s" : ""} selected`
                  : "Click to select images to include in your deck"}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => {
              onOpenChange(false);
              setTitle("");
              setDescription("");
              setSelectedImageIds(new Set());
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating deck...
              </>
            ) : (
              "Create Deck"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
