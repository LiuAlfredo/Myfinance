# MyFinance Cloud Backup

This Worker stores encrypted MyFinance SQLite snapshots and their metadata in
D1. Large encrypted payloads are split into 512 KiB rows. Encryption and
decryption happen in the desktop app.

## Resources

- Worker: `myfinance-cloud-backup`
- D1 database: `myfinance-cloud`

## Deploy

```powershell
cd cloud
npm install
npx wrangler d1 create myfinance-cloud
# Put the returned D1 database_id in wrangler.jsonc.
npx wrangler d1 migrations apply myfinance-cloud --remote
# SYNC_TOKEN_HASH is the lowercase SHA-256 of the recovery key used by the app.
npx wrangler secret put SYNC_TOKEN_HASH
# Generate a separate high-entropy value. Do not reuse or commit either secret.
npx wrangler secret put PASSWORD_PEPPER
npm run deploy
```

The deployed `/health` route is public. Every `/v1/backups` route requires the
account session token as a Bearer token. Legacy clients may use the recovery
key only for backups that have not yet been claimed by an account. D1 contains
only AES-256-GCM encrypted chunks plus identifiers, timestamps, sizes, and
checksums.

## Accounts

- `POST /v1/auth/register` creates an account and a 30-day device session.
- `POST /v1/auth/login` verifies the password and creates a new session.
- `GET /v1/auth/me` validates the current session.
- `POST /v1/auth/logout` revokes the current session.
- `POST /v1/auth/change-password` verifies the current password, changes it, and revokes other device sessions.
- `POST /v1/auth/claim-legacy` assigns unclaimed backups during the v0.5 upgrade.

Passwords use PBKDF2-HMAC-SHA256 with a random salt, the Cloudflare Web Crypto
maximum of 100,000 iterations, and the `PASSWORD_PEPPER` Worker secret. Session
tokens are randomly generated and stored only as SHA-256 digests. Five failed
logins within 15 minutes cause a 15-minute lock. Backup operations are scoped
by `account_id` in every read and mutation query.

## Retention API

- `PATCH /v1/backups/:id` pins or unpins a completed backup.
- `DELETE /v1/backups/:id` deletes an unpinned backup idempotently.
- `POST /v1/backups/cleanup-preview` calculates automatic-backup cleanup candidates.
- `POST /v1/backups/cleanup` deletes the same candidates transactionally in a D1 batch.

Retention applies only to `AUTO` backups from the requesting device policy.
`MANUAL`, `PRE_RESTORE`, pinned, and recently uploaded backups are protected.
