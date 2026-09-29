import {
  ChartNoAxesColumnIncreasing,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { PageHero } from "@/components/page-hero";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  deleteBudget,
  getBudgets,
  getCategories,
  saveBudget,
  toMinorUnit,
  type BudgetRecord,
} from "@/services/finance-service";
import { formatCurrency } from "@/lib/utils";
import type { CategoryRecord } from "@/types/finance";
export function BudgetsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [rows, setRows] = useState<BudgetRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    void getBudgets(year, month)
      .then(setRows)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "加载失败"),
      )
      .finally(() => setLoading(false));
  }, [month, year]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <div className="page-container">
      <PageHero
        title="预算"
        description="按自然月统计人民币支出，实时计算分类预算使用率。"
        action={
          <div className="flex gap-2">
            <select
              className="form-control mt-0 w-28"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              <option>{now.getFullYear()}</option>
              <option>{now.getFullYear() - 1}</option>
            </select>
            <select
              className="form-control mt-0 w-20"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1} 月
                </option>
              ))}
            </select>
            <Button
              onClick={() => {
                setEditing(null);
                setOpen(true);
              }}
            >
              <Plus className="size-4" />
              添加预算
            </Button>
          </div>
        }
      />
      {loading ? (
        <div className="content-card p-6 text-[var(--text-secondary)]">
          正在加载预算…
        </div>
      ) : error ? (
        <div className="content-card p-6 text-[var(--danger)]">
          {error}
          <Button variant="secondary" className="ml-4" onClick={load}>
            重试
          </Button>
        </div>
      ) : rows.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => {
            const pct = r.amount
              ? Math.min(100, (r.spent / r.amount) * 100)
              : 0;
            return (
              <section className="content-card" key={r.id}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text)]">
                    {r.categoryName}
                  </h3>
                  <div className="flex gap-2">
                    <button
                      aria-label="编辑预算"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </button>
                    <button
                      aria-label="删除预算"
                      onClick={() => {
                        if (window.confirm("删除此预算？"))
                          void deleteBudget(r.id).then(() => {
                            window.dispatchEvent(
                              new Event("finance-data-changed"),
                            );
                            load();
                          });
                      }}
                    >
                      <Trash2 className="size-4 text-[var(--danger)]" />
                    </button>
                  </div>
                </div>
                <div className="mt-4 flex justify-between text-sm">
                  <span>预算 {formatCurrency(r.amount / 100, r.currency)}</span>
                  <span>已消费 {formatCurrency(r.spent / 100, r.currency)}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-[var(--surface-muted)]">
                  <div
                    className={`h-2 rounded-full ${pct >= 100 ? "bg-[var(--danger)]" : "bg-[var(--accent)]"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-xs text-[var(--text-secondary)]">
                  <span>
                    剩余 {formatCurrency(Math.max(0, r.amount - r.spent) / 100, r.currency)}
                  </span>
                  <span>
                    {pct.toFixed(0)}%{pct >= 100 ? " · 已超预算" : ""}
                  </span>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={ChartNoAxesColumnIncreasing}
          title="还没有设置预算"
          description="为当前月份添加分类预算。"
        />
      )}
      <BudgetDialog
        open={open}
        record={editing}
        year={year}
        month={month}
        onClose={() => setOpen(false)}
        onSaved={() => {
          setOpen(false);
          window.dispatchEvent(new Event("finance-data-changed"));
          load();
        }}
      />
    </div>
  );
}
function BudgetDialog({
  open,
  record,
  year,
  month,
  onClose,
  onSaved,
}: {
  open: boolean;
  record: BudgetRecord | null;
  year: number;
  month: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    void getCategories("EXPENSE").then(setCategories);
  }, []);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={record ? "编辑预算" : "添加预算"}
      description="使用率根据真实交易动态计算。"
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const d = new FormData(e.currentTarget);
          void saveBudget(
            {
              categoryId: String(d.get("categoryId")),
              amount: toMinorUnit(String(d.get("amount"))),
              currency: "CNY",
              year,
              month,
            },
            record?.id,
          )
            .then(onSaved)
            .catch((x: unknown) =>
              setError(x instanceof Error ? x.message : "保存失败"),
            );
        }}
      >
        <label className="form-label">
          分类
          <select
            name="categoryId"
            required
            defaultValue={record?.categoryId ?? categories[0]?.id}
            className="form-control"
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-label">
          预算金额
          <input
            name="amount"
            required
            defaultValue={record ? record.amount / 100 : ""}
            className="form-control"
            inputMode="decimal"
          />
        </label>
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            取消
          </Button>
          <Button type="submit">保存</Button>
        </div>
      </form>
    </Dialog>
  );
}
