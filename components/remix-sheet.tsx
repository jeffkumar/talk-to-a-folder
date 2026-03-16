"use client";

import {
  ArrowRight,
  Check,
  Copy,
  FileText,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Notebook,
  Pencil,
  Plus,
  Presentation,
  Search,
  Sparkles,
  Target,
  Twitter,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR, { mutate } from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useProjectSelector } from "@/hooks/use-project-selector";
import {
  REMIX_TEMPLATES,
  type RemixTemplateId,
} from "@/lib/constants/remix-templates";
import {
  BUILT_IN_NOTE_LABELS,
  type NoteLabel,
  type NoteLabelDefinition,
  type ProjectDoc,
} from "@/lib/db/schema";
import { cn, fetcher, generateUUID } from "@/lib/utils";
import { Response } from "./elements/response";
import { SlidesViewer } from "./slides-viewer";

type RemixSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docIds: string[];
  docNames: string[];
  /** Type of documents: "notes" or "files" - used to fetch available docs */
  docType?: "notes" | "files";
};

type ContextDoc = {
  id: string;
  name: string;
  labels?: NoteLabel[];
};

const TEMPLATE_ICONS: Record<string, typeof Twitter> = {
  Twitter,
  Instagram,
  Linkedin,
  Mail,
  FileText,
  Presentation,
  Pencil,
  Target,
  ArrowRight,
};

const CATEGORY_LABELS: Record<string, string> = {
  product: "Product Development",
  strategy: "Strategy",
  social: "Social Media",
};

