import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  getAccounts,
  getTransactions,
  toMinorUnit,
} from "@/services/finance-service";
import type { AccountRecord, TransactionRecord } from "@/types/finance";
import { localDay } from "./life-service";
import { workspaceCall } from "./workspace-service";
export interface Subscription {
  id: string;
  title: string;
  amount: number;
  currency: string;
  accountId: string;
  frequency: string;
  anchorDay: string;
  nextDay: string;
  reminderDays: number;
  status: string;
}
interface Payment {
  id: string;
  subscriptionId: string;
  periodDay: string;
  transactionId: string;
  amount: number;
  paidAt: number;
  currency: string;
  title: string;
}
export function SubscriptionPanel() {
  const [params, setParams] = useSearchParams(),
    [rows, setRows] = useState<Subscription[]>([]),
    [payments, setPayments] = useState<Payment[]>([]),
    [accounts, setAccounts] = useState<AccountRecord[]>([]),
    [transactions, setTransactions] = useState<TransactionRecord[]>([]),
    [editing, setEditing] = useState<Subscription | "new" | null>(null),
    [paying, setPaying] = useState<Subscription | null>(null),
    [existing, setExisting] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    submitting = useRef(false);
  const load = useCallback(async () => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    try {
      const [s, p, a, t] = await Promise.all([
        workspaceCall<Subscription[]>("list_subscriptions"),
        workspaceCall<Payment[]>("list_subscription_payments"),
        getAccounts(),
        getTransactions(),
      ]);
      setRows(s);
      setPayments(p);
      setAccounts(a);
      setTransactions(t);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const id = params.get("subscription");
    if (!id) return;
    const row = rows.find((s) => s.id === id);
    if (row) {
      setEditing(row);
      setParams({}, { replace: true });
    }
  }, [rows, params, setParams]);
  const action = async (work: () => Promise<unknown>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
      window.dispatchEvent(new Event("finance-data-changed"));
      window.dispatchEvent(new Event("life-data-changed"));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const record = editing === "new" ? null : editing;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const d = new FormData(e.currentTarget),
      account = accounts.find((a) => a.id === String(d.get("account")));
    if (!account) {
      setError("请选择账户");
      return;
    }
    void action(async () => {
      await workspaceCall("save_subscription", {
        idOpt: record?.id ?? null,
        input: {
          title: String(d.get("title")),
          amount: toMinorUnit(String(d.get("amount"))),
          currency: account.currency,
          accountId: account.id,
          frequency: String(d.get("frequency")),
          anchorDay: String(d.get("anchor")),
          nextDay: String(d.get("next")),
          reminderDays: Number(d.get("reminder")),
          status: String(d.get("status")),
        },
      });
      setEditing(null);
    });
  };
  const currencies = [...new Set(rows.map((r) => r.currency))];
  return (
    <section className="content-card mt-6">
      <div className="flex justify-between">
        <h2 className="font-semibold">订阅与续费</h2>
        <Button onClick={() => setEditing("new")}>添加订阅</Button>
      </div>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error}
        </p>
      )}
      <div className="my-3 space-y-2 text-sm">
        {currencies.map((currency) => {
          const annual = rows
              .filter((r) => r.currency === currency && r.status === "ACTIVE")
              .reduce(
                (s, r) => s + r.amount * (r.frequency === "MONTHLY" ? 12 : 1),
                0,
              ),
            actual = payments
              .filter((p) => p.currency === currency)
              .reduce((s, p) => s + p.amount, 0);
          return (
            <p key={currency}>
              {currency}：预计每月 {(annual / 1200).toFixed(2)}，每年{" "}
              {(annual / 100).toFixed(2)}；累计实际 {(actual / 100).toFixed(2)}
            </p>
          );
        })}
      </div>
      {rows.map((s) => (
        <div
          key={s.id}
          className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] py-3"
        >
          <div>
            {s.title} · {s.currency} {(s.amount / 100).toFixed(2)}
            <p className="text-xs">
              {s.frequency === "MONTHLY" ? "每月" : "每年"} · 下次 {s.nextDay} ·{" "}
              {s.status === "ACTIVE"
                ? "启用"
                : s.status === "PAUSED"
                  ? "暂停"
                  : "取消"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
              编辑
            </Button>
            {s.status === "ACTIVE" && (
              <Button
                size="sm"
                onClick={() => {
                  setExisting("");
                  setPaying(s);
                }}
              >
                确认付款
              </Button>
            )}
          </div>
        </div>
      ))}
      <details className="mt-4">
        <summary>续费历史</summary>
        {payments.map((p) => (
          <p key={p.id} className="py-2 text-sm">
            {p.periodDay} · {p.title} · {p.currency}{" "}
            {(p.amount / 100).toFixed(2)} · 交易 {p.transactionId}
          </p>
        ))}
      </details>
      <Dialog
        open={editing !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setEditing(null);
        }}
        title={record ? "修改订阅" : "添加订阅"}
      >
        {editing && (
          <form
            key={record?.id ?? "new"}
            className="space-y-3"
            onSubmit={submit}
          >
            <label className="form-label">
              服务名称
              <input
                name="title"
                className="form-control"
                required
                defaultValue={record?.title}
              />
            </label>
            <label className="form-label">
              每期金额
              <input
                name="amount"
                className="form-control"
                required
                inputMode="decimal"
                defaultValue={record ? record.amount / 100 : ""}
              />
            </label>
            <label className="form-label">
              账户与币种
              <select
                className="form-control"
                name="account"
                defaultValue={record?.accountId ?? accounts[0]?.id}
              >
                {accounts
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </label>
            <label className="form-label">
              周期
              <select
                className="form-control"
                name="frequency"
                defaultValue={record?.frequency ?? "MONTHLY"}
              >
                <option value="MONTHLY">每月</option>
                <option value="YEARLY">每年</option>
              </select>
            </label>
            <label className="form-label">
              初始周期日期
              <input
                className="form-control"
                name="anchor"
                required
                type="date"
                defaultValue={record?.anchorDay ?? localDay()}
              />
            </label>
            <label className="form-label">
              下一次付款日期
              <input
                className="form-control"
                name="next"
                required
                type="date"
                defaultValue={record?.nextDay ?? localDay()}
              />
            </label>
            <label className="form-label">
              提前提醒天数
              <input
                className="form-control"
                name="reminder"
                type="number"
                min="0"
                max="365"
                defaultValue={record?.reminderDays ?? 3}
              />
            </label>
            <label className="form-label">
              状态
              <select
                className="form-control"
                name="status"
                defaultValue={record?.status ?? "ACTIVE"}
              >
                <option value="ACTIVE">启用</option>
                <option value="PAUSED">暂停</option>
                <option value="CANCELLED">取消</option>
              </select>
            </label>
            {error && (
              <p role="alert" className="text-[var(--danger)]">
                {error}
              </p>
            )}
            <Button disabled={busy}>保存</Button>
          </form>
        )}
      </Dialog>
      <Dialog
        open={paying !== null}
        onOpenChange={(v) => {
          if (!v && !busy) setPaying(null);
        }}
        title="确认本次续费"
      >
        {paying && (
          <div className="space-y-3">
            <p>
              {paying.title} · 周期 {paying.nextDay} · {paying.currency}{" "}
              {(paying.amount / 100).toFixed(2)}
            </p>
            <label className="form-label">
              入账方式
              <select
                className="form-control"
                value={existing}
                onChange={(e) => setExisting(e.target.value)}
              >
                <option value="">创建一笔新的支出</option>
                {transactions
                  .filter(
                    (t) =>
                      t.type === "expense" &&
                      t.accountId === paying.accountId &&
                      t.currency === paying.currency &&
                      toMinorUnit(String(Math.abs(t.amount))) ===
                        paying.amount &&
                      !payments.some((p) => p.transactionId === t.id),
                  )
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      关联已有支出 ·{" "}
                      {new Date(t.transactionDate).toLocaleDateString()} ·{" "}
                      {t.merchant || t.note || t.id}
                    </option>
                  ))}
              </select>
            </label>
            <p className="text-sm">
              确认后推进下次日期。同一次续费重复提交只会保留一笔付款。
            </p>
            {error && (
              <p role="alert" className="text-[var(--danger)]">
                {error}
              </p>
            )}
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await workspaceCall("pay_subscription", {
                    subscriptionId: paying.id,
                    periodDay: paying.nextDay,
                    existingTransactionId: existing || null,
                  });
                  setPaying(null);
                })
              }
            >
              {busy ? "处理中…" : "确认付款并更新下次日期"}
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}
