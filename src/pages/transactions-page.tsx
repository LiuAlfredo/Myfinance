import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { Button } from "@/components/ui/button";
import { getTransactions } from "@/services/finance-service";
import type { TransactionRecord } from "@/types/finance";
import { useUiStore } from "@/stores/ui-store";

export function TransactionsPage() {
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]); const [loading, setLoading] = useState(true); const load = () => { setLoading(true); void getTransactions().then(setTransactions).finally(() => setLoading(false)); }; useEffect(() => { load(); window.addEventListener("finance-data-changed", load); return () => window.removeEventListener("finance-data-changed", load); }, []);
  return <div className="page-container"><PageHero title="交易" description="收入、支出、转账与余额调整统一记录，来源账户清晰可追溯。" action={<Button onClick={() => setNewTransactionOpen(true)}><Plus className="size-4" />新建交易</Button>} />{loading ? <div className="content-card p-8 text-sm text-[var(--text-secondary)]">正在加载交易…</div> : transactions.length ? <RecentTransactions transactions={transactions} /> : <div className="content-card p-10 text-center text-sm text-[var(--text-secondary)]">还没有交易，记录第一笔收入或支出。</div>}</div>;
}
