import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { EditableDoc } from "@/components/editable-doc";

export default function Page({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh items-center justify-center">Loading...</div>
      }
    >
      <EditableDocPage params={params} />
    </Suspense>
  );
}

async function EditableDocPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  const session = await auth();
  if (!session) {
    const { docId } = await params;
    redirect(`/api/auth/guest?redirectUrl=/files/docs/${docId}`);
  }

  const { docId } = await params;

  return <EditableDoc docId={docId} />;
}
