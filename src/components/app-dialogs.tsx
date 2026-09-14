import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/stores/ui-store";
import { getAccounts, getCategories, saveTransaction, searchAll, toMinorUnit } from "@/services/finance-service";
import type { AccountRecord, CategoryRecord } from "@/types/finance";

export function AppDialogs() {
  const isNewTransactionOpen = useUiStore((state) => state.isNewTransactionOpen);
  const setNewTransactionOpen = useUiStore((state) => state.setNewTransactionOpen);
  const isCommandPaletteOpen = useUiStore((state) => state.isCommandPaletteOpen);
  const setCommandPaletteOpen = useUiStore((state) => state.setCommandPaletteOpen);
  const showToast = useUiStore((state) => state.showToast);
  const [query, setQuery] = useState(""); const [results, setResults] = useState<string[]>([]);
  useEffect(() => { const timer = window.setTimeout(() => { void searchAll(query).then(setResults); }, 150); return () => window.clearTimeout(timer); }, [query]);

  return (
    <>
      <Dialog open={isNewTransactionOpen} onOpenChange={setNewTransactionOpen} title="新建交易" description="每笔交易都会明确记录账户，并安全保存到本地数据库。">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget; const data = new FormData(form); const amount = toMinorUnit(String(data.get("amount") ?? "")); if (!amount) { showToast("请输入有效金额"); return; } void saveTransaction({ type: String(data.get("type")) as "INCOME" | "EXPENSE", accountId: String(data.get("accountId")), categoryId: String(data.get("categoryId")) || undefined, amount, currency: "CNY", merchant: String(data.get("merchant") ?? ""), transactionDate: new Date(String(data.get("date") || new Date().toISOString().slice(0, 10))).getTime(), note: String(data.get("note") ?? "") }).then(() => { setNewTransactionOpen(false); showToast("交易已保存"); window.dispatchEvent(new Event("finance-data-changed")); }).catch((e: unknown) => showToast(e instanceof Error ? e.message : "保存失败"));
          }}
        >
            <label className="block text-sm font-medium text-[var(--text-secondary)]">
            金额
            <input name="amount" required className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-2xl font-semibold text-[var(--text)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]" inputMode="decimal" placeholder="¥ 0.00" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="form-label">类型<select name="type" defaultValue="EXPENSE" className="form-control"><option value="EXPENSE">支出</option><option value="INCOME">收入</option></select></label>
            <AccountOptions />
          </div>
          <div className="grid grid-cols-2 gap-3"><CategoryOptions /><label className="form-label">日期<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="form-control" /></label></div>
          <label className="form-label">商户 / 标题<input name="merchant" className="form-control" placeholder="例如：午餐" /></label><label className="form-label">备注<textarea name="note" className="form-control" rows={2} /></label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setNewTransactionOpen(false)}>取消</Button>
            <Button type="submit">保存交易</Button>
          </div>
        </form>
      </Dialog>
      <Dialog open={isCommandPaletteOpen} onOpenChange={setCommandPaletteOpen} title="快速搜索" description="搜索账户、交易和分类。">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2.5 text-[var(--text-tertiary)]"><Search className="size-4" /><input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-[var(--text)] outline-none" placeholder="搜索账户、交易或分类…" /></div>
        <div className="mt-3 divide-y divide-[var(--border)]">{results.map((result) => <p className="py-2 text-sm text-[var(--text-secondary)]" key={result}>{result}</p>)}{query && !results.length ? <p className="py-3 text-sm text-[var(--text-tertiary)]">没有匹配结果</p> : null}</div>
      </Dialog>
    </>
  );
}

function AccountOptions() { const [accounts, setAccounts] = useState<AccountRecord[]>([]); useEffect(() => { void getAccounts().then(setAccounts); }, []); return <label className="form-label">账户<select name="accountId" required className="form-control">{accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>; }
function CategoryOptions() { const [categories, setCategories] = useState<CategoryRecord[]>([]); useEffect(() => { void getCategories("EXPENSE").then(setCategories); }, []); return <label className="form-label">分类<select name="categoryId" className="form-control"><option value="">未分类</option>{categories.filter((c) => c.isActive !== false).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>; }
