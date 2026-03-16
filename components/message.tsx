"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import equal from "fast-deep-equal";
import {
  ExternalLink,
  FileText,
  Loader2,
  Maximize2,
} from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { ChartViewer, safeParseChartPayload } from "@/components/chart-viewer";
import { EntitySelector } from "@/components/entity-selector";
import { TimeRangeSelector } from "@/components/time-range-selector";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useArtifact } from "@/hooks/use-artifact";
import { getRandomThinkingMessage } from "@/lib/ai/messages";
import type { Document, Vote } from "@/lib/db/schema";
import type {
  ChartDocumentAnnotation,
  ChatMessage,
  EntityOption,
  EntitySelectorAnnotation,
  RetrievedSource,
  TimeRangeOption,
  TimeRangeSelectorAnnotation,
} from "@/lib/types";
import { cn, fetcher, sanitizeText } from "@/lib/utils";
import { useDataStream } from "./data-stream-provider";
import { MessageContent } from "./elements/message";
import { Response } from "./elements/response";
import { Source } from "./elements/source";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
} from "./elements/tool";
import { EmailCard, looksLikeEmail } from "./email-card";
import { SparklesIcon } from "./icons";
import { MessageActions } from "./message-actions";
import { MessageEditor } from "./message-editor";
import { MessageReasoning } from "./message-reasoning";
import { PreviewAttachment } from "./preview-attachment";
import { looksLikeSlides, SlidesCard } from "./slides-card";

