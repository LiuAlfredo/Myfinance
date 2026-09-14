import { motion } from "motion/react";
import type { ReactNode } from "react";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}

export function PageHero({ eyebrow, title, description, action }: PageHeroProps) {
  return (
    <motion.div className="mb-7 flex flex-wrap items-end justify-between gap-4" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
      <div>
        {eyebrow ? <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{eyebrow}</p> : null}
        <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text)] md:text-[28px]">{title}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
      </div>
      {action}
    </motion.div>
  );
}
