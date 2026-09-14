import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <section className="content-card flex min-h-72 flex-col items-center justify-center px-6 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-[var(--surface-muted)] text-[var(--accent)]"><Icon className="size-5" /></span>
      <h3 className="mt-5 font-semibold text-[var(--text)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
      {actionLabel ? <Button className="mt-5" onClick={onAction}>{actionLabel}</Button> : null}
    </section>
  );
}
