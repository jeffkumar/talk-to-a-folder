import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Chat } from "@/components/chat";
import { DataStreamHandler } from "@/components/data-stream-handler";
import {
  type AgentMode,
  chatModels,
  DEFAULT_AGENT_MODE,
  DEFAULT_CHAT_MODEL,
} from "@/lib/ai/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "../../(auth)/auth";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <NewChatPage />
    </Suspense>
  );
}

async function NewChatPage() {
  const session = await auth();

  if (!session) {
    redirect("/api/auth/guest");
  }

  const id = generateUUID();

  const cookieStore = await cookies();
  const modelIdFromCookie = cookieStore.get("chat-model");
  const agentModeFromCookie = cookieStore.get("agent-mode");
  const validAgentModes: AgentMode[] = ["project", "finance", "email"];
  const initialAgentMode: AgentMode = validAgentModes.includes(
    agentModeFromCookie?.value as AgentMode
  )
    ? (agentModeFromCookie?.value as AgentMode)
    : DEFAULT_AGENT_MODE;

  // Validate model ID from cookie - use default if invalid
  const validModelIds = chatModels.map((m) => m.id);
  const initialChatModel =
    modelIdFromCookie?.value && validModelIds.includes(modelIdFromCookie.value)
      ? modelIdFromCookie.value
      : DEFAULT_CHAT_MODEL;

  return (
    <>
      <Chat
        autoResume={false}
        id={id}
        initialAgentMode={initialAgentMode}
        initialChatModel={initialChatModel}
        initialMessages={[]}
        initialVisibilityType="private"
        isReadonly={false}
        key={id}
      />
      <DataStreamHandler />
    </>
  );
}
