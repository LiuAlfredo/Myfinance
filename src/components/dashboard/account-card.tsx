import { Landmark } from "lucide-react";
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
      </div>
      <p className="mt-7 text-2xl font-semibold tracking-[-0.035em] text-[var(--text)]">{formatCurrency(account.balance, account.currency ?? "CNY")}</p>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"><Landmark className="size-3.5" />{account.type}</p>
    </article>
  );
}
