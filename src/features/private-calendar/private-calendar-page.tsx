import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  deletePrivateCalendarEvent,
  getPrivateCalendarDay,
  getPrivateCalendarMonth,
  savePrivateCalendarEvent,
} from "@/features/private-calendar/private-calendar-service";
import type { PrivateCalendarDayMark, PrivateCalendarEvent } from "@/features/private-calendar/types";

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDayKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function timeValue(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function PrivateCalendarPage() {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => dayKey(today));
  const [marks, setMarks] = useState<PrivateCalendarDayMark[]>([]);
  const [events, setEvents] = useState<PrivateCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventDialog, setEventDialog] = useState<PrivateCalendarEvent | "new" | null>(null);
  const [privacyHidden, setPrivacyHidden] = useState(false);

  const loadMonth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMarks(await getPrivateCalendarMonth(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "私密日历加载失败");
    } finally {
      setLoading(false);
    }
  }, [visibleMonth]);

  const loadDay = useCallback(async () => {
    try {
      setEvents(await getPrivateCalendarDay(selectedDay));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "当天记录加载失败");
    }
  }, [selectedDay]);

  useEffect(() => { void loadMonth(); }, [loadMonth]);
  useEffect(() => { void loadDay(); }, [loadDay]);

  const refresh = async () => {
    setEventDialog(null);
    await Promise.all([loadMonth(), loadDay()]);
  };

  const moveMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1);
    setVisibleMonth(next);
    setSelectedDay(dayKey(next));
  };

  return (
    <main className="modules-screen">
      <header className="modules-header">
        <Button variant="ghost" onClick={() => navigate("/modules")}>
          <ArrowLeft className="size-4" />返回模块选择
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setPrivacyHidden((hidden) => !hidden)}>
            {privacyHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            <span className="hidden sm:inline">{privacyHidden ? "显示记录" : "隐私模式"}</span>
          </Button>
          <ThemeSwitcher />
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1320px] px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="entry-eyebrow">PRIVATE CALENDAR</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">私密日历</h1>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">所有详细内容均在本地加密保存。</p>
          </div>
          <Button onClick={() => setEventDialog("new")}><Plus className="size-4" />添加记录</Button>
        </div>

        {error ? <div className="mt-5 rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{error}</div> : null}

        <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(560px,1.35fr)_minmax(320px,.65fr)]">
          <section className="content-card min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button aria-label="上一个月" size="icon" variant="ghost" onClick={() => moveMonth(-1)}><ChevronLeft className="size-5" /></Button>
                <h2 className="min-w-28 text-center text-lg font-semibold text-[var(--text)]">{visibleMonth.getFullYear()}年 {visibleMonth.getMonth() + 1}月</h2>
                <Button aria-label="下一个月" size="icon" variant="ghost" onClick={() => moveMonth(1)}><ChevronRight className="size-5" /></Button>
              </div>
              <Button variant="ghost" onClick={() => { setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(dayKey(today)); }}>今天</Button>
            </div>
            <MonthCalendar
              month={visibleMonth}
              marks={privacyHidden ? [] : marks}
              selectedDay={selectedDay}
              onSelect={setSelectedDay}
            />
            {loading ? <p className="mt-3 text-center text-xs text-[var(--text-tertiary)]">正在读取加密记录…</p> : null}
          </section>

          <section className="content-card min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-[.08em] text-[var(--text-tertiary)]">当天记录</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{parseDayKey(selectedDay).toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" })}</h2>
              </div>
              <Button size="sm" onClick={() => setEventDialog("new")}><Plus className="size-4" />添加</Button>
            </div>

            <div className="mt-5 space-y-3">
              {privacyHidden ? (
                <div className="rounded-xl bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-secondary)]">隐私模式已隐藏记录内容</div>
              ) : events.length ? events.map((event) => (
                <article key={event.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-[var(--text)]"><UserRound className="size-4 text-[var(--accent)]" />{event.personName}</p>
                      <div className="mt-2 space-y-1 text-sm text-[var(--text-secondary)]">
                        <p className="flex items-center gap-2"><Clock3 className="size-3.5" />{new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</p>
                        {event.location ? <p className="flex items-center gap-2"><MapPin className="size-3.5" />{event.location}</p> : null}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button aria-label="编辑记录" size="icon" variant="ghost" onClick={() => setEventDialog(event)}><Pencil className="size-4" /></Button>
                      <Button aria-label="删除记录" size="icon" variant="ghost" onClick={() => { if (window.confirm("确定删除这条私密记录吗？此操作无法撤销。")) void deletePrivateCalendarEvent(event.id).then(refresh).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "删除失败")); }}><Trash2 className="size-4 text-[var(--danger)]" /></Button>
                    </div>
                  </div>
                  {event.note ? <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-6 text-[var(--text-secondary)]">{event.note}</p> : null}
                </article>
              )) : (
                <div className="rounded-xl bg-[var(--surface-muted)] p-8 text-center text-sm text-[var(--text-secondary)]">当天暂无记录</div>
              )}
            </div>
          </section>
        </div>
      </div>

      <EventDialog
        open={eventDialog !== null}
        event={eventDialog === "new" ? null : eventDialog}
        day={selectedDay}
        onClose={() => setEventDialog(null)}
        onSaved={() => void refresh()}
      />
    </main>
  );
}

