import { motion, useReducedMotion } from "motion/react";
import { dayKey } from "./calendar-utils";
import type { PrivateCalendarDayMark } from "./types";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthCalendar({ month, marks, selectedDay, onSelect, direction }: {
  month: Date; marks: PrivateCalendarDayMark[]; selectedDay: string; onSelect: (day: string) => void; direction: number;
}) {
  const reducedMotion = useReducedMotion();
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const counts = new Map(marks.map((mark) => [mark.dayKey, mark.count]));
  const today = dayKey(new Date());
  return (
    <div className="mt-5 overflow-hidden">
      <div className="grid grid-cols-7">{weekdays.map((weekday) => <span key={weekday} className="py-2 text-center text-xs font-semibold text-[var(--text-tertiary)]">{weekday}</span>)}</div>
      <motion.div key={`${year}-${monthIndex}`} className="grid grid-cols-7 gap-1.5"
        initial={reducedMotion ? false : { opacity: 0, x: direction * 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.16 }}>
        {Array.from({ length: 42 }, (_, index) => {
          const date = new Date(year, monthIndex, index - firstWeekday + 1);
          const key = dayKey(date);
          const count = counts.get(key) ?? 0;
          const outside = date.getMonth() !== monthIndex;
          return (
            <motion.button type="button" key={key} aria-label={`${key}${count ? `，${count}条记录` : ""}`}
              aria-pressed={key === selectedDay} aria-current={key === today ? "date" : undefined}
              disabled={date.getFullYear() < 1900 || date.getFullYear() > 9999}
              whileTap={reducedMotion ? undefined : { scale: 0.95 }}
              className={`private-calendar-day ${outside ? "private-calendar-day-outside" : ""} ${count ? "private-calendar-day-marked" : ""} ${key === selectedDay ? "private-calendar-day-selected" : ""}`}
              onClick={() => onSelect(key)}>
              <span>{date.getDate()}</span>
              {key === today ? <span className="private-calendar-today">今天</span> : null}
              {count ? <span className="private-calendar-count">{count}</span> : null}
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
