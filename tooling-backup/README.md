# 技能与插件迁移备份

这是2026-10-28从本机生成的可迁移文件快照，保存在当前私有仓库的开发分支 `codex/vocabulary-app`。

## 文件

- `skills.zip`：`.codex/skills` 与 `.agents/skills` 中的技能说明、脚本、参考资料和素材。
- `plugins.zip`：本机插件缓存中的可迁移源码、插件清单、技能、文档与素材，包括多个已缓存版本。
- `manifest.json`：每个文件及压缩包的SHA256、版本清单、配置中的启用状态与排除项。
- `restore.py`：Python 3.10+跨平台恢复；先校验所有文件，再检查路径和冲突，不覆盖不同内容。
- `create-backup.py`：在其他本机重新生成快照，需要Python 3.11+。不要在包含凭证的任意目录上扩展扫描范围。

## 云端配置

克隆仓库并切换到 `codex/vocabulary-app` 后，在仓库根目录运行：

```sh
python3 tooling-backup/restore.py --target "$PWD" --dry-run
python3 tooling-backup/restore.py --target "$PWD"
```

默认将个人技能恢复至该仓库的 `.agents/skills/`，不修改全局设置。先在云端环境准备阶段运行，再启动新的Codex任务，使其能发现这些技能。重复运行时，相同内容会保留；不同内容会报冲突并停止，不删除或覆盖现有文件。

如确实需要查阅插件原始文件及系统技能快照：

```sh
python3 tooling-backup/restore.py --target "$PWD" --plugin-sources --system-skills
```

插件快照解压至 `.codex-plugin-snapshots/`，不会自动注册或启用插件。原始版本和来源以manifest为准。请在云端支持的插件管理界面安装相应插件，并重新连接所需服务。

## Windows配置

```powershell
python tooling-backup/restore.py --target (Get-Location).Path --dry-run
python tooling-backup/restore.py --target (Get-Location).Path
```

## 使用边界

- 凭证、账户登录态、个人全局config、会话日志、依赖目录和编译运行时未上传。完整排除清单见manifest。
- 快照包含缓存过的插件版本，不能仅凭存在文件就认定某版本当前已安装、已启用或能运行。
- 插件的GitHub/Figma等连接权限需在云端重新授权；备份不携带令牌，也不能通过复制文件获得工具权限。
- Windows电脑控制、桌面应用等技能依赖Windows环境，不能在Linux云电脑上直接使用。
- Python/Node依赖按相应技能的要求重新安装；恢复脚本只复制并验证文件，不自动执行技能脚本或安装软件。
- 官方插件由平台管理的工具与服务仍需要平台支持，离线源码快照不能取代这些服务。
- 备份文件保留其原有许可证和第三方内容说明；继续保持仓库私有。

官方说明：
- 技能发现目录：https://learn.chatgpt.com/docs/build-skills
- 插件打包与配置：https://developers.openai.com/plugins/build/plugins
