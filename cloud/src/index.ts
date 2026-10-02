interface Env {
  DB: D1Database;
  SYNC_TOKEN_HASH: string;
  PASSWORD_PEPPER: string;
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

interface AuthContext {
  accountId: string | null;
  legacy: boolean;
}

interface AccountInput {
  username: string;
  password: string;
  deviceId: string;
}

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const CHUNK_BYTES = 512 * 1024;
const ID_PATTERN = /^[0-9a-f-]{36}$/i;
const DEVICE_PATTERN = /^[0-9a-zA-Z._-]{1,80}$/;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;
const BACKUP_KINDS = new Set(["AUTO", "MANUAL", "PRE_RESTORE"]);
const USERNAME_PATTERN = /^[a-zA-Z0-9_.-]{3,32}$/;
// Cloudflare Workers Web Crypto rejects PBKDF2 iteration counts above 100,000.
// A Worker secret is mixed into the password so a stolen D1 database alone is
// insufficient to run an offline password guessing attack.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_MILLISECONDS = 30 * 24 * 3_600_000;
const LOGIN_WINDOW_MILLISECONDS = 15 * 60_000;
const LOGIN_LOCK_MILLISECONDS = 15 * 60_000;

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

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return base64Url(value);
}

async function passwordHash(
  password: string,
  salt: string,
  iterations: number,
  pepper: string,
): Promise<string> {
  if (typeof pepper !== "string" || pepper.length < 32) {
    throw new Error("PASSWORD_PEPPER must be configured as a Worker secret");
  }
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(`${password}\0${pepper}`),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    material,
    256,
  );
  return hex(bits);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function authorize(request: Request, env: Env): Promise<AuthContext | null> {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (token.length < 24 || token.length > 256) return null;
  const tokenHash = await sha256(token);
  const now = Date.now();
  const session = await env.DB.prepare(
    "SELECT account_id, last_used_at FROM sessions WHERE token_hash = ?1 AND revoked = 0 AND expires_at > ?2",
  )
    .bind(tokenHash, now)
    .first<{ account_id: string; last_used_at: number }>();
  if (session) {
    if (now - session.last_used_at > 3_600_000) {
      await env.DB.prepare("UPDATE sessions SET last_used_at = ?2 WHERE token_hash = ?1")
        .bind(tokenHash, now)
        .run();
    }
    return { accountId: session.account_id, legacy: false };
  }
  if (constantTimeEqual(tokenHash, env.SYNC_TOKEN_HASH.toLowerCase())) {
    return { accountId: null, legacy: true };
  }
  return null;
}

function validAccountInput(value: unknown): value is AccountInput {
  if (!value || typeof value !== "object") return false;
  const input = value as Partial<AccountInput>;
  const passwordBytes =
    typeof input.password === "string" ? new TextEncoder().encode(input.password).byteLength : 0;
  return (
    typeof input.username === "string" &&
    USERNAME_PATTERN.test(input.username.trim()) &&
    typeof input.password === "string" &&
    input.password.length >= 12 &&
    input.password.length <= 128 &&
    passwordBytes <= 256 &&
    typeof input.deviceId === "string" &&
    DEVICE_PATTERN.test(input.deviceId)
  );
}

async function issueSession(accountId: string, deviceId: string, env: Env) {
  const token = randomToken();
  const timestamp = Date.now();
  await env.DB.prepare(
    `INSERT INTO sessions(id, account_id, token_hash, device_id, created_at, last_used_at, expires_at)
     VALUES(?1, ?2, ?3, ?4, ?5, ?5, ?6)`,
  )
    .bind(crypto.randomUUID(), accountId, await sha256(token), deviceId, timestamp, timestamp + SESSION_MILLISECONDS)
    .run();
  return { token, expiresAt: timestamp + SESSION_MILLISECONDS };
}

async function attemptKey(request: Request, username: string): Promise<string> {
  const address = request.headers.get("cf-connecting-ip") ?? "local";
  return sha256(`${address}:${username}`);
}

async function loginAllowed(key: string, env: Env): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT locked_until FROM login_attempts WHERE attempt_key = ?1",
  )
    .bind(key)
    .first<{ locked_until: number }>();
  return !row || row.locked_until <= Date.now();
}

