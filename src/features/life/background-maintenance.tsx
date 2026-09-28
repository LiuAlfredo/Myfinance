import { useUiStore } from "@/stores/ui-store";
import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { flushAllNotes } from "./note-save-queue";
import { automaticBackup, workspaceCall } from "./workspace-service";

export function BackgroundMaintenance() {
  const toast = useUiStore((s) => s.showToast);
  const authenticated = useAuthStore((s) => s.isAuthenticated);
  useEffect(() => {
    if (!authenticated || !("__TAURI_INTERNALS__" in window)) return;
    let active = true,
      running = false,
      lastError = "";
    const run = async () => {
      if (!active || running) return;
      running = true;
      try {
        const results = await Promise.allSettled([
          (async () => {
            await flushAllNotes();
            await automaticBackup();
          })(),
          workspaceCall("generate_routine_tasks"),
        ]);
        const failed = results.filter((r) => r.status === "rejected");
        const error = failed
          .map((r) => (r.status === "rejected" ? String(r.reason) : ""))
          .join("；");
        if (error && error !== lastError && active)
          toast(`自动维护未完成：${error}`);
        lastError = error;
        window.dispatchEvent(new Event("life-data-changed"));
      } finally {
        running = false;
      }
    };
    void run();
    const timer = setInterval(() => void run(), 300000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [authenticated, toast]);
  return null;
}
