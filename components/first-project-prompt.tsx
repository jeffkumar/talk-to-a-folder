"use client";

import { Folder, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjectSelector } from "@/hooks/use-project-selector";

export function FirstProjectPrompt() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { mutate, setSelectedProjectId } = useProjectSelector();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const data = await response.json();
      setSelectedProjectId(data.project.id);
      // Use optimistic update to immediately add the new project to the cache
      await mutate(
        (current) => ({
          projects: [
            ...(current?.projects ?? []),
            { ...data.project, role: "owner" },
          ],
        }),
        { revalidate: true }
      );
      toast.success("Project created! Let's get started.");
      router.refresh();
    } catch (_error) {
      toast.error("Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex h-dvh w-full items-center justify-center bg-background dark:bg-auth-charcoal">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-lg">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
            <Folder className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="font-semibold text-xl">Create a project</h2>
          <p className="mt-2 text-muted-foreground text-sm">
            Projects help you organize your chats and documents. Give your
            project a name to get started.
          </p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="project-name">Project Name</Label>
            <Input
              autoFocus
              disabled={isSubmitting}
              id="project-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Personal, Work, Research..."
              value={name}
            />
          </div>

          <Button
            className="w-full"
            disabled={isSubmitting || !name.trim()}
            type="submit"
          >
            {isSubmitting ? (
              "Creating..."
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Create Project
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
