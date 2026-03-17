"use client";

import { FileText, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ProjectSwitcher } from "@/components/project-switcher";
import { ShareProjectDialog } from "@/components/share-project-dialog";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { cn } from "@/lib/utils";

const TABS = [{ href: "/files", label: "Files", icon: FileText }] as const;

export function ProjectFilesHeader() {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const { selectedProjectId } = useProjectSelector();
  const _pathname = usePathname();

  // Determine active tab
  const getActiveTab = () => {
    return "/files";
  };

  const activeTab = getActiveTab();

  return (
    <>
      <header className="sticky top-0 z-10 flex flex-col border-border border-b bg-background">
        <div className="flex items-center gap-2 px-2 py-1.5 md:px-2">
          <SidebarToggle />
          <ProjectSwitcher />
          <div className="ml-auto flex items-center gap-1">
            <Button
              disabled={!selectedProjectId}
              onClick={() => setIsShareOpen(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-1 px-2 pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.href;

            return (
              <Link
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                href={tab.href}
                key={tab.href}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {selectedProjectId && (
        <ShareProjectDialog
          onOpenChange={setIsShareOpen}
          open={isShareOpen}
          projectId={selectedProjectId}
        />
      )}
    </>
  );
}
