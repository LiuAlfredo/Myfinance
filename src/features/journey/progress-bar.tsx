import { motion, useReducedMotion } from "motion/react";

export function JourneyProgress({ value, color = "var(--accent)", compact = false }: { value: number; color?: string; compact?: boolean }) {
  const reduced = useReducedMotion();
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className={`journey-progress ${compact ? "journey-progress-compact" : ""}`} aria-label={`完成度 ${safe}%`}>
      <motion.span
        className="journey-progress-fill"
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${safe}%` }}
        transition={{ duration: reduced ? 0 : 0.75, ease: [0.22, 1, 0.36, 1] }}
        style={{ backgroundColor: color }}
      >
        {!reduced && safe > 8 ? <span className="journey-progress-shimmer" /> : null}
      </motion.span>
    </div>
  );
}