async function recordLoginFailure(key: string, env: Env): Promise<void> {
  const timestamp = Date.now();
  const existing = await env.DB.prepare(
    "SELECT window_started_at, attempt_count FROM login_attempts WHERE attempt_key = ?1",
  )
    .bind(key)
    .first<{ window_started_at: number; attempt_count: number }>();
  const withinWindow = existing && timestamp - existing.window_started_at < LOGIN_WINDOW_MILLISECONDS;
  const count = withinWindow ? existing.attempt_count + 1 : 1;
  const windowStartedAt = withinWindow ? existing.window_started_at : timestamp;
  const lockedUntil = count >= 5 ? timestamp + LOGIN_LOCK_MILLISECONDS : 0;
  await env.DB.prepare(
    `INSERT INTO login_attempts(attempt_key, window_started_at, attempt_count, locked_until)
     VALUES(?1, ?2, ?3, ?4)
     ON CONFLICT(attempt_key) DO UPDATE SET
       window_started_at=excluded.window_started_at,
       attempt_count=excluded.attempt_count,
       locked_until=excluded.locked_until`,
  )
    .bind(key, windowStartedAt, count, lockedUntil)
    .run();
}

async function registerAccount(request: Request, env: Env): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid account request" }, 400);
  }
  if (!validAccountInput(input)) return json({ error: "invalid account or password" }, 400);
  const registrationKey = await sha256(
    `${request.headers.get("cf-connecting-ip") ?? "local"}:registration`,
  );
  if (!(await loginAllowed(registrationKey, env))) {
    return json({ error: "registration temporarily locked" }, 429);
  }
  await recordLoginFailure(registrationKey, env);
  const username = input.username.trim().toLowerCase();
  const salt = randomToken(16);
  const accountId = crypto.randomUUID();
  const hash = await passwordHash(input.password, salt, PASSWORD_ITERATIONS, env.PASSWORD_PEPPER);
  try {
    await env.DB.prepare(
      `INSERT INTO accounts(id, username, password_hash, password_salt, password_iterations, created_at)
       VALUES(?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(accountId, username, hash, salt, PASSWORD_ITERATIONS, Date.now())
      .run();
  } catch {
    return json({ error: "account already exists" }, 409);
  }
  const session = await issueSession(accountId, input.deviceId, env);
  return json({ accountId, username, ...session }, 201);
}

async function loginAccount(request: Request, env: Env): Promise<Response> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid account request" }, 400);
  }
  if (!validAccountInput(input)) return json({ error: "invalid account or password" }, 400);
  const username = input.username.trim().toLowerCase();
  const key = await attemptKey(request, username);
  if (!(await loginAllowed(key, env))) return json({ error: "login temporarily locked" }, 429);
  const account = await env.DB.prepare(
    "SELECT id, username, password_hash, password_salt, password_iterations FROM accounts WHERE username = ?1",
  )
    .bind(username)
    .first<{
      id: string;
      username: string;
      password_hash: string;
      password_salt: string;
      password_iterations: number;
    }>();
  const candidate = await passwordHash(
    input.password,
    account?.password_salt ?? randomToken(16),
    account?.password_iterations ?? PASSWORD_ITERATIONS,
    env.PASSWORD_PEPPER,
  );
  if (!account || !constantTimeEqual(candidate, account.password_hash)) {
    await recordLoginFailure(key, env);
    return json({ error: "invalid account or password" }, 401);
  }
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key = ?1").bind(key).run();
  const session = await issueSession(account.id, input.deviceId, env);
  return json({ accountId: account.id, username: account.username, ...session });
}

async function accountProfile(context: AuthContext, env: Env): Promise<Response> {
  if (!context.accountId) return json({ error: "account login required" }, 401);
  const account = await env.DB.prepare("SELECT id, username, created_at FROM accounts WHERE id = ?1")
    .bind(context.accountId)
    .first<{ id: string; username: string; created_at: number }>();
  return account
    ? json({ accountId: account.id, username: account.username, createdAt: account.created_at })
    : json({ error: "account not found" }, 404);
}

async function logoutAccount(request: Request, context: AuthContext, env: Env): Promise<Response> {
  if (!context.accountId) return json({ error: "account login required" }, 401);
  const token = (request.headers.get("authorization") ?? "").slice(7);
  await env.DB.prepare("UPDATE sessions SET revoked = 1 WHERE token_hash = ?1 AND account_id = ?2")
    .bind(await sha256(token), context.accountId)
    .run();
  return json({ ok: true });
}

async function changeAccountPassword(
  request: Request,
  context: AuthContext,
  env: Env,
): Promise<Response> {
  if (!context.accountId) return json({ error: "account login required" }, 401);
  let input: { currentPassword?: unknown; newPassword?: unknown };
  try {
    input = await request.json();
  } catch {
    return json({ error: "invalid password request" }, 400);
  }
  const validPassword = (value: unknown): value is string =>
    typeof value === "string" &&
    value.length >= 12 &&
    value.length <= 128 &&
    new TextEncoder().encode(value).byteLength <= 256;
  if (!validPassword(input.currentPassword) || !validPassword(input.newPassword)) {
    return json({ error: "invalid password request" }, 400);
  }
  const account = await env.DB.prepare(
    "SELECT password_hash,password_salt,password_iterations FROM accounts WHERE id=?1",
  )
    .bind(context.accountId)
    .first<{ password_hash: string; password_salt: string; password_iterations: number }>();
  if (!account) return json({ error: "account not found" }, 404);
  const currentHash = await passwordHash(
    input.currentPassword,
    account.password_salt,
    account.password_iterations,
    env.PASSWORD_PEPPER,
  );
  if (!constantTimeEqual(currentHash, account.password_hash)) {
    return json({ error: "invalid account or password" }, 401);
  }
  const salt = randomToken(16);
  const hash = await passwordHash(input.newPassword, salt, PASSWORD_ITERATIONS, env.PASSWORD_PEPPER);
  const currentTokenHash = await sha256((request.headers.get("authorization") ?? "").slice(7));
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE accounts SET password_hash=?2,password_salt=?3,password_iterations=?4 WHERE id=?1",
    ).bind(context.accountId, hash, salt, PASSWORD_ITERATIONS),
    env.DB.prepare(
      "UPDATE sessions SET revoked=1 WHERE account_id=?1 AND token_hash<>?2",
    ).bind(context.accountId, currentTokenHash),
  ]);
  return json({ ok: true });
}

async function claimLegacy(request: Request, context: AuthContext, env: Env): Promise<Response> {
  if (!context.accountId) return json({ error: "account login required" }, 401);
  const legacyToken = request.headers.get("x-legacy-token") ?? "";
  if (
    legacyToken.length < 24 ||
    !constantTimeEqual(await sha256(legacyToken), env.SYNC_TOKEN_HASH.toLowerCase())
  ) {
    return json({ error: "legacy credential rejected" }, 401);
  }
  const result = await env.DB.prepare("UPDATE backups SET account_id = ?1 WHERE account_id IS NULL")
    .bind(context.accountId)
    .run();
  return json({ claimed: result.meta.changes });
}

function integerHeader(request: Request, name: string): number | null {
  const raw = request.headers.get(name);
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

async function createBackup(request: Request, context: AuthContext, env: Env): Promise<Response> {
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
       (id, device_id, created_at, uploaded_at, encrypted_size, source_size, schema_version, checksum, chunk_count, status, backup_kind, pinned, account_id)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'UPLOADING', ?10, 0, ?11)`,
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
        context.accountId,
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

async function listBackups(context: AuthContext, env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    `SELECT id, device_id, created_at, uploaded_at, encrypted_size,
            source_size, schema_version, checksum, backup_kind, pinned
     FROM backups WHERE status = 'COMPLETE' AND account_id IS ?1
     ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(context.accountId)
    .all<BackupRow>();
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

async function cleanupBackups(
  request: Request,
  context: AuthContext,
  env: Env,
  dryRun: boolean,
): Promise<Response> {
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
     WHERE device_id = ?1 AND account_id IS ?2 AND backup_kind = 'AUTO' AND pinned = 0
       AND status = 'COMPLETE' AND uploaded_at < ?3
       AND id NOT IN (
         SELECT id FROM backups
         WHERE device_id = ?1 AND account_id IS ?2 AND backup_kind = 'AUTO' AND pinned = 0 AND status = 'COMPLETE'
         ORDER BY uploaded_at DESC LIMIT ?4
       )
     ORDER BY uploaded_at ASC LIMIT 100`,
  )
    .bind(input.deviceId, context.accountId, cutoff, input.retain)
    .all<{ id: string; encrypted_size: number }>();
  const ids = candidates.results.map((row) => row.id);
  const bytes = candidates.results.reduce((sum, row) => sum + row.encrypted_size, 0);
  if (!dryRun && ids.length > 0) {
    await env.DB.batch(ids.map((id) => env.DB.prepare("DELETE FROM backups WHERE id = ?1").bind(id)));
  }
  return json({ deletedIds: dryRun ? [] : ids, candidateIds: ids, bytes });
}

async function updateBackup(
  request: Request,
  id: string,
  context: AuthContext,
  env: Env,
): Promise<Response> {
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
  const result = await env.DB.prepare(
    "UPDATE backups SET pinned = ?2 WHERE id = ?1 AND account_id IS ?3 AND status = 'COMPLETE'",
  )
    .bind(id, (body as { pinned: boolean }).pinned ? 1 : 0, context.accountId)
    .run();
  return result.meta.changes === 0 ? json({ error: "backup not found" }, 404) : json({ ok: true });
}

async function deleteBackup(id: string, context: AuthContext, env: Env): Promise<Response> {
  if (!ID_PATTERN.test(id)) return json({ error: "invalid backup id" }, 400);
  const row = await env.DB.prepare(
    "SELECT pinned FROM backups WHERE id = ?1 AND account_id IS ?2",
  )
    .bind(id, context.accountId)
    .first<{ pinned: number }>();
  if (!row) return json({ ok: true });
  if (row.pinned === 1) return json({ error: "pinned backup cannot be deleted" }, 409);
  await env.DB.prepare("DELETE FROM backups WHERE id = ?1 AND account_id IS ?2")
    .bind(id, context.accountId)
    .run();
  return json({ ok: true });
}

async function downloadBackup(id: string, context: AuthContext, env: Env): Promise<Response> {
  if (!ID_PATTERN.test(id)) return json({ error: "invalid backup id" }, 400);
  const row = await env.DB.prepare(
    "SELECT encrypted_size, checksum FROM backups WHERE id = ?1 AND account_id IS ?2 AND status = 'COMPLETE'",
  )
    .bind(id, context.accountId)
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
    if (request.method === "POST" && url.pathname === "/v1/auth/register") {
      return registerAccount(request, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/auth/login") {
      return loginAccount(request, env);
    }
    const context = await authorize(request, env);
    if (!context) {
      return json({ error: "unauthorized" }, 401);
    }
    if (request.method === "GET" && url.pathname === "/v1/auth/me") {
      return accountProfile(context, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/auth/logout") {
      return logoutAccount(request, context, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/auth/change-password") {
      return changeAccountPassword(request, context, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/auth/claim-legacy") {
      return claimLegacy(request, context, env);
    }
    if (!url.pathname.startsWith("/v1/backups")) return json({ error: "not found" }, 404);
    if (request.method === "POST" && url.pathname === "/v1/backups") {
      return createBackup(request, context, env);
    }
    if (request.method === "GET" && url.pathname === "/v1/backups") {
      return listBackups(context, env);
    }
    if (request.method === "POST" && url.pathname === "/v1/backups/cleanup-preview") {
      return cleanupBackups(request, context, env, true);
    }
    if (request.method === "POST" && url.pathname === "/v1/backups/cleanup") {
      return cleanupBackups(request, context, env, false);
    }
    const match = url.pathname.match(/^\/v1\/backups\/([0-9a-f-]{36})$/i);
    if (request.method === "GET" && match) {
      return downloadBackup(match[1], context, env);
    }
    if (request.method === "PATCH" && match) {
      return updateBackup(request, match[1], context, env);
    }
    if (request.method === "DELETE" && match) {
      return deleteBackup(match[1], context, env);
    }
    return json({ error: "method not allowed" }, 405);
  },
} satisfies ExportedHandler<Env>;
