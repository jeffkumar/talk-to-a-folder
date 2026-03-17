"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
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

export type AgentInitialValues = {
  name?: string;
  description?: string;
  systemPrompt?: string;
};

type CreateAgentModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (agent: { id: string; name: string }) => void;
  initialValues?: AgentInitialValues;
  agentType?: string;
  showUseAsDefault?: boolean;
  onUseAsDefault?: (agent: { id: string; name: string }) => void;
};

export function CreateAgentModal({
  open,
  onOpenChange,
  onCreated,
  initialValues,
  agentType,
  showUseAsDefault,
  onUseAsDefault,
}: CreateAgentModalProps) {
  const { selectedProjectId } = useProjectSelector();
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSystemPrompt, setFormSystemPrompt] = useState("");
  const [useAsDefault, setUseAsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialValues) {
        setFormName(initialValues.name ?? "");
        setFormDescription(initialValues.description ?? "");
        setFormSystemPrompt(initialValues.systemPrompt ?? "");
      }
      if (showUseAsDefault) {
        setUseAsDefault(true);
      }
    }
  }, [open, initialValues, showUseAsDefault]);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormSystemPrompt("");
    setUseAsDefault(false);
  };

  const handleSave = async () => {
    if (!selectedProjectId || !formName.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const metadata: Record<string, unknown> = {};
      if (agentType) {
        metadata.agentType = agentType;
      }

      const response = await fetch(
        `/api/projects/${selectedProjectId}/agents`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: formName.trim(),
            description: formDescription.trim(),
            systemPrompt: formSystemPrompt,
            ...(Object.keys(metadata).length > 0 && { metadata }),
          }),
        }
      );

      if (!response.ok) {
        const json = await response.json().catch(() => null);
        throw new Error(json?.error ?? "Failed to create agent");
      }

      const result = await response.json();
      toast.success("Agent created");

      void mutate(`/api/projects/${selectedProjectId}/agents`);

      const agent = { id: result.agent.id, name: result.agent.name };
      onCreated?.(agent);
      if (useAsDefault && onUseAsDefault) {
        onUseAsDefault(agent);
      }

      resetForm();
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create agent"
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          resetForm();
        }
      }}
      open={open}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {agentType === "email" ? "Create Email Agent" : "Create New Agent"}
          </DialogTitle>
          <DialogDescription>
            {agentType === "email"
              ? "Create a custom email agent with rules for how your emails should be written."
              : "Create a custom agent with a specific system prompt. The project agent can invoke this agent when appropriate."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <label className="font-medium text-sm" htmlFor="create-agent-name">
              Name
            </label>
            <Input
              className="mt-2"
              id="create-agent-name"
              onChange={(e) => setFormName(e.target.value)}
              placeholder={
                agentType === "email" ? "e.g. My Email Style" : "Agent name..."
              }
              value={formName}
            />
          </div>
          <div className="space-y-3">
            <label
              className="font-medium text-sm"
              htmlFor="create-agent-description"
            >
              Description
            </label>
            <Input
              className="mt-2"
              id="create-agent-description"
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder={
                agentType === "email"
                  ? "e.g. Concise, professional tone"
                  : "Brief description of what this agent does..."
              }
              value={formDescription}
            />
          </div>
          <div className="space-y-3">
            <label
              className="font-medium text-sm"
              htmlFor="create-agent-prompt"
            >
              {agentType === "email"
                ? "Email Rules / System Prompt"
                : "System Prompt"}
            </label>
            <Textarea
              className="mt-2 min-h-[200px] font-mono text-sm"
              id="create-agent-prompt"
              onChange={(e) => setFormSystemPrompt(e.target.value)}
              placeholder={
                agentType === "email"
                  ? "Define your email style, tone, and rules..."
                  : "Enter the system prompt for this agent..."
              }
              value={formSystemPrompt}
            />
            <p className="text-muted-foreground text-xs">
              {agentType === "email"
                ? "Define how this agent writes emails — tone, sign-off, formatting rules, etc."
                : "This prompt defines the agent\u0027s behavior and personality."}
            </p>
          </div>
          {showUseAsDefault && (
            <label className="flex cursor-pointer items-center gap-2">
              <input
                checked={useAsDefault}
                className="size-4 accent-primary"
                onChange={(e) => setUseAsDefault(e.target.checked)}
                type="checkbox"
              />
              <span className="text-sm">Use as default agent</span>
            </label>
          )}
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={!formName.trim() || isSaving} onClick={handleSave}>
            {isSaving ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
