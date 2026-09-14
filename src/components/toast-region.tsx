import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useUiStore } from "@/stores/ui-store";

export function ToastRegion() {
  const message = useUiStore((state) => state.toastMessage);
  const clearToast = useUiStore((state) => state.clearToast);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(clearToast, 3600);
    return () => window.clearTimeout(timeout);
  }, [clearToast, message]);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 right-5 z-[60]">
      <AnimatePresence>
        {message ? (
          <motion.div className="flex max-w-sm items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] shadow-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
            <CheckCircle2 className="size-4 shrink-0 text-[var(--success)]" />
            {message}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
