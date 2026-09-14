import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, title, description, children }: DialogProps) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/25 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onOpenChange(false);
          }}
          role="presentation"
        >
          <motion.section
            aria-labelledby="dialog-title"
            aria-modal="true"
            className="w-full max-w-lg rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 6 }}
            transition={{ duration: 0.16 }}
            role="dialog"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="dialog-title" className="text-lg font-semibold text-[var(--text)]">{title}</h2>
                {description ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{description}</p> : null}
              </div>
              <Button aria-label="关闭对话框" variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
                <X className="size-4" />
              </Button>
            </div>
            {children}
          </motion.section>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
