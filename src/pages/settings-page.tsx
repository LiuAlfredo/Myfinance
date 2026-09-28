import { CheckCircle2, MonitorCog, Palette } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHero } from "@/components/page-hero";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { getAppInfo, type AppInfo } from "@/services/app-service";
import {
  canBuy,
  exportFinanceJson,
  exportTransactionsCsv,
  getCategories,
  getFileInfo,
  getSetting,
  saveCategory,
  setCategoryActive,
  setSetting,
  toMinorUnit,
  fromMinorUnit,
  type FileInfo,
  type PurchaseResult,
} from "@/services/finance-service";
import type { CategoryRecord } from "@/types/finance";
import { open, save } from "@tauri-apps/plugin-dialog";
import { backupDatabase, restoreDatabase } from "@/services/finance-service";
import { useUiStore } from "@/stores/ui-store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  previewBackup,
  type BackupPreview,
} from "@/features/life/workspace-service";
import { BackupPanel } from "@/features/life/backup-panel";

export function SettingsPage() {
  const [appInfo, setAppInfo] = useState<AppInfo>({
    name: "MyFinance",
    version: "正在检查…",
  });
  const [safety, setSafety] = useState(10000);
  const [purchase, setPurchase] = useState<PurchaseResult | null>(null);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [categoryName, setCategoryName] = useState("");
  const [restoreCandidate, setRestoreCandidate] = useState<{
    path: string;
    info: FileInfo;
    preview: BackupPreview;
  } | null>(null);
  const showToast = useUiStore((state) => state.showToast);
  useEffect(() => {
    void getAppInfo()
      .then(setAppInfo)
      .catch(() => setAppInfo({ name: "MyFinance", version: "连接不可用" }));
  }, []);
  useEffect(() => {
    void getSetting("safety_balance").then((value) => {
      if (value) setSafety(fromMinorUnit(Number(value)));
    });
  }, []);
  useEffect(() => {
    void getCategories().then(setCategories);
  }, []);
  return (
    <div className="page-container">
      <PageHero
        title="设置"
        description="调整 MyFinance 的外观与基础应用偏好。"
      />
      <div className="settings-stack">
        <BackupPanel />
        <section className="content-card flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="icon-badge icon-badge-primary">
              <Palette className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">外观</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                选择浅色、深色或自动跟随 Windows。
              </p>
            </div>
          </div>
          <ThemeSwitcher />
        </section>
        <section className="content-card flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <span className="icon-badge icon-badge-success">
              <MonitorCog className="size-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--text)]">
                桌面连接
              </h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Tauri 通信基础探针：{appInfo.name} · {appInfo.version}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-sm text-[var(--success)]">
            <CheckCircle2 className="size-4" />
            已配置
          </span>
        </section>
        <section className="content-card flex flex-wrap items-center justify-between gap-5">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text)]">
              财务安全余额
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              预测余额低于此金额时提醒你。
            </p>
          </div>
          <label className="form-label">
            <span className="sr-only">最低安全余额</span>
            <input
              className="form-control mt-0 w-40"
              inputMode="decimal"
              value={safety}
              onChange={(e) => setSafety(Number(e.target.value) || 0)}
              onBlur={() =>
                void setSetting(
                  "safety_balance",
                  String(toMinorUnit(String(safety))),
                )
              }
            />
          </label>
        </section>
        <section className="content-card">
          <h2 className="text-sm font-semibold text-[var(--text)]">
            我能买这个吗？
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            结合未来现金流和安全余额评估一次性购买。
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="form-label">
              价格
              <input
                id="purchase-amount"
                className="form-control"
                inputMode="decimal"
                placeholder="¥ 0.00"
              />
            </label>
            <label className="form-label">
              购买日期
              <input
                id="purchase-date"
                type="date"
                className="form-control"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
            </label>
            <button
              className="button-primary h-10 rounded-xl px-4 text-sm"
              onClick={() => {
                const amount = toMinorUnit(
                  (
                    document.getElementById(
                      "purchase-amount",
                    ) as HTMLInputElement
                  ).value,
                );
                const date = new Date(
                  (
                    document.getElementById("purchase-date") as HTMLInputElement
                  ).value,
                ).getTime();
                if (amount) void canBuy(amount, date).then(setPurchase);
              }}
            >
              {purchase ? "重新分析" : "开始分析"}
            </button>
          </div>
          {purchase && (
            <div
              className={`mt-4 rounded-xl p-4 text-sm ${purchase.verdict === "OK" ? "bg-[var(--success-soft)] text-[var(--success)]" : purchase.verdict === "CAUTION" ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--danger-soft)] text-[var(--danger)]"}`}
            >
              <strong>
                {purchase.verdict === "OK"
                  ? "可以购买"
                  : purchase.verdict === "CAUTION"
                    ? "谨慎购买"
                    : "不建议购买"}
              </strong>
              <p className="mt-1">
                {purchase.reason}。购买后余额{" "}
                {purchase.balanceAfterPurchase.toLocaleString("zh-CN", {
                  style: "currency",
                  currency: "CNY",
                })}
                。
              </p>
            </div>
          )}
        </section>
        <section className="content-card">
          <h2 className="text-sm font-semibold text-[var(--text)]">分类管理</h2>
          <div className="mt-3 flex gap-2">
            <input
              className="form-control mt-0 max-w-xs"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="新增支出分类"
            />
            <button
              className="button-primary rounded-xl px-4 text-sm"
              onClick={() => {
                if (categoryName.trim())
                  void saveCategory({
                    name: categoryName.trim(),
                    type: "EXPENSE",
                    icon: "tag",
                    color: "#5b6ee1",
                    isActive: true,
                  }).then((r) => {
                    setCategories([...categories, r]);
                    setCategoryName("");
                  });
              }}
            >
              添加
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg bg-[var(--surface-muted)] px-3 py-2 text-sm"
              >
                <span
                  className={
                    c.isActive === false
                      ? "text-[var(--text-tertiary)]"
                      : "text-[var(--text-secondary)]"
                  }
                >
                  {c.name}
                  {c.isActive === false ? " · 已停用" : ""}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    className="text-xs text-[var(--accent)]"
                    onClick={() => {
                      const name = window.prompt("修改分类名称", c.name);
                      if (name?.trim())
                        void saveCategory(
                          { ...c, name: name.trim() },
                          c.id,
                        ).then((updated) =>
                          setCategories(
                            categories.map((item) =>
                              item.id === c.id ? updated : item,
                            ),
                          ),
                        );
                    }}
                  >
                    编辑
                  </button>
                  <button
                    className="text-xs text-[var(--accent)]"
                    onClick={() =>
                      void setCategoryActive(c.id, c.isActive === false).then(
                        () =>
                          setCategories(
                            categories.map((item) =>
                              item.id === c.id
                                ? { ...item, isActive: c.isActive === false }
                                : item,
                            ),
                          ),
                      )
                    }
                  >
                    {c.isActive === false ? "启用" : "停用"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="content-card">
          <h2 className="text-sm font-semibold text-[var(--text)]">数据备份</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            SQLite 备份包含所有模块与密码配置，私密记录保持加密。JSON / CSV
            仅导出财务数据。
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="button-primary rounded-xl px-4 py-2 text-sm"
              onClick={() =>
                void exportFinanceJson().then((text) =>
                  downloadFile(
                    "myfinance-backup.json",
                    text,
                    "application/json",
                  ),
                )
              }
            >
              导出 JSON
            </button>
            <button
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              onClick={() =>
                void exportTransactionsCsv().then((text) =>
                  downloadFile("myfinance-transactions.csv", text, "text/csv"),
                )
              }
            >
              导出 CSV
            </button>
            <button
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              onClick={() =>
                void save({
                  defaultPath: "myfinance.sqlite3",
                  filters: [
                    { name: "SQLite Database", extensions: ["sqlite3", "db"] },
                  ],
                })
                  .then((path) => {
                    if (typeof path !== "string") return;
                    return backupDatabase(path).then(() =>
                      showToast("SQLite 备份已完成"),
                    );
                  })
                  .catch((e: unknown) =>
                    showToast(e instanceof Error ? e.message : "备份失败"),
                  )
              }
            >
              备份 SQLite
            </button>
            <button
              className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
              onClick={() =>
                void open({
                  multiple: false,
                  directory: false,
                  filters: [
                    { name: "SQLite Database", extensions: ["sqlite3", "db"] },
                  ],
                })
                  .then(async (path) => {
                    if (typeof path !== "string") return;
                    const info = await getFileInfo(path);
                    const preview = await previewBackup(path);
                    setRestoreCandidate({ path, info, preview });
                  })
                  .catch((e: unknown) =>
                    showToast(e instanceof Error ? e.message : "读取备份失败"),
                  )
              }
            >
              恢复 SQLite
            </button>
          </div>
        </section>
        <Dialog
          open={Boolean(restoreCandidate)}
          onOpenChange={(open) => {
            if (!open) setRestoreCandidate(null);
          }}
          title="确认恢复数据库"
          description="恢复将替换全部财务、Journey、私密日历和登录密码配置。恢复后需要使用备份时的密码重新登录。"
        >
          {restoreCandidate && (
            <div className="space-y-4">
              <div className="rounded-xl bg-[var(--surface-muted)] p-4 text-sm">
                <p>文件：{restoreCandidate.info.name}</p>
                {restoreCandidate.preview.counts.map(([name, count]) => (
                  <p key={name}>
                    {name}：{count}
                  </p>
                ))}
                <p>
                  结构版本：{restoreCandidate.preview.schemaVersion} →{" "}
                  {restoreCandidate.preview.upgradedVersion}
                </p>
                <p>大小：{(restoreCandidate.info.size / 1024).toFixed(1)} KB</p>
                <p>
                  修改时间：
                  {restoreCandidate.info.modified
                    ? new Date(restoreCandidate.info.modified).toLocaleString(
                        "zh-CN",
                      )
                    : "不可用"}
                </p>
              </div>
              <p className="text-sm text-[var(--danger)]">
                恢复前会自动保留当前数据库副本。请确认你知道备份时使用的登录密码。
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setRestoreCandidate(null)}
                >
                  取消
                </Button>
                <Button
                  onClick={() => {
                    const path = restoreCandidate.path;
                    setRestoreCandidate(null);
                    void restoreDatabase(path)
                      .then(() => showToast("数据库已恢复，请重新登录"))
                      .catch((e: unknown) =>
                        showToast(
                          e instanceof Error ? e.message : "恢复失败，请重试",
                        ),
                      );
                  }}
                >
                  确认恢复
                </Button>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </div>
  );
}
function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
