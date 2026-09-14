import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export function BalanceTrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <section className="content-card chart-card">
      <div className="card-heading"><div><h2>余额趋势</h2><p>最近 7 天的总资产变化</p></div><span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">最近 7 天</span></div>
      <div className="mt-4 h-[250px]" role="img" aria-label="最近七天的总余额趋势图">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
            <defs><linearGradient id="balanceGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5b6ee1" stopOpacity={0.22} /><stop offset="100%" stopColor="#5b6ee1" stopOpacity={0} /></linearGradient></defs>
            <XAxis axisLine={false} dataKey="label" tick={{ fill: "var(--chart-text)", fontSize: 11 }} tickLine={false} />
            <YAxis axisLine={false} hide domain={["dataMin - 2000", "dataMax + 2000"]} />
            <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", boxShadow: "0 8px 24px rgba(15, 23, 42, .1)" }} formatter={(value: number) => [formatCurrency(value), "总余额"]} labelStyle={{ color: "var(--text-secondary)" }} />
            <Area dataKey="balance" fill="url(#balanceGradient)" stroke="#5b6ee1" strokeWidth={2.5} type="monotone" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
