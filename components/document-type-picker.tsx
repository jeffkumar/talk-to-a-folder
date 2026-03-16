"use client";

import { ArrowRight, FileText, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { fetcher } from "@/lib/utils";
import { CreateDocumentTypeModal } from "./create-document-type-modal";

export type DocumentTypeOption = {
  id: string;
  name: string;
  description?: string;
  acceptedMimeTypes?: string[];
  isBuiltIn?: boolean;
};

type DocumentTypesResponse = {
  agents: DocumentTypeOption[];
  supportedMimeTypes: Array<{ value: string; label: string }>;
};

type DocumentTypePickerProps = {
  onSelect: (type: { id: string; isWorkflow: boolean }) => void;
  onCancel?: () => void;
  mimeTypeFilter?: string | null;
  showGeneralDoc?: boolean;
  fileCount?: number;
};

function getMatchingDocumentTypes(
  types: DocumentTypeOption[],
  mimeType: string | null
): DocumentTypeOption[] {
  if (!mimeType) return types;
  return types.filter((t) => {
    const accepted = t.acceptedMimeTypes ?? [];
    return accepted.length === 0 || accepted.includes(mimeType);
  });
}

export function DocumentTypePicker({
  onSelect,
  onCancel,
  mimeTypeFilter = null,
  showGeneralDoc = true,
  fileCount = 1,
}: DocumentTypePickerProps) {
  const { selectedProjectId } = useProjectSelector();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const { data, mutate } = useSWR<DocumentTypesResponse>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/workflow-agents`
      : null,
    fetcher
  );

  const documentTypes = data?.agents ?? [];
  const filteredTypes = getMatchingDocumentTypes(documentTypes, mimeTypeFilter);

  const handleTypeCreated = (newType: { id: string; name: string }) => {
    void mutate();
    setShowCreateModal(false);
    onSelect({ id: newType.id, isWorkflow: true });
  };

  return (
    <>
      <div className="space-y-2">
        {/* General Document */}
        {showGeneralDoc && (
          <button
            className="flex w-full flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            onClick={() => onSelect({ id: "general_doc", isWorkflow: false })}
            type="button"
          >
            <span className="font-medium text-sm">General Document</span>
            <span className="text-muted-foreground text-xs">
              Standard document processing
            </span>
          </button>
        )}

        {/* Next Steps Analysis */}
        {showGeneralDoc && (
          <button
            className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
            onClick={() => onSelect({ id: "next_steps", isWorkflow: false })}
            type="button"
          >
            <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">Next Steps Analysis</span>
              <span className="text-muted-foreground text-xs">
                Identify key opportunities and actions
              </span>
            </div>
          </button>
        )}

        {/* Custom Document Types */}
        {filteredTypes.length > 0 && (
          <>
            <div className="mt-3 mb-1 text-muted-foreground text-xs">
              Your Document Types
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-2">
                {filteredTypes.map((docType) => (
                  <button
                    className="flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50"
                    key={docType.id}
                    onClick={() =>
                      onSelect({ id: docType.id, isWorkflow: true })
                    }
                    type="button"
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-sm">
                        {docType.name}
                      </span>
                      {docType.description && (
                        <span className="text-muted-foreground text-xs">
                          {docType.description}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        {/* Create New Type Button */}
        <div className="mt-3 border-t pt-3">
          <button
            className="flex w-full items-center gap-2 rounded-lg border border-dashed p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/50"
            onClick={() => setShowCreateModal(true)}
            type="button"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <Plus className="h-4 w-4 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="font-medium text-sm">Create New Type</span>
              <span className="text-muted-foreground text-xs">
                Define custom extraction for your documents
              </span>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        {onCancel && (
          <div className="mt-4 flex justify-end">
            <Button onClick={onCancel} variant="outline">
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateDocumentTypeModal
        onCreated={handleTypeCreated}
        onOpenChange={setShowCreateModal}
        open={showCreateModal}
      />
    </>
  );
}