function MonthCalendar({ month, marks, selectedDay, onSelect }: { month: Date; marks: PrivateCalendarDayMark[]; selectedDay: string; onSelect: (day: string) => void }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const counts = new Map(marks.map((mark) => [mark.dayKey, mark.count]));
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => index < firstWeekday ? null : index - firstWeekday + 1);

  return (
    <div className="mt-6">
      <div className="grid grid-cols-7">{weekdays.map((weekday) => <span key={weekday} className="py-2 text-center text-xs font-semibold text-[var(--text-tertiary)]">{weekday}</span>)}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((day, index) => {
          if (day === null) return <span key={`empty-${index}`} />;
          const key = dayKey(new Date(year, monthIndex, day));
          const count = counts.get(key) ?? 0;
          const selected = key === selectedDay;
          const current = key === dayKey(new Date());
          return (
            <button
              type="button"
              key={key}
              aria-label={`${key}${count ? `，${count}条记录` : ""}`}
              className={`private-calendar-day ${count ? "private-calendar-day-marked" : ""} ${selected ? "private-calendar-day-selected" : ""}`}
              onClick={() => onSelect(key)}
            >
              <span>{day}</span>
              {current ? <span className="private-calendar-today">今天</span> : null}
              {count ? <span className="private-calendar-count">{count}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EventDialog({ open, event, day, onClose, onSaved }: { open: boolean; event: PrivateCalendarEvent | null; day: string; onClose: () => void; onSaved: () => void }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} title={event ? "编辑私密记录" : "添加私密记录"} description="详细内容会加密后保存到本地数据库。">
      <form className="space-y-4" onSubmit={(submitEvent: FormEvent<HTMLFormElement>) => {
        submitEvent.preventDefault();
        setError(null);
        const data = new FormData(submitEvent.currentTarget);
        const recordDay = String(data.get("day"));
        const occurredAt = new Date(`${recordDay}T${String(data.get("time"))}:00`).getTime();
        void savePrivateCalendarEvent({ occurredAt, dayKey: recordDay, personName: String(data.get("personName")), location: String(data.get("location") ?? ""), note: String(data.get("note") ?? "") }, event?.id).then(onSaved).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "保存失败"));
      }}>
        <div className="grid grid-cols-2 gap-3">
          <label className="form-label">日期<input name="day" type="date" required defaultValue={event?.dayKey ?? day} className="form-control" /></label>
          <label className="form-label">时间<input name="time" type="time" required defaultValue={event ? timeValue(event.occurredAt) : timeValue(Date.now())} className="form-control" /></label>
        </div>
        <label className="form-label">姓名<input name="personName" required maxLength={80} defaultValue={event?.personName ?? ""} className="form-control" placeholder="输入任何人的名字或别名" autoComplete="off" /></label>
        <label className="form-label">地点<input name="location" defaultValue={event?.location ?? ""} className="form-control" placeholder="可选" /></label>
        <label className="form-label">备注<textarea name="note" defaultValue={event?.note ?? ""} className="form-control" rows={3} placeholder="可选" /></label>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onClose}>取消</Button><Button type="submit">保存记录</Button></div>
      </form>
    </Dialog>
  );
}
