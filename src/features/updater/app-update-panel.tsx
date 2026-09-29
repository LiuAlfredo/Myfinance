import { CheckCircle2, Download, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "@/components/ui/button";
import { checkForAppUpdate, isDesktopApp } from "./updater-service";

type UpdateStatus =
  | "idle"
  | "checking"
  | "current"
  | "available"
  | "downloading"
  | "installing"
  | "error";

interface AppUpdatePanelProps {
  currentVersion: string;
}

export function AppUpdatePanel({ currentVersion }: AppUpdatePanelProps) {
  const updateRef = useRef<Update | null>(null);
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [targetVersion, setTargetVersion] = useState<string | null>(null);
  const [message, setMessage] = useState("点击按钮检查是否有新版本。");
  const [progress, setProgress] = useState<number | null>(null);

  async function checkUpdate() {
    setStatus("checking");
    setMessage("正在连接更新服务器…");
    setProgress(null);
    try {
      if (updateRef.current) await updateRef.current.close();
      const update = await checkForAppUpdate();
      updateRef.current = update;
      if (!update) {
        setStatus("current");
        setTargetVersion(null);
        setMessage("当前已经是最新版本。");
        return;
      }
      setStatus("available");
      setTargetVersion(update.version);
      setMessage(update.body?.trim() || "新版本已经可以下载并安装。");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "检查更新失败，请稍后重试。",
      );
    }
  }

  async function installUpdate() {
    const update = updateRef.current;
    if (!update) return;
    setStatus("downloading");
    setMessage("正在下载更新…");
    setProgress(0);
    let downloaded = 0;
    let total: number | undefined;
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setProgress(
            total
              ? Math.min(100, Math.round((downloaded / total) * 100))
              : null,
          );
        } else {
          setStatus("installing");
          setProgress(100);
          setMessage("下载完成，正在安装。应用会自动关闭并重新启动。");
        }
      });
    } catch (error) {
      setStatus("error");
      setProgress(null);
      setMessage(
        error instanceof Error ? error.message : "更新安装失败，请稍后重试。",
      );
    }
  }

  const busy =
    status === "checking" ||
    status === "downloading" ||
    status === "installing";
  const desktop = isDesktopApp();

  return (
    <section className="content-card">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="icon-badge icon-badge-primary">
            <Download className="size-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-[var(--text)]">
              软件更新
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              当前版本 {currentVersion}
              {targetVersion ? ` · 可更新至 ${targetVersion}` : ""}
            </p>
            <p
              className={`mt-2 text-sm ${status === "error" ? "text-[var(--danger)]" : "text-[var(--text-tertiary)]"}`}
            >
              {desktop ? message : "请在安装后的 Windows 桌面应用中检查更新。"}
            </p>
          </div>
        </div>
        {status === "available" ? (
          <Button onClick={() => void installUpdate()}>
            <Download className="size-4" />
            立即更新
          </Button>
        ) : (
          <Button
            variant="outline"
            disabled={!desktop || busy}
            onClick={() => void checkUpdate()}
          >
            {status === "current" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <RefreshCw className={`size-4 ${busy ? "animate-spin" : ""}`} />
            )}
            {status === "checking"
              ? "正在检查"
              : status === "downloading"
                ? "正在下载"
                : status === "installing"
                  ? "正在安装"
                  : "检查更新"}
          </Button>
        )}
      </div>
      {status === "downloading" || status === "installing" ? (
        <div className="mt-4" aria-label="更新下载进度">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className={`h-full rounded-full bg-[var(--accent)] transition-[width] ${progress === null ? "w-1/3 animate-pulse" : ""}`}
              style={progress === null ? undefined : { width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-right text-xs text-[var(--text-tertiary)]">
            {progress === null ? "正在接收数据" : `${progress}%`}
          </p>
        </div>
      ) : null}
    </section>
  );
}
