import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/page-hero";
import { getForecast, type ForecastRecord } from "@/services/finance-service";
import { formatCurrency } from "@/lib/utils";
export function ForecastPage() {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<ForecastRecord[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = () => {
      setLoading(true);
      void getForecast(days)
        .then(setRows)
        .finally(() => setLoading(false));
    };
    load();
    window.addEventListener("finance-data-changed", load);
    return () => window.removeEventListener("finance-data-changed", load);
  }, [days]);
  const min = rows.length ? Math.min(...rows.map((r) => r.balance)) : 0;
  const pressure = rows.find((r) => r.balance === min);
  const largest = rows
    .filter((r) => r.expense > 0)
    .sort((a, b) => b.expense - a.expense)[0];
  return (
    <div className="page-container">
      <PageHero
        title="预测"
        description="综合人民币账户余额、固定收支、计划支出和分期付款，查看未来现金流。"
        action={
          <select
            className="form-control mt-0 w-auto"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            <option value={7}>未来 7 天</option>
            <option value={30}>未来 30 天</option>
            <option value={90}>未来 3 个月</option>
            <option value={365}>未来 12 个月</option>
          </select>
        }
      />
      {loading ? (
        <div className="content-card p-8 text-sm text-[var(--text-secondary)]">
          正在计算现金流…
        </div>
      ) : rows.length ? (
        <section className="content-card">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">
                预测最低余额
              </p>
              <p className="mt-2 text-4xl font-semibold text-[var(--text)]">
                {formatCurrency(min)}
              </p>
            </div>
            <Sparkles className="size-5 text-[var(--accent)]" />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm">
              <p className="text-xs text-[var(--text-secondary)]">
                现金流压力最大日期
              </p>
              <p className="mt-1 font-medium">
                {pressure
                  ? new Date(pressure.date).toLocaleDateString("zh-CN")
                  : "暂无"}
              </p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3 text-sm">
              <p className="text-xs text-[var(--text-secondary)]">
                单日最大支出
              </p>
              <p className="mt-1 font-medium">
                {largest ? formatCurrency(largest.expense) : "暂无"}
              </p>
            </div>
          </div>
          <div className="mt-6 max-h-80 space-y-2 overflow-y-auto">
            {rows
              .filter(
                (_, i) =>
                  i === 0 ||
                  i === rows.length - 1 ||
                  rows[i].income ||
                  rows[i].expense,
              )
              .map((r) => (
                <div
                  className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm"
                  key={r.date}
                >
                  <span className="text-[var(--text-secondary)]">
                    {new Date(r.date).toLocaleDateString("zh-CN")}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(r.balance)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      ) : (
        <EmptyState
          icon={Sparkles}
          title="还没有可预测的数据"
          description="添加固定收支、计划支出或分期后，预测会自动更新。"
        />
      )}
    </div>
  );
}
