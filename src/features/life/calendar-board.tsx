import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { listEvents, localDay, type DailyEvent } from "./life-service";
type CalendarMode = "MONTH" | "WEEK" | "DAY";
function dayRange(day: Date, mode: CalendarMode) {
  const start = new Date(
    day.getFullYear(),
    day.getMonth(),
    mode === "MONTH" ? 1 : day.getDate(),
  );
  if (mode !== "DAY")
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(
    end.getDate() + (mode === "MONTH" ? 42 : mode === "WEEK" ? 7 : 1),
  );
  return { start, end };
}
export function CalendarBoard({
  month,
  onMonth,
  onEdit,
  onNew,
}: {
  month: string;
  onMonth: (month: string) => void;
  onEdit: (event: DailyEvent) => void;
  onNew: (day: string) => void;
}) {
  const [mode, setMode] = useState<CalendarMode>("MONTH"),
    [day, setDay] = useState(() => localDay()),
    [events, setEvents] = useState<DailyEvent[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false),
    version = useRef(0);
  const selected = new Date(`${day}T00:00:00`),
    { start, end } = dayRange(selected, mode);
  useEffect(() => {
    if (day.slice(0, 7) !== month) setDay(`${month}-01`);
  }, [month, day]);
  const from = localDay(start),
    to = localDay(new Date(end.getTime() - 1));
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    try {
      const rows = await listEvents(
        from,
        to,
        new Date(`${from}T00:00:00`).getTime(),
        new Date(`${to}T00:00:00`).setDate(
          new Date(`${to}T00:00:00`).getDate() + 1,
        ),
      );
      if (request === version.current) {
        setEvents(rows);
        setError("");
      }
    } catch (e) {
      if (request === version.current) setError(String(e));
    } finally {
      if (request === version.current) setLoading(false);
    }
  }, [from, to]);
  useEffect(() => {
    const requestVersion = version;
    void load();
    const refresh = () => void load();
    window.addEventListener("life-data-changed", refresh);
    return () => {
      requestVersion.current++;
      window.removeEventListener("life-data-changed", refresh);
    };
  }, [load]);
  const select = (value: string) => {
    setDay(value);
    onMonth(value.slice(0, 7));
  };
  const move = (direction: number) => {
    const d = new Date(`${day}T00:00:00`);
    if (mode === "MONTH") {
      d.setDate(1);
      d.setMonth(d.getMonth() + direction);
    } else d.setDate(d.getDate() + direction * (mode === "WEEK" ? 7 : 1));
    select(localDay(d));
  };
  const days = Array.from(
    { length: mode === "MONTH" ? 42 : mode === "WEEK" ? 7 : 1 },
    (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    },
  );
  return (
    <section className="content-card mt-5">
      <div className="mb-4 flex flex-wrap gap-2">
        <Button variant="ghost" onClick={() => move(-1)}>
          上一{mode === "MONTH" ? "月" : mode === "WEEK" ? "周" : "天"}
        </Button>
        <Button variant="ghost" onClick={() => select(localDay())}>
          今天
        </Button>
        <Button variant="ghost" onClick={() => move(1)}>
          下一{mode === "MONTH" ? "月" : mode === "WEEK" ? "周" : "天"}
        </Button>
        <input
          aria-label="日程日期"
          type="date"
          min="1900-01-01"
          className="form-control w-auto"
          value={day}
          onChange={(e) => {
            if (e.target.value) select(e.target.value);
          }}
        />
        {(["MONTH", "WEEK", "DAY"] as CalendarMode[]).map((m) => (
          <Button
            key={m}
            variant={mode === m ? "secondary" : "ghost"}
            onClick={() => setMode(m)}
          >
            {m === "MONTH" ? "月" : m === "WEEK" ? "周" : "日"}
          </Button>
        ))}
      </div>
      {error && (
        <div role="alert">
          {error}
          <Button onClick={() => void load()}>重试</Button>
        </div>
      )}
      {loading && <p className="text-sm">读取日程…</p>}
      <div className="overflow-auto">
        <div
          className={`grid gap-2 ${mode === "DAY" ? "grid-cols-1" : "min-w-[760px] grid-cols-7"}`}
        >
          {days.map((d) => {
            const key = localDay(d),
              next = new Date(d);
            next.setDate(next.getDate() + 1);
            const rows = events.filter((e) =>
              e.allDay
                ? e.dayKey === key
                : (e.startsAt ?? Infinity) < next.getTime() &&
                  (e.endsAt ?? -Infinity) > d.getTime(),
            );
            const all = rows.filter((e) => e.allDay),
              timed = rows.filter((e) => !e.allDay);
            return (
              <article
                key={key}
                className={`rounded-xl border border-[var(--border)] p-2 ${mode === "MONTH" ? "min-h-32" : ""} ${key === localDay() ? "bg-[var(--accent-soft)]" : ""}`}
              >
                <button
                  className="mb-2 block text-sm font-semibold"
                  onClick={() => {
                    select(key);
                    setMode("DAY");
                  }}
                >
                  {d.toLocaleDateString("zh-CN", {
                    month: "numeric",
                    day: "numeric",
                    weekday: "short",
                  })}
                </button>
                <Button size="sm" variant="ghost" onClick={() => onNew(key)}>
                  ＋安排
                </Button>
                {(mode === "MONTH" ? rows : all).map((e) => (
                  <button
                    key={e.id}
                    className="mb-1 block w-full truncate rounded bg-[var(--surface-muted)] p-1 text-left text-xs"
                    onClick={() => onEdit(e)}
                  >
                    {e.allDay
                      ? "全天"
                      : new Date(e.startsAt ?? 0).toLocaleTimeString("zh-CN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                    {e.title}
                  </button>
                ))}
                {mode !== "MONTH" && (
                  <div
                    className="relative mt-2 h-[768px]"
                    style={{
                      background:
                        "repeating-linear-gradient(to bottom, transparent 0px, transparent 31px, var(--border) 32px)",
                    }}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <span
                        key={h}
                        className="absolute left-0 text-[9px] text-[var(--text-tertiary)]"
                        style={{ top: h * 32 }}
                      >
                        {h}:00
                      </span>
                    ))}
                    {timed.map((e, i) => {
                      const top = Math.max(d.getTime(), e.startsAt ?? 0),
                        bottom = Math.min(next.getTime(), e.endsAt ?? 0),
                        height = Math.max(
                          20,
                          ((bottom - top) / (next.getTime() - d.getTime())) *
                            768,
                        );
                      return (
                        <button
                          key={e.id}
                          className="absolute overflow-hidden rounded border border-[var(--accent)] bg-[var(--accent-soft)] p-1 text-left text-xs"
                          style={{
                            top:
                              ((top - d.getTime()) /
                                (next.getTime() - d.getTime())) *
                              768,
                            height,
                            left: `${15 + (i * 85) / timed.length}%`,
                            width: `${85 / timed.length}%`,
                          }}
                          onClick={() => onEdit(e)}
                        >
                          {e.title}
                          <br />
                          {new Date(e.startsAt ?? 0).toLocaleTimeString(
                            "zh-CN",
                            { hour: "2-digit", minute: "2-digit" },
                          )}
                          —
                          {new Date(e.endsAt ?? 0).toLocaleTimeString("zh-CN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
