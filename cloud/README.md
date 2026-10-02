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
npm run deploy
```

The deployed `/health` route is public. Every `/v1/backups` route requires the
recovery key as a Bearer token. D1 contains only AES-256-GCM encrypted chunks
plus identifiers, timestamps, sizes, and checksums.

## Retention API

- `PATCH /v1/backups/:id` pins or unpins a completed backup.
- `DELETE /v1/backups/:id` deletes an unpinned backup idempotently.
- `POST /v1/backups/cleanup-preview` calculates automatic-backup cleanup candidates.
- `POST /v1/backups/cleanup` deletes the same candidates transactionally in a D1 batch.

Retention applies only to `AUTO` backups from the requesting device policy.
`MANUAL`, `PRE_RESTORE`, pinned, and recently uploaded backups are protected.
