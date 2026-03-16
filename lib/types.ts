import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { ArtifactKind } from "@/components/artifact";
import type { financeQuery } from "./ai/tools/finance-query";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export type DataPart = { type: "append-message"; message: string };

export type RetrievedSource = {
  sourceType: string;
  docId?: string;
  filename?: string;
  channelName?: string;
  category?: string;
  description?: string;
  documentType?: string;
  blobUrl?: string;
  content?: string;
};

export type ChartDocumentAnnotation = {
  type: "chart-document";
  data: {
    documentId: string;
    title: string;
  };
};

export type EntitySelectorAnnotation = {
  type: "entity-selector";
  data: {
    availableEntities: EntityOption[];
    questionId: string;
  };
};

export type TimeRangeSelectorAnnotation = {
  type: "time-range-selector";
  data: {
    availableTimeRanges: TimeRangeOption[];
    defaultTimeRange?: TimeRangeOption;
    questionId: string;
  };
};

export type ChatAnnotation =
  | { type: "sources"; data: RetrievedSource[] }
  | ChartDocumentAnnotation
  | EntitySelectorAnnotation
  | TimeRangeSelectorAnnotation
  | { type: string; data: unknown };

export const messageMetadataSchema = z.object({
  createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type financeQueryTool = InferUITool<ReturnType<typeof financeQuery>>;

export type ChatTools = {
  financeQuery: financeQueryTool;
};

export type EntityOption = {
  kind: "personal" | "business";
  name: string | null;
};

export type TimeRangeOption = {
  type: "preset" | "custom";
  label: string;
  date_start?: string;
  date_end?: string;
};

export type CustomUIDataTypes = {
  textDelta: string;
  imageDelta: string;
  sheetDelta: string;
  codeDelta: string;
  slidesDelta: string;
  suggestion: Suggestion;
  appendMessage: string;
  id: string;
  title: string;
  kind: ArtifactKind;
  clear: null;
  finish: null;
  usage: AppUsage;
  sources: RetrievedSource[];
  chartDocument: { id: string; title: string; kind: "chart" };
  agentStatus: { agent: string; message: string };
  entitySelector: {
    availableEntities: EntityOption[];
    questionId?: string;
  };
  timeRangeSelector: {
    availableTimeRanges: TimeRangeOption[];
    defaultTimeRange?: TimeRangeOption;
    questionId?: string;
  };
};

export type ChatMessage = UIMessage<
  MessageMetadata,
  CustomUIDataTypes,
  ChatTools
> & {
  annotations?: ChatAnnotation[];
};

export type Attachment = {
  name: string;
  url: string;
  contentType: string;
  isLoading?: boolean;
};

export type VisibilityType = "public" | "private";
