import { Landmark, MoreHorizontal } from "lucide-react";
import type { AccountPreview } from "@/types/finance";
import { formatCurrency } from "@/lib/utils";

export function AccountCard({ account }: { account: AccountPreview }) {
  return (
    <article className="account-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl text-sm font-semibold text-white" style={{ background: account.color }}>{account.symbol}</span>
          <div><h3 className="font-medium text-[var(--text)]">{account.name}</h3><p className="mt-0.5 text-xs text-[var(--text-secondary)]">{account.institution}</p></div>
        </div>
        <button aria-label={`${account.name} 更多选项`} className="rounded-lg p-1.5 text-[var(--text-tertiary)] hover:bg-[var(--surface-muted)]"><MoreHorizontal className="size-4" /></button>
      </div>
      <p className="mt-7 text-2xl font-semibold tracking-[-0.035em] text-[var(--text)]">{formatCurrency(account.balance)}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Landmark className="size-3.5" />{account.type}</p>
    </article>
  );
}
