import { check, type Update } from "@tauri-apps/plugin-updater";

export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function checkForAppUpdate(): Promise<Update | null> {
  if (!isDesktopApp()) {
    throw new Error("请在安装后的 Windows 桌面应用中检查更新。");
  }
  return check({ timeout: 20_000 });
}
