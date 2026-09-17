import { Clock3, MapPin, Pencil, Trash2, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import type { PrivateCalendarEvent } from "./types";

export function DayRecords({ selectedDay, events, loading, error, hidden, onRetry, onEdit, onDelete }: {
  selectedDay: string; events: PrivateCalendarEvent[]; loading: boolean; error: string | null; hidden: boolean;
  onRetry: () => void; onEdit: (event: PrivateCalendarEvent) => void; onDelete: (event: PrivateCalendarEvent) => void;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div key={`${selectedDay}:${hidden}`} className="mt-5 min-h-48 space-y-3" initial={reducedMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }} aria-busy={loading}>
      {hidden ? <Message>隐私模式已隐藏记录和统计</Message> : loading ? <Message>正在读取当天记录…</Message> : error ? <div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{error}<Button variant="ghost" size="sm" onClick={onRetry}>重试</Button></div> : events.length ? events.map((event) => (
        <article key={event.id} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 break-all font-medium text-[var(--text)]"><UserRound className="size-4 shrink-0 text-[var(--accent)]" />{event.personName}</p>
              <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                <p className="flex items-center gap-2"><Clock3 className="size-3.5 shrink-0" />{new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                {event.location ? <p className="flex items-start gap-2 break-all"><MapPin className="mt-0.5 size-3.5 shrink-0" />{event.location}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button aria-label="编辑记录" size="icon" variant="ghost" onClick={() => onEdit(event)}><Pencil className="size-4" /></Button>
              <Button aria-label="删除记录" size="icon" variant="ghost" onClick={() => onDelete(event)}><Trash2 className="size-4 text-[var(--danger)]" /></Button>
            </div>
          </div>
          {event.note ? <p className="mt-3 whitespace-pre-wrap break-words border-t border-[var(--border)] pt-3 text-sm leading-6 text-[var(--text-secondary)]">{event.note}</p> : null}
        </article>
      )) : <Message>当天暂无记录，可点击“添加”补记。</Message>}
    </motion.div>
  );
}

function Message({ children }: { children: string }) {
  return <p role="status" className="rounded-xl bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-secondary)]">{children}</p>;
}
