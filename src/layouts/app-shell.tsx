import type { ReactNode } from "react";
import { AppDialogs } from "@/components/app-dialogs";
import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { ToastRegion } from "@/components/toast-region";
import { useAppShortcuts } from "@/hooks/use-app-shortcuts";

export function AppShell({ children }: { children: ReactNode }) {
  useAppShortcuts();

  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">{children}</main>
      </div>
      <AppDialogs />
      <ToastRegion />
    </div>
  );
}
