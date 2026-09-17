import { invoke } from "@tauri-apps/api/core";

export interface VaultInput {
  platform: string;
  website: string;
  username: string;
  password: string;
  note: string;
}

export interface VaultSummary {
  id: string;
  platform: string;
  username: string;
  updatedAt: number;
}

export interface VaultItem extends VaultInput {
  id: string;
  updatedAt: number;
}

function desktop() {
  if (!("__TAURI_INTERNALS__" in window)) {
    throw new Error("密码库仅在桌面应用中可用");
  }
}

export async function unlockVault(password: string) {
  desktop();
  return invoke<boolean>("unlock_password_vault", { password });
}

export async function lockVault() {
  desktop();
  return invoke<void>("lock_password_vault");
}

export async function listVaultItems() {
  desktop();
  return invoke<VaultSummary[]>("list_vault_items");
}

export async function getVaultItem(id: string) {
  desktop();
  return invoke<VaultItem>("get_vault_item", { id });
}

export async function saveVaultItem(input: VaultInput, idOpt?: string) {
  desktop();
  return invoke<VaultSummary>("save_vault_item", { input, idOpt });
}

export async function deleteVaultItem(id: string) {
  desktop();
  return invoke<void>("delete_vault_item", { id });
}
