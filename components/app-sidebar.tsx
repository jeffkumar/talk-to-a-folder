"use client";

import {
  FileText,
  MessageSquarePlus,
  Plug2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { SidebarHistory } from "@/components/sidebar-history";
import { SidebarUserNav } from "@/components/sidebar-user-nav";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useProjectSelector } from "@/hooks/use-project-selector";
import { cn } from "@/lib/utils";

export function AppSidebar({ user }: { user: User | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const { selectedProjectId } = useProjectSelector();
  const { resolvedTheme } = useTheme();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const shouldInvertSidebar = hasMounted && resolvedTheme === "light";

  return (
    <>
      <Sidebar
        className={cn(
          "group-data-[side=left]:border-r-0",
          shouldInvertSidebar && "sidebar-inverted"
        )}
      >
        <SidebarHeader>
          <SidebarMenu>
            <div className="flex flex-row items-center justify-between">
              <Link
                className="flex flex-row items-center gap-3"
                href="/"
                onClick={() => {
                  setOpenMobile(false);
                }}
              >
                <span className="cursor-pointer rounded-md px-2 font-semibold text-lg hover:bg-muted">
                  Flowchat
                </span>
              </Link>
            </div>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <div className="px-2 pt-2 pb-1">
            <Button
              className="new-chat-button w-full justify-start gap-2 border-2 shadow-sm transition-shadow hover:shadow-md"
              onClick={() => {
                router.push("/chat");
                setOpenMobile(false);
              }}
              variant="outline"
            >
              <MessageSquarePlus className="h-4 w-4" />
              New Chat
            </Button>
          </div>
          <div className="px-2 py-2">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link
                    href="/integrations"
                    onClick={() => setOpenMobile(false)}
                  >
                    <Plug2 className="h-4 w-4" />
                    <span>Integrations</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <Link href="/files" onClick={() => setOpenMobile(false)}>
                    <FileText className="h-4 w-4" />
                    <span>Files</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
          <SidebarHistory user={user} />
        </SidebarContent>
        <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
      </Sidebar>
    </>
  );
}