const PurePreviewMessage = ({
  chatId,
  message,
  vote,
  isLoading,
  setMessages,
  regenerate,
  isReadonly,
  requiresScrollPadding: _requiresScrollPadding,
  showCitations,
  onToggleCitations,
  selectedEntities = [],
  onEntitySelection = () => {},
  selectedTimeRange = null,
  onTimeRangeSelection = () => {},
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  regenerate: UseChatHelpers<ChatMessage>["regenerate"];
  isReadonly: boolean;
  requiresScrollPadding: boolean;
  showCitations: boolean;
  onToggleCitations?: () => void;
  selectedEntities?: EntityOption[];
  onEntitySelection?: (args: {
    entities: EntityOption[];
    questionId: string;
  }) => void;
  selectedTimeRange?: TimeRangeOption | null;
  onTimeRangeSelection?: (args: {
    timeRange: TimeRangeOption;
    questionId: string;
  }) => void;
}) => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  const { artifact, setArtifact } = useArtifact();

  // When an artifact is being streamed, limit the message height so it doesn't push down the chat
  const isArtifactStreaming = artifact.status === "streaming";

  const existingSources = (
    message.annotations?.find((a: any) => a?.type === "sources") as any
  )?.data as RetrievedSource[] | undefined;

  const chartAnnotation = message.annotations?.find(
    (a): a is ChartDocumentAnnotation => a?.type === "chart-document"
  );
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);

  const entitySelectorAnnotation = message.annotations?.find(
    (a): a is EntitySelectorAnnotation => a?.type === "entity-selector"
  );
  const [isEntitySelectorCollapsed, setIsEntitySelectorCollapsed] =
    useState(false);

  const timeRangeSelectorAnnotation = message.annotations?.find(
    (a): a is TimeRangeSelectorAnnotation => a?.type === "time-range-selector"
  );
  const [isTimeRangeSelectorCollapsed, setIsTimeRangeSelectorCollapsed] =
    useState(false);

  const sources = existingSources;
  const uniqueSources = (() => {
    if (!sources || sources.length === 0) return [];
    const seen = new Set<string>();
    const out: RetrievedSource[] = [];
    for (const s of sources) {
      const sourceType = typeof s.sourceType === "string" ? s.sourceType : "";
      const docId = typeof s.docId === "string" ? s.docId : "";
      const blobUrl = typeof s.blobUrl === "string" ? s.blobUrl : "";
      const filename = typeof s.filename === "string" ? s.filename : "";
      const key = docId
        ? `${sourceType}:${docId}`
        : blobUrl
          ? `${sourceType}:${blobUrl}`
          : `${sourceType}:${filename}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
    return out;
  })();

  const citationSources =
    showCitations && message.role === "assistant" ? uniqueSources : [];
  const shouldEnumerateCitations = citationSources.length > 1;

  const attachmentsFromMessage = message.parts.filter(
    (part) => part.type === "file"
  );

  useDataStream();

  const chartDocId = chartAnnotation?.data.documentId;
  const { data: chartDocs } = useSWR<Document[]>(
    chartDocId ? `/api/document?id=${chartDocId}` : null,
    fetcher,
    { shouldRetryOnError: false }
  );
  const chartDoc = chartDocs?.at(-1);
  const chartPayload = safeParseChartPayload(chartDoc?.content ?? "");

  return (
    <div
      className="group/message fade-in-0 w-full animate-in duration-200"
      data-role={message.role}
      data-testid={`message-${message.role}`}
    >
      <div
        className={cn("flex w-full items-start gap-2 md:gap-3", {
          "justify-end": message.role === "user" && mode !== "edit",
          "justify-start": message.role === "assistant",
        })}
      >
        <div
          className={cn("flex flex-col", {
            "gap-2 md:gap-4": message.parts?.some(
              (p) => p.type === "text" && p.text?.trim()
            ),
            "w-full":
              (message.role === "assistant" &&
                message.parts?.some(
                  (p) => p.type === "text" && p.text?.trim()
                )) ||
              mode === "edit",
            "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)]":
              message.role === "user" && mode !== "edit",
          })}
        >
          {message.role === "assistant" && chartAnnotation && chartDocId ? (
            <div className="mb-3 w-full">
              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">
                      {chartAnnotation.data.title}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      onClick={() => setIsChartCollapsed((v) => !v)}
                      type="button"
                    >
                      {isChartCollapsed ? "Expand" : "Collapse"}
                    </button>
                    <button
                      className="rounded-md border bg-background p-1.5"
                      disabled={isReadonly}
                      onClick={(event) => {
                        if (isReadonly) return;
                        const rect =
                          event.currentTarget.getBoundingClientRect();
                        setArtifact((current) => ({
                          ...current,
                          documentId: chartDocId,
                          kind: "chart",
                          title: chartAnnotation.data.title,
                          isVisible: true,
                          status: "idle",
                          boundingBox: {
                            top: rect.top,
                            left: rect.left,
                            width: rect.width,
                            height: rect.height,
                          },
                        }));
                      }}
                      title="Open in full screen"
                      type="button"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {isChartCollapsed ? null : chartPayload ? (
                  <ChartViewer payload={chartPayload} />
                ) : (
                  <div className="px-3 pb-3 text-muted-foreground text-sm">
                    Loading chart…
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {message.role === "assistant" &&
          timeRangeSelectorAnnotation &&
          !selectedTimeRange ? (
            <div className="mb-3 w-full">
              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">
                      Select time period
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Choose a time range for your finance query
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      onClick={() => setIsTimeRangeSelectorCollapsed((v) => !v)}
                      type="button"
                    >
                      {isTimeRangeSelectorCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                </div>

                {isTimeRangeSelectorCollapsed ? null : (
                  <div className="px-3 pb-3">
                    <TimeRangeSelector
                      availableTimeRanges={
                        timeRangeSelectorAnnotation.data.availableTimeRanges
                      }
                      className="rounded-lg border p-4"
                      defaultTimeRange={
                        timeRangeSelectorAnnotation.data.defaultTimeRange
                      }
                      onSelectionChange={(timeRange) => {
                        onTimeRangeSelection({
                          timeRange,
                          questionId:
                            timeRangeSelectorAnnotation.data.questionId,
                        });
                      }}
                      questionId={timeRangeSelectorAnnotation.data.questionId}
                      selectedTimeRange={selectedTimeRange}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {message.role === "assistant" &&
          entitySelectorAnnotation &&
          (!selectedEntities || selectedEntities.length === 0) ? (
            <div className="mb-3 w-full">
              <div className="rounded-xl border bg-background">
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-sm">
                      Select accounts
                    </div>
                    <div className="text-muted-foreground text-xs">
                      Choose which accounts to use for the finance question
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-md border bg-background px-2 py-1 text-xs"
                      onClick={() => setIsEntitySelectorCollapsed((v) => !v)}
                      type="button"
                    >
                      {isEntitySelectorCollapsed ? "Expand" : "Collapse"}
                    </button>
                  </div>
                </div>

                {isEntitySelectorCollapsed ? null : (
                  <div className="px-3 pb-3">
                    <EntitySelector
                      availableEntities={
                        entitySelectorAnnotation.data.availableEntities
                      }
                      className="rounded-lg border p-4"
                      onSelectionChange={(entities) => {
                        onEntitySelection({
                          entities,
                          questionId: entitySelectorAnnotation.data.questionId,
                        });
                      }}
                      questionId={entitySelectorAnnotation.data.questionId}
                      selectedEntities={selectedEntities}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {attachmentsFromMessage.length > 0 && (
            <div
              className="flex flex-row justify-end gap-2"
              data-testid={"message-attachments"}
            >
              {attachmentsFromMessage.map((attachment) => (
                <PreviewAttachment
                  attachment={{
                    name: attachment.filename ?? "file",
                    contentType: attachment.mediaType,
                    url: attachment.url,
                  }}
                  key={attachment.url}
                />
              ))}
            </div>
          )}

          {message.parts?.map((part, index) => {
            const { type } = part;
            const key = `message-${message.id}-part-${index}`;

            if (type === "reasoning" && part.text?.trim().length > 0) {
              return (
                <MessageReasoning
                  isLoading={isLoading}
                  key={key}
                  reasoning={part.text}
                />
              );
            }

            if (type === "text") {
              if (mode === "view") {
                const raw = sanitizeText(part.text);
                const text =
                  message.role === "assistant"
                    ? raw.replace(/【[\d,\s]+】/g, "")
                    : raw;

                // Check if assistant response looks like slides JSON
                if (message.role === "assistant" && looksLikeSlides(text)) {
                  return (
                    <div key={key}>
                      <SlidesCard content={text} />
                    </div>
                  );
                }

                // Check if assistant response looks like an email
                if (message.role === "assistant" && looksLikeEmail(text)) {
                  return (
                    <div key={key}>
                      <EmailCard content={text} />
                    </div>
                  );
                }

                return (
                  <div key={key}>
                    <MessageContent
                      className={cn({
                        "w-fit break-words rounded-2xl bg-brand/8 px-3 py-2 text-right text-foreground dark:bg-primary dark:text-primary-foreground":
                          message.role === "user",
                        "bg-transparent px-0 py-0 text-left":
                          message.role === "assistant",
                        // When an artifact is streaming, limit height and make scrollable like Cursor IDE
                        "max-h-[200px] overflow-y-auto rounded-lg border border-border/50 bg-muted/30 px-3 py-2":
                          message.role === "assistant" &&
                          isLoading &&
                          isArtifactStreaming,
                      })}
                      data-testid="message-content"
                    >
                      <Response
                        citationHrefs={undefined}
                        citationHrefsKey={undefined}
                      >
                        {text}
                      </Response>
                    </MessageContent>
                  </div>
                );
              }

              if (mode === "edit") {
                return (
                  <div
                    className="flex w-full flex-row items-start gap-3"
                    key={key}
                  >
                    <div className="size-8" />
                    <div className="min-w-0 flex-1">
                      <MessageEditor
                        key={message.id}
                        message={message}
                        regenerate={regenerate}
                        setMessages={setMessages}
                        setMode={setMode}
                      />
                    </div>
                  </div>
                );
              }
            }

            return null;
          })}

          {citationSources.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <div className="font-medium text-muted-foreground text-xs">
                Citations
              </div>
              <div className="flex flex-wrap gap-2">
                {citationSources.map((source, i) => {
                  const citationNumber = i + 1;
                  const baseTitle = source.filename ?? "Source";
                  const href = source.blobUrl;
                  const title = baseTitle;
                  const displayLabel = shouldEnumerateCitations
                    ? `${citationNumber}. ${title}`
                    : title;
                  const isFile =
                    source.sourceType === "docs" &&
                    typeof source.docId === "string";
                  const hasPreview = isFile && source.content;

                  if (hasPreview) {
                    return (
                      <HoverCard closeDelay={100} key={i} openDelay={300}>
                        <HoverCardTrigger asChild>
                          <button
                              className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 font-medium text-xs transition-colors hover:bg-muted"
                              onClick={() => {
                                if (
                                  typeof href === "string" &&
                                  href.length > 0
                                ) {
                                  window.open(href, "_blank", "noopener");
                                }
                              }}
                              type="button"
                            >
                              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                              <span className="block max-w-[240px] truncate">
                                {displayLabel}
                              </span>
                            </button>
                        </HoverCardTrigger>
                        <HoverCardContent
                          align="start"
                          className="w-80 p-0"
                          side="top"
                        >
                          <div className="flex items-center gap-2 border-border border-b px-3 py-2">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate font-medium text-xs">
                              {source.description || title}
                            </span>
                            {typeof href === "string" && href.length > 0 && (
                              <a
                                className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                                href={href}
                                rel="noopener"
                                target="_blank"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <div className="max-h-48 overflow-auto px-3 py-2">
                            <p className="line-clamp-6 text-muted-foreground text-xs leading-relaxed">
                              {source.content}
                            </p>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }

                  if (typeof href === "string" && href.length > 0) {
                    return (
                      <Source
                        className="rounded-full border bg-muted/50 px-3 py-1 font-medium text-xs hover:bg-muted"
                        href={href}
                        key={i}
                        title={title}
                      >
                        {displayLabel}
                      </Source>
                    );
                  }

                  return (
                    <div
                      className="rounded-full border bg-muted/50 px-3 py-1 font-medium text-xs"
                      key={i}
                      title={title}
                    >
                      <span className="block max-w-[240px] truncate">
                        {displayLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!isReadonly && (
            <MessageActions
              chatId={chatId}
              isLoading={isLoading}
              key={`action-${message.id}`}
              message={message}
              onToggleCitations={onToggleCitations}
              setMode={setMode}
              showCitations={showCitations}
              vote={vote}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export const PreviewMessage = memo(
  PurePreviewMessage,
  (prevProps, nextProps) => {
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }
    if (prevProps.requiresScrollPadding !== nextProps.requiresScrollPadding) {
      return false;
    }
    if (!equal(prevProps.message.parts, nextProps.message.parts)) {
      return false;
    }
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.showCitations !== nextProps.showCitations) {
      return false;
    }
    if (!equal(prevProps.selectedEntities, nextProps.selectedEntities)) {
      return false;
    }
    if (!equal(prevProps.selectedTimeRange, nextProps.selectedTimeRange)) {
      return false;
    }
    return false;
  }
);

export const ThinkingMessage = ({
  agentStatus,
}: {
  agentStatus?: { agent: string; message: string };
  showIcon?: boolean;
}) => {
  const randomMessage = useMemo(() => getRandomThinkingMessage(), []);
  const displayText =
    agentStatus && agentStatus.message.trim().length > 0
      ? agentStatus.message
      : `${randomMessage}...`;

  return (
    <div
      className="group/message fade-in-0 w-full animate-in duration-300"
      data-role="assistant"
      data-testid="message-assistant-loading"
    >
      <div className="flex w-full min-w-0 items-center justify-start gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">{displayText}</span>
      </div>
    </div>
  );
};
