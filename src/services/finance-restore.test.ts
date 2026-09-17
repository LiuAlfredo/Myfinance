import { beforeEach, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/stores/auth-store";
import { restoreDatabase } from "./finance-service";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "__TAURI_INTERNALS__", { configurable: true, value: {} });
  window.sessionStorage.clear();
  useAuthStore.setState({ isAuthenticated: true });
});

it("clears authentication after restore and explains which password to use", async () => {
  vi.mocked(invoke).mockResolvedValue(undefined);
  await restoreDatabase("test-backup.sqlite3");
  expect(useAuthStore.getState().isAuthenticated).toBe(false);
  expect(window.sessionStorage.getItem("my-personal-affairs:login-notice")).toContain("备份时的密码");
  expect(invoke).toHaveBeenCalledWith("restore_database", { source: "test-backup.sqlite3" });
});

it("keeps the session usable when restoring fails", async () => {
  vi.mocked(invoke).mockRejectedValueOnce(new Error("备份无效"));
  await expect(restoreDatabase("invalid.sqlite3")).rejects.toThrow("备份无效");
  expect(useAuthStore.getState().isAuthenticated).toBe(true);
  expect(invoke).not.toHaveBeenCalledWith("lock_private_data");
});
