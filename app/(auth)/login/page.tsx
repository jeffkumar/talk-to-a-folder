"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/auth-form";
import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    {
      status: "idle",
    }
  );

  const { update: updateSession } = useSession();

  // biome-ignore lint/correctness/useExhaustiveDependencies: router and updateSession are stable refs
  useEffect(() => {
    if (state.status === "failed") {
      toast({
        type: "error",
        description: "Invalid credentials!",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Failed validating your submission!",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      updateSession();
      router.refresh();
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <div className="flex min-h-dvh w-screen flex-col items-center justify-between bg-auth-charcoal py-12 md:py-0">
      <div className="flex w-full flex-1 items-start justify-center md:items-center">
        <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl border border-border bg-background py-10">
          <div className="flex flex-col items-center justify-center gap-2 px-4 text-center sm:px-16">
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
              Build and deploy agentic workflows.
            </p>
            <p className="mt-2 text-muted-foreground text-xs">
              Built especially for construction and renewable energy projects.
            </p>
          </div>
          <AuthForm action={handleSubmit} defaultEmail={email}>
            <SubmitButton isSuccessful={isSuccessful}>Continue</SubmitButton>
            <div className="mt-2 text-center">
              <Link
                className="text-muted-foreground text-sm hover:text-foreground hover:underline"
                href="/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
            <p className="mt-2 text-center text-muted-foreground text-sm">
              {"Don't have an account? "}
              <Link
                className="font-semibold text-brand hover:underline"
                href="/register"
              >
                Sign up
              </Link>
              {" for free."}
            </p>
          </AuthForm>
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
