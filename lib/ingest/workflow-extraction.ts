import "server-only";

import { generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";

export type WorkflowExtractionResult = {
  structuredData: Record<string, unknown> | null;
  processedText: string;
  error?: string;
};

// Reduced chunk size to prevent DeepSeek from generating corrupted output on large responses
// When the model tries to output too many array items, it can hit output limits and corrupt
const MAX_CHARS_PER_CHUNK = 15_000; // ~4k tokens, smaller chunks for more reliable extraction

/**
 * Apply a workflow agent's extraction prompt to raw document text.
 * Returns both structured JSON (if outputSchema provided) and processed text for RAG.
 */
export async function extractWithWorkflowAgent({
  rawText,
  extractionPrompt,
  outputSchema,
  filename,
}: {
  rawText: string;
  extractionPrompt: string;
  outputSchema: Record<string, unknown> | null;
  filename: string;
}): Promise<WorkflowExtractionResult> {
  // For very long documents, we may need to process in chunks
  if (rawText.length > MAX_CHARS_PER_CHUNK) {
    return extractLongDocument({
      rawText,
      extractionPrompt,
      outputSchema,
      filename,
    });
  }

  return extractSingleChunk({
    rawText,
    extractionPrompt,
    outputSchema,
    filename,
  });
}

async function extractSingleChunk({
  rawText,
  extractionPrompt,
  outputSchema,
  filename,
}: {
  rawText: string;
  extractionPrompt: string;
  outputSchema: Record<string, unknown> | null;
  filename: string;
}): Promise<WorkflowExtractionResult> {
  // Use extraction-model which prefers OpenAI for reliable structured JSON output
  const model = myProvider.languageModel("extraction-model");

  // Build system prompt based on whether we have an output schema
  let systemPrompt: string;
  if (outputSchema) {
    systemPrompt = `You are a document processing assistant that extracts structured data from documents.

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanations, no code blocks.

Your response must be a JSON object with exactly two fields:
{
  "structuredData": <object matching the schema below>,
  "processedText": "<detailed markdown for search indexing>"
}

The structuredData field MUST match this JSON schema:
${JSON.stringify(outputSchema, null, 2)}

IMPORTANT RULES FOR processedText:
- The processedText MUST be a DETAILED markdown document that includes ALL the key data from the extraction
- For transaction data: list each merchant, amount, date, and category so they are searchable
- For other data: include all important names, values, dates, and identifiers
- Format as organized markdown sections with bullet points or tables
- This text will be used for semantic search, so include specific details that users would query

IMPORTANT RULES FOR JSON:
- Output ONLY the JSON object, nothing else
- Do NOT wrap the response in \`\`\`json code blocks
- Do NOT use markdown tables or any other format outside the JSON
- All string values must be properly escaped for JSON
- Numbers should be JSON numbers, not strings`;
  } else {
    systemPrompt = `You are a document processing assistant that extracts and processes documents.

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no explanations, no code blocks.

Your response must be a JSON object with exactly two fields:
{
  "structuredData": null,
  "processedText": "<detailed markdown for search indexing>"
}

IMPORTANT RULES:
- Output ONLY the JSON object, nothing else
- Do NOT wrap the response in \`\`\`json code blocks
- The processedText should be a detailed, searchable markdown version of the document content
- Include all important names, values, dates, and identifiers that users might search for`;
  }

  const userPrompt = `Document filename: ${filename}

Extraction instructions:
${extractionPrompt}

Document content to extract from:
---
${rawText}
---

Now extract the data and respond with ONLY the JSON object.`;

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxRetries: 2,
    });

    // Parse the JSON response
    const responseText = result.text.trim();

    // Try multiple strategies to extract JSON from the response
    let jsonText = responseText;

    // Strategy 1: Try to extract JSON from markdown code blocks
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // Strategy 2: Find the first { and last } to extract JSON object
    if (!jsonText.startsWith("{")) {
      const startIdx = responseText.indexOf("{");
      const endIdx = responseText.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        jsonText = responseText.slice(startIdx, endIdx + 1);
      }
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonText) as Record<string, unknown>;
    } catch (parseError) {
      // Log the actual response for debugging
      console.error(
        "[workflow-extraction] JSON parse failed. Response preview:",
        responseText.slice(0, 500)
      );
      throw parseError;
    }

    // Check if the LLM followed the expected wrapper format
    if ("structuredData" in parsed && "processedText" in parsed) {
      console.info(
        "[workflow-extraction] Extraction succeeded with wrapper format"
      );
      return {
        structuredData:
          (parsed.structuredData as Record<string, unknown>) ?? null,
        processedText: (parsed.processedText as string) || rawText,
      };
    }

    // LLM returned data directly without the wrapper - use it as structuredData
    // This handles cases where the LLM returns { "transactions": [...] } directly
    console.info(
      "[workflow-extraction] Extraction succeeded with direct schema format"
    );
    return {
      structuredData: parsed,
      processedText: rawText,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown extraction error";
    console.error("[workflow-extraction] Extraction failed:", errorMessage);

    // Fall back to using raw text
    return {
      structuredData: null,
      processedText: rawText,
      error: errorMessage,
    };
  }
}

