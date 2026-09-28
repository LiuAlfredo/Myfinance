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
export interface SearchHit {
  id: string;
  kind: string;
  title: string;
  detail: string;
  url: string;
}
export const searchWorkspace = (query: string, kind: string) =>
  workspaceCall<SearchHit[]>("search_workspace", { query, kind });
