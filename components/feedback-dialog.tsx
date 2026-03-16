"use client";

import { Bug, Lightbulb, LoaderIcon, MessageSquareWarning } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type FeedbackType = "bug" | "feature";

export function FeedbackDialog({
  onOpenMobileClose,
  trigger,
}: {
  onOpenMobileClose?: () => void;
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.message || error.cause || "Failed to submit feedback"
        );
      }

      toast.success(
        type === "bug"
          ? "Bug report submitted. Thank you!"
          : "Feature request submitted. Thank you!"
      );

      setOpen(false);
      setType("feature");
      setTitle("");
      setDescription("");
      onOpenMobileClose?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to submit feedback"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultTrigger = (
    <SidebarMenuItem>
      <DialogTrigger asChild>
        <SidebarMenuButton>
          <MessageSquareWarning className="h-4 w-4" />
          <span>Send Feedback</span>
        </SidebarMenuButton>
      </DialogTrigger>
    </SidebarMenuItem>
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        defaultTrigger
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug or request a new feature. We appreciate your feedback!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex gap-2">
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors",
                  type === "feature"
                    ? "feedback-type-feature-selected"
                    : "border-border bg-background hover:bg-accent"
                )}
                onClick={() => setType("feature")}
                type="button"
              >
                <Lightbulb className="h-4 w-4" />
                <span className="font-medium text-sm">Feature Request</span>
              </button>
              <button
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg border p-3 transition-colors",
                  type === "bug"
                    ? "feedback-type-bug-selected"
                    : "border-border bg-background hover:bg-accent"
                )}
                onClick={() => setType("bug")}
                type="button"
              >
                <Bug className="h-4 w-4" />
                <span className="font-medium text-sm">Bug Report</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-title">Title</Label>
            <Input
              id="feedback-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "bug"
                  ? "Brief description of the issue..."
                  : "What feature would you like?"
              }
              value={title}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedback-description">Description</Label>
            <Textarea
              id="feedback-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                type === "bug"
                  ? "Please describe what happened and how to reproduce it..."
                  : "Describe your idea in detail..."
              }
              rows={4}
              value={description}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={isSubmitting}
            onClick={() => setOpen(false)}
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || !description.trim() || isSubmitting}
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <>
                <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
