"use client";

import Link from "next/link";

export default function Page() {
  return (
    <div className="flex h-dvh w-screen items-start justify-center bg-auth-charcoal py-12 md:items-center md:py-0">
      <div className="flex w-full max-w-md flex-col gap-8 overflow-hidden rounded-2xl border border-border bg-background py-10">
        <div className="flex flex-col items-center justify-center gap-4 px-4 text-center sm:px-16">
          <h1 className="font-semibold text-2xl text-brand">Flow Chat</h1>
          <p className="text-muted-foreground text-sm">
            Build and deploy agents with the right context
          </p>
        </div>

        <div className="flex flex-col gap-4 px-4 sm:px-16">
          <div className="flex flex-col gap-2 text-center">
            <h2 className="font-semibold text-lg">
              You&apos;re on the Waitlist
            </h2>
            <p className="text-muted-foreground text-sm">
              Thank you for your interest in Flow Chat! Our pilot program is
              currently full with the first 50 users.
            </p>
            <p className="mt-2 text-muted-foreground text-sm">
              We&apos;ve saved your information and will notify you when a spot
              opens up.
            </p>
            <div className="mt-4 rounded-lg border border-border bg-muted/50 p-4">
              <p className="font-medium text-sm">Want to get started sooner?</p>
              <p className="mt-1 text-muted-foreground text-sm">
                Contact us at{" "}
                <a
                  className="font-medium text-brand hover:underline"
                  href="mailto:jeffkumar.aw@gmail.com?subject=Flow Chat Pro Plan Inquiry"
                >
                  jeffkumar.aw@gmail.com
                </a>{" "}
                to activate your account or learn about our Pro plan.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <Link
              className="flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2 font-medium text-sm hover:bg-accent"
              href="/login"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
