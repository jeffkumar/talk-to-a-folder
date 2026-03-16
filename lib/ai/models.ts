export const DEFAULT_CHAT_MODEL: string = "claude-sonnet";

export type ChatModel = {
  id: string;
  name: string;
  description: string;
};

export const chatModels: ChatModel[] = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    description: "Anthropic's balanced model for most tasks",
  },
  {
    id: "claude-opus",
    name: "Claude Opus 4.5",
    description: "Anthropic's most powerful reasoning model",
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    description: "DeepSeek's latest high-performance model",
  },
  {
    id: "glm-4",
    name: "GLM-4",
    description: "Zhipu AI's powerful bilingual model",
  },
];

// Agent Modes
// "finance" is available as an optional prebuilt agent, not shown by default
export type AgentMode = "project" | "finance" | "email";

export type AgentModeConfig = {
  id: AgentMode;
  name: string;
  description: string;
};

// Default agent modes shown in the dropdown
// Finance is NOT included by default - users can add it via Agents page
export const agentModes: AgentModeConfig[] = [
  {
    id: "project",
    name: "Project",
    description: "Documents, notes, slides, and more",
  },
  {
    id: "email",
    name: "Rockstar Emails",
    description: "Draft clear, concise emails",
  },
];

export const DEFAULT_AGENT_MODE: AgentMode = "project";
