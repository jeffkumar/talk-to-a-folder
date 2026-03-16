import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { FilesHeader } from "@/components/files-header";
import { FilesViewer } from "@/components/files-viewer";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <FilesPage />
    </Suspense>
  );
}

async function FilesPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/guest?redirectUrl=/files");
  }

  return (
    <>
      <FilesHeader />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="space-y-1">
          <h1 className="font-semibold text-xl">Files</h1>
          <p className="text-muted-foreground text-sm">
            Browse project documents and manage context visibility.
          </p>
        </div>

        <div className="mt-6">
          <FilesViewer />
        </div>
      </div>
    </>
  );
}
