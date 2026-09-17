import { ArrowLeft, BarChart3, ChevronLeft, ChevronRight, Eye, EyeOff, History, LockKeyhole, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/auth-store";
import { dayKey, errorMessage, parseDayKey } from "./calendar-utils";
import { DayRecords } from "./day-records";
import { EventDialog } from "./event-dialog";
import { MonthCalendar } from "./month-calendar";
import { deletePrivateCalendarEvent } from "./private-calendar-service";
import { HistoryDialog, StatisticsDialog } from "./statistics-dialog";
import type { PrivateCalendarEvent } from "./types";
import { usePrivateCalendarData } from "./use-private-calendar-data";

export function PrivateCalendarPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [selectedDay, setSelectedDay] = useState(() => dayKey(new Date()));
  const [direction, setDirection] = useState(0);
  const [revision, setRevision] = useState(0);
  const [eventDialog, setEventDialog] = useState<PrivateCalendarEvent | "new" | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PrivateCalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletePending = useRef(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [privacyHidden, setPrivacyHidden] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [statisticsYear, setStatisticsYear] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedDate = parseDayKey(selectedDay);
  const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth();
  const data = usePrivateCalendarData(selectedDay, revision, !privacyHidden);
  const refresh = () => setRevision((value) => value + 1);

  const selectDay = (day: string) => {
    setDirection(day > selectedDay ? 1 : -1);
    setSelectedDay(day);
    setNotice(null);
  };
  const selectMonth = (value: string) => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value) || Number(value.slice(0, 4)) < 1900) return;
    selectDay(`${value}-01`);
    setHistoryOpen(false);
    setStatisticsYear(null);
  };
  const moveMonth = (offset: number) => {
    const next = new Date(year, month + offset, 1);
    next.setDate(Math.min(selectedDate.getDate(), new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
    selectDay(dayKey(next));
  };
  const saved = (event: PrivateCalendarEvent) => {
    const editing = eventDialog !== "new";
    setEventDialog(null);
    selectDay(event.dayKey);
    refresh();
    setNotice(`${editing ? "修改已保存" : "记录已保存"}，已定位到 ${event.dayKey}。`);
  };
  const remove = async () => {
    if (!deleteCandidate || deletePending.current) return;
    deletePending.current = true;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deletePrivateCalendarEvent(deleteCandidate.id);
      setDeleteCandidate(null);
      refresh();
      setNotice("记录已删除。");
    } catch (reason) { setDeleteError(errorMessage(reason)); }
    finally { deletePending.current = false; setDeleting(false); }
  };
  const statisticsProps = { years: data.statistics.data ?? [], loading: data.statistics.loading, error: data.statistics.error, onRetry: refresh };

  return (
    <main className="modules-screen">
      <header className="modules-header">
        <Button variant="ghost" onClick={() => navigate("/modules")}><ArrowLeft className="size-4" />返回模块选择</Button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => { setPrivacyHidden((hidden) => !hidden); setHistoryOpen(false); setStatisticsYear(null); }}>
            {privacyHidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}<span className="hidden sm:inline">{privacyHidden ? "显示记录" : "隐私模式"}</span>
          </Button>
          <Button variant="ghost" onClick={() => void logout()}><LockKeyhole className="size-4" /><span className="hidden sm:inline">锁定</span></Button>
          <ThemeSwitcher />
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1320px] px-5 py-8 md:px-10 md:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="entry-eyebrow">PRIVATE CALENDAR</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[var(--text)]">私密日历</h1><p className="mt-2 text-sm text-[var(--text-secondary)]">本地加密记录 · 15 分钟无操作后自动锁定</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={privacyHidden} onClick={() => setHistoryOpen(true)}><History className="size-4" />历史数据</Button>
            <Button variant="secondary" disabled={privacyHidden} onClick={() => setStatisticsYear(year)}><BarChart3 className="size-4" />年度统计</Button>
            <Button disabled={privacyHidden} onClick={() => setEventDialog("new")}><Plus className="size-4" />添加记录</Button>
          </div>
        </div>
        {notice && !privacyHidden ? <p role="status" className="mt-4 rounded-xl bg-[var(--success-soft)] px-4 py-3 text-sm text-[var(--success)]">{notice}</p> : null}
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.8fr)]">
          <section className="content-card min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button aria-label="上一个月" size="icon" variant="ghost" disabled={year === 1900 && month === 0} onClick={() => moveMonth(-1)}><ChevronLeft className="size-5" /></Button>
                <Button variant="ghost" aria-label="选择历史年月" onClick={() => setHistoryOpen(true)} disabled={privacyHidden} className="min-w-32 text-base font-semibold">{year}年 {month + 1}月</Button>
                <Button aria-label="下一个月" size="icon" variant="ghost" disabled={year === 9999 && month === 11} onClick={() => moveMonth(1)}><ChevronRight className="size-5" /></Button>
              </div>
              <Button variant="ghost" onClick={() => selectDay(dayKey(new Date()))}>今天</Button>
            </div>
            <MonthCalendar month={selectedDate} marks={data.month.data ?? []} selectedDay={selectedDay} onSelect={selectDay} direction={direction} />
            <div className="mt-3 min-h-6 text-xs text-[var(--text-tertiary)]" aria-live="polite">
              {privacyHidden ? "记录标记已隐藏" : data.month.error ? <span className="text-[var(--danger)]">{data.month.error}<button className="ml-2 underline" onClick={refresh}>重试</button></span> : data.month.loading ? "正在读取日历…" : "点击日期查看记录；点击上方年月快速跳转。"}
            </div>
          </section>
          <section className="content-card min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-semibold tracking-[.08em] text-[var(--text-tertiary)]">当天记录</p><h2 className="mt-1 text-lg font-semibold text-[var(--text)]">{selectedDate.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</h2><p className="mt-1 text-xs text-[var(--text-tertiary)]">{selectedDate.toLocaleDateString("zh-CN", { weekday: "long" })}</p></div>
              <Button size="sm" disabled={privacyHidden} onClick={() => setEventDialog("new")}><Plus className="size-4" />添加</Button>
            </div>
            <DayRecords selectedDay={selectedDay} events={data.day.data ?? []} loading={data.day.loading} error={data.day.error} hidden={privacyHidden} onRetry={refresh} onEdit={setEventDialog} onDelete={(event) => { setDeleteError(null); setDeleteCandidate(event); }} />
          </section>
        </div>
      </div>
      {eventDialog !== null ? <EventDialog event={eventDialog === "new" ? null : eventDialog} day={selectedDay} onClose={() => setEventDialog(null)} onSaved={saved} /> : null}
      {historyOpen && !privacyHidden ? <HistoryDialog {...statisticsProps} month={selectedDay.slice(0, 7)} onSelectMonth={selectMonth} onSelectYear={(value) => { setHistoryOpen(false); setStatisticsYear(value); }} onClose={() => setHistoryOpen(false)} /> : null}
      {statisticsYear !== null && !privacyHidden ? <StatisticsDialog {...statisticsProps} year={statisticsYear} onYearChange={setStatisticsYear} onMonthSelect={selectMonth} onClose={() => setStatisticsYear(null)} /> : null}
      {deleteCandidate ? <Dialog open onOpenChange={(open) => { if (!open && !deletePending.current) setDeleteCandidate(null); }} title="删除这条记录？" description="删除后无法撤销，年度次数也会同步减少。">
        {deleteError ? <p role="alert" className="mb-4 text-sm text-[var(--danger)]">{deleteError}</p> : null}
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={deleting} onClick={() => setDeleteCandidate(null)}>取消</Button><Button disabled={deleting} onClick={() => void remove()}>{deleting ? "正在删除…" : "确认删除"}</Button></div>
      </Dialog> : null}
    </main>
  );
}
