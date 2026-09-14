import { invoke } from "@tauri-apps/api/core";

export interface AppInfo {
  name: string;
  version: string;
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

export async function getAppInfo(): Promise<AppInfo> {
  if (!isTauriRuntime()) {
    return { name: "MyFinance", version: "Web preview" };
  }

  return invoke<AppInfo>("get_app_info");
}
