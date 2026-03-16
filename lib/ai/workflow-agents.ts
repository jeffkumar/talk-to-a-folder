import "server-only";

/**
 * Workflow Agents - Define custom document types with extraction configurations.
 *
 * Each workflow agent specifies:
 * - acceptedMimeTypes: Which file formats this agent can process
 * - extractionPrompt: Instructions for how to process/extract content from the document
 * - outputSchema: JSON schema defining the expected output structure (optional)
 */

// Supported MIME types for workflow agents
export const SUPPORTED_MIME_TYPES = [
  { value: "application/pdf", label: "PDF Documents" },
  {
    value:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    label: "Word Documents (.docx)",
  },
  { value: "text/csv", label: "CSV Files" },
  { value: "text/markdown", label: "Markdown Files" },
  { value: "text/plain", label: "Plain Text Files" },
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number]["value"];

// Finance document types (special handling, not custom workflow agents)
export type FinanceDocumentType = "bank_statement" | "cc_statement" | "invoice";

export function isFinanceDocumentType(
  type: string
): type is FinanceDocumentType {
  return ["bank_statement", "cc_statement", "invoice"].includes(type);
}

// Extraction method determines how schema is derived
// - auto: Schema is generated from the extraction prompt automatically
// - custom: User provides their own JSON schema
// - reducto: Uses Reducto API with built-in schemas (for finance types)
export type ExtractionMethod = "auto" | "custom" | "reducto";

export const EXTRACTION_METHODS: {
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
  {
    value: "reducto",
    label: "Reducto",
    description: "Use Reducto API for structured extraction",
  },
];

// Chunk size options for indexing
// Smaller chunks = more precise retrieval, larger chunks = more context per result
export const DEFAULT_CHUNK_SIZE = 2400; // Default for general documents
export const TRANSACTIONAL_CHUNK_SIZE = 800; // Smaller for transaction-heavy data

export const CHUNK_SIZE_OPTIONS = [
  {
    value: 800,
    label: "Small (800 chars)",
    description: "Best for transactional data with many items",
  },
  {
    value: 1200,
    label: "Medium (1200 chars)",
    description: "Balanced for mixed content",
  },
  {
    value: 2400,
    label: "Large (2400 chars)",
    description: "Default for narrative documents",
  },
] as const;

// Custom workflow agent stored in ProjectDoc
export type CustomWorkflowAgent = {
  id: string;
  name: string;
  description: string;
  acceptedMimeTypes: string[];
  extractionPrompt: string;
  extractionMethod: ExtractionMethod;
  outputSchema: Record<string, unknown> | null;
  docId: string;
};

export type WorkflowAgentExtractionConfig = {
  extractionPrompt: string;
  extractionMethod: ExtractionMethod;
  outputSchema: Record<string, unknown> | null;
  agentId: string | null;
  agentName: string | null;
  chunkSize: number; // Chunk size for Turbopuffer indexing
};

// Default extraction prompt for general documents (when no workflow agent is selected)
export const DEFAULT_EXTRACTION_PROMPT = `Extract all text content from this document. Preserve the document structure including:
- Headings and sections
- Paragraphs and text blocks
- Tables (format as markdown tables)
- Lists (preserve bullet points and numbering)
- Important metadata (dates, names, references)

Output the content as clean, well-formatted markdown that preserves the original document's organization.`;

/**
 * Get the display label for a MIME type
 */
export function getMimeTypeLabel(mimeType: string): string {
  const found = SUPPORTED_MIME_TYPES.find((m) => m.value === mimeType);
  return found?.label ?? mimeType;
}

/**
 * Check if a MIME type is supported for workflow agents
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.some((m) => m.value === mimeType);
}

/**
 * Fetches the workflow agent configuration for a given agent ID.
 * Returns the agent's extraction config or default if not found.
 */
export async function getWorkflowAgentConfigById({
  agentId,
}: {
  agentId: string;
}): Promise<WorkflowAgentExtractionConfig> {
  const { getProjectDocById } = await import("@/lib/db/queries");

  try {
    const doc = await getProjectDocById({ docId: agentId });

    if (doc && doc.documentType === "workflow_agent") {
      const response = await fetch(doc.blobUrl);
      if (response.ok) {
        const config = await response.json();
        // Infer extraction method for legacy agents
        const extractionMethod: ExtractionMethod =
          config.extractionMethod ?? (config.outputSchema ? "custom" : "auto");

        // Use configured chunk size, or default based on whether there's a schema
        // (schemas typically mean structured/transactional data = smaller chunks)
        const chunkSize =
          config.chunkSize ??
          (config.outputSchema ? TRANSACTIONAL_CHUNK_SIZE : DEFAULT_CHUNK_SIZE);

        return {
          extractionPrompt:
            config.extractionPrompt || DEFAULT_EXTRACTION_PROMPT,
          extractionMethod,
          outputSchema: config.outputSchema || null,
          agentId: doc.id,
          agentName: doc.description || doc.filename,
          chunkSize,
        };
      }
    }
  } catch {
    // Fall back to default if fetch fails
  }

  // Return default configuration
  return {
    extractionPrompt: DEFAULT_EXTRACTION_PROMPT,
    extractionMethod: "auto",
    outputSchema: null,
    agentId: null,
    agentName: null,
    chunkSize: DEFAULT_CHUNK_SIZE,
  };
}

/**
 * Get all workflow agents for a project that accept a specific MIME type.
 */
export async function getWorkflowAgentsForMimeType({
  projectId,
  mimeType,
}: {
  projectId: string;
  mimeType: string;
}): Promise<CustomWorkflowAgent[]> {
  const { getProjectDocsByProjectId } = await import("@/lib/db/queries");

  const allDocs = await getProjectDocsByProjectId({ projectId });
  const workflowAgentDocs = allDocs.filter(
    (doc) => doc.documentType === "workflow_agent"
  );

  const matchingAgents: CustomWorkflowAgent[] = [];

  for (const doc of workflowAgentDocs) {
    try {
      const response = await fetch(doc.blobUrl);
      if (response.ok) {
        const config = await response.json();
        const acceptedMimeTypes: string[] = config.acceptedMimeTypes || [];

        if (acceptedMimeTypes.includes(mimeType)) {
          // Infer extraction method for legacy agents
          const extractionMethod: ExtractionMethod =
            config.extractionMethod ??
            (config.outputSchema ? "custom" : "auto");
          matchingAgents.push({
            id: doc.id,
            name: doc.description || doc.filename.replace(/\.json$/, ""),
            description: doc.category || "",
            acceptedMimeTypes,
            extractionPrompt: config.extractionPrompt || "",
            extractionMethod,
            outputSchema: config.outputSchema || null,
            docId: doc.id,
          });
        }
      }
    } catch {
      // Skip agents that fail to load
    }
  }

  return matchingAgents;
}