export function RemixSheet({
  open,
  onOpenChange,
  docIds: initialDocIds,
  docNames: initialDocNames,
  docType = "notes",
}: RemixSheetProps) {
  const router = useRouter();
  const { selectedProjectId } = useProjectSelector();
  const [selectedTemplate, setSelectedTemplate] =
    useState<RemixTemplateId | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [contextDocs, setContextDocs] = useState<ContextDoc[]>([]);
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [filterLabelName, setFilterLabelName] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingToChat, setIsSavingToChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch available notes/docs for the picker
  const { data: availableDocsData } = useSWR<{
    notes?: ProjectDoc[];
    docs?: ProjectDoc[];
  }>(
    selectedProjectId && open
      ? docType === "notes"
        ? `/api/projects/${selectedProjectId}/notes`
        : `/api/projects/${selectedProjectId}/docs`
      : null,
    fetcher
  );

  // Fetch project data for available labels (only for notes)
  const { data: projectData } = useSWR<{
    project: { noteLabels: NoteLabelDefinition[] };
  }>(
    selectedProjectId && open && docType === "notes"
      ? `/api/projects/${selectedProjectId}`
      : null,
    fetcher
  );

  const availableLabels = useMemo(() => {
    return projectData?.project?.noteLabels ?? BUILT_IN_NOTE_LABELS;
  }, [projectData]);

  const availableDocs = useMemo(() => {
    const rawDocs =
      docType === "notes" ? availableDocsData?.notes : availableDocsData?.docs;
    return (rawDocs ?? []).map((d) => ({
      id: d.id,
      name: d.description || d.filename,
      labels:
        docType === "notes"
          ? ((d.metadata as { labels?: NoteLabel[] })?.labels ?? [])
          : [],
    }));
  }, [availableDocsData, docType]);

  // Docs not yet in context, filtered by search and labels
  const docsToAdd = useMemo(() => {
    const contextIds = new Set(contextDocs.map((d) => d.id));
    const searchLower = docSearchQuery.toLowerCase().trim();
    return availableDocs.filter((d) => {
      if (contextIds.has(d.id)) return false;
      // Filter by search query
      if (searchLower && !d.name.toLowerCase().includes(searchLower))
        return false;
      // Filter by label (only for notes)
      if (
        docType === "notes" &&
        filterLabelName &&
        !d.labels?.some((l) => l.name === filterLabelName)
      )
        return false;
      return true;
    });
  }, [availableDocs, contextDocs, docSearchQuery, filterLabelName, docType]);

  // Stable key for initial docIds to detect changes
  const initialDocIdsKey = initialDocIds.join(",");

  // Reset state when sheet opens with new docs
  useEffect(() => {
    if (open) {
      // Initialize context docs from props
      const initial: ContextDoc[] = initialDocIds.map((id, i) => ({
        id,
        name: initialDocNames[i] ?? id,
      }));
      setContextDocs(initial);
      setSelectedTemplate(null);
      setCustomInstructions("");
      setGeneratedContent("");
      setStreamingContent("");
      setIsGenerating(false);
      setAddDocOpen(false);
      setIsCopied(false);
    }
  }, [open, initialDocIdsKey, initialDocIds, initialDocNames]);

  // Derived arrays for API calls
  const docIds = contextDocs.map((d) => d.id);

  const addDocToContext = (doc: ContextDoc) => {
    setContextDocs((prev) => [...prev, doc]);
    setAddDocOpen(false);
  };

  const removeDocFromContext = (docId: string) => {
    setContextDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [generatedContent, streamingContent]);

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate || !selectedProjectId || isGenerating) return;
    if (selectedTemplate === "custom" && !customInstructions.trim()) return;

    setIsGenerating(true);
    setStreamingContent("");
    setGeneratedContent("");

    try {
      const response = await fetch("/api/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetDocIds: docIds,
          template: selectedTemplate,
          customInstructions: customInstructions.trim() || undefined,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to generate content");
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            // SSE format: "data: {json}"
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6);
                const event = JSON.parse(jsonStr);
                if (
                  event.type === "text-delta" &&
                  typeof event.delta === "string"
                ) {
                  fullContent += event.delta;
                  setStreamingContent(fullContent);
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }

      setGeneratedContent(fullContent);
      setStreamingContent("");
    } catch (error) {
      console.error("Failed to generate content:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate content"
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    selectedTemplate,
    selectedProjectId,
    docIds,
    customInstructions,
    isGenerating,
  ]);

  const handleCopy = useCallback(async () => {
    if (!generatedContent) return;

    try {
      await navigator.clipboard.writeText(generatedContent);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }, [generatedContent]);

  const handleSaveAsNote = useCallback(async () => {
    if (!generatedContent || !selectedProjectId || isSaving) return;

    setIsSaving(true);
    try {
      const templateName =
        REMIX_TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "Remix";
      const noteTitle = `${templateName} - ${new Date().toLocaleDateString()}`;

      // Auto-tag with build-plans label for product build plan template
      const labels =
        selectedTemplate === "product_build_plan"
          ? [{ name: "build-plans", color: "#f59e0b" }]
          : undefined;

      const response = await fetch(`/api/projects/${selectedProjectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: noteTitle,
          content: generatedContent,
          labels,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save note");
      }

      toast.success("Saved as note");
      // Refresh notes list
      void mutate(`/api/projects/${selectedProjectId}/notes`);
    } catch (error) {
      console.error("Failed to save note:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save note"
      );
    } finally {
      setIsSaving(false);
    }
  }, [generatedContent, selectedProjectId, selectedTemplate, isSaving]);

  const handleSaveToChat = useCallback(async () => {
    if (!generatedContent || !selectedProjectId || isSavingToChat) return;

    setIsSavingToChat(true);
    try {
      const templateName =
        REMIX_TEMPLATES.find((t) => t.id === selectedTemplate)?.name || "Remix";
      const chatId = generateUUID();
      const sourceNames = contextDocs.map((d) => d.name).join(", ");

      const response = await fetch("/api/remix/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          projectId: selectedProjectId,
          templateName,
          sourceNames,
          content: generatedContent,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save to chat");
      }

      toast.success("Saved to chat history");
      onOpenChange(false);
      // Small delay to let sheet close before navigation
      setTimeout(() => {
        router.push(`/chat/${chatId}`);
      }, 100);
    } catch (error) {
      console.error("Failed to save to chat:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save to chat"
      );
    } finally {
      setIsSavingToChat(false);
    }
  }, [
    generatedContent,
    selectedProjectId,
    selectedTemplate,
    contextDocs,
    isSavingToChat,
    onOpenChange,
    router,
  ]);

  const isMultiple = contextDocs.length > 1;
  const title = isMultiple
    ? `Remix ${contextDocs.length} ${docType === "notes" ? "notes" : "files"}`
    : `Remix "${contextDocs[0]?.name ?? ""}"`;

  const displayContent = streamingContent || generatedContent;
  const showTemplateSelection = !displayContent && !isGenerating;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="remix-sheet-content flex w-full flex-col gap-0 p-0 sm:max-w-lg [&>button:last-of-type]:hidden"
        side="right"
      >
        <SheetHeader className="border-border border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                {title}
              </SheetTitle>
              <SheetDescription className="mt-0.5 text-xs">
                Transform your content into new formats
              </SheetDescription>
            </div>
            <SheetClose asChild>
              <Button
                className="h-8 w-8"
                size="icon"
                type="button"
                variant="ghost"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        {/* Document chips */}
        <div className="border-border border-b px-4 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {contextDocs.map((doc) => (
              <div
                className="group inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs"
                key={doc.id}
              >
                <FileText className="h-3 w-3" />
                <span className="max-w-[100px] truncate">{doc.name}</span>
                {contextDocs.length > 1 && (
                  <button
                    className="ml-0.5 rounded-full p-0.5 opacity-60 hover:bg-background hover:opacity-100"
                    onClick={() => removeDocFromContext(doc.id)}
                    title="Remove from context"
                    type="button"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            ))}
            {/* Add document button */}
            <Popover
              onOpenChange={(open) => {
                setAddDocOpen(open);
                if (!open) {
                  setDocSearchQuery("");
                  setFilterLabelName(null);
                }
              }}
              open={addDocOpen}
            >
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs",
                    "border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary"
                  )}
                  type="button"
                >
                  <Plus className="h-3 w-3" />
                  Add
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="flex w-72 flex-col p-0"
                onOpenAutoFocus={(e) => e.preventDefault()}
                style={{
                  maxHeight:
                    "min(24rem, var(--radix-popover-content-available-height))",
                }}
              >
                <div className="shrink-0 p-2 pb-1">
                  <div className="mb-2 font-medium text-muted-foreground text-xs">
                    Add {docType === "notes" ? "note" : "file"} to context
                  </div>
                  {/* Search input */}
                  <div className="relative mb-2">
                    <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      className="h-7 pl-7 text-sm"
                      onChange={(e) => setDocSearchQuery(e.target.value)}
                      placeholder="Search..."
                      value={docSearchQuery}
                    />
                  </div>
                  {/* Label filter - only for notes */}
                  {docType === "notes" && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      <button
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs transition-colors",
                          filterLabelName === null
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                        onClick={() => setFilterLabelName(null)}
                        type="button"
                      >
                        All
                      </button>
                      {availableLabels.map((label) => (
                        <button
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs transition-colors",
                            filterLabelName === label.name
                              ? "text-white"
                              : "bg-muted text-muted-foreground hover:bg-muted/80"
                          )}
                          key={label.name}
                          onClick={() =>
                            setFilterLabelName(
                              filterLabelName === label.name ? null : label.name
                            )
                          }
                          style={
                            filterLabelName === label.name
                              ? { backgroundColor: label.color }
                              : undefined
                          }
                          type="button"
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Scrollable doc list */}
                <div
                  className="min-h-0 flex-1 space-y-1 p-2 pt-0"
                  onWheel={(e) => e.stopPropagation()}
                  style={{ overflowY: "auto", overscrollBehavior: "contain" }}
                >
                  {docsToAdd.length > 0 ? (
                    docsToAdd.map((doc) => (
                      <button
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        key={doc.id}
                        onClick={() => addDocToContext(doc)}
                        type="button"
                      >
                        {docType === "notes" ? (
                          <Notebook className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        ) : (
                          <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 truncate">{doc.name}</span>
                        {docType === "notes" &&
                          doc.labels &&
                          doc.labels.length > 0 && (
                            <div className="flex gap-0.5">
                              {doc.labels.slice(0, 2).map((label) => (
                                <span
                                  className="h-2 w-2 rounded-full"
                                  key={label.name}
                                  style={{ backgroundColor: label.color }}
                                  title={label.name}
                                />
                              ))}
                            </div>
                          )}
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-3 text-center text-muted-foreground text-xs">
                      {docSearchQuery || filterLabelName
                        ? "No matching documents"
                        : "All documents are in context"}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Main content area */}
        <ScrollArea className="min-w-0 flex-1 overflow-hidden" ref={scrollRef}>
          <div
            className={cn(
              "w-full max-w-full",
              selectedTemplate === "slides" ? "p-0" : "px-4 py-4"
            )}
          >
            {showTemplateSelection ? (
              <div className="space-y-4 p-4">
                <div className="font-medium text-sm">Choose output format</div>
                <div className="space-y-4">
                  {/* Group templates by category */}
                  {(["product", "strategy", "social"] as const).map(
                    (category) => {
                      const categoryTemplates = REMIX_TEMPLATES.filter(
                        (t) => t.category === category
                      );
                      if (categoryTemplates.length === 0) return null;
                      return (
                        <div key={category}>
                          <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                            {CATEGORY_LABELS[category]}
                          </div>
                          <div className="grid gap-2">
                            {categoryTemplates.map((template) => {
                              const Icon =
                                TEMPLATE_ICONS[template.iconName] || FileText;
                              const isSelected =
                                selectedTemplate === template.id;
                              return (
                                <button
                                  className={cn(
                                    "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                                    isSelected
                                      ? "border-primary bg-primary/5"
                                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                                  )}
                                  key={template.id}
                                  onClick={() =>
                                    setSelectedTemplate(template.id)
                                  }
                                  type="button"
                                >
                                  <div
                                    className={cn(
                                      "mt-0.5 rounded-md p-1.5",
                                      isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted"
                                    )}
                                  >
                                    <Icon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {template.name}
                                      </span>
                                      {isSelected && (
                                        <Check className="h-4 w-4 text-primary" />
                                      )}
                                    </div>
                                    <p className="mt-0.5 text-muted-foreground text-xs">
                                      {template.description}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    }
                  )}
                  {/* Custom template (no category) */}
                  {REMIX_TEMPLATES.filter((t) => !t.category).map(
                    (template) => {
                      const Icon =
                        TEMPLATE_ICONS[template.iconName] || FileText;
                      const isSelected = selectedTemplate === template.id;
                      return (
                        <button
                          className={cn(
                            "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                          key={template.id}
                          onClick={() => setSelectedTemplate(template.id)}
                          type="button"
                        >
                          <div
                            className={cn(
                              "mt-0.5 rounded-md p-1.5",
                              isSelected
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {template.name}
                              </span>
                              {isSelected && (
                                <Check className="h-4 w-4 text-primary" />
                              )}
                            </div>
                            <p className="mt-0.5 text-muted-foreground text-xs">
                              {template.description}
                            </p>
                          </div>
                        </button>
                      );
                    }
                  )}
                </div>

                {/* Custom instructions for custom template */}
                {selectedTemplate === "custom" && (
                  <div className="space-y-2">
                    <label
                      className="font-medium text-sm"
                      htmlFor="custom-instructions"
                    >
                      Describe your desired format
                    </label>
                    <Textarea
                      className="resize-none"
                      id="custom-instructions"
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      placeholder="e.g., Create a podcast script introduction, write as a haiku, summarize in bullet points..."
                      rows={3}
                      value={customInstructions}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Generated content display */}
                <div
                  className={cn(
                    "rounded-lg border border-border bg-muted/30",
                    selectedTemplate === "slides"
                      ? "w-full max-w-full overflow-hidden border-0 bg-transparent p-0"
                      : "p-4"
                  )}
                >
                  {isGenerating && !streamingContent ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground text-sm">
                        Generating...
                      </span>
                    </div>
                  ) : selectedTemplate === "slides" ? (
                    <div
                      className="min-h-[300px] w-full max-w-full overflow-hidden"
                      style={{ maxWidth: "100%" }}
                    >
                      <SlidesViewer
                        content={displayContent}
                        currentVersionIndex={0}
                        isCurrentVersion={true}
                        status={isGenerating ? "streaming" : "idle"}
                      />
                    </div>
                  ) : (
                    <Response className="prose prose-sm dark:prose-invert max-w-none">
                      {displayContent}
                    </Response>
                  )}
                </div>

                {/* Action buttons for generated content */}
                {generatedContent && !isGenerating && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        className="gap-1.5"
                        onClick={handleCopy}
                        size="sm"
                        variant="outline"
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                        {isCopied ? "Copied" : "Copy"}
                      </Button>
                      <Button
                        className="gap-1.5"
                        disabled={isSaving}
                        onClick={handleSaveAsNote}
                        size="sm"
                        variant="outline"
                      >
                        {isSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        Save as Note
                      </Button>
                      <Button
                        className="gap-1.5"
                        disabled={isSavingToChat}
                        onClick={handleSaveToChat}
                        size="sm"
                        variant="outline"
                      >
                        {isSavingToChat ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MessageSquare className="h-4 w-4" />
                        )}
                        Save to Chat
                      </Button>
                    </div>
                    <Button
                      className="ml-auto"
                      onClick={() => {
                        setGeneratedContent("");
                        setStreamingContent("");
                        setSelectedTemplate(null);
                      }}
                      size="sm"
                      variant="ghost"
                    >
                      Try Another Format
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Generate button */}
        {showTemplateSelection && (
          <div className="border-border border-t p-4">
            <Button
              className="w-full gap-2"
              disabled={
                !selectedTemplate ||
                isGenerating ||
                (selectedTemplate === "custom" && !customInstructions.trim())
              }
              onClick={handleGenerate}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
