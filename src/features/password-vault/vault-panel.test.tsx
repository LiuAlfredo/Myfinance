import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/auth-store";
import { VaultPanel } from "./vault-panel";
import { getVaultItem, listVaultItems, lockVault, unlockVault } from "./vault-service";
import type { VaultItem } from "./vault-service";

vi.mock("./vault-service");

beforeEach(() => {
  vi.resetAllMocks();
  useAuthStore.setState({ isAuthenticated: true });
  vi.mocked(unlockVault).mockResolvedValue(true);
  vi.mocked(lockVault).mockResolvedValue();
  vi.mocked(listVaultItems).mockResolvedValue([{ id: "one", platform: "示例平台", username: "user", updatedAt: 1000 }]);
});

it("keeps the password out of the list and clears it when locked", async () => {
  const item: VaultItem = { id: "one", platform: "示例平台", website: "", username: "user", password: "hidden-secret", note: "", updatedAt: 1000 };
  vi.mocked(getVaultItem).mockResolvedValue(item);
  render(<VaultPanel />);
  fireEvent.change(screen.getByLabelText("软件密码"), { target: { value: "long-password" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁密码库" }));
  await screen.findByRole("button", { name: /示例平台/ });
  expect(screen.queryByText("hidden-secret")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /示例平台/ }));
  await screen.findByRole("dialog");
  expect(screen.queryByText(/hidden-secret/)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "显示密码" }));
  expect(screen.getByText(/hidden-secret/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "立即锁定" }));
  await waitFor(() => expect(screen.queryByText(/hidden-secret/)).toBeNull());
  expect(lockVault).toHaveBeenCalled();
});

it("discards a detail response arriving after lock", async () => {
  let resolve!: (value: VaultItem) => void;
  vi.mocked(getVaultItem).mockReturnValue(new Promise<VaultItem>((done) => { resolve = done; }));
  render(<VaultPanel />);
  fireEvent.change(screen.getByLabelText("软件密码"), { target: { value: "long-password" } });
  fireEvent.click(screen.getByRole("button", { name: "解锁密码库" }));
  fireEvent.click(await screen.findByRole("button", { name: /示例平台/ }));
  fireEvent.click(screen.getByRole("button", { name: "立即锁定" }));
  await act(async () => resolve({ id: "one", platform: "示例平台", website: "", username: "user", password: "late-secret", note: "", updatedAt: 1000 }));
  expect(screen.queryByText(/late-secret/)).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});
