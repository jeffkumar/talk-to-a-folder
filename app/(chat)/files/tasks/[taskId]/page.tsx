import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { TaskEditor } from "@/components/task-editor";

export default function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">Loading...</div>
      }
    >
      <TaskEditorPage params={params} />
    </Suspense>
  );
}

async function TaskEditorPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await auth();
  if (!session) {
    const { taskId } = await params;
    redirect(`/api/auth/guest?redirectUrl=/files/tasks/${taskId}`);
  }

  const { taskId } = await params;

  return <TaskEditor taskId={taskId} />;
}
