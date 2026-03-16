import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { ProjectFilesHeader } from "@/components/project-files-header";
import { TasksViewer } from "@/components/tasks-viewer";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <TasksPage />
    </Suspense>
  );
}

async function TasksPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/guest?redirectUrl=/project-files/tasks");
  }

  return (
    <>
      <ProjectFilesHeader />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="space-y-1">
          <h1 className="font-semibold text-xl">Tasks</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage tasks for your project. Generate tasks from meeting
            transcripts or other documents.
          </p>
        </div>

        <div className="mt-6">
          <TasksViewer />
        </div>
      </div>
    </>
  );
}
