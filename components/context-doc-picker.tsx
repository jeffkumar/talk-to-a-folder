"use client";

import { FileText, Notebook, Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  BUILT_IN_NOTE_LABELS,
  type NoteLabel,
  type NoteLabelDefinition,
  type ProjectDoc,
} from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

export type ContextDoc = {
  id: string;
  name: string;
  type: "note" | "file";
  labels?: NoteLabel[];
};

type ContextDocPickerProps = {
  contextDocs: ContextDoc[];
  onAdd: (doc: ContextDoc) => void;
  onRemove: (docId: string) => void;
  onClear: () => void;
  selectedProjectId: string | null;
};

export function ContextDocPicker({
  contextDocs,
  onAdd,
  onRemove,
  onClear,
  selectedProjectId,
}: ContextDocPickerProps) {
  const [addDocOpen, setAddDocOpen] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState("");
  const [filterLabelName, setFilterLabelName] = useState<string | null>(null);

  const { data: notesData } = useSWR<{ notes?: ProjectDoc[] }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/docs?type=note`
      : null,
    fetcher
  );

  const { data: filesData } = useSWR<{ docs?: ProjectDoc[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/docs` : null,
    fetcher
  );

  const { data: projectData } = useSWR<{
    project: { noteLabels: NoteLabelDefinition[] };
  }>(selectedProjectId ? `/api/projects/${selectedProjectId}` : null, fetcher);

  const availableLabels = useMemo(() => {
    return projectData?.project?.noteLabels ?? BUILT_IN_NOTE_LABELS;
  }, [projectData]);

  const availableNotes = useMemo(() => {
    return (notesData?.notes ?? []).map((d) => ({
      id: d.id,
      name: d.description || d.filename,
      type: "note" as const,
      labels: (d.metadata as { labels?: NoteLabel[] })?.labels ?? [],
    }));
  }, [notesData]);

  const availableFiles = useMemo(() => {
    return (filesData?.docs ?? []).map((d) => ({
      id: d.id,
      name: d.description || d.filename,
      type: "file" as const,
    }));
  }, [filesData]);

  const notesToAdd = useMemo(() => {
    const contextIds = new Set(contextDocs.map((d) => d.id));
    const searchLower = docSearchQuery.toLowerCase().trim();
    return availableNotes.filter((d) => {
      if (contextIds.has(d.id)) {
        return false;
      }
      if (searchLower && !d.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      if (
        filterLabelName &&
        !d.labels?.some((l) => l.name === filterLabelName)
      ) {
        return false;
      }
      return true;
    });
  }, [availableNotes, contextDocs, docSearchQuery, filterLabelName]);

  const filesToAdd = useMemo(() => {
    const contextIds = new Set(contextDocs.map((d) => d.id));
    const searchLower = docSearchQuery.toLowerCase().trim();
    return availableFiles.filter((d) => {
      if (contextIds.has(d.id)) {
        return false;
      }
      if (searchLower && !d.name.toLowerCase().includes(searchLower)) {
        return false;
      }
      if (filterLabelName) {
        return false;
      }
      return true;
    });
  }, [availableFiles, contextDocs, docSearchQuery, filterLabelName]);

  const hasDocsToAdd = notesToAdd.length > 0 || filesToAdd.length > 0;

  if (!selectedProjectId) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      {contextDocs.map((doc) => (
        <div
          className="group inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs"
          key={doc.id}
        >
          {doc.type === "note" ? (
            <Notebook className="h-3 w-3" />
          ) : (
            <FileText className="h-3 w-3" />
          )}
          <span className="max-w-[120px] truncate">{doc.name}</span>
          <button
            className="ml-0.5 rounded-full p-0.5 opacity-60 hover:bg-background hover:opacity-100"
            onClick={() => onRemove(doc.id)}
            title="Remove from context"
            type="button"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      ))}

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
              Add document to context
            </div>
            <div className="relative mb-2">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-7 pl-7 text-sm"
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Search..."
                value={docSearchQuery}
              />
            </div>
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
          </div>
          <div
            className="min-h-0 flex-1 space-y-1 p-2 pt-0"
            onWheel={(e) => e.stopPropagation()}
            style={{ overflowY: "auto", overscrollBehavior: "contain" }}
          >
            {notesToAdd.length > 0 && (
              <>
                <div className="px-2 py-1 font-medium text-muted-foreground text-xs">
                  Notes
                </div>
                {notesToAdd.map((doc) => (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    key={doc.id}
                    onClick={() => {
                      onAdd(doc);
                      setAddDocOpen(false);
                    }}
                    type="button"
                  >
                    <Notebook className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{doc.name}</span>
                    {doc.labels && doc.labels.length > 0 && (
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
                ))}
              </>
            )}
            {filesToAdd.length > 0 && (
              <>
                <div
                  className={cn(
                    "px-2 py-1 font-medium text-muted-foreground text-xs",
                    notesToAdd.length > 0 && "mt-2"
                  )}
                >
                  Files
                </div>
                {filesToAdd.map((doc) => (
                  <button
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                    key={doc.id}
                    onClick={() => {
                      onAdd(doc);
                      setAddDocOpen(false);
                    }}
                    type="button"
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.name}</span>
                  </button>
                ))}
              </>
            )}
            {!hasDocsToAdd && (
              <div className="px-2 py-3 text-center text-muted-foreground text-xs">
                {docSearchQuery || filterLabelName
                  ? "No matching documents"
                  : "All documents are in context"}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {contextDocs.length > 0 && (
        <Button
          className="h-5 whitespace-nowrap px-1.5 text-xs"
          onClick={onClear}
          size="sm"
          type="button"
          variant="ghost"
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Clear</span>
        </Button>
      )}
    </div>
  );
}
