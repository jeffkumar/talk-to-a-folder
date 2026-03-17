"use client";

import { CheckCircle2, Clock, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { fetcher } from "@/lib/utils";

type ProjectMemberRow =
  | {
      kind: "user";
      userId: string;
      email: string;
      role: "owner" | "admin" | "member";
      status: "active";
    }
  | {
      kind: "invite";
      email: string;
      role: "admin" | "member";
      status: "pending";
    };

type MembersResponse = {
  members: ProjectMemberRow[];
  currentUserRole?: "owner" | "admin" | "member";
};

export function ShareProjectDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { projects } = useProjectSelector();
  const project = useMemo(
    () => projects.find((p) => p.id === projectId),
    [projects, projectId]
  );
  const projectName = project?.name ?? "";

  const { data, mutate, isLoading } = useSWR<MembersResponse>(
    open ? `/api/projects/${projectId}/members` : null,
    fetcher
  );

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const currentUserRole = data?.currentUserRole ?? null;
  const canManageMembers =
    currentUserRole === "owner" || currentUserRole === "admin";

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const invite = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: trimmed, role }),
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error || "Failed to invite");
      }

      toast.success("Invite sent");
      setEmail("");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateRole = async (
    member: ProjectMemberRow,
    nextRole: "admin" | "member"
  ) => {
    if (member.kind === "user" && member.role === "owner") {
      return;
    }

    const memberId = member.kind === "user" ? member.userId : member.email;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${encodeURIComponent(memberId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role: nextRole }),
        }
      );

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error || "Failed to update role");
      }

      toast.success("Role updated");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const remove = async (member: ProjectMemberRow) => {
    if (member.kind === "user" && member.role === "owner") {
      return;
    }

    const memberId = member.kind === "user" ? member.userId : member.email;
    try {
      const res = await fetch(
        `/api/projects/${projectId}/members/${encodeURIComponent(memberId)}`,
        { method: "DELETE" }
      );

      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(json?.error || "Failed to remove");
      }

      toast.success(
        member.kind === "invite" ? "Invite removed" : "Member removed"
      );
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Share Project
            {projectName && (
              <Badge className="project-name-badge border" variant="secondary">
                {projectName}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Invite your team members by email.
          </DialogDescription>
        </DialogHeader>

        {canManageMembers && (
          <div className="flex gap-2">
            <Input
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              value={email}
            />
            <Select
              onValueChange={(v) => setRole(v as "admin" | "member")}
              value={role}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button
              disabled={isSubmitting || !email.trim()}
              onClick={invite}
              type="button"
            >
              Invite
            </Button>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="text-muted-foreground text-sm">
              Loading members…
            </div>
          ) : members.length === 0 ? (
            <div className="text-muted-foreground text-sm">No members yet.</div>
          ) : (
            members.map((m) => {
              const key = m.kind === "user" ? m.userId : `invite:${m.email}`;
              const roleValue = m.kind === "user" ? m.role : m.role;
              const statusLabel = m.status === "active" ? "Active" : "Pending";
              const StatusIcon = m.status === "active" ? CheckCircle2 : Clock;

              return (
                <div
                  className="flex items-center justify-between gap-3 text-sm"
                  key={key}
                >
                  <div className="min-w-0">
                    <div className="truncate">{m.email}</div>
                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                      <StatusIcon
                        className={
                          m.status === "active"
                            ? "h-4 w-4 text-brand"
                            : "h-4 w-4"
                        }
                      />
                      <span>{statusLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {canManageMembers ? (
                      <Select
                        disabled={m.kind === "user" && m.role === "owner"}
                        onValueChange={(v) =>
                          updateRole(m, v as "admin" | "member")
                        }
                        value={roleValue}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {m.kind === "user" && m.role === "owner" && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="w-[140px] text-sm capitalize">
                        {roleValue}
                      </span>
                    )}

                    {canManageMembers && (
                      <Button
                        disabled={m.kind === "user" && m.role === "owner"}
                        onClick={() => remove(m)}
                        size="icon"
                        title={
                          m.kind === "invite"
                            ? "Remove invite"
                            : "Remove member"
                        }
                        type="button"
                        variant="outline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter />
      </DialogContent>
    </Dialog>
  );
}
