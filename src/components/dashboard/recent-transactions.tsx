import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { TransactionPreview } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export function RecentTransactions({ transactions, onViewAll }: { transactions: TransactionPreview[]; onViewAll?: () => void }) {
  return (
    <section className="content-card">
      <div className="card-heading"><div><h2>最近交易</h2><p>你的最新资金变动</p></div>{onViewAll&&<button onClick={onViewAll} className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]">查看全部</button>}</div>
      <div className="mt-3 divide-y divide-[var(--border)]">
        {transactions.map((transaction) => (
          <article className="transaction-row" key={transaction.id}>
            <span className="grid size-10 place-items-center rounded-xl bg-[var(--surface-muted)] text-lg">{transaction.icon}</span>
            <div className="min-w-0 flex-1"><h3 className="truncate text-sm font-medium text-[var(--text)]">{transaction.title}</h3><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{transaction.account} · {transaction.timestamp}</p></div>
            <div className="text-right"><p className={`flex items-center justify-end gap-1 text-sm font-semibold ${transaction.type === "income" ? "text-[var(--success)]" : "text-[var(--text)]"}`}>{transaction.type === "income" ? <ArrowUpRight className="size-3.5" /> : <ArrowDownLeft className="size-3.5" />}{transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}{formatCurrency(transaction.amount, transaction.currency ?? "CNY")}</p><p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{transaction.category}</p></div>
          </article>
        ))}
      </div>
    </section>
  );
}
