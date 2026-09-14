import { ArrowDownRight, ArrowUpRight, PiggyBank, Wallet } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { AccountCard } from "@/components/dashboard/account-card";
import { BalanceTrendChart } from "@/components/dashboard/balance-trend-chart";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { SummaryCard } from "@/components/dashboard/summary-card";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getDashboard } from "@/services/finance-service";
import { useUiStore } from "@/stores/ui-store";
import type { DashboardData } from "@/types/finance";

export function DashboardPage() {
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const [data, setData] = useState<DashboardData | null>(null);
  useEffect(() => { const load = () => void getDashboard().then(setData); load(); window.addEventListener("finance-data-changed", load); return () => window.removeEventListener("finance-data-changed", load); }, []);
  const summary = data ?? { totalBalance: 0, monthlyIncome: 0, monthlyExpenses: 0, monthlySavings: 0, accountCount: 0, accounts: [], transactions: [] };
  const rate = summary.monthlyIncome ? ((summary.monthlySavings / summary.monthlyIncome) * 100).toFixed(1) : "0.0";
  return <div className="page-container"><PageHero eyebrow={new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long" })} title="早上好，今天也从容管理每一笔钱。" description={data ? "数据来自本地 SQLite，所有金额均以最小货币单位安全计算。" : "正在准备你的本地财务数据…"} action={<Button onClick={() => setNewTransactionOpen(true)}>记录一笔交易</Button>} /><div className="summary-grid"><SummaryCard detail="所有启用账户" icon={Wallet} label="总余额" prominent tone="primary" value={formatCurrency(summary.totalBalance)} /><SummaryCard detail="本月已到账" icon={ArrowUpRight} label="本月收入" tone="success" value={formatCurrency(summary.monthlyIncome)} /><SummaryCard detail="本月已记录" icon={ArrowDownRight} label="本月支出" tone="danger" value={formatCurrency(summary.monthlyExpenses)} /><SummaryCard detail={`储蓄率 ${rate}%`} icon={PiggyBank} label="本月结余" tone="neutral" value={formatCurrency(summary.monthlySavings)} /></div><motion.section className="mt-7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.08 }}><div className="mb-3"><h2 className="text-base font-semibold text-[var(--text)]">账户</h2><p className="mt-1 text-sm text-[var(--text-secondary)]">{summary.accountCount} 个活跃账户</p></div><div className="account-grid">{summary.accounts.map((account) => <AccountCard account={account} key={account.id} />)}</div></motion.section><div className="dashboard-bottom-grid"><RecentTransactions transactions={summary.transactions} /><BalanceTrendChart data={[]} /></div></div>;
}
