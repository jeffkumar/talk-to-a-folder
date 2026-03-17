"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { ChatHeader } from "@/components/chat-header";
import {
  type ContextDoc,
  ContextDocPicker,
} from "@/components/context-doc-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { useAutoResume } from "@/hooks/use-auto-resume";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { type AgentMode, DEFAULT_AGENT_MODE } from "@/lib/ai/models";
import type { ProjectDoc, Vote } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import { extractDriveFolderIds } from "@/lib/integrations/google/parse-drive-url";
import type {
  Attachment,
  ChatMessage,
  EntityOption,
  EntitySelectorAnnotation,
  RetrievedSource,
  TimeRangeOption,
  TimeRangeSelectorAnnotation,
  VisibilityType,
} from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import {
  cn,
  fetcher,
  fetchWithErrorHandlers,
  generateUUID,
  readIgnoredDocIdsForProject,
  writeIgnoredDocIdsForProject,
} from "@/lib/utils";
import { Artifact } from "./artifact";
import { useDataStream } from "./data-stream-provider";
import { DocumentTypePicker } from "./document-type-picker";
import { FirstProjectPrompt } from "./first-project-prompt";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";
import { getChatHistoryPaginationKey } from "./sidebar-history";
import { SlidesLoadingCard } from "./slides-card";
import { toast } from "./toast";

type UploadDocumentType =
  | "general_doc"
  | "bank_statement"
  | "cc_statement"
  | "invoice"
  | `workflow:${string}`;

type WorkflowAgentOption = {
  id: string;
  name: string;
  description?: string;
};

function normalizeBusinessName(value: string): string {
  return value.trim();
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const v = value.trim();
    if (v.length === 0) {
      continue;
    }
    const key = v.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  return out;
}

