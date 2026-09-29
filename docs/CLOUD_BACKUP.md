# MyFinance 加密云备份

MyFinance 继续使用本地 SQLite 作为主数据库。点击“立即上传加密备份”时，桌面端先创建一致性 SQLite 快照，再使用恢复密钥派生的 AES-256-GCM 密钥加密，最后上传密文。

## 已部署资源

- Worker：`myfinance-cloud-backup`
- Worker 地址：`https://myfinance-cloud-backup.liuzheng85857.workers.dev`
- D1：`myfinance-cloud`
- D1 ID：`fdf8e396-1580-4e95-9b97-b84dd5c03f2a`

Cloudflare 账户的 R2 订阅当前处于移除状态。为了不触发订阅或计费变更，密文按 512 KiB 分块保存在 D1。单份备份上限为 20 MiB。

## 首次使用

1. 打开“财务 → 设置 → 加密云备份”。
2. Worker 地址已经预填。
3. 从项目根目录的 `myfinance-cloud-recovery-key.txt` 复制恢复密钥。
4. 点击“保存并测试”。
5. 点击“立即上传加密备份”。

恢复密钥文件已被 `.gitignore` 排除，并限制为当前 Windows 用户可读。请另存一份到安全的密码管理器或离线介质。丢失该密钥后，Cloudflare 中的密文无法恢复。

## 数据边界

- 本地 SQLite 包含完整业务数据，仍可离线使用。
- D1 的 `backups` 表只保存备份元数据。
- D1 的 `backup_chunks` 表只保存客户端生成的密文。
- Worker Secret `SYNC_TOKEN_HASH` 只保存恢复密钥的 SHA-256，不保存恢复密钥原文。
- 恢复操作会先备份当前本地数据库，再替换数据，并要求使用备份创建时的软件密码重新登录。
