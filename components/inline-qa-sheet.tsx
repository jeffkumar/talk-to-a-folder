"use client";

import { ExternalLink, Loader2, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ContextDoc,
  ContextDocPicker,
} from "@/components/context-doc-picker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { getRandomThinkingMessage } from "@/lib/ai/messages";
import type { AgentMode } from "@/lib/ai/models";
import { cn, generateUUID } from "@/lib/utils";
import { Response } from "./elements/response";
import { EmailCard, looksLikeEmail } from "./email-card";
import { SparklesIcon } from "./icons";

// Strip citation markers like 【1】 from responses (same as main chat)
function stripCitations(text: string): string {
  return text.replace(/【[\d,\s]+】/g, "");
}

type InlineQASheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docIds: string[];
  docNames: string[];
  /** Type of documents: "notes" or "files" - used to fetch available docs */
  docType?: "notes" | "files";
};

type SimpleMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

export function InlineQASheet({
  open,
  onOpenChange,
  docIds: initialDocIds,
  docNames: initialDocNames,
  docType = "notes",
}: InlineQASheetProps) {
  const router = useRouter();
  const { selectedProjectId } = useProjectSelector();
  const [chatId] = useState(() => generateUUID());
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SimpleMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [contextDocs, setContextDocs] = useState<ContextDoc[]>([]);
  const [selectedAgentMode, setSelectedAgentMode] = useState<
    AgentMode | string
  >("files");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isSubmittingRef = useRef(false);
  const randomThinkingMessage = useMemo(() => getRandomThinkingMessage(), []);

  // Stable key for initial docIds to detect changes
  const initialDocIdsKey = initialDocIds.join(",");

  // Reset state when sheet opens with new docs
  useEffect(() => {
    if (open) {
      // Initialize context docs from props - use docType to determine initial type
      const initial: ContextDoc[] = initialDocIds.map((id, i) => ({
        id,
        name: initialDocNames[i] ?? id,
        type: docType === "notes" ? "note" : "file",
      }));
      setContextDocs(initial);
      setMessages([]);
      setInput("");
      setStreamingContent("");
      setIsStreaming(false);
      isSubmittingRef.current = false;
      // Focus input after sheet animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, initialDocIdsKey, initialDocIds, initialDocNames, docType]);

  // Derived arrays for API calls
  const docIds = contextDocs.map((d) => d.id);
  const docNames = contextDocs.map((d) => d.name);

  const addDocToContext = (doc: ContextDoc) => {
    setContextDocs((prev) => [...prev, doc]);
  };

  const removeDocFromContext = (docId: string) => {
    setContextDocs((prev) => prev.filter((d) => d.id !== docId));
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, streamingContent]);

  const handleSubmit = useCallback(async () => {
    // Use ref for immediate check to prevent double-clicks
    if (isSubmittingRef.current) return;
    if (!input.trim() || isStreaming || !selectedProjectId) return;

    // Set ref immediately (synchronous) before any state updates
    isSubmittingRef.current = true;

    const userMessage: SimpleMessage = {
      id: generateUUID(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: chatId,
          message: {
            id: userMessage.id,
            role: "user",
            parts: [{ type: "text", text: userMessage.content }],
          },
          selectedChatModel: "deepseek-v3",
          selectedVisibilityType: "private",
          selectedAgentMode,
          projectId: selectedProjectId,
          targetDocIds: docIds,
          // Inline Q&A mode - simpler responses
          inlineQAMode: true,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
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
                // Handle text-delta events from createUIMessageStream
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

      // Add assistant message
      if (fullContent) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateUUID(),
            role: "assistant",
            content: fullContent,
          },
        ]);
      }
    } catch (error) {
      console.error("Failed to get response:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateUUID(),
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      isSubmittingRef.current = false;
    }
  }, [input, isStreaming, selectedProjectId, docIds, chatId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && input.trim()) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const handleOpenInChat = () => {
    // Navigate to chat with current context preserved
    const url = new URL("/chat", window.location.origin);

    // If there were messages, pass the last user question to continue
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages.at(-1);
      if (lastUserMessage) {
        url.searchParams.set("query", lastUserMessage.content);
      }
    }

    // Pass the current context docs (including any added ones)
    const currentDocIds = contextDocs.map((d) => d.id);
    if (currentDocIds.length > 0) {
      url.searchParams.set("targetDocIds", currentDocIds.join(","));
    }
    url.searchParams.set("agentId", "files");

    onOpenChange(false);
    router.push(url.toString());
  };

  const isMultiple = contextDocs.length > 1;
  const title = isMultiple
    ? `Ask about ${contextDocs.length} ${docType === "notes" ? "notes" : "files"}`
    : `Ask about "${contextDocs[0]?.name ?? ""}"`;

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        className="flex w-full flex-col gap-0 p-0 sm:max-w-lg [&>button:last-of-type]:hidden"
        side="right"
      >
        <SheetHeader className="border-border border-b px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base">{title}</SheetTitle>
              {isMultiple && (
                <SheetDescription className="mt-0.5 text-xs">
                  Scoped to {docNames.length} selected documents
                </SheetDescription>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                className="shrink-0 gap-1 text-xs"
                onClick={handleOpenInChat}
                size="sm"
                type="button"
                variant="ghost"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in Chat
              </Button>
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
          </div>
        </SheetHeader>

        <div className="border-border border-b px-4 py-2">
          <ContextDocPicker
            contextDocs={contextDocs}
            onAdd={addDocToContext}
            onClear={() => setContextDocs([])}
            onRemove={removeDocFromContext}
            selectedProjectId={selectedProjectId}
          />
        </div>

        {/* Messages area */}
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="flex flex-col gap-4 py-4">
            {messages.length === 0 && !isStreaming && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 rounded-full bg-primary/10 p-3">
                  <SparklesIcon className="text-primary" size={24} />
                </div>
                <p className="text-muted-foreground text-sm">
                  Ask a question about{" "}
                  {isMultiple ? "these documents" : "this document"}
                </p>
              </div>
            )}

            {messages.map((message) => (
              <div
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
                key={message.id}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {message.role === "assistant" ? (
                    looksLikeEmail(stripCitations(message.content)) ? (
                      <EmailCard content={stripCitations(message.content)} />
                    ) : (
                      <Response className="prose prose-sm dark:prose-invert max-w-none [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:pl-4 [&_ul]:my-1 [&_ul]:pl-4">
                        {stripCitations(message.content)}
                      </Response>
                    )
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}

            {/* Streaming message */}
            {isStreaming && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-muted px-3 py-2 text-sm">
                  {streamingContent ? (
                    looksLikeEmail(stripCitations(streamingContent)) ? (
                      <EmailCard content={stripCitations(streamingContent)} />
                    ) : (
                      <Response className="prose prose-sm dark:prose-invert max-w-none [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:pl-4 [&_ul]:my-1 [&_ul]:pl-4">
                        {stripCitations(streamingContent)}
                      </Response>
                    )
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{randomThinkingMessage}...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-border border-t p-4">
          <div className="flex gap-2">
            <Textarea
              className="min-h-[60px] flex-1 resize-none"
              disabled={isStreaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              ref={inputRef}
              rows={2}
              value={input}
            />
            <Button
              disabled={!input.trim() || isStreaming}
              onClick={() => void handleSubmit()}
              size="icon"
              type="button"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
