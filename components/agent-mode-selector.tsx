"use client";

import { Bot, FolderOpen, Mail, Plus, TrendingUp } from "lucide-react";
import { startTransition, useMemo, useOptimistic, useState } from "react";
import useSWR from "swr";
import {
  type AgentInitialValues,
  CreateAgentModal,
} from "@/components/create-agent-modal";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { type AgentMode, agentModes } from "@/lib/ai/models";
import { cn, fetcher } from "@/lib/utils";
import { CheckCircleFillIcon, ChevronDownIcon } from "./icons";

type CustomAgent = {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  isPrebuilt?: boolean;
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

const EMAIL_AGENT_INITIAL_VALUES: AgentInitialValues = {
  name: "",
  description: "Custom email drafting rules",
  systemPrompt: `Write clear and concise emails.

Keep it short and to the point.

Never make it sound like a salesperson. Be technical, but not overly technical.

Never end an email with "Best". "Cheers" is much better.

Be creative!`,
};

type AgentModeSelectorProps = {
  selectedAgentMode: AgentMode | string;
  onAgentModeChange?: (mode: AgentMode | string) => void;
  className?: string;
};

export function AgentModeSelector({
  selectedAgentMode,
  onAgentModeChange,
  className,
}: AgentModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [optimisticMode, setOptimisticMode] = useOptimistic(selectedAgentMode);
  const { selectedProjectId } = useProjectSelector();

  const { data } = useSWR<{ agents: CustomAgent[] }>(
    selectedProjectId ? `/api/projects/${selectedProjectId}/agents` : null,
    fetcher
  );

  const allAgents = data?.agents ?? [];
  const enabledPrebuiltAgents = allAgents.filter((a) => a.isPrebuilt);
  const customAgents = allAgents.filter((a) => !a.isBuiltIn && !a.isPrebuilt);

  const allBuiltInModes = useMemo(
    () => [
      ...agentModes,
      ...enabledPrebuiltAgents.map((a) => ({
        id: a.id as AgentMode,
        name: a.name,
        description: a.description,
      })),
    ],
    [enabledPrebuiltAgents]
  );

  const selectedBuiltIn = allBuiltInModes.find((m) => m.id === optimisticMode);
  const selectedCustom = customAgents.find((a) => a.id === optimisticMode);
  const selectedName =
    selectedBuiltIn?.name ?? selectedCustom?.name ?? "Project";

  return (
    <>
      <DropdownMenu onOpenChange={setOpen} open={open}>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "h-8 gap-1.5 px-2 data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",
              className
            )}
            variant="ghost"
          >
            {getAgentIcon(optimisticMode)}
            <span className="hidden font-medium text-xs sm:inline">
              {selectedName}
            </span>
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[220px]">
          {allBuiltInModes.map((mode) => (
            <DropdownMenuItem
              data-active={mode.id === optimisticMode}
              key={mode.id}
              onSelect={() => {
                setOpen(false);
                startTransition(() => {
                  setOptimisticMode(mode.id);
                  onAgentModeChange?.(mode.id);
                });
              }}
            >
              <button
                className="group/item flex w-full flex-row items-center justify-between gap-2"
                type="button"
              >
                <div className="flex items-center gap-2">
                  {getAgentIcon(mode.id)}
                  <div className="flex flex-col items-start gap-0.5">
                    <div className="text-sm">{mode.name}</div>
                    <div className="text-muted-foreground text-xs">
                      {mode.description}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                  <CheckCircleFillIcon />
                </div>
              </button>
            </DropdownMenuItem>
          ))}

          {customAgents.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <div className="px-2 py-1 text-muted-foreground text-xs">
                Custom Agents
              </div>
              {customAgents.map((agent) => (
                <DropdownMenuItem
                  data-active={agent.id === optimisticMode}
                  key={agent.id}
                  onSelect={() => {
                    setOpen(false);
                    startTransition(() => {
                      setOptimisticMode(agent.id);
                      onAgentModeChange?.(agent.id);
                    });
                  }}
                >
                  <button
                    className="group/item flex w-full flex-row items-center justify-between gap-2"
                    type="button"
                  >
                    <div className="flex items-center gap-2">
                      <Bot className="size-4 text-primary" />
                      <div className="flex flex-col items-start gap-0.5">
                        <div className="text-sm">{agent.name}</div>
                        <div className="text-muted-foreground text-xs">
                          {agent.description || "Custom agent"}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 text-foreground opacity-0 group-data-[active=true]/item:opacity-100">
                      <CheckCircleFillIcon />
                    </div>
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              setOpen(false);
              setShowCreateModal(true);
            }}
          >
            <button className="flex w-full items-center gap-2" type="button">
              <Plus className="size-4 text-muted-foreground" />
              <span className="text-sm">Create Email Agent</span>
            </button>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateAgentModal
        agentType="email"
        initialValues={EMAIL_AGENT_INITIAL_VALUES}
        onCreated={(agent) => {
          startTransition(() => {
            setOptimisticMode(agent.id);
            onAgentModeChange?.(agent.id);
          });
        }}
        onOpenChange={setShowCreateModal}
        onUseAsDefault={(agent) => {
          startTransition(() => {
            setOptimisticMode(agent.id);
            onAgentModeChange?.(agent.id);
          });
        }}
        open={showCreateModal}
        showUseAsDefault
      />
    </>
  );
}
