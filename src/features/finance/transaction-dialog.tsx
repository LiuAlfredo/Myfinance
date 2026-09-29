import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  getAccounts,
  getCategories,
  localDateInput,
  saveTransaction,
  toMinorUnit,
} from "@/services/finance-service";
import type {
  AccountRecord,
  CategoryRecord,
  TransactionRecord,
} from "@/types/finance";

export function TransactionDialog({
  open,
  record,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  record?: TransactionRecord | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [kind, setKind] = useState<"INCOME" | "EXPENSE" | "ADJUSTMENT">("EXPENSE");
  const [accountId, setAccountId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    if (!open) return;
    const nextKind = record?.type === "income" ? "INCOME" : record?.type === "adjustment" ? "ADJUSTMENT" : "EXPENSE";
    setKind(nextKind);
    setAccountId(record?.accountId ?? "");
    setError("");
    void Promise.all([getAccounts(), getCategories(nextKind === "INCOME" ? "INCOME" : "EXPENSE")]).then(([nextAccounts, nextCategories]) => {
      setAccounts(nextAccounts);
      setCategories(nextCategories);
      setAccountId((current) => current || nextAccounts.find((account) => account.isActive)?.id || "");
    });
  }, [open, record]);
  useEffect(() => {
    if (!open || kind === "ADJUSTMENT") return;
    void getCategories(kind).then(setCategories);
  }, [kind, open]);
  const account = accounts.find((value) => value.id === accountId);
  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }} title={record ? "编辑交易" : "记录交易"} description="金额按所选账户币种保存；余额调整可使用负数。">
      <form className="space-y-4" onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current || !account) return;
        const data = new FormData(event.currentTarget);
        const raw = toMinorUnit(String(data.get("amount") ?? ""));
        const amount = kind === "ADJUSTMENT" ? raw : Math.abs(raw);
        if (!amount) { setError("请输入有效金额"); return; }
        submitting.current = true; setBusy(true); setError("");
        void saveTransaction({
          type: kind,
          accountId,
          categoryId: kind === "ADJUSTMENT" ? undefined : String(data.get("categoryId") || "") || undefined,
          amount,
          currency: account.currency,
          merchant: String(data.get("merchant") ?? ""),
          transactionDate: new Date(`${String(data.get("date"))}T12:00:00`).getTime(),
          note: String(data.get("note") ?? ""),
        }, record?.id).then(onSaved).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "保存失败")).finally(() => { submitting.current = false; setBusy(false); });
      }}>
        <label className="form-label">类型<select name="type" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className="form-control"><option value="EXPENSE">支出</option><option value="INCOME">收入</option><option value="ADJUSTMENT">余额调整</option></select></label>
        <label className="form-label">账户<select name="accountId" required value={accountId} onChange={(event) => setAccountId(event.target.value)} className="form-control">{accounts.filter((value) => value.isActive || value.id === record?.accountId).map((value) => <option key={value.id} value={value.id}>{value.name} · {value.currency}</option>)}</select></label>
        <label className="form-label">金额（{account?.currency ?? "—"}）<input name="amount" required inputMode="decimal" defaultValue={record?.amount ?? ""} className="form-control" /></label>
        {kind !== "ADJUSTMENT" && <label className="form-label">分类<select name="categoryId" defaultValue={record?.categoryId ?? ""} className="form-control"><option value="">未分类</option>{categories.filter((value) => value.isActive !== false).map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>}
        <label className="form-label">日期<input name="date" type="date" required defaultValue={record ? localDateInput(new Date(record.transactionDate)) : localDateInput()} className="form-control" /></label>
        <label className="form-label">商户 / 标题<input name="merchant" defaultValue={record?.merchant ?? ""} className="form-control" /></label>
        <label className="form-label">备注<textarea name="note" defaultValue={record?.note ?? ""} className="form-control" rows={2} /></label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button><Button type="submit" disabled={busy}>{busy ? "保存中…" : "保存"}</Button></div>
      </form>
    </Dialog>
  );
}
