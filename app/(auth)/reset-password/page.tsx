"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type ResetPasswordActionState, resetPassword } from "../actions";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<
    ResetPasswordActionState,
    FormData
  >(resetPassword, { status: "idle" });

  // biome-ignore lint/correctness/useExhaustiveDependencies: router is a stable ref
  useEffect(() => {
    if (state.status === "success") {
      setIsSuccessful(true);
      toast({
        type: "success",
        description: "Password reset successfully. Redirecting to login...",
      });
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } else if (state.status === "invalid_token") {
      toast({
        type: "error",
        description: "This reset link is invalid or has expired.",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Password must be at least 6 characters.",
      });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      toast({
        type: "error",
        description: "Passwords do not match.",
      });
      return;
    }

    formData.append("token", token ?? "");
    formAction(formData);
  };

  if (!token) {
    return (
      <div className="flex w-full max-w-md flex-col gap-12 overflow-hidden rounded-2xl border border-border bg-background py-10">
        <div className="flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-16">
          <h1 className="font-semibold text-2xl text-brand">Invalid Link</h1>
          <p className="text-muted-foreground text-sm">
            This password reset link is invalid. Please request a new one.
          </p>
          <Link
            className="font-semibold text-brand text-sm hover:underline"
            href="/forgot-password"
          >
            Request new reset link
          </Link>
        </div>
      </div>
    );
  }

  return (
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
        <h1 className="font-semibold text-2xl text-brand">Set New Password</h1>
        <p className="text-muted-foreground text-sm">
          Enter your new password below.
        </p>
      </div>

      {isSuccessful ? (
        <div className="flex flex-col gap-4 px-4 text-center sm:px-16">
          <p className="text-foreground text-sm">
            Your password has been reset. Redirecting to login...
          </p>
        </div>
      ) : (
        <Form
          action={handleSubmit}
          className="flex flex-col gap-4 px-4 sm:px-16"
        >
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-muted-foreground"
              htmlFor="password"
            >
              New Password
            </Label>
            <Input
              autoFocus
              className="bg-muted text-md md:text-sm"
              id="password"
              minLength={6}
              name="password"
              required
              type="password"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-muted-foreground"
              htmlFor="confirmPassword"
            >
              Confirm Password
            </Label>
            <Input
              className="bg-muted text-md md:text-sm"
              id="confirmPassword"
              minLength={6}
              name="confirmPassword"
              required
              type="password"
            />
          </div>

          <SubmitButton isSuccessful={isSuccessful}>
            Reset Password
          </SubmitButton>

          <p className="mt-4 text-center text-muted-foreground text-sm">
            <Link
              className="font-semibold text-brand hover:underline"
              href="/login"
            >
              Back to login
            </Link>
          </p>
        </Form>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex min-h-dvh w-screen flex-col items-center justify-between bg-auth-charcoal py-12 md:py-0">
      <div className="flex w-full flex-1 items-start justify-center md:items-center">
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
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
