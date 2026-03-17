"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong.");
        return;
      }
      toast.success("Message sent. We'll be in touch soon.");
      setName("");
      setEmail("");
      setMessage("");
    } catch {
      toast.error("Failed to send. Try emailing us directly.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="mb-2 font-bold text-2xl text-foreground md:text-3xl">
        Get in touch
      </h1>
      <p className="mb-8 text-muted-foreground">
        Ask for guidance or tell us about your project. We&apos;ll respond
        shortly.
      </p>
      <form
        aria-label="Contact form"
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        <div className="space-y-2">
          <Label htmlFor="contact-name">Name</Label>
          <Input
            disabled={isSubmitting}
            id="contact-name"
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            type="text"
            value={name}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            disabled={isSubmitting}
            id="contact-email"
            maxLength={320}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            type="email"
            value={email}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-message">Message</Label>
          <Textarea
            className="resize-none"
            disabled={isSubmitting}
            id="contact-message"
            maxLength={5000}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="How can we help?"
            required
            rows={4}
            value={message}
          />
        </div>
        <Button
          className="landing-cta-primary w-full sm:w-auto"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Sending…" : "Send message"}
        </Button>
      </form>
      <p className="mt-6 text-muted-foreground text-sm">
        Prefer email?{" "}
        <a
          className="font-medium text-foreground underline hover:no-underline"
          href="mailto:jeff@adventureflow.ai"
        >
          jeff@adventureflow.ai
        </a>
      </p>
      <p className="mt-4">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
