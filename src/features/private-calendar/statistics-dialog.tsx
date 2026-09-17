import { BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { PrivateCalendarYearStats } from "./types";

interface StatisticsProps {
  years: PrivateCalendarYearStats[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function StatisticsState({ loading, error, onRetry }: Pick<StatisticsProps, "loading" | "error" | "onRetry">) {
  if (error) return <div role="alert" className="rounded-xl bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{error}<Button variant="ghost" size="sm" onClick={onRetry}>重试</Button></div>;
  if (loading) return <p role="status" className="py-8 text-center text-sm text-[var(--text-secondary)]">正在读取年度统计…</p>;
  return null;
}

export function StatisticsDialog({ year, years, loading, error, onRetry, onYearChange, onMonthSelect, onClose }: StatisticsProps & {
  year: number; onYearChange: (year: number) => void; onMonthSelect: (month: string) => void; onClose: () => void;
}) {
  const stats = years.find((item) => item.year === year);
  const yearOptions = [...new Set([year, new Date().getFullYear(), ...years.map((item) => item.year)])].sort((a, b) => b - a);
  const months = stats?.months ?? Array<number>(12).fill(0);
  const max = Math.max(...months, 1);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="年度统计" description="按记录日期统计，每条记录计为一次，同一天可计多次。">
      <label className="form-label">统计年份<select className="form-control" value={year} onChange={(e) => onYearChange(Number(e.target.value))}>{yearOptions.map((value) => <option key={value} value={value}>{value}年</option>)}</select></label>
      <StatisticsState loading={loading} error={error} onRetry={onRetry} />
      {!loading && !error ? <>
        <div className="my-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[var(--accent-soft)] p-5"><p className="text-xs text-[var(--text-secondary)]">{year}年性爱次数</p><p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--accent)]">{stats?.total ?? 0}<span className="ml-2 text-sm font-normal">次</span></p></div>
          <div className="rounded-2xl bg-[var(--surface-muted)] p-5"><p className="text-xs text-[var(--text-secondary)]">有记录的天数</p><p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text)]">{stats?.activeDays ?? 0}<span className="ml-2 text-sm font-normal">天</span></p></div>
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]"><span>每月次数</span><span>点击月份查看记录</span></div>
        <div className="mt-3 grid grid-cols-6 gap-2">
          {months.map((count, index) => <button type="button" key={index} onClick={() => onMonthSelect(`${year}-${String(index + 1).padStart(2, "0")}`)}
            aria-label={`${year}年${index + 1}月，${count}次，查看记录`} className="private-stat-month">
            <span className="text-xs text-[var(--text-tertiary)]">{index + 1}月</span>
            <span className="private-stat-track"><span className="private-stat-fill" style={{ height: `${count / max * 100}%` }} /></span>
            <span className="text-sm font-semibold tabular-nums text-[var(--text)]">{count}</span>
          </button>)}
        </div>
        <p className="mt-4 text-xs leading-5 text-[var(--text-tertiary)]">{stats ? `记录范围：${stats.firstDay} 至 ${stats.lastDay}。编辑日期或删除记录后，统计会同步更新。` : "这一年暂无记录。可以点击月份，查看或补记历史记录。"}</p>
      </> : null}
    </Dialog>
  );
}

export function HistoryDialog({ month, years, loading, error, onRetry, onSelectMonth, onSelectYear, onClose }: StatisticsProps & {
  month: string; onSelectMonth: (month: string) => void; onSelectYear: (year: number) => void; onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }} title="历史数据" description="快速选择年月，或点击历史年份查看年度统计。">
      <form className="flex items-end gap-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); onSelectMonth(String(data.get("month"))); }}>
        <label className="form-label flex-1">跳转到月份<input name="month" className="form-control" type="month" min="1900-01" max="9999-12" defaultValue={month} required /></label>
        <Button type="submit">前往</Button>
      </form>
      <div className="mt-5"><StatisticsState loading={loading} error={error} onRetry={onRetry} /></div>
      {!loading && !error ? <div className="max-h-64 space-y-2 overflow-y-auto">
        {years.length ? years.map((stats) => <button type="button" key={stats.year} onClick={() => onSelectYear(stats.year)} className="flex w-full items-center gap-3 rounded-xl border border-[var(--border)] p-4 text-left transition-colors hover:bg-[var(--surface-muted)]">
          <BarChart3 className="size-4 text-[var(--accent)]" /><span className="flex-1 text-sm font-medium text-[var(--text)]">{stats.year}年</span><span className="text-sm tabular-nums text-[var(--text-secondary)]">{stats.total}次 · {stats.activeDays}天</span><ChevronRight className="size-4 text-[var(--text-tertiary)]" />
        </button>) : <p className="py-6 text-center text-sm text-[var(--text-secondary)]">暂无历史记录，可选择月份开始补记。</p>}
      </div> : null}
    </Dialog>
  );
}
