import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  cloudBackupStatus,
  cleanupCloudBackups,
  deleteCloudBackup,
  generateCloudRecoveryKey,
  listCloudBackups,
  previewCloudBackup,
  restoreCloudBackup,
  saveCloudBackupConfig,
  saveCloudBackupPolicy,
  setCloudBackupPinned,
  testCloudBackup,
  uploadCloudBackup,
  type BackupPreview,
  type CloudBackupRecord,
  type CloudBackupPolicy,
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
  const [policy, setPolicy] = useState<CloudBackupPolicy>({
    enabled: true,
    intervalHours: 24,
    retain: 10,
    protectHours: 24,
  });
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
    setPolicy(current.policy);
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
        <div className="rounded-lg border border-[var(--border)] p-3 md:col-span-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={policy.enabled}
              onChange={(event) =>
                setPolicy((value) => ({
                  ...value,
                  enabled: event.target.checked,
                }))
              }
            />
            自动上传云备份
          </label>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="form-label">
              最短间隔（小时）
              <input
                className="form-control"
                type="number"
                min={1}
                max={168}
                value={policy.intervalHours}
                onChange={(event) =>
                  setPolicy((value) => ({
                    ...value,
                    intervalHours: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="form-label">
              每台设备保留自动备份
              <input
                className="form-control"
                type="number"
                min={1}
                max={100}
                value={policy.retain}
                onChange={(event) =>
                  setPolicy((value) => ({
                    ...value,
                    retain: Number(event.target.value),
                  }))
                }
              />
            </label>
            <label className="form-label">
              新备份保护期（小时）
              <input
                className="form-control"
                type="number"
                min={1}
                max={720}
                value={policy.protectHours}
                onChange={(event) =>
                  setPolicy((value) => ({
                    ...value,
                    protectHours: Number(event.target.value),
                  }))
                }
              />
            </label>
          </div>
          <Button
            className="mt-3"
            type="button"
            variant="secondary"
            onClick={() =>
              void action(async () => {
                await saveCloudBackupPolicy(policy);
                await load();
                showToast("自动云备份策略已保存");
              })
            }
          >
            保存自动备份策略
          </Button>
        </div>
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
          <Button
            variant="secondary"
            disabled={!status?.configured}
            onClick={() =>
              void action(async () => {
                const candidates = await cleanupCloudBackups(true);
                if (candidates.length === 0) {
                  showToast("当前没有需要清理的自动备份");
                  return;
                }
                if (!window.confirm(`将删除 ${candidates.length} 份过期自动备份，是否继续？`))
                  return;
                await cleanupCloudBackups(false);
                await load();
                showToast(`已清理 ${candidates.length} 份过期自动备份`);
              })
            }
          >
            清理旧自动备份
          </Button>
        </div>
      </fieldset>
      <div className="text-sm text-[var(--text-secondary)]">
        状态：{status?.configured ? "已配置" : "未配置"}
        {status?.lastSuccess
          ? ` · 最近成功 ${new Date(status.lastSuccess).toLocaleString()}`
          : ""}
        {status?.nextAt
          ? ` · 下次最早 ${new Date(status.nextAt).toLocaleString()}`
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
              {record.pinned ? " · 已固定" : ""}
            </div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              {record.backupKind === "AUTO" ? "自动备份" : "手动备份"} · 设备{" "}
              {record.deviceId.slice(0, 8)} · 密文{" "}
              {(record.encryptedSize / 1024).toFixed(1)} KB
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
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
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await setCloudBackupPinned(record.id, !record.pinned);
                    await load();
                    showToast(record.pinned ? "已取消固定" : "备份已固定保留");
                  })
                }
              >
                {record.pinned ? "取消固定" : "固定保留"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || record.pinned}
                onClick={() => {
                  if (!window.confirm("确定永久删除这份云备份吗？")) return;
                  void action(async () => {
                    await deleteCloudBackup(record.id);
                    await load();
                    showToast("云备份已删除");
                  });
                }}
              >
                删除
              </Button>
            </div>
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
