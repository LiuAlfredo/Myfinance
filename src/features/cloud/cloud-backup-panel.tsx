import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  cloudBackupStatus,
  generateCloudRecoveryKey,
  listCloudBackups,
  previewCloudBackup,
  restoreCloudBackup,
  saveCloudBackupConfig,
  testCloudBackup,
  uploadCloudBackup,
  type BackupPreview,
  type CloudBackupRecord,
  type CloudBackupStatus,
} from "@/features/life/workspace-service";
import { flushAllNotes } from "@/features/life/note-save-queue";
import { useUiStore } from "@/stores/ui-store";

const DEFAULT_ENDPOINT =
  "https://myfinance-cloud-backup.liuzheng85857.workers.dev";

export function CloudBackupPanel() {
  const [status, setStatus] = useState<CloudBackupStatus | null>(null);
  const [records, setRecords] = useState<CloudBackupRecord[]>([]);
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  const [recoveryKey, setRecoveryKey] = useState("");
  const [showRecoveryKey, setShowRecoveryKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{
    record: CloudBackupRecord;
    data: BackupPreview;
  } | null>(null);
  const showToast = useUiStore((state) => state.showToast);

  const load = useCallback(async () => {
    const current = await cloudBackupStatus();
    setStatus(current);
    setEndpoint((value) => value || current.endpoint || "");
    if (current.configured) setRecords(await listCloudBackups());
    else setRecords([]);
  }, []);

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setError(reason instanceof Error ? reason.message : String(reason)),
    );
  }, [load]);

  const action = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="content-card space-y-4">
      <div>
        <h2 className="font-semibold">加密云备份</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          本地 SQLite 继续作为主数据库。上传前使用恢复密钥进行 AES-256-GCM
          加密，Cloudflare 仅保存密文和备份元数据。
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">
        <label className="form-label md:col-span-2">
          Worker 地址
          <input
            className="form-control"
            type="url"
            placeholder="https://myfinance-cloud-backup.example.workers.dev"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
          />
        </label>
        <label className="form-label">
          {status?.configured ? "输入恢复密钥以重新配置" : "恢复密钥"}
          <input
            className="form-control"
            type={showRecoveryKey ? "text" : "password"}
            autoComplete="new-password"
            minLength={24}
            value={recoveryKey}
            onChange={(event) => setRecoveryKey(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setShowRecoveryKey((value) => !value)}
          >
            {showRecoveryKey ? "隐藏密钥" : "显示密钥"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              void action(async () => {
                const key = await generateCloudRecoveryKey();
                setRecoveryKey(key);
                setShowRecoveryKey(true);
              })
            }
          >
            生成密钥
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!recoveryKey}
            onClick={() =>
              void navigator.clipboard.writeText(recoveryKey).then(() =>
                showToast("恢复密钥已复制，请保存到安全位置"),
              )
            }
          >
            复制密钥
          </Button>
        </div>
        <p className="text-xs text-[var(--danger)] md:col-span-2">
          丢失恢复密钥后，云端密文无法恢复。密钥只加密保存在本机，不会上传到 Cloudflare。
        </p>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Button
            disabled={!endpoint.trim() || !recoveryKey.trim()}
            onClick={() =>
              void action(async () => {
                await saveCloudBackupConfig({
                  endpoint: endpoint.trim(),
                  recoveryKey: recoveryKey.trim(),
                });
                await testCloudBackup();
                setRecoveryKey("");
                setShowRecoveryKey(false);
                await load();
                showToast("云备份配置已保存并验证");
              })
            }
          >
            保存并测试
          </Button>
          <Button
            variant="secondary"
            disabled={!status?.configured}
            onClick={() =>
              void action(async () => {
                await testCloudBackup();
                showToast("云端连接正常");
              })
            }
          >
            测试连接
          </Button>
          <Button
            variant="secondary"
            disabled={!status?.configured}
            onClick={() =>
              void action(async () => {
                await flushAllNotes();
                await uploadCloudBackup();
                await load();
                showToast("加密云备份已完成");
              })
            }
          >
            立即上传加密备份
          </Button>
        </div>
      </fieldset>
      <div className="text-sm text-[var(--text-secondary)]">
        状态：{status?.configured ? "已配置" : "未配置"}
        {status?.lastSuccess
          ? ` · 最近成功 ${new Date(status.lastSuccess).toLocaleString()}`
          : ""}
      </div>
      {status?.lastError && (
        <p className="text-sm text-[var(--danger)]">
          最近失败：{status.lastError}
        </p>
      )}
      <div className="max-h-72 overflow-auto">
        {records.length === 0 && status?.configured ? (
          <p className="text-sm text-[var(--text-tertiary)]">云端暂无备份。</p>
        ) : null}
        {records.map((record) => (
          <div
            key={record.id}
            className="border-t border-[var(--border)] py-3 text-sm"
          >
            <div>
              {new Date(record.createdAt).toLocaleString()} ·{" "}
              {(record.sourceSize / 1024).toFixed(1)} KB · 数据版本{" "}
              {record.schemaVersion}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              设备 {record.deviceId.slice(0, 8)} · 密文{" "}
              {(record.encryptedSize / 1024).toFixed(1)} KB
            </p>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const data = await previewCloudBackup(record.id);
                  setPreview({ record, data });
                })
              }
            >
              校验与恢复
            </Button>
          </div>
        ))}
      </div>
      <Dialog
        open={preview !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setPreview(null);
        }}
        title="恢复云备份"
        description="恢复将替换本机全部模块及登录配置；操作前会自动保留当前数据库副本。"
      >
        {preview && (
          <div className="space-y-4">
            <p>
              备份版本 {preview.data.schemaVersion} →{" "}
              {preview.data.upgradedVersion}，解密与升级校验通过。
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {preview.data.counts.map(([name, count]) => (
                <p key={name}>
                  {name}：{count}
                </p>
              ))}
            </div>
            <p className="text-sm text-[var(--danger)]">
              恢复后需要使用该备份创建时的软件密码重新登录。
            </p>
            <Button
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await restoreCloudBackup(preview.record.id);
                  setPreview(null);
                  window.sessionStorage.setItem(
                    "my-personal-affairs:login-notice",
                    "云备份已恢复，请使用备份时的软件密码重新登录。",
                  );
                  window.location.reload();
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