/**
 * For documents longer than MAX_CHARS_PER_CHUNK, process in sections and merge.
 */
async function extractLongDocument({
  rawText,
  extractionPrompt,
  outputSchema,
  filename,
}: {
  rawText: string;
  extractionPrompt: string;
  outputSchema: Record<string, unknown> | null;
  filename: string;
}): Promise<WorkflowExtractionResult> {
  // Split into chunks with some overlap
  const chunkSize = MAX_CHARS_PER_CHUNK;
  const overlap = 1000;
  const chunks: string[] = [];

  let start = 0;
  while (start < rawText.length) {
    const end = Math.min(start + chunkSize, rawText.length);
    chunks.push(rawText.slice(start, end));
    start = end - overlap;
    if (start >= rawText.length) break;
  }

  console.info(
    `[workflow-extraction] Processing long document in ${chunks.length} chunks`
  );

  // Process each chunk
  const chunkResults: WorkflowExtractionResult[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunkPrompt = `${extractionPrompt}\n\n(Note: This is part ${i + 1} of ${chunks.length} of the document)`;
    const result = await extractSingleChunk({
      rawText: chunks[i],
      extractionPrompt: chunkPrompt,
      outputSchema,
      filename,
    });
    chunkResults.push(result);
  }

  // Merge results
  const allProcessedText = chunkResults
    .map((r) => r.processedText)
    .join("\n\n---\n\n");

  // For structured data, we'll merge arrays and combine objects
  let mergedStructuredData: Record<string, unknown> | null = null;
  if (outputSchema) {
    mergedStructuredData = mergeStructuredData(
      chunkResults.map((r) => r.structuredData).filter((d) => d !== null)
    );
  }

  const errors = chunkResults
    .filter((r) => r.error)
    .map((r) => r.error)
    .join("; ");

  return {
    structuredData: mergedStructuredData,
    processedText: allProcessedText,
    error: errors || undefined,
  };
}

/**
 * Merge multiple structured data objects from chunk processing.
 * Arrays with the same key are concatenated, other values use the last non-null value.
 */
function mergeStructuredData(
  dataArray: Array<Record<string, unknown> | null>
): Record<string, unknown> | null {
  const validData = dataArray.filter(
    (d): d is Record<string, unknown> => d !== null
  );
  if (validData.length === 0) return null;
  if (validData.length === 1) return validData[0];

  const merged: Record<string, unknown> = {};

  for (const data of validData) {
    for (const [key, value] of Object.entries(data)) {
      const existing = merged[key];

      if (Array.isArray(value)) {
        // Concatenate arrays
        if (Array.isArray(existing)) {
          merged[key] = [...existing, ...value];
        } else {
          merged[key] = value;
        }
      } else if (value !== null && value !== undefined) {
        // Use the latest non-null value
        merged[key] = value;
      }
    }
  }

  return merged;
}
