"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { WaitlistForm } from "@/components/waitlist-form";
import { type RequestWaitlistActionState, requestWaitlist } from "../actions";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<
    RequestWaitlistActionState,
    FormData
  >(requestWaitlist, {
    status: "idle",
  });

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "already_exists") {
      toast({
        type: "error",
        description: "A request with this email already exists!",
      });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: "Failed to submit waitlist request!",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description:
          "Failed validating your submission! Please check all required fields are filled.",
      });
    } else if (state.status === "waitlisted") {
      setIsSuccessful(true);
      // Redirect to waitlist status page for pilot-full users
      setTimeout(() => {
        router.push("/waitlist-status");
      }, 500);
    } else if (state.status === "success") {
      setIsSuccessful(true);
      toast({
        type: "success",
        description: "Account created successfully!",
      });
      // Small delay to show success message before redirect
      setTimeout(() => {
        updateSession();
        router.push("/");
      }, 500);
    }
  }, [state.status, router]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <div className="flex min-h-dvh w-screen flex-col items-center justify-between bg-auth-charcoal py-12 md:py-0">
      <div className="flex w-full flex-1 items-start justify-center md:items-center">
        <div className="flex h-full max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background md:max-h-[85vh]">
          <div className="flex shrink-0 flex-col items-center justify-center gap-2 border-border border-b px-4 py-6 text-center sm:px-16">
            <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-900 dark:bg-zinc-800">
              <Image
                alt="Flowchat Logo"
                height={40}
                src="/af-logo.svg"
                unoptimized
                width={40}
              />
            </div>
            <h1 className="font-semibold text-2xl text-brand">Flowchat</h1>
            <p className="text-muted-foreground text-sm">
              Build and deploy agentic workflows
            </p>
            <p className="mt-2 text-muted-foreground text-xs">
              Built especially for construction and renewable energy projects.
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <WaitlistForm action={handleSubmit} defaultEmail={email}>
              <SubmitButton isSuccessful={isSuccessful}>
                Request Access
              </SubmitButton>
              <p className="mt-4 text-center text-muted-foreground text-sm">
                {"Already have an account? "}
                <Link
                  className="font-semibold text-brand hover:underline"
                  href="/login"
                >
                  Sign in
                </Link>
                {" instead."}
              </p>
            </WaitlistForm>
          </div>
        </div>
      </div>
      <footer className="w-full py-6 text-center">
        <div className="flex items-center justify-center gap-6 text-muted-foreground text-sm">
          <Link
            className="transition-colors hover:text-foreground"
            href="/privacy"
          >
            Privacy Policy
          </Link>
          <span className="text-border">•</span>
          <Link
            className="transition-colors hover:text-foreground"
            href="/terms"
          >
            Terms of Service
          </Link>
          <span className="text-border">•</span>
          <a
            className="transition-colors hover:text-foreground"
            href="mailto:jeff@adventureflow.ai"
          >
            Contact
          </a>
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          © 2026 Adventure Flow AI. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
