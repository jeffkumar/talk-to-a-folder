"use client";

import { AlertTriangle, Check, LoaderIcon, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { fetcher } from "@/lib/utils";

type SupportedMimeType = {
  value: string;
  label: string;
};

type ExtractionMethod = "auto" | "custom";

const EXTRACTION_METHODS: {
  value: ExtractionMethod;
  label: string;
  description: string;
}[] = [
  {
    value: "auto",
    label: "Auto-generate",
    description: "Schema generated from extraction prompt",
  },
  {
    value: "custom",
    label: "Custom schema",
    description: "Provide your own JSON schema",
  },
];

type SchemaValidationResult = {
  isValid: boolean;
  isEmpty: boolean;
  error: string | null;
};

function validateJsonSchema(schemaString: string): SchemaValidationResult {
  if (!schemaString.trim()) {
    return { isValid: true, isEmpty: true, error: null };
  }

  try {
    const parsed = JSON.parse(schemaString);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return {
        isValid: false,
        isEmpty: false,
        error: "Schema must be a JSON object",
      };
    }

    if (parsed.type !== "object") {
      return {
        isValid: false,
        isEmpty: false,
        error: 'Root schema must have type: "object"',
      };
    }

    if (!parsed.properties || typeof parsed.properties !== "object") {
      return {
        isValid: false,
        isEmpty: false,
        error: "Schema must have a 'properties' object",
      };
    }

    if (Object.keys(parsed.properties).length === 0) {
      return {
        isValid: false,
        isEmpty: false,
        error: "Schema must have at least one property",
      };
    }

    for (const [key, value] of Object.entries(parsed.properties)) {
      if (typeof value !== "object" || value === null) {
        return {
          isValid: false,
          isEmpty: false,
          error: `Property '${key}' must be an object`,
        };
      }
      const prop = value as Record<string, unknown>;
      if (!prop.type) {
        return {
          isValid: false,
          isEmpty: false,
          error: `Property '${key}' must have a 'type'`,
        };
      }
    }

    return { isValid: true, isEmpty: false, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid JSON";
    return { isValid: false, isEmpty: false, error: message };
  }
}

type CreateDocumentTypeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (docType: { id: string; name: string }) => void;
};

