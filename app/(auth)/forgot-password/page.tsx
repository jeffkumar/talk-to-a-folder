"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";

import { SubmitButton } from "@/components/submit-button";
import { toast } from "@/components/toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type RequestPasswordResetActionState,
  requestPasswordReset,
} from "../actions";

export default function Page() {
  const [isSuccessful, setIsSuccessful] = useState(false);

  const [state, formAction] = useActionState<
    RequestPasswordResetActionState,
    FormData
  >(requestPasswordReset, { status: "idle" });

  useEffect(() => {
    if (state.status === "success") {
      setIsSuccessful(true);
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: "Please enter a valid email address.",
      });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: "Something went wrong. Please try again.",
      });
    }
  }, [state.status]);

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
            <h1 className="font-semibold text-2xl text-brand">
              Reset Password
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter your email and we&apos;ll send you a reset link.
            </p>
          </div>

          {isSuccessful ? (
            <div className="flex flex-col gap-4 px-4 text-center sm:px-16">
              <p className="text-foreground text-sm">
                If an account exists with that email, you&apos;ll receive a
                password reset link shortly.
              </p>
              <Link
                className="font-semibold text-brand text-sm hover:underline"
                href="/login"
              >
                Back to login
              </Link>
            </div>
          ) : (
            <Form
              action={formAction}
              className="flex flex-col gap-4 px-4 sm:px-16"
            >
              <div className="flex flex-col gap-2">
                <Label
                  className="font-normal text-muted-foreground"
                  htmlFor="email"
                >
                  Email Address
                </Label>
                <Input
                  autoComplete="email"
                  autoFocus
                  className="bg-muted text-md md:text-sm"
                  id="email"
                  name="email"
                  placeholder="user@acme.com"
                  required
                  type="email"
                />
              </div>

              <SubmitButton isSuccessful={isSuccessful}>
                Send Reset Link
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
