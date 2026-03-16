import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { GoogleIntegrationCard } from "@/components/integrations/google-integration-card";
import { IntegrationsHeader } from "@/components/integrations/integrations-header";
import { MicrosoftIntegrationCard } from "@/components/integrations/microsoft-integration-card";
import { ENABLE_MICROSOFT_INTEGRATION } from "@/lib/constants";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-dvh" />}>
      <IntegrationsPage />
    </Suspense>
  );
}

async function IntegrationsPage() {
  const session = await auth();
  if (!session) {
    redirect("/api/auth/guest?redirectUrl=/integrations");
  }

  return (
    <>
      <IntegrationsHeader />
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="space-y-1">
          <h1 className="font-semibold text-xl">Integrations</h1>
          <p className="text-muted-foreground text-sm">
            Connect external document sources and import files into your
            projects.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <GoogleIntegrationCard />
          {ENABLE_MICROSOFT_INTEGRATION && <MicrosoftIntegrationCard />}
        </div>
      </div>
    </>
  );
}
