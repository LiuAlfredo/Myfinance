import { invoke } from "@tauri-apps/api/core";
import type { KnowledgeNoteInput } from "./life-service";
export async function workspaceCall<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!("__TAURI_INTERNALS__" in window))
    throw new Error("此功能需要在桌面应用中使用");
  try {
    return await invoke<T>(command, args);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : String(e));
  }
}
export interface NoteResource {
  id: string;
  noteId: string;
  name: string;
  payload: string | null;
  createdAt: number;
  size: number;
  revision: number;
}
export const noteResources = (kind: string, noteId?: string) =>
  "__TAURI_INTERNALS__" in window
    ? workspaceCall<NoteResource[]>("list_note_resources", {
        kind,
        noteId: noteId ?? null,
      })
    : Promise.resolve([]);
export const stageDraft = (noteId: string, input: KnowledgeNoteInput) =>
  "__TAURI_INTERNALS__" in window
    ? workspaceCall<void>("stage_note_draft", { noteId, input })
    : Promise.resolve();
export const discardDraft = (noteId: string) =>
  workspaceCall<void>("discard_note_draft", { noteId });
export const restoreVersion = (
  noteId: string,
  versionId: string,
  expectedRevision: number,
) =>
  workspaceCall<void>("restore_note_version", {
    noteId,
    versionId,
    expectedRevision,
  });
export interface BackupConfig {
  enabled: boolean;
  directory: string;
  intervalHours: number;
  retain: number;
}
export interface BackupRecord {
  id: string;
  path: string;
  createdAt: number;
  size: number;
  schemaVersion: number;
  checksum: string;
}
export interface BackupStatus {
  config: BackupConfig;
  records: BackupRecord[];
  lastError: string | null;
  nextAt: number | null;
}
export interface BackupPreview {
  schemaVersion: number;
  upgradedVersion: number;
  hasSecurity: boolean;
  counts: Array<[string, number]>;
}
export const backupStatus = () =>
  workspaceCall<BackupStatus>("get_backup_status");
export const saveBackupConfig = (input: BackupConfig) =>
  workspaceCall<void>("save_backup_config", { input });
export const automaticBackup = (force = false) =>
  workspaceCall<string | null>("run_automatic_backup", { force });
export const previewBackup = (source: string) =>
  workspaceCall<BackupPreview>("preview_database_backup", { source });
export interface CloudBackupStatus {
  configured: boolean;
  endpoint: string | null;
  deviceId: string | null;
  lastSuccess: number | null;
  lastError: string | null;
  policy: CloudBackupPolicy;
  nextAt: number | null;
  currentRevision: number;
  lastBackupRevision: number;
  running: boolean;
  signedIn: boolean;
  username: string | null;
  accountId: string | null;
  sessionExpiresAt: number | null;
}
export interface CloudAccountInfo {
  accountId: string;
  username: string;
  expiresAt: number;
}
export interface CloudBackupPolicy {
  enabled: boolean;
  intervalHours: number;
  retain: number;
  protectHours: number;
}
export interface CloudBackupRecord {
  id: string;
  deviceId: string;
  createdAt: number;
  uploadedAt: number;
  encryptedSize: number;
  sourceSize: number;
  schemaVersion: number;
  checksum: string;
  backupKind: "AUTO" | "MANUAL" | "PRE_RESTORE";
  pinned: boolean;
}
export const generateCloudRecoveryKey = () =>
  workspaceCall<string>("generate_cloud_recovery_key");
export const saveCloudBackupConfig = (input: {
  endpoint: string;
  recoveryKey: string;
}) => workspaceCall<void>("save_cloud_backup_config", { input });
export const registerCloudAccount = (input: {
  endpoint: string;
  username: string;
  password: string;
  recoveryKey: string;
}) => workspaceCall<CloudAccountInfo>("register_cloud_account", { input });
export const loginCloudAccount = (input: {
  endpoint: string;
  username: string;
  password: string;
  recoveryKey: string;
}) => workspaceCall<CloudAccountInfo>("login_cloud_account", { input });
export const logoutCloudAccount = () =>
  workspaceCall<void>("logout_cloud_account");
export const cloudBackupStatus = () =>
  workspaceCall<CloudBackupStatus>("get_cloud_backup_status");
export const testCloudBackup = () =>
  workspaceCall<void>("test_cloud_backup");
export const listCloudBackups = () =>
  workspaceCall<CloudBackupRecord[]>("list_cloud_backups");
export const uploadCloudBackup = () =>
  workspaceCall<CloudBackupRecord>("upload_cloud_backup");
export const automaticCloudBackup = (force = false) =>
  workspaceCall<CloudBackupRecord | null>("run_automatic_cloud_backup", {
    force,
  });
export const saveCloudBackupPolicy = (input: CloudBackupPolicy) =>
  workspaceCall<void>("save_cloud_backup_policy", { input });
export const cleanupCloudBackups = (dryRun = false) =>
  workspaceCall<string[]>("cleanup_cloud_backups", { dryRun });
export const setCloudBackupPinned = (backupId: string, pinned: boolean) =>
  workspaceCall<void>("set_cloud_backup_pinned", { backupId, pinned });
export const deleteCloudBackup = (backupId: string) =>
  workspaceCall<void>("delete_cloud_backup", { backupId });
export const previewCloudBackup = (backupId: string) =>
  workspaceCall<BackupPreview>("preview_cloud_backup", { backupId });
export const restoreCloudBackup = (backupId: string) =>
  workspaceCall<void>("restore_cloud_backup", { backupId });
export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  detail: string;
  url: string;
}
export const searchWorkspace = (query: string, kind: string) =>
  workspaceCall<SearchHit[]>("search_workspace", { query, kind });
