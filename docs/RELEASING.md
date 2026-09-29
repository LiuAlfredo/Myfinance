# MyFinance Windows 发布与应用内更新

应用在“财务 → 设置 → 软件更新”中从公开的 `LiuAlfredo/Myfinance` 仓库检查、下载并安装新版本。更新包由 Tauri 签名验证，发布使用的私钥不得提交到仓库。

## 首次配置

项目公钥已经写入 `src-tauri/tauri.conf.json`。对应私钥只保存在发布者电脑，并已由 `.gitignore` 排除：

`D:\Personal management application\myfinance-updater.key`

在 GitHub 仓库的 **Settings → Secrets and variables → Actions** 新建仓库 Secret：

- 名称：`TAURI_SIGNING_PRIVATE_KEY`
- 内容：上述私钥文件的完整文本

当前密钥未设置密码，因此 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` 可以不创建。请把私钥另存一份离线备份；私钥丢失后，已经安装的旧版本将无法验证后续更新。

## 发布新版本

1. 同时更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 中的版本号。
2. 完成测试后提交并推送代码。
3. 创建与版本一致的标签，例如版本 `0.3.0` 使用 `v0.3.0`，然后推送标签。
4. `.github/workflows/release.yml` 会构建签名后的 NSIS 安装包，发布 GitHub Release，并生成更新客户端读取的 `latest.json`。

发布完成后，旧版本应用点击“检查更新”即可下载安装。不要删除已经发布版本所使用的签名私钥。
