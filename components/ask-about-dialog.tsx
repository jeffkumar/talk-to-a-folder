"use client";

import { Bot, FolderOpen, Mail, Plus, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { agentModes } from "@/lib/ai/models";
import { fetcher } from "@/lib/utils";
import { CreateAgentModal } from "./create-agent-modal";

type CustomAgent = {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
};

function getAgentIcon(agentId: string) {
  switch (agentId) {
    case "finance":
      return <TrendingUp className="size-4" />;
    case "project":
      return <FolderOpen className="size-4" />;
    case "email":
      return <Mail className="size-4" />;
    default:
      return <Bot className="size-4" />;
  }
}

type AskAboutDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docIds: string[];
  docNames: string[];
};

export function AskAboutDialog({
  open,
  onOpenChange,
  docIds,
  docNames,
}: AskAboutDialogProps) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("project");
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false);
  const { selectedProjectId } = useProjectSelector();

  // Fetch available agents
  const { data, mutate } = useSWR<{ agents: CustomAgent[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/agents` : null,
    fetcher
  );

  const allAgents = data?.agents ?? [];
  const customAgents = allAgents.filter((a) => !a.isBuiltIn);

  const handleAgentCreated = (agent: { id: string; name: string }) => {
    void mutate();
    setSelectedAgentId(agent.id);
  };

  const handleSubmit = async () => {
    if (!question.trim() || isSubmitting || docIds.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Navigate to new chat with the question, target doc IDs, and selected agent
      const url = new URL("/chat", window.location.origin);
      url.searchParams.set("query", question.trim());
      url.searchParams.set("targetDocIds", docIds.join(","));
      url.searchParams.set("agentId", selectedAgentId);

      // Close dialog first before navigation
      onOpenChange(false);
      setQuestion("");
      router.push(url.toString());
    } catch (error) {
      console.error("Failed to navigate to chat:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && question.trim()) {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const isMultiple = docNames.length > 1;
  const title = isMultiple
    ? `Ask about ${docNames.length} documents`
    : "Ask about this document";
  const description = isMultiple
    ? `Ask a question about these ${docNames.length} documents. The chat will be scoped to only these documents.`
    : `Ask a question about "${docNames[0] ?? ""}". The chat will be scoped to only this document.`;

  // Get selected agent name for display
  const selectedBuiltIn = agentModes.find((m) => m.id === selectedAgentId);
  const selectedCustom = customAgents.find((a) => a.id === selectedAgentId);
  const _selectedAgentName =
    selectedBuiltIn?.name ?? selectedCustom?.name ?? "Project";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {isMultiple && (
          <div className="max-h-32 overflow-y-auto rounded-md border border-border bg-muted/30 p-2">
            <ul className="space-y-1 text-muted-foreground text-sm">
              {docNames.map((name, i) => (
                <li className="truncate" key={docIds[i]}>
                  • {name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="agent-select">
              Agent
            </label>
            <Select
              onValueChange={(value) => {
                if (value === "__create__") {
                  setShowCreateAgentModal(true);
                  return;
                }
                setSelectedAgentId(value);
              }}
              value={selectedAgentId}
            >
              <SelectTrigger className="w-full" id="agent-select">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agentModes.map((mode) => (
                  <SelectItem key={mode.id} value={mode.id}>
                    <div className="flex items-center gap-2">
                      {getAgentIcon(mode.id)}
                      <span>{mode.name}</span>
                    </div>
                  </SelectItem>
                ))}
                {customAgents.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-muted-foreground text-xs">
                      Custom Agents
                    </div>
                    {customAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex items-center gap-2">
                          <Bot className="size-4 text-primary" />
                          <span>{agent.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </>
                )}
                <SelectItem className="text-primary" value="__create__">
                  <div className="flex items-center gap-2">
                    <Plus className="size-4" />
                    <span>Create new agent</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="question-input">
              Question
            </label>
            <Input
              autoFocus
              id="question-input"
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What would you like to know?"
              value={question}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => {
              onOpenChange(false);
              setQuestion("");
            }}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!question.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? "Opening..." : "Ask"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <CreateAgentModal
        onCreated={handleAgentCreated}
        onOpenChange={setShowCreateAgentModal}
        open={showCreateAgentModal}
      />
    </Dialog>
  );
}
