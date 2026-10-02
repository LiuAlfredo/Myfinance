interface Env {
  DB: D1Database;
  SYNC_TOKEN_HASH: string;
}

interface BackupRow {
  id: string;
  device_id: string;
  created_at: number;
  uploaded_at: number;
  encrypted_size: number;
  source_size: number;
  schema_version: number;
  checksum: string;
  backup_kind: "AUTO" | "MANUAL" | "PRE_RESTORE";
  pinned: number;
}

interface CleanupInput {
  deviceId: string;
  retain: number;
  protectHours: number;
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const CHUNK_BYTES = 512 * 1024;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;
const DEVICE_PATTERN = /^[0-9a-zA-Z._-]{1,80}$/;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const BACKUP_KINDS = new Set(["AUTO", "MANUAL", "PRE_RESTORE"]);

function json(value: unknown, status = 200): Response {
  return Response.json(value, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function hex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string | ArrayBuffer): Promise<string> {
  const data = typeof value === "string" ? new TextEncoder().encode(value) : value;
  return hex(await crypto.subtle.digest("SHA-256", data));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function authorized(request: Request, env: Env): Promise<boolean> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  if (token.length < 24 || token.length > 256) return false;
  return constantTimeEqual(await sha256(token), env.SYNC_TOKEN_HASH.toLowerCase());
}

function integerHeader(request: Request, name: string): number | null {
  const raw = request.headers.get(name);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

async function createBackup(request: Request, env: Env): Promise<Response> {
  const id = request.headers.get("x-backup-id") ?? "";
  const deviceId = request.headers.get("x-device-id") ?? "";
  const checksum = (request.headers.get("x-checksum") ?? "").toLowerCase();
  const createdAt = integerHeader(request, "x-created-at");
  const sourceSize = integerHeader(request, "x-source-size");
  const schemaVersion = integerHeader(request, "x-schema-version");
  const declaredSize = Number(request.headers.get("content-length") ?? "0");
  const backupKind = (request.headers.get("x-backup-kind") ?? "MANUAL").toUpperCase();

  if (
    !ID_PATTERN.test(id) ||
    !DEVICE_PATTERN.test(deviceId) ||
    !CHECKSUM_PATTERN.test(checksum) ||
    createdAt === null ||
    sourceSize === null ||
    schemaVersion === null ||
    !BACKUP_KINDS.has(backupKind)
  ) {
    return json({ error: "invalid backup metadata" }, 400);
  }
  if (declaredSize > MAX_BACKUP_BYTES) {
    return json({ error: "backup exceeds 20 MiB" }, 413);
  }

  const body = await request.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BACKUP_BYTES) {
    return json({ error: "invalid backup size" }, 413);
  }
  if (!constantTimeEqual(await sha256(body), checksum)) {
    return json({ error: "checksum mismatch" }, 400);
  }

  const uploadedAt = Date.now();
  const existing = await env.DB.prepare("SELECT id, checksum, status FROM backups WHERE id = ?1")
    .bind(id)
    .first<{ id: string; checksum: string; status: string }>();
  if (existing) {
    if (existing.checksum === checksum && existing.status === "COMPLETE") {
      return json({ id, uploadedAt, duplicate: true });
    }
    return json({ error: "backup already exists" }, 409);
  }

  const chunkCount = Math.ceil(body.byteLength / CHUNK_BYTES);
  try {
    await env.DB.prepare(
      `INSERT INTO backups
       (id, device_id, created_at, uploaded_at, encrypted_size, source_size, schema_version, checksum, chunk_count, status, backup_kind, pinned)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'UPLOADING', ?10, 0)`,
    )
      .bind(
        id,
        deviceId,
        createdAt,
        uploadedAt,
        body.byteLength,
        sourceSize,
        schemaVersion,
        checksum,
        chunkCount,
        backupKind,
      )
      .run();
    const bytes = new Uint8Array(body);
    for (let offset = 0, index = 0; offset < bytes.length; offset += CHUNK_BYTES, index += 1) {
      await env.DB.prepare(
        "INSERT INTO backup_chunks(backup_id, chunk_index, payload) VALUES (?1, ?2, ?3)",
      )
        .bind(id, index, bytes.slice(offset, offset + CHUNK_BYTES).buffer)
        .run();
    }
    await env.DB.prepare("UPDATE backups SET status = 'COMPLETE' WHERE id = ?1")
      .bind(id)
      .run();
  } catch (error) {
    await env.DB.prepare("DELETE FROM backups WHERE id = ?1").bind(id).run();
    throw error;
  }
  return json({ id, uploadedAt }, 201);
}

async function listBackups(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, device_id, created_at, uploaded_at, encrypted_size,
            source_size, schema_version, checksum, backup_kind, pinned
     FROM backups WHERE status = 'COMPLETE' ORDER BY created_at DESC LIMIT 50`,
  ).all<BackupRow>();
  return json({
    backups: result.results.map((row) => ({
      id: row.id,
      deviceId: row.device_id,
      createdAt: row.created_at,
      uploadedAt: row.uploaded_at,
      encryptedSize: row.encrypted_size,
      sourceSize: row.source_size,
      schemaVersion: row.schema_version,
      checksum: row.checksum,
      backupKind: row.backup_kind,
      pinned: row.pinned === 1,
    })),
  });
}

function validCleanupInput(value: unknown): value is CleanupInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<CleanupInput>;
  return (
    typeof input.deviceId === "string" &&
    DEVICE_PATTERN.test(input.deviceId) &&
    Number.isInteger(input.retain) &&
    Number(input.retain) >= 1 &&
    Number(input.retain) <= 100 &&
    Number.isInteger(input.protectHours) &&
    Number(input.protectHours) >= 1 &&
    Number(input.protectHours) <= 720
  );
}

async function cleanupBackups(request: Request, env: Env, dryRun: boolean): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid cleanup request" }, 400);
  }
  if (!validCleanupInput(input)) return json({ error: "invalid cleanup policy" }, 400);
  const cutoff = Date.now() - input.protectHours * 3_600_000;
  const candidates = await env.DB.prepare(
    `SELECT id, encrypted_size FROM backups
     WHERE device_id = ?1 AND backup_kind = 'AUTO' AND pinned = 0
       AND status = 'COMPLETE' AND uploaded_at < ?2
       AND id NOT IN (
         SELECT id FROM backups
         WHERE device_id = ?1 AND backup_kind = 'AUTO' AND pinned = 0 AND status = 'COMPLETE'
         ORDER BY uploaded_at DESC LIMIT ?3
       )
     ORDER BY uploaded_at ASC LIMIT 100`,
  )
    .bind(input.deviceId, cutoff, input.retain)
    .all<{ id: string; encrypted_size: number }>();
  const ids = candidates.results.map((row) => row.id);
  const bytes = candidates.results.reduce((sum, row) => sum + row.encrypted_size, 0);
  if (!dryRun && ids.length > 0) {
    await env.DB.batch(ids.map((id) => env.DB.prepare("DELETE FROM backups WHERE id = ?1").bind(id)));
  }
  return json({ deletedIds: dryRun ? [] : ids, candidateIds: ids, bytes });
}

async function updateBackup(request: Request, id: string, env: Env): Promise<Response> {
  if (!ID_PATTERN.test(id)) return json({ error: "invalid backup id" }, 400);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid update request" }, 400);
  }
  if (!body || typeof body !== "object" || typeof (body as { pinned?: unknown }).pinned !== "boolean") {
    return json({ error: "pinned must be boolean" }, 400);
  }
  const result = await env.DB.prepare("UPDATE backups SET pinned = ?2 WHERE id = ?1 AND status = 'COMPLETE'")
    .bind(id, (body as { pinned: boolean }).pinned ? 1 : 0)
    .run();
  return result.meta.changes === 0 ? json({ error: "backup not found" }, 404) : json({ ok: true });
}

async function deleteBackup(id: string, env: Env): Promise<Response> {
  if (!ID_PATTERN.test(id)) return json({ error: "invalid backup id" }, 400);
  const row = await env.DB.prepare("SELECT pinned FROM backups WHERE id = ?1").bind(id).first<{ pinned: number }>();
  if (!row) return json({ ok: true });
  if (row.pinned === 1) return json({ error: "pinned backup cannot be deleted" }, 409);
  await env.DB.prepare("DELETE FROM backups WHERE id = ?1").bind(id).run();
  return json({ ok: true });
}

async function downloadBackup(id: string, env: Env): Promise<Response> {
  if (!ID_PATTERN.test(id)) return json({ error: "invalid backup id" }, 400);
  const row = await env.DB.prepare(
    "SELECT encrypted_size, checksum FROM backups WHERE id = ?1 AND status = 'COMPLETE'",
  )
    .bind(id)
    .first<{ encrypted_size: number; checksum: string }>();
  if (!row) return json({ error: "backup not found" }, 404);
  const chunks = await env.DB.prepare(
    "SELECT payload FROM backup_chunks WHERE backup_id = ?1 ORDER BY chunk_index",
  )
    .bind(id)
    .all<{ payload: ArrayBuffer | number[] }>();
  const payload = new Uint8Array(row.encrypted_size);
  let offset = 0;
  for (const chunk of chunks.results) {
    const bytes = chunk.payload instanceof ArrayBuffer
      ? new Uint8Array(chunk.payload)
      : new Uint8Array(chunk.payload);
    payload.set(bytes, offset);
    offset += bytes.length;
  }
  if (offset !== row.encrypted_size || !constantTimeEqual(await sha256(payload.buffer), row.checksum)) {
    return json({ error: "backup chunks are incomplete" }, 503);
  }
  return new Response(payload, {
    headers: {
      "content-type": "application/octet-stream",
      "content-length": String(payload.byteLength),
      "x-checksum": row.checksum,
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "myfinance-cloud-backup" });
    }
    if (!url.pathname.startsWith("/v1/backups")) {
      return json({ error: "not found" }, 404);
    }
    if (!(await authorized(request, env))) {
      return json({ error: "unauthorized" }, 401);
    }
    if (request.method === "POST" && url.pathname === "/v1/backups") {
      return createBackup(request, env);
    }
    if (request.method === "GET" && url.pathname === "/v1/backups") {
      return listBackups(env);
    }
    if (request.method === "POST" && url.pathname === "/v1/backups/cleanup-preview") {
      return cleanupBackups(request, env, true);
    }
    if (request.method === "POST" && url.pathname === "/v1/backups/cleanup") {
      return cleanupBackups(request, env, false);
    }
    const match = url.pathname.match(/^\/v1\/backups\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && match) {
      return downloadBackup(match[1], env);
    }
    if (request.method === "PATCH" && match) {
      return updateBackup(request, match[1], env);
    }
    if (request.method === "DELETE" && match) {
      return deleteBackup(match[1], env);
    }
    return json({ error: "method not allowed" }, 405);
  },
} satisfies ExportedHandler<Env>;