export function CreateDocumentTypeModal({
  open,
  onOpenChange,
  onCreated,
}: CreateDocumentTypeModalProps) {
  const { selectedProjectId } = useProjectSelector();

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formAcceptedMimeTypes, setFormAcceptedMimeTypes] = useState<string[]>(
    []
  );
  const [formExtractionPrompt, setFormExtractionPrompt] = useState("");
  const [formExtractionMethod, setFormExtractionMethod] =
    useState<ExtractionMethod>("auto");
  const [formSchemaDescription, setFormSchemaDescription] = useState("");
  const [formOutputSchema, setFormOutputSchema] = useState("");
  const [isGeneratingSchema, setIsGeneratingSchema] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const schemaValidation = useMemo(
    () => validateJsonSchema(formOutputSchema),
    [formOutputSchema]
  );

  const { data: supportedMimeTypesData } = useSWR<{
    supportedMimeTypes: SupportedMimeType[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/workflow-agents`
      : null,
    fetcher
  );

  const supportedMimeTypes = supportedMimeTypesData?.supportedMimeTypes ?? [];

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormAcceptedMimeTypes([]);
    setFormExtractionPrompt("");
    setFormExtractionMethod("auto");
    setFormSchemaDescription("");
    setFormOutputSchema("");
  };

  const toggleMimeType = (mimeType: string) => {
    setFormAcceptedMimeTypes((prev) =>
      prev.includes(mimeType)
        ? prev.filter((m) => m !== mimeType)
        : [...prev, mimeType]
    );
  };

  const handleSave = async () => {
    if (
      !selectedProjectId ||
      !formName.trim() ||
      formAcceptedMimeTypes.length === 0
    )
      return;

    if (formExtractionMethod === "custom" && !schemaValidation.isValid) {
      toast.error(schemaValidation.error ?? "Invalid output schema");
      return;
    }

    setIsSaving(true);
    try {
      let parsedSchema: Record<string, unknown> | null = null;

      if (formExtractionMethod === "auto" && formExtractionPrompt.trim()) {
        setIsGeneratingSchema(true);
        const schemaResponse = await fetch("/api/generate-schema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description: formExtractionPrompt.trim(),
            projectId: selectedProjectId,
          }),
        });

        if (schemaResponse.ok) {
          const { schema } = await schemaResponse.json();
          parsedSchema = schema;
        }
        setIsGeneratingSchema(false);
      } else if (formExtractionMethod === "custom" && formOutputSchema.trim()) {
        parsedSchema = JSON.parse(formOutputSchema) as Record<string, unknown>;
      }

      const response = await fetch(
        `/api/projects/${selectedProjectId}/workflow-agents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim(),
            acceptedMimeTypes: formAcceptedMimeTypes,
            extractionPrompt: formExtractionPrompt,
            extractionMethod: formExtractionMethod,
            outputSchema: parsedSchema,
          }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create document type");
      }

      const result = await response.json();
      toast.success("Document type created");
      resetForm();
      onOpenChange(false);
      onCreated?.({ id: result.id, name: formName.trim() });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create document type"
      );
    } finally {
      setIsSaving(false);
      setIsGeneratingSchema(false);
    }
  };

  const handleGenerateSchema = async () => {
    if (!formSchemaDescription.trim()) {
      toast.error("Please enter a description of the output schema");
      return;
    }

    setIsGeneratingSchema(true);
    try {
      const response = await fetch("/api/generate-schema", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: formSchemaDescription.trim(),
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to generate schema");
      }

      const { schema } = await response.json();
      setFormOutputSchema(JSON.stringify(schema, null, 2));
      toast.success("Schema generated! Review and edit if needed.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate schema"
      );
    } finally {
      setIsGeneratingSchema(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(newOpen) => {
        onOpenChange(newOpen);
        if (!newOpen) {
          resetForm();
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Document Type</DialogTitle>
          <DialogDescription>
            Define how specific document types are extracted and processed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-4">
            <div>
              <label className="font-medium text-sm" htmlFor="doc-type-name">
                Document type name
              </label>
              <Input
                className="mt-2"
                id="doc-type-name"
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., Purchase Orders, Contracts, Receipts..."
                value={formName}
              />
              <p className="mt-1 text-muted-foreground text-xs">
                This name will appear when uploading files.
              </p>
            </div>

            <div>
              <label
                className="font-medium text-sm"
                htmlFor="doc-type-description"
              >
                Description
              </label>
              <Input
                className="mt-2"
                id="doc-type-description"
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of what this document type processes..."
                value={formDescription}
              />
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Accepted File Types</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {supportedMimeTypes.map((mimeType) => {
                  const isSelected = formAcceptedMimeTypes.includes(
                    mimeType.value
                  );
                  return (
                    <button
                      className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                      key={mimeType.value}
                      onClick={() => toggleMimeType(mimeType.value)}
                      type="button"
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </div>
                      <span className="text-sm">{mimeType.label}</span>
                    </button>
                  );
                })}
              </div>
              {formAcceptedMimeTypes.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  Select at least one file type.
                </p>
              )}
            </div>

            <div>
              <label className="font-medium text-sm" htmlFor="doc-type-prompt">
                Extraction Prompt
              </label>
              <Textarea
                className="mt-2 min-h-[80px] font-mono text-sm"
                id="doc-type-prompt"
                onChange={(e) => setFormExtractionPrompt(e.target.value)}
                placeholder="Instructions for how to extract and format content from these documents..."
                value={formExtractionPrompt}
              />
              <p className="mt-1 text-muted-foreground text-xs">
                Instructions that guide the extraction process.
              </p>
            </div>

            <div className="space-y-3">
              <label className="font-medium text-sm">Output Schema</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {EXTRACTION_METHODS.map((method) => {
                  const isSelected = formExtractionMethod === method.value;
                  return (
                    <button
                      className={`flex items-center gap-2 rounded-md border p-2 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/10"
                          : "hover:bg-muted/50"
                      }`}
                      key={method.value}
                      onClick={() => setFormExtractionMethod(method.value)}
                      type="button"
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground"
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">
                          {method.label}
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {method.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {formExtractionMethod === "auto" && (
                <div className="flex items-start gap-2 rounded-md bg-primary/5 p-2.5 text-muted-foreground text-xs">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>
                    Schema will be automatically generated from your extraction
                    prompt when you save.
                  </span>
                </div>
              )}

              {formExtractionMethod === "custom" && (
                <div className="space-y-3">
                  <div>
                    <Textarea
                      className="min-h-[60px] text-sm"
                      id="schema-description"
                      onChange={(e) => setFormSchemaDescription(e.target.value)}
                      placeholder="Describe what data you want to extract, e.g., 'Extract PO number, vendor, line items with SKU, quantity, and price'"
                      value={formSchemaDescription}
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <Button
                        disabled={
                          !formSchemaDescription.trim() || isGeneratingSchema
                        }
                        onClick={handleGenerateSchema}
                        size="sm"
                        type="button"
                      >
                        {isGeneratingSchema ? (
                          <>
                            <LoaderIcon className="mr-1 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-1 h-4 w-4" />
                            Generate Schema
                          </>
                        )}
                      </Button>
                      <p className="text-muted-foreground text-xs">
                        Describe the fields and we&apos;ll generate a JSON
                        schema.
                      </p>
                    </div>
                  </div>

                  {formOutputSchema && (
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-amber-700 text-xs dark:text-amber-400">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          Be careful when editing. An invalid schema may cause
                          files to fail parsing.
                        </span>
                      </div>
                      <Textarea
                        className={`min-h-[120px] font-mono text-xs ${
                          !schemaValidation.isEmpty && !schemaValidation.isValid
                            ? "border-red-500 focus-visible:ring-red-500"
                            : ""
                        }`}
                        id="doc-type-schema"
                        onChange={(e) => setFormOutputSchema(e.target.value)}
                        placeholder='{"type": "object", "properties": {...}}'
                        value={formOutputSchema}
                      />
                      {schemaValidation.error && (
                        <p className="text-red-600 text-xs">
                          {schemaValidation.error}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={
                !formName.trim() ||
                formAcceptedMimeTypes.length === 0 ||
                isSaving ||
                isGeneratingSchema ||
                (formExtractionMethod === "custom" && !schemaValidation.isValid)
              }
              onClick={handleSave}
            >
              {isSaving || isGeneratingSchema ? (
                <>
                  <LoaderIcon className="mr-1 h-4 w-4 animate-spin" />
                  {isGeneratingSchema ? "Generating schema..." : "Creating..."}
                </>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