function BusinessNameTypeahead({
  value,
  onChange,
  options,
  inputId,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  inputId: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const query = normalizeBusinessName(value);
  const normalizedOptions = uniqueStrings(options);
  const filtered =
    query.length === 0
      ? normalizedOptions.slice(0, 8)
      : normalizedOptions
          .filter((name) => includesCaseInsensitive(name, query))
          .slice(0, 8);
  const shouldShow = open && filtered.length > 0;

  return (
    <Popover onOpenChange={setOpen} open={shouldShow}>
      <PopoverTrigger asChild>
        <Input
          autoComplete="off"
          id={inputId}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          value={value}
        />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-1"
        sideOffset={4}
      >
        <div className="max-h-48 overflow-auto">
          {filtered.map((name) => (
            <Button
              className="h-8 w-full justify-start px-2 text-sm"
              key={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }}
              onMouseDown={(e) => e.preventDefault()}
              type="button"
              variant="ghost"
            >
              {name}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Chat({
  id,
  initialMessages,
  initialChatModel,
  initialVisibilityType,
  isReadonly,
  autoResume,
  initialLastContext,
  initialAgentMode = DEFAULT_AGENT_MODE,
  chatProjectId,
}: {
  id: string;
  initialMessages: ChatMessage[];
  initialChatModel: string;
  initialVisibilityType: VisibilityType;
  isReadonly: boolean;
  autoResume: boolean;
  initialLastContext?: AppUsage;
  initialAgentMode?: AgentMode;
  chatProjectId?: string;
}) {
  const router = useRouter();

  const { visibilityType } = useChatVisibility({
    chatId: id,
    initialVisibilityType,
  });

  const { mutate } = useSWRConfig();

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      // When user navigates back/forward, refresh to sync with URL
      router.refresh();
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);
  const { setDataStream } = useDataStream();

  const [input, setInput] = useState<string>("");
  const [_usage, setUsage] = useState<AppUsage | undefined>(initialLastContext);
  const [showCreditCardAlert, setShowCreditCardAlert] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(initialChatModel);
  const currentModelIdRef = useRef(currentModelId);
  const [currentAgentMode, setCurrentAgentMode] = useState<AgentMode | string>(
    initialAgentMode
  );
  const currentAgentModeRef = useRef<AgentMode | string>(currentAgentMode);
  const {
    selectedProjectId,
    setSelectedProjectId,
    projects,
    needsFirstProject,
  } = useProjectSelector();
  const selectedProjectIdRef = useRef(selectedProjectId);

  // Switch to the chat's project if it differs from current selection
  useEffect(() => {
    if (!chatProjectId) {
      return;
    }
    if (selectedProjectId === chatProjectId) {
      return;
    }
    // Ensure the project exists in the user's list before switching
    const projectExists = projects.some((p) => p.id === chatProjectId);
    if (projectExists) {
      setSelectedProjectId(chatProjectId);
    }
  }, [chatProjectId, selectedProjectId, projects, setSelectedProjectId]);

  const browserTimeZone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";
  const browserTimeZoneRef = useRef(browserTimeZone);

  const [ignoredDocIds, setIgnoredDocIds] = useState<string[]>([]);
  const ignoredDocIdsRef = useRef(ignoredDocIds);

  // Persist ignored docs locally per-project (device-local).
  useEffect(() => {
    if (!selectedProjectId) {
      setIgnoredDocIds([]);
      return;
    }
    setIgnoredDocIds(readIgnoredDocIdsForProject(selectedProjectId));
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }
    writeIgnoredDocIdsForProject(selectedProjectId, ignoredDocIds);
  }, [ignoredDocIds, selectedProjectId]);

  const [targetDocIds, setTargetDocIds] = useState<string[]>([]);
  const targetDocIdsRef = useRef(targetDocIds);

  const [showCitations, setShowCitations] = useState(false);
  const onToggleCitations = useCallback(() => setShowCitations((v) => !v), []);
  const [_pendingSources, setPendingSources] = useState<
    RetrievedSource[] | null
  >(null);
  const pendingSourcesRef = useRef<RetrievedSource[] | null>(null);

  const pendingChartDocumentRef = useRef<{ id: string; title: string } | null>(
    null
  );

  const pendingEntitySelectorRef = useRef<{
    availableEntities: EntityOption[];
    questionId: string;
  } | null>(null);

  const pendingTimeRangeSelectorRef = useRef<{
    availableTimeRanges: TimeRangeOption[];
    defaultTimeRange?: TimeRangeOption;
    questionId: string;
  } | null>(null);

  const [selectedEntities, setSelectedEntities] = useState<EntityOption[]>([]);
  const selectedEntitiesRef = useRef<EntityOption[]>([]);
  const isApplyingEntitySelectionRef = useRef(false);

  const [selectedTimeRange, setSelectedTimeRange] =
    useState<TimeRangeOption | null>(null);
  const selectedTimeRangeRef = useRef<TimeRangeOption | null>(null);
  const isApplyingTimeRangeSelectionRef = useRef(false);

  const {
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    resumeStream,
  } = useChat<ChatMessage>({
    id,
    messages: initialMessages,
    experimental_throttle: 100,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      fetch: fetchWithErrorHandlers,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            selectedChatModel: currentModelIdRef.current,
            selectedVisibilityType: visibilityType,
            selectedAgentMode: currentAgentModeRef.current,
            projectId: selectedProjectIdRef.current,
            ignoredDocIds: ignoredDocIdsRef.current,
            targetDocIds:
              targetDocIdsRef.current.length > 0
                ? targetDocIdsRef.current
                : undefined,
            retrievalTimeZone: browserTimeZoneRef.current,
            selectedEntities: selectedEntitiesRef.current,
            selectedTimeRange: selectedTimeRangeRef.current ?? undefined,
            ...request.body,
          },
        };
      },
    }),
    onData: (dataPart) => {
      setDataStream((ds) => (ds ? [...ds, dataPart] : []));
      if (dataPart.type === "data-usage") {
        setUsage(dataPart.data);
      }
      if (dataPart.type === "data-sources") {
        pendingSourcesRef.current = dataPart.data;
        setPendingSources(dataPart.data);
      }
      if (dataPart.type === "data-chartDocument") {
        pendingChartDocumentRef.current = {
          id: dataPart.data.id,
          title: dataPart.data.title,
        };
      }
      if (
        dataPart.type === "data-entitySelector" &&
        typeof dataPart.data.questionId === "string"
      ) {
        pendingEntitySelectorRef.current = {
          availableEntities: dataPart.data.availableEntities,
          questionId: dataPart.data.questionId,
        };
      }
      if (
        dataPart.type === "data-timeRangeSelector" &&
        typeof dataPart.data.questionId === "string"
      ) {
        pendingTimeRangeSelectorRef.current = {
          availableTimeRanges: dataPart.data.availableTimeRanges,
          defaultTimeRange: dataPart.data.defaultTimeRange,
          questionId: dataPart.data.questionId,
        };
      }
    },
    onFinish: (_result) => {
      // If we have pending sources, attach them to the last message here
      // This is safe because the stream has finished
      const sourcesToAttach = pendingSourcesRef.current;
      if (sourcesToAttach) {
        setMessages((prevMessages) => {
          const last = prevMessages.at(-1);
          // We look for the last assistant message
          if (last && last.role === "assistant") {
            const newAnnotations = [
              ...(last.annotations || []),
              { type: "sources", data: sourcesToAttach },
            ];
            return [
              ...prevMessages.slice(0, -1),
              { ...last, annotations: newAnnotations },
            ];
          }
          return prevMessages;
        });
        pendingSourcesRef.current = null;
        setPendingSources(null);
      }

      const chartDoc = pendingChartDocumentRef.current;
      if (chartDoc) {
        setMessages((prevMessages) => {
          const last = prevMessages.at(-1);
          if (last && last.role === "assistant") {
            const newAnnotations = [
              ...(last.annotations || []),
              {
                type: "chart-document",
                data: { documentId: chartDoc.id, title: chartDoc.title },
              },
            ];
            return [
              ...prevMessages.slice(0, -1),
              { ...last, annotations: newAnnotations },
            ];
          }
          return prevMessages;
        });
        pendingChartDocumentRef.current = null;
      }

      const timeRangeSelector = pendingTimeRangeSelectorRef.current;
      if (timeRangeSelector) {
        setMessages((prevMessages) => {
          const last = prevMessages.at(-1);
          if (last && last.role === "assistant") {
            const newAnnotations = [
              ...(last.annotations || []),
              {
                type: "time-range-selector",
                data: {
                  availableTimeRanges: timeRangeSelector.availableTimeRanges,
                  defaultTimeRange: timeRangeSelector.defaultTimeRange,
                  questionId: timeRangeSelector.questionId,
                },
              },
            ];
            return [
              ...prevMessages.slice(0, -1),
              { ...last, annotations: newAnnotations },
            ];
          }
          return prevMessages;
        });
        pendingTimeRangeSelectorRef.current = null;
      }

      const entitySelector = pendingEntitySelectorRef.current;
      if (entitySelector) {
        setMessages((prevMessages) => {
          const last = prevMessages.at(-1);
          if (last && last.role === "assistant") {
            const newAnnotations = [
              ...(last.annotations || []),
              {
                type: "entity-selector",
                data: {
                  availableEntities: entitySelector.availableEntities,
                  questionId: entitySelector.questionId,
                },
              },
            ];
            return [
              ...prevMessages.slice(0, -1),
              { ...last, annotations: newAnnotations },
            ];
          }
          return prevMessages;
        });
        pendingEntitySelectorRef.current = null;
      }

      mutate(
        unstable_serialize((index, previousPageData) =>
          getChatHistoryPaginationKey(
            index,
            previousPageData,
            selectedProjectIdRef.current
          )
        )
      );
    },
    onError: (error) => {
      if (error instanceof ChatSDKError) {
        // Check if it's a credit card error
        if (
          error.message?.includes("AI Gateway requires a valid credit card")
        ) {
          setShowCreditCardAlert(true);
        } else {
          toast({
            type: "error",
            description: error.message,
          });
        }
        return;
      }

      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : "Something went wrong. Please try again.";

      toast({
        type: "error",
        description:
          message.length > 300 ? `${message.slice(0, 300)}…` : message,
      });
    },
  });

  const statusRef = useRef(status);

  useEffect(() => {
    if (statusRef.current !== status && status === "submitted") {
      pendingSourcesRef.current = null;
      setPendingSources(null);
      pendingChartDocumentRef.current = null;
      pendingEntitySelectorRef.current = null;
      pendingTimeRangeSelectorRef.current = null;
      // Don't clear selectedEntities or selectedTimeRange on message submission - they persist until explicitly cleared
      isApplyingEntitySelectionRef.current = false;
      isApplyingTimeRangeSelectionRef.current = false;
    }
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    currentModelIdRef.current = currentModelId;
  }, [currentModelId]);

  useEffect(() => {
    currentAgentModeRef.current = currentAgentMode;
  }, [currentAgentMode]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    browserTimeZoneRef.current = browserTimeZone;
  }, [browserTimeZone]);

  useEffect(() => {
    ignoredDocIdsRef.current = ignoredDocIds;
  }, [ignoredDocIds]);

  useEffect(() => {
    targetDocIdsRef.current = targetDocIds;
  }, [targetDocIds]);

  const resolvedFolderIdsRef = useRef<Set<string>>(new Set());
  const [folderSyncStatus, setFolderSyncStatus] = useState<{
    synced: boolean;
    count: number;
    folderId: string;
  } | null>(null);

  useEffect(() => {
    if (!selectedProjectId || !input) {
      setFolderSyncStatus(null);
      return;
    }

    const folderIds = extractDriveFolderIds(input);
    if (folderIds.length === 0) {
      setFolderSyncStatus(null);
      return;
    }

    const newFolderIds = folderIds.filter(
      (fid) => !resolvedFolderIdsRef.current.has(fid)
    );
    if (newFolderIds.length === 0) {
      return;
    }

    let cancelled = false;

    const resolve = async () => {
      for (const folderId of newFolderIds) {
        if (cancelled) {
          return;
        }
        try {
          const res = await fetch(
            `/api/projects/${selectedProjectId}/integrations/google/resolve-folder?folderId=${encodeURIComponent(folderId)}`
          );
          if (!res.ok || cancelled) {
            continue;
          }
          const data = (await res.json()) as {
            synced: boolean;
            count: number;
            folderId: string;
            docs: Array<{ id: string; name: string; type: "note" | "file" }>;
          };
          if (cancelled) {
            return;
          }

          resolvedFolderIdsRef.current.add(folderId);
          setFolderSyncStatus({
            synced: data.synced,
            count: data.count,
            folderId: data.folderId,
          });

          if (data.synced && data.docs.length > 0) {
            setTargetDocIds((prev) => {
              const existing = new Set(prev);
              const next = [...prev];
              for (const doc of data.docs) {
                if (!existing.has(doc.id)) {
                  next.push(doc.id);
                }
              }
              targetDocIdsRef.current = next;
              return next;
            });
          }
        } catch {
          // Silently ignore resolution errors
        }
      }
    };
    void resolve();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, selectedProjectId]);

  useEffect(() => {
    selectedEntitiesRef.current = selectedEntities;
  }, [selectedEntities]);

  useEffect(() => {
    selectedTimeRangeRef.current = selectedTimeRange;
  }, [selectedTimeRange]);

  const handleTimeRangeSelection = useCallback(
    ({
      timeRange,
      questionId,
    }: {
      timeRange: TimeRangeOption;
      questionId: string;
    }) => {
      setSelectedTimeRange(timeRange);
      selectedTimeRangeRef.current = timeRange;

      const isTimeRangeSelector = (
        a: unknown
      ): a is TimeRangeSelectorAnnotation => {
        if (!a || typeof a !== "object") {
          return false;
        }
        if (!("type" in a)) {
          return false;
        }
        if ((a as { type?: unknown }).type !== "time-range-selector") {
          return false;
        }
        if (!("data" in a)) {
          return false;
        }
        const data = (a as { data?: unknown }).data;
        if (!data || typeof data !== "object") {
          return false;
        }
        return (
          typeof (data as { questionId?: unknown }).questionId === "string"
        );
      };

      // Remove the selector UI from the message once applied (matches existing behavior).
      setMessages((prevMessages) =>
        prevMessages.map((m) => {
          if (m.role !== "assistant" || !m.annotations) {
            return m;
          }
          const hasSelector = m.annotations.some(
            (a) => isTimeRangeSelector(a) && a.data.questionId === questionId
          );
          if (!hasSelector) {
            return m;
          }
          const annotations = m.annotations.filter(
            (a) => !(isTimeRangeSelector(a) && a.data.questionId === questionId)
          );
          return { ...m, annotations };
        })
      );

      if (timeRange) {
        const lastUserMessage = messages
          .slice()
          .reverse()
          .find((m) => m.role === "user");
        if (lastUserMessage) {
          const questionText = lastUserMessage.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n");
          // Mark that we're applying time range selection so selectedTimeRange isn't cleared
          isApplyingTimeRangeSelectionRef.current = true;
          sendMessage({
            role: "user",
            parts: [{ type: "text", text: questionText }],
          });
        }
      }
    },
    [messages, sendMessage, setMessages]
  );

  const handleEntitySelection = useCallback(
    ({
      entities,
      questionId,
    }: {
      entities: EntityOption[];
      questionId: string;
    }) => {
      setSelectedEntities(entities);
      selectedEntitiesRef.current = entities;

      const isEntitySelector = (a: unknown): a is EntitySelectorAnnotation => {
        if (!a || typeof a !== "object") {
          return false;
        }
        if (!("type" in a)) {
          return false;
        }
        if ((a as { type?: unknown }).type !== "entity-selector") {
          return false;
        }
        if (!("data" in a)) {
          return false;
        }
        const data = (a as { data?: unknown }).data;
        if (!data || typeof data !== "object") {
          return false;
        }
        return (
          typeof (data as { questionId?: unknown }).questionId === "string"
        );
      };

      // Remove the selector UI from the message once applied (matches existing behavior).
      setMessages((prevMessages) =>
        prevMessages.map((m) => {
          if (m.role !== "assistant" || !m.annotations) {
            return m;
          }
          const hasSelector = m.annotations.some(
            (a) => isEntitySelector(a) && a.data.questionId === questionId
          );
          if (!hasSelector) {
            return m;
          }
          const annotations = m.annotations.filter(
            (a) => !(isEntitySelector(a) && a.data.questionId === questionId)
          );
          return { ...m, annotations };
        })
      );

      if (entities.length > 0) {
        const lastUserMessage = messages
          .slice()
          .reverse()
          .find((m) => m.role === "user");
        if (lastUserMessage) {
          const questionText = lastUserMessage.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("\n");
          // Mark that we're applying entity selection so selectedEntities aren't cleared
          isApplyingEntitySelectionRef.current = true;
          sendMessage({
            role: "user",
            parts: [{ type: "text", text: questionText }],
          });
        }
      }
    },
    [messages, sendMessage, setMessages]
  );

  const searchParams = useSearchParams();
  const query = searchParams.get("query");
  const targetDocIdsParam = searchParams.get("targetDocIds");
  const entityKindParam = searchParams.get("entityKind");
  const entityNameParam = searchParams.get("entityName");
  const agentIdParam = searchParams.get("agentId");
  const slidesModeParam = searchParams.get("slidesMode");
  const slidesTitleParam = searchParams.get("slidesTitle");
  const slidesPromptParam = searchParams.get("slidesPrompt");
  const slidesDataParam = searchParams.get("slidesData");

  const [hasAppendedQuery, setHasAppendedQuery] = useState(false);
  const hasAppendedQueryRef = useRef(false);
  const [hasInitializedTargetDocIds, setHasInitializedTargetDocIds] =
    useState(false);
  const [hasInitializedEntity, setHasInitializedEntity] = useState(false);
  const [hasInitializedAgentId, setHasInitializedAgentId] = useState(false);
  const [hasInitializedSlidesData, setHasInitializedSlidesData] =
    useState(false);
  const [slidesMode, setSlidesMode] = useState(false);
  const [slidesTitle, setSlidesTitle] = useState("");

  // Initialize targetDocIds from URL parameter
  useEffect(() => {
    if (targetDocIdsParam && !hasInitializedTargetDocIds) {
      const docIds = targetDocIdsParam.split(",").filter(Boolean);
      if (docIds.length > 0) {
        setTargetDocIds(docIds);
        targetDocIdsRef.current = docIds;
        setHasInitializedTargetDocIds(true);
        // Clear URL param after reading
        const url = new URL(window.location.href);
        url.searchParams.delete("targetDocIds");
        window.history.replaceState({}, "", url.toString());
      } else {
        setHasInitializedTargetDocIds(true);
      }
    } else if (!targetDocIdsParam && !hasInitializedTargetDocIds) {
      setHasInitializedTargetDocIds(true);
    }
  }, [targetDocIdsParam, hasInitializedTargetDocIds]);

  // Initialize selectedEntities from URL parameters
  useEffect(() => {
    if (entityKindParam && !hasInitializedEntity) {
      const kind = entityKindParam as "personal" | "business";
      const entity: EntityOption = {
        kind,
        name: kind === "business" ? entityNameParam : null,
      };
      setSelectedEntities([entity]);
      selectedEntitiesRef.current = [entity];
      setHasInitializedEntity(true);
      // Clear URL params after reading
      const url = new URL(window.location.href);
      url.searchParams.delete("entityKind");
      url.searchParams.delete("entityName");
      window.history.replaceState({}, "", url.toString());
    } else if (!entityKindParam && !hasInitializedEntity) {
      setHasInitializedEntity(true);
    }
  }, [entityKindParam, entityNameParam, hasInitializedEntity]);

  // Initialize agentMode from URL parameter
  useEffect(() => {
    if (agentIdParam && !hasInitializedAgentId) {
      setCurrentAgentMode(agentIdParam);
      currentAgentModeRef.current = agentIdParam;
      setHasInitializedAgentId(true);
      // Clear URL param after reading
      const url = new URL(window.location.href);
      url.searchParams.delete("agentId");
      window.history.replaceState({}, "", url.toString());
    } else if (!agentIdParam && !hasInitializedAgentId) {
      setHasInitializedAgentId(true);
    }
  }, [agentIdParam, hasInitializedAgentId]);

  // Handle pre-generated slides data from URL parameter
  useEffect(() => {
    if (slidesDataParam && !hasInitializedSlidesData && selectedProjectId) {
      setHasInitializedSlidesData(true);

      const handleSlidesData = async () => {
        try {
          // Decode and parse the slides data
          const decodedData = decodeURIComponent(slidesDataParam);
          const slidesJson = JSON.parse(decodedData);

          // Validate it has the expected structure
          if (
            slidesJson &&
            Array.isArray(slidesJson.slides) &&
            slidesJson.slides.length > 0
          ) {
            const title =
              slidesTitleParam || slidesJson.slides[0]?.title || "Presentation";

            // Add the slides as messages inline in the chat for immediate display
            setMessages([
              {
                id: generateUUID(),
                role: "user",
                parts: [
                  { type: "text", text: `Create a presentation: ${title}` },
                ],
              },
              {
                id: generateUUID(),
                role: "assistant",
                parts: [{ type: "text", text: decodedData }],
              },
            ]);

            // Save the chat to the database
            try {
              const response = await fetch("/api/slides/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chatId: id,
                  projectId: selectedProjectId,
                  title,
                  slidesJson: decodedData,
                }),
              });

              if (response.ok) {
                // Update URL to show the chat ID and refresh chat history
                window.history.replaceState({}, "", `/chat/${id}`);
                mutate(`/api/history?limit=20&projectId=${selectedProjectId}`);
              }
            } catch (saveError) {
              console.error("Failed to save slides chat:", saveError);
            }
          }
        } catch (error) {
          console.error("Failed to parse slidesData:", error);
        }

        // Clear URL params after reading
        const url = new URL(window.location.href);
        url.searchParams.delete("slidesData");
        url.searchParams.delete("slidesTitle");
        window.history.replaceState({}, "", url.toString());
      };

      void handleSlidesData();
    } else if (!slidesDataParam && !hasInitializedSlidesData) {
      setHasInitializedSlidesData(true);
    }
  }, [
    slidesDataParam,
    slidesTitleParam,
    hasInitializedSlidesData,
    setMessages,
    selectedProjectId,
    id,
    mutate,
  ]);

  useEffect(() => {
    // Only send query after targetDocIds, entity, and agentId have been initialized (if present)
    // Use ref to prevent double-sending in React Strict Mode or with changing function references
    const queryToSend =
      slidesModeParam === "true" && slidesPromptParam
        ? slidesPromptParam
        : query;

    if (
      queryToSend &&
      !hasAppendedQuery &&
      !hasAppendedQueryRef.current &&
      hasInitializedTargetDocIds &&
      hasInitializedEntity &&
      hasInitializedAgentId
    ) {
      // Immediately mark as sent using ref (synchronous) to prevent race conditions
      hasAppendedQueryRef.current = true;

      // Set slides mode state before sending if in slides mode
      if (slidesModeParam === "true") {
        setSlidesMode(true);
        setSlidesTitle(slidesTitleParam || "Presentation");
      }

      sendMessage({
        role: "user" as const,
        parts: [{ type: "text", text: queryToSend }],
      });

      setHasAppendedQuery(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("query");
      url.searchParams.delete("slidesMode");
      url.searchParams.delete("slidesTitle");
      url.searchParams.delete("slidesPrompt");
      window.history.replaceState({}, "", url.toString());
    }
  }, [
    query,
    slidesPromptParam,
    slidesModeParam,
    slidesTitleParam,
    sendMessage,
    hasAppendedQuery,
    hasInitializedTargetDocIds,
    hasInitializedEntity,
    hasInitializedAgentId,
  ]);

  const { data: votes } = useSWR<Vote[]>(
    messages.length >= 2 ? `/api/vote?chatId=${id}` : null,
    fetcher
  );

  // Fetch document info for target doc IDs (includeAll to include notes/agents)
  const { data: projectDocs } = useSWR<{ docs: ProjectDoc[] }>(
    selectedProjectId && targetDocIds.length > 0
      ? `/api/projects/${selectedProjectId}/docs?includeAll=true`
      : null,
    fetcher
  );

  const targetDocs =
    projectDocs?.docs?.filter((doc) => targetDocIds.includes(doc.id)) ?? [];

  // Clear slides mode when generation completes
  useEffect(() => {
    if (slidesMode && status === "ready") {
      setSlidesMode(false);
      setSlidesTitle("");
    }
  }, [slidesMode, status]);

  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);

  const [invoiceSender, setInvoiceSender] = useState("");
  const [invoiceRecipient, setInvoiceRecipient] = useState("");

  useEffect(() => {
    const sender = localStorage.getItem("invoice_sender_last");
    const recipient = localStorage.getItem("invoice_recipient_last");
    if (typeof sender === "string") {
      setInvoiceSender(sender);
    }
    if (typeof recipient === "string") {
      setInvoiceRecipient(recipient);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("invoice_sender_last", invoiceSender);
  }, [invoiceSender]);

  useEffect(() => {
    localStorage.setItem("invoice_recipient_last", invoiceRecipient);
  }, [invoiceRecipient]);

  const { data: invoiceParties } = useSWR<{
    senders: string[];
    recipients: string[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/invoices/parties`
      : null,
    fetcher
  );

  const { data: businessNamesData } = useSWR<{ names: string[] }>(
    "/api/entities/business-names",
    fetcher,
    { shouldRetryOnError: false }
  );

  // Fetch workflow agents for the document type selection
  const { data: workflowAgentsData } = useSWR<{
    agents: WorkflowAgentOption[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/workflow-agents`
      : null,
    fetcher
  );
  const _workflowAgentOptions = workflowAgentsData?.agents ?? [];

  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);
  const [selectedFileType, setSelectedFileType] =
    useState<UploadDocumentType>("general_doc");
  const [dropDialogStep, setDropDialogStep] = useState<"type" | "entity">(
    "type"
  );
  const [dropEntityKind, setDropEntityKind] = useState<"personal" | "business">(
    "personal"
  );
  const [dropBusinessName, setDropBusinessName] = useState("");

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isReadonly) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isReadonly) {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  };

  const uploadFile = async (file: File, type: UploadDocumentType) => {
    const formData = new FormData();
    formData.append("file", file);

    // Check if type is a workflow agent selection
    let effectiveDocType: string = type;
    let workflowAgentId: string | undefined;
    if (type.startsWith("workflow:")) {
      workflowAgentId = type.slice("workflow:".length);
      effectiveDocType = "general_doc"; // Use general_doc as base type
    }

    formData.append("documentType", effectiveDocType);
    formData.append("entityKind", dropEntityKind);
    if (dropEntityKind === "business") {
      const bn = dropBusinessName.trim();
      if (bn.length > 0) {
        formData.append("entityName", bn);
      }
    }
    if (effectiveDocType === "invoice") {
      const sender = invoiceSender.trim();
      const recipient = invoiceRecipient.trim();
      if (sender) {
        formData.append("invoiceSender", sender);
      }
      if (recipient) {
        formData.append("invoiceRecipient", recipient);
      }
    }
    if (selectedProjectId) {
      formData.append("projectId", selectedProjectId);
    }
    if (workflowAgentId) {
      formData.append("workflowAgentId", workflowAgentId);
    }

    try {
      const response = await fetch("/api/files/upload", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        if (selectedProjectId) {
          mutate(`/api/projects/${selectedProjectId}/docs`);
        }

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast({ type: "error", description: error });
    } catch (_error) {
      toast({
        type: "error",
        description: "Failed to upload file, please try again!",
      });
    }
  };

  const handleUploadDroppedFiles = async (fileType?: UploadDocumentType) => {
    const filesToUpload = [...droppedFiles];
    const type = fileType ?? selectedFileType;
    setDroppedFiles([]);
    setDropDialogStep("type");
    setSelectedFileType("general_doc");

    try {
      const uploadPromises = filesToUpload.map((file) =>
        uploadFile(file, type)
      );
      const uploadedAttachments = await Promise.all(uploadPromises);
      const successfullyUploadedAttachments = uploadedAttachments.filter(
        (attachment): attachment is Attachment => attachment !== undefined
      );

      setAttachments((currentAttachments) => [
        ...currentAttachments,
        ...successfullyUploadedAttachments,
      ]);
    } catch (error) {
      console.error("Error uploading dropped files!", error);
    }
  };

  useAutoResume({
    autoResume,
    initialMessages,
    resumeStream,
    setMessages,
  });

  // Show full-screen project creation view if user has no (non-default) projects
  if (needsFirstProject) {
    return <FirstProjectPrompt />;
  }

  return (
    <>
      <div
        className={cn(
          "overscroll-behavior-contain relative flex h-dvh min-w-0 touch-pan-y flex-col bg-background dark:bg-auth-charcoal",
          isDragging && "ring-4 ring-primary ring-inset"
        )}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary border-dashed bg-background p-8 shadow-xl">
              <p className="font-medium text-lg">Drop files to upload</p>
              <p className="text-muted-foreground text-sm">
                Release to select document type
              </p>
            </div>
          </div>
        )}

        <ChatHeader
          chatId={id}
          ignoredDocIds={ignoredDocIds}
          isReadonly={isReadonly}
          onModelChange={setCurrentModelId}
          selectedModelId={currentModelId}
          selectedVisibilityType={initialVisibilityType}
          setIgnoredDocIds={setIgnoredDocIds}
        />

        {/* Slides loading card - shown when generating slides */}
        {slidesMode && status !== "ready" && (
          <div className="mx-auto w-full max-w-4xl px-4 py-8">
            <SlidesLoadingCard title={slidesTitle} />
          </div>
        )}

        <Messages
          chatId={id}
          isArtifactVisible={isArtifactVisible}
          isReadonly={isReadonly}
          messages={slidesMode && status !== "ready" ? [] : messages}
          onEntitySelection={handleEntitySelection}
          onTimeRangeSelection={handleTimeRangeSelection}
          onToggleCitations={onToggleCitations}
          regenerate={regenerate}
          selectedEntities={selectedEntities}
          selectedModelId={initialChatModel}
          selectedTimeRange={selectedTimeRange}
          setMessages={setMessages}
          showCitations={showCitations}
          status={status}
          votes={votes}
        />

        <div className="sticky bottom-0 z-1 mx-auto flex w-full max-w-4xl flex-col gap-2 border-t-0 bg-background px-2 pb-3 md:px-4 md:pb-4 dark:bg-auth-charcoal">
          {!isReadonly && (
            <>
              {selectedEntities && selectedEntities.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <span className="whitespace-nowrap text-muted-foreground text-xs">
                    Accounts:
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {selectedEntities.map((entity) => {
                      const label =
                        entity.kind === "personal"
                          ? "Personal"
                          : entity.name || "Business";
                      return (
                        <Badge
                          className="whitespace-nowrap text-xs"
                          key={`${entity.kind}-${entity.name || "null"}`}
                          variant="secondary"
                        >
                          {label}
                        </Badge>
                      );
                    })}
                  </div>
                  <Button
                    className="h-6 whitespace-nowrap px-2 text-xs"
                    onClick={() => {
                      setSelectedEntities([]);
                      selectedEntitiesRef.current = [];
                    }}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-3 w-3" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </div>
              )}
              {folderSyncStatus && !folderSyncStatus.synced && (
                <div className="px-1 text-muted-foreground text-xs">
                  This folder hasn&apos;t been synced yet. Sync files via the{" "}
                  <a
                    className="underline hover:text-foreground"
                    href="/integrations"
                  >
                    Integrations
                  </a>{" "}
                  page first.
                </div>
              )}
              {folderSyncStatus?.synced && (
                <div className="px-1 text-muted-foreground text-xs">
                  {folderSyncStatus.count} file
                  {folderSyncStatus.count !== 1 ? "s" : ""} from this folder
                  added to context.
                </div>
              )}
              <ContextDocPicker
                contextDocs={targetDocs.map((doc) => ({
                  id: doc.id,
                  name: doc.description || doc.filename,
                  type: doc.documentType === "note" ? "note" : "file",
                }))}
                onAdd={(doc: ContextDoc) => {
                  setTargetDocIds((prev) => [...prev, doc.id]);
                  targetDocIdsRef.current = [
                    ...targetDocIdsRef.current,
                    doc.id,
                  ];
                }}
                onClear={() => {
                  setTargetDocIds([]);
                  targetDocIdsRef.current = [];
                }}
                onRemove={(docId: string) => {
                  setTargetDocIds((prev) => prev.filter((id) => id !== docId));
                  targetDocIdsRef.current = targetDocIdsRef.current.filter(
                    (id) => id !== docId
                  );
                }}
                selectedProjectId={selectedProjectId}
              />
              <MultimodalInput
                attachments={attachments}
                chatId={id}
                input={input}
                messages={messages}
                onAgentModeChange={setCurrentAgentMode}
                onModelChange={setCurrentModelId}
                selectedAgentMode={currentAgentMode}
                selectedModelId={currentModelId}
                selectedProjectId={selectedProjectId ?? undefined}
                selectedVisibilityType={visibilityType}
                sendMessage={sendMessage}
                setAttachments={setAttachments}
                setInput={setInput}
                setMessages={setMessages}
                status={status}
                stop={stop}
              />
            </>
          )}
        </div>
      </div>

      <Artifact
        attachments={attachments}
        chatId={id}
        input={input}
        isReadonly={isReadonly}
        messages={messages}
        onEntitySelection={handleEntitySelection}
        onTimeRangeSelection={handleTimeRangeSelection}
        regenerate={regenerate}
        selectedEntities={selectedEntities}
        selectedModelId={currentModelId}
        selectedTimeRange={selectedTimeRange}
        selectedVisibilityType={visibilityType}
        sendMessage={sendMessage}
        setAttachments={setAttachments}
        setInput={setInput}
        setMessages={setMessages}
        status={status}
        stop={stop}
        votes={votes}
      />

      <AlertDialog
        onOpenChange={setShowCreditCardAlert}
        open={showCreditCardAlert}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate AI Gateway</AlertDialogTitle>
            <AlertDialogDescription>
              This application requires{" "}
              {process.env.NODE_ENV === "production" ? "the owner" : "you"} to
              activate Vercel AI Gateway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                window.open(
                  "https://vercel.com/d?to=%2F%5Bteam%5D%2F%7E%2Fai%3Fmodal%3Dadd-credit-card",
                  "_blank"
                );
                window.location.href = "/";
              }}
            >
              Activate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDroppedFiles([]);
            setDropDialogStep("type");
            setSelectedFileType("general_doc");
            setDropEntityKind("personal");
            setDropBusinessName("");
          }
        }}
        open={droppedFiles.length > 0}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dropDialogStep === "type"
                ? "Select Document Type"
                : "Upload Files"}
            </DialogTitle>
            <DialogDescription>
              {dropDialogStep === "type"
                ? `Choose a document type for the ${droppedFiles.length} file${droppedFiles.length !== 1 ? "s" : ""} you dropped.`
                : "Configure entity and invoice details."}
            </DialogDescription>
          </DialogHeader>

          {dropDialogStep === "type" ? (
            <div className="py-4">
              <DocumentTypePicker
                fileCount={droppedFiles.length}
                onCancel={() => setDroppedFiles([])}
                onSelect={(selection) => {
                  if (selection.isWorkflow) {
                    void handleUploadDroppedFiles(`workflow:${selection.id}`);
                  } else {
                    void handleUploadDroppedFiles("general_doc");
                  }
                }}
              />
            </div>
          ) : (
            <div className="py-4">
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <label
                    className="text-muted-foreground text-xs"
                    htmlFor="chat-drop-entity-kind"
                  >
                    Entity type
                  </label>
                  <Select
                    onValueChange={(value) =>
                      setDropEntityKind(value as "personal" | "business")
                    }
                    value={dropEntityKind}
                  >
                    <SelectTrigger id="chat-drop-entity-kind">
                      <SelectValue placeholder="Select entity type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="personal">Personal</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {dropEntityKind === "business" ? (
                  <div className="grid gap-1">
                    <label
                      className="text-muted-foreground text-xs"
                      htmlFor="chat-drop-business-name"
                    >
                      Business name
                    </label>
                    <BusinessNameTypeahead
                      inputId="chat-drop-business-name"
                      onChange={setDropBusinessName}
                      options={businessNamesData?.names ?? []}
                      placeholder="Start typing a business name"
                      value={dropBusinessName}
                    />
                    <div className="text-[11px] text-muted-foreground">
                      Start typing to reuse an existing business name, or type a
                      new one.
                    </div>
                  </div>
                ) : null}
              </div>

              {selectedFileType === "invoice" && (
                <div className="mt-4 grid gap-3">
                  <div className="grid gap-1">
                    <label
                      className="text-muted-foreground text-xs"
                      htmlFor="chat-drop-invoice-sender"
                    >
                      Sender
                    </label>
                    <Input
                      autoComplete="off"
                      id="chat-drop-invoice-sender"
                      list="chat-drop-invoice-sender-options"
                      onChange={(e) => setInvoiceSender(e.target.value)}
                      placeholder="Select or type sender"
                      value={invoiceSender}
                    />
                    <datalist id="chat-drop-invoice-sender-options">
                      {(invoiceParties?.senders ?? []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                  <div className="grid gap-1">
                    <label
                      className="text-muted-foreground text-xs"
                      htmlFor="chat-drop-invoice-recipient"
                    >
                      Recipient
                    </label>
                    <Input
                      autoComplete="off"
                      id="chat-drop-invoice-recipient"
                      list="chat-drop-invoice-recipient-options"
                      onChange={(e) => setInvoiceRecipient(e.target.value)}
                      placeholder="Select or type recipient"
                      value={invoiceRecipient}
                    />
                    <datalist id="chat-drop-invoice-recipient-options">
                      {(invoiceParties?.recipients ?? []).map((value) => (
                        <option key={value} value={value} />
                      ))}
                    </datalist>
                  </div>
                </div>
              )}

              <div className="mt-4 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                {droppedFiles.map((file, i) => (
                  <div className="truncate text-xs" key={`${file.name}-${i}`}>
                    {file.name}
                  </div>
                ))}
              </div>

              <DialogFooter className="mt-4">
                <Button
                  onClick={() => setDropDialogStep("type")}
                  variant="outline"
                >
                  Back
                </Button>
                <Button
                  onClick={() => {
                    if (
                      dropEntityKind === "business" &&
                      dropBusinessName.trim().length === 0
                    ) {
                      toast({
                        type: "error",
                        description: "Business name is required",
                      });
                      return;
                    }
                    void handleUploadDroppedFiles();
                  }}
                >
                  Upload
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
