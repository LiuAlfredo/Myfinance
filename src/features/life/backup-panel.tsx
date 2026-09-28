import { useCallback, useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { restoreDatabase } from "@/services/finance-service";
import { flushAllNotes } from "./note-save-queue";
import {
  workspaceCall,
  automaticBackup,
  backupStatus,
  previewBackup,
  saveBackupConfig,
  type BackupConfig,
  type BackupPreview,
  type BackupStatus,
} from "./workspace-service";

export function BackupPanel() {
  const [status, setStatus] = useState<BackupStatus | null>(null),
    [config, setConfig] = useState<BackupConfig | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<{
      path: string;
      data: BackupPreview;
    } | null>(null);
  const load = useCallback(async () => {
    try {
      const value = await backupStatus();
      setStatus(value);
      setConfig(value.config);
    } catch (e) {
      setError(String(e));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const action = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const inspect = async (path: string) => {
    const data = await previewBackup(path);
    setPreview({ path, data });
  };
  return (
    <section className="content-card space-y-4">
      <h2 className="font-semibold">自动备份与恢复检查</h2>
      <p className="text-sm text-[var(--text-secondary)]">
        软件运行时执行，错过的备份在下次启动补做。普通数据与附件未加密，私密记录保留原有加密。自动清理仅处理校验一致的本应用自动备份。
      </p>
      {error && (
        <p role="alert" className="text-[var(--danger)]">
          {error}
        </p>
      )}
      {config && (
        <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
          <label>
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(e) =>
                setConfig({ ...config, enabled: e.target.checked })
              }
            />{" "}
            启用自动备份
          </label>
          <label className="form-label">
            间隔（小时）
            <input
              type="number"
              min="1"
              max="168"
              className="form-control"
              value={config.intervalHours}
              onChange={(e) =>
                setConfig({ ...config, intervalHours: Number(e.target.value) })
              }
            />
          </label>
          <label className="form-label">
            备份目录
            <input
              className="form-control"
              value={config.directory}
              onChange={(e) =>
                setConfig({ ...config, directory: e.target.value })
              }
            />
          </label>
          <label className="form-label">
            保留数量
            <input
              type="number"
              min="1"
              max="100"
              className="form-control"
              value={config.retain}
              onChange={(e) =>
                setConfig({ ...config, retain: Number(e.target.value) })
              }
            />
          </label>
          <Button onClick={() => void action(() => saveBackupConfig(config))}>
            保存配置
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              void action(async () => {
                await flushAllNotes();
                await automaticBackup(true);
              })
            }
          >
            立即备份
          </Button>
        </fieldset>
      )}
      <div className="text-sm">
        最近成功：
        {status?.records[0]
          ? new Date(status.records[0].createdAt).toLocaleString()
          : "暂无"}{" "}
        · 下次：
        {status?.nextAt
          ? new Date(Math.max(Date.now(), status.nextAt)).toLocaleString()
          : "已停用"}
      </div>
      {status?.lastError && (
        <p className="text-[var(--danger)]">最近失败：{status.lastError}</p>
      )}
      <Button
        disabled={busy}
        variant="secondary"
        onClick={() =>
          void action(() => workspaceCall("open_backup_directory"))
        }
      >
        打开备份目录
      </Button>
      <Button
        disabled={busy}
        variant="secondary"
        onClick={() =>
          void action(async () => {
            const path = await open({
              multiple: false,
              filters: [{ name: "完整数据库", extensions: ["sqlite3", "db"] }],
            });
            if (typeof path === "string") await inspect(path);
          })
        }
      >
        检查并恢复备份
      </Button>
      <div className="max-h-64 overflow-auto">
        {status?.records.map((r) => (
          <div
            key={r.id}
            className="border-t border-[var(--border)] py-3 text-sm"
          >
            <div>
              {new Date(r.createdAt).toLocaleString()} ·{" "}
              {(r.size / 1024).toFixed(1)} KB · 数据版本 {r.schemaVersion}
            </div>
            <p className="break-all text-xs text-[var(--text-secondary)]">
              {r.path}
            </p>
            <Button
              disabled={busy}
              size="sm"
              variant="ghost"
              onClick={() => void action(() => inspect(r.path))}
            >
              校验与恢复
            </Button>
          </div>
        ))}
      </div>
      <Dialog
        open={preview !== null}
        onOpenChange={(value) => {
          if (!value && !busy) setPreview(null);
        }}
        title="恢复预览"
        description="恢复将替换全部模块及登录配置；操作前自动保留当前数据库副本。"
      >
        {preview && (
          <div className="space-y-4">
            <p>
              备份版本 {preview.data.schemaVersion} →{" "}
              {preview.data.upgradedVersion}，升级校验通过。
            </p>
            <p>
              {preview.data.hasSecurity
                ? "恢复后使用备份时的密码登录"
                : "此备份无密码配置，恢复后进入首次设置"}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {preview.data.counts.map(([name, count]) => (
                <p key={name}>
                  {name}：{count}
                </p>
              ))}
            </div>
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await restoreDatabase(preview.path);
                  setPreview(null);
                })
              }
            >
              {busy ? "恢复中…" : "确认恢复全部数据"}
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}
