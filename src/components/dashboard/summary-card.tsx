import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { motion } from "motion/react";

interface SummaryCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: "primary" | "success" | "danger" | "neutral";
  prominent?: boolean;
}

export function SummaryCard({ label, value, detail, icon: Icon, tone, prominent = false }: SummaryCardProps) {
  return (
    <motion.section className={`summary-card ${prominent ? "summary-card-prominent" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[var(--text-secondary)]">{label}</p>
        <span className={`icon-badge icon-badge-${tone}`}><Icon className="size-4" /></span>
      </div>
      <p className={`mt-7 font-semibold tracking-[-0.04em] ${prominent ? "text-4xl" : "text-2xl"}`}>{value}</p>
      <p className="mt-3 flex items-center gap-1 text-xs text-[var(--text-secondary)]"><ArrowUpRight className="size-3.5 text-[var(--success)]" />{detail}</p>
    </motion.section>
  );
}
