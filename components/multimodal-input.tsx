"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { Trigger } from "@radix-ui/react-select";
import type { UIMessage } from "ai";
import fastDeepEqual from "fast-deep-equal";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import { saveChatModelAsCookie } from "@/app/(chat)/actions";
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
import { useUploadNotifications } from "@/hooks/use-upload-notifications";
import type { AgentMode } from "@/lib/ai/models";
import { chatModels } from "@/lib/ai/models";
import type { Attachment, ChatMessage, VisibilityType } from "@/lib/types";
import { cn, fetcher } from "@/lib/utils";
import { DocumentTypePicker } from "./document-type-picker";
import {
  PromptInput,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "./elements/prompt-input";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  CpuIcon,
  PlusIcon,
  StopIcon,
} from "./icons";
import { PreviewAttachment } from "./preview-attachment";
import { Button } from "./ui/button";

// UploadDocumentType can be a built-in type or a workflow agent ID (prefixed with "workflow:")
type UploadDocumentType =
  | "general_doc"
  | "bank_statement"
  | "cc_statement"
  | "invoice"
  | `workflow:${string}`;

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

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  selectedProjectId,
  selectedAgentMode,
  onAgentModeChange,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  selectedProjectId?: string;
  selectedAgentMode?: AgentMode | string;
  onAgentModeChange?: (mode: AgentMode | string) => void;
}) {
  const { mutate } = useSWRConfig();
  const { trackUpload } = useUploadNotifications();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      adjustHeight();
    }
  }, [adjustHeight]);

  const resetHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
  }, []);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      // Prefer DOM value over localStorage to handle hydration
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
      adjustHeight();
    }
    // Only run once after hydration
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjustHeight, localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(event.target.value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [uploadDocumentType, setUploadDocumentType] =
    useState<UploadDocumentType>("general_doc");
  const [invoiceSender, _setInvoiceSender] = useLocalStorage(
    "invoice_sender_last",
    ""
  );
  const [invoiceRecipient, _setInvoiceRecipient] = useLocalStorage(
    "invoice_recipient_last",
    ""
  );
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [uploadEntityKind, setUploadEntityKind] = useState<
    "personal" | "business"
  >("personal");
  const [uploadBusinessName, setUploadBusinessName] = useState("");

  // Document type selection state
  const [documentTypeDialogOpen, setDocumentTypeDialogOpen] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);

  const { data: businessNamesData } = useSWR<{ names: string[] }>(
    "/api/entities/business-names",
    fetcher,
    { shouldRetryOnError: false }
  );

  const { data: invoiceParties } = useSWR<{
    senders: string[];
    recipients: string[];
  }>(
    selectedProjectId
      ? `/api/projects/${selectedProjectId}/invoices/parties`
      : null,
    fetcher
  );

  const submitForm = useCallback(() => {
    window.history.pushState({}, "", `/chat/${chatId}`);

    sendMessage({
      role: "user",
      parts: [
        ...attachments.map((attachment) => ({
          type: "file" as const,
          url: attachment.url,
          name: attachment.name,
          mediaType: attachment.contentType,
        })),
        {
          type: "text",
          text: input,
        },
      ],
    });

    setAttachments([]);
    setLocalStorageInput("");
    resetHeight();
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
    resetHeight,
  ]);

  const uploadFile = useCallback(
    async (file: File, agentId?: string) => {
      const formData = new FormData();
      formData.append("file", file);

      // Check if uploadDocumentType is a workflow agent selection
      let effectiveDocType = uploadDocumentType;
      let effectiveAgentId = agentId;
      if (uploadDocumentType.startsWith("workflow:")) {
        effectiveAgentId = uploadDocumentType.slice("workflow:".length);
        effectiveDocType = "general_doc"; // Use general_doc as base type
      }

      formData.append("documentType", effectiveDocType);
      formData.append("entityKind", uploadEntityKind);
      if (uploadEntityKind === "business") {
        const bn = uploadBusinessName.trim();
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
      if (effectiveAgentId) {
        formData.append("workflowAgentId", effectiveAgentId);
      }

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          const { url, pathname, contentType, doc } = data;

          if (selectedProjectId) {
            mutate(`/api/projects/${selectedProjectId}/docs`);
            // Track upload for processing notification
            if (doc?.id && doc?.parseStatus === "pending") {
              trackUpload(doc.id, file.name, selectedProjectId);
            }
          }

          return {
            url,
            name: pathname,
            contentType,
          };
        }
        const { error } = await response.json();
        toast.error(error);
      } catch (_error) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    [
      invoiceRecipient,
      invoiceSender,
      selectedProjectId,
      mutate,
      trackUpload,
      uploadDocumentType,
      uploadBusinessName,
      uploadEntityKind,
    ]
  );

  const processFilesWithAgent = useCallback(
    async (files: File[], agentId?: string) => {
      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file, agentId));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
        setPendingFiles([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length === 0) {
        return;
      }

      // Reset the file input
      if (event.target) {
        event.target.value = "";
      }

      // Store files and show document type selection dialog
      setPendingFiles(files);
      setUploadDocumentType("general_doc"); // Reset to default
      setDocumentTypeDialogOpen(true);
    },
    []
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      // Prevent default paste behavior for images
      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (error) {
        console.error("Error uploading pasted images:", error);
        toast.error("Failed to upload pasted image(s)");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  // Add paste event listener to textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      <input
        accept="image/jpeg,image/png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/csv,application/csv,text/plain"
        className="-top-4 -left-4 pointer-events-none fixed size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <PromptInput
        className="rounded-xl border border-border bg-background p-3 shadow-xs transition-all duration-200 focus-within:border-border hover:border-muted-foreground/50"
        onSubmit={(event) => {
          event.preventDefault();
          if (status !== "ready") {
            toast.error("Please wait for the model to finish its response!");
          } else {
            submitForm();
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex flex-row items-end gap-2 overflow-x-scroll"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <div className="flex flex-row items-start gap-1 sm:gap-2">
          <PromptInputTextarea
            autoFocus
            className="grow resize-none border-0! border-none! bg-transparent p-2 text-sm outline-none ring-0 [-ms-overflow-style:none] [scrollbar-width:none] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 [&::-webkit-scrollbar]:hidden"
            data-testid="multimodal-input"
            disableAutoResize={true}
            maxHeight={200}
            minHeight={44}
            onChange={handleInput}
            placeholder="Ask me anything about this project..."
            ref={textareaRef}
            rows={1}
            value={input}
          />{" "}
        </div>
        <PromptInputToolbar className="!border-top-0 border-t-0! p-0 shadow-none dark:border-0 dark:border-transparent!">
          <PromptInputTools className="gap-0 sm:gap-0.5">
            <AttachmentsButton
              onRequestFiles={() => {
                fileInputRef.current?.click();
              }}
              selectedModelId={selectedModelId}
              status={status}
            />
          </PromptInputTools>

          {status === "submitted" ? (
            <StopButton setMessages={setMessages} stop={stop} />
          ) : (
            <PromptInputSubmit
              className="size-8 rounded-full bg-primary text-primary-foreground transition-colors duration-200 hover:bg-primary/90 disabled:bg-muted disabled:text-foreground"
              data-testid="send-button"
              disabled={!input.trim() || uploadQueue.length > 0}
              status={status}
            >
              <ArrowUpIcon size={14} />
            </PromptInputSubmit>
          )}
        </PromptInputToolbar>
      </PromptInput>

      <Dialog
        onOpenChange={(open) => {
          setEntityDialogOpen(open);
          if (!open) {
            setUploadEntityKind("personal");
            setUploadBusinessName("");
          }
        }}
        open={entityDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload files</DialogTitle>
            <DialogDescription>
              Choose whether these files are Personal or Business. If Business,
              select or type a business name.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1">
              <label
                className="text-muted-foreground text-xs"
                htmlFor="chat-upload-entity-kind"
              >
                Entity type
              </label>
              <Select
                onValueChange={(value) =>
                  setUploadEntityKind(value as "personal" | "business")
                }
                value={uploadEntityKind}
              >
                <SelectTrigger className="h-9" id="chat-upload-entity-kind">
                  <SelectValue placeholder="Select entity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {uploadEntityKind === "business" ? (
              <div className="grid gap-1">
                <label
                  className="text-muted-foreground text-xs"
                  htmlFor="chat-upload-business-name"
                >
                  Business name
                </label>
                <BusinessNameTypeahead
                  inputId="chat-upload-business-name"
                  onChange={setUploadBusinessName}
                  options={businessNamesData?.names ?? []}
                  placeholder="Start typing a business name"
                  value={uploadBusinessName}
                />
                <div className="text-[11px] text-muted-foreground">
                  Start typing to reuse an existing business name, or type a new
                  one.
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              onClick={() => setEntityDialogOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const name =
                  uploadEntityKind === "personal"
                    ? "Personal"
                    : uploadBusinessName.trim();
                if (uploadEntityKind === "business" && name.length === 0) {
                  toast.error("Business name is required");
                  return;
                }
                setEntityDialogOpen(false);
                processFilesWithAgent(pendingFiles, undefined);
              }}
              type="button"
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Document Type Selection Dialog */}
      <Dialog
        onOpenChange={(open) => {
          setDocumentTypeDialogOpen(open);
          if (!open) {
            setPendingFiles([]);
            setUploadDocumentType("general_doc");
          }
        }}
        open={documentTypeDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Document Type</DialogTitle>
            <DialogDescription>
              Choose a document type for the {pendingFiles.length} file
              {pendingFiles.length !== 1 ? "s" : ""} you selected.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <DocumentTypePicker
              fileCount={pendingFiles.length}
              onCancel={() => {
                setDocumentTypeDialogOpen(false);
                setPendingFiles([]);
              }}
              onSelect={(selection) => {
                setDocumentTypeDialogOpen(false);
                if (selection.isWorkflow) {
                  setUploadDocumentType(`workflow:${selection.id}`);
                  processFilesWithAgent(pendingFiles, selection.id);
                } else {
                  setUploadDocumentType("general_doc");
                  processFilesWithAgent(pendingFiles, undefined);
                }
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!fastDeepEqual(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.selectedProjectId !== nextProps.selectedProjectId) {
      return false;
    }
    if (prevProps.selectedAgentMode !== nextProps.selectedAgentMode) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  status,
  selectedModelId,
  onRequestFiles,
}: {
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
  onRequestFiles: () => void;
}) {
  const isReasoningModel = selectedModelId === "chat-model-reasoning";

  return (
    <Button
      className="aspect-square h-8 rounded-full p-1.5 transition-colors hover:bg-accent"
      data-testid="attachments-button"
      disabled={status !== "ready" || isReasoningModel}
      onClick={onRequestFiles}
      type="button"
      variant="ghost"
    >
      <PlusIcon size={16} />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [optimisticModelId, setOptimisticModelId] = useState(selectedModelId);

  useEffect(() => {
    setOptimisticModelId(selectedModelId);
  }, [selectedModelId]);

  const selectedModel = chatModels.find(
    (model) => model.id === optimisticModelId
  );

  return (
    <PromptInputModelSelect
      onValueChange={(modelName) => {
        const model = chatModels.find((m) => m.name === modelName);
        if (model) {
          setOptimisticModelId(model.id);
          onModelChange?.(model.id);
          startTransition(() => {
            saveChatModelAsCookie(model.id);
          });
        }
      }}
      value={selectedModel?.name}
    >
      <Trigger asChild>
        <Button className="h-8 px-2" variant="ghost">
          <CpuIcon size={16} />
          <span className="hidden font-medium text-xs sm:block">
            {selectedModel?.name}
          </span>
          <ChevronDownIcon size={16} />
        </Button>
      </Trigger>
      <PromptInputModelSelectContent className="min-w-[260px] p-0">
        <div className="flex flex-col gap-px">
          {chatModels.map((model) => (
            <SelectItem key={model.id} value={model.name}>
              <div className="truncate font-medium text-xs">{model.name}</div>
              <div className="mt-px truncate text-[10px] text-muted-foreground leading-tight">
                {model.description}
              </div>
            </SelectItem>
          ))}
        </div>
      </PromptInputModelSelectContent>
    </PromptInputModelSelect>
  );
}

const _ModelSelectorCompact = memo(PureModelSelectorCompact);

function PureStopButton({
  stop,
  setMessages,
}: {
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Button
      className="size-7 rounded-full bg-foreground p-1 text-background transition-colors duration-200 hover:bg-foreground/90 disabled:bg-muted disabled:text-foreground"
      data-testid="stop-button"
      onClick={(event) => {
        event.preventDefault();
        stop();
        setMessages((messages) => messages);
      }}
    >
      <StopIcon size={14} />
    </Button>
  );
}

const StopButton = memo(PureStopButton);
