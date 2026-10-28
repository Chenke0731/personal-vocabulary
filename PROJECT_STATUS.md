# 项目交接状态

开发分支：codex/vocabulary-app。远端整合基点：42acbdb20c07708da008a02a0c3ea1331d1511d4；最新提交请运行 git rev-parse HEAD 确认。

## 当前能力

手机优先 React / TypeScript / Vite PWA，Dexie 本地持久化，FSRS 复习调度，导入/校对词包、收藏、备份恢复、起点抽查。云同步和密码恢复代码已存在，但尚无真实 Supabase 服务验收。

## 尚需完成

- 配置用户自己的 Supabase，并真实验证权限、双设备同步和密码恢复邮件。
- 密码恢复缺少专项自动测试；时间和起点抽查不跨设备同步。
- 内置 24 条演示知识点；完整教材内容、音标和词性尚未完善。
- 公开仓库中的旧技能及插件快照含环境路径，公开适宜性尚待处理；不得将凭据和私人配置纳入公开备份。

## 云端继续

检出 codex/vocabulary-app，阅读 README.md、docs/PROGRESS.md、AGENTS.md，运行 npm ci、npm test、npm run build 和 npm run test:e2e。环境变量名为 VITE_SUPABASE_URL、VITE_SUPABASE_PUBLISHABLE_KEY；只使用公开客户端密钥，服务端密钥不放前端或 Git。

本次隔离副本检查：60 项逻辑测试、生产构建与备份恢复校验通过；隔离副本 5188 端口的 9 项浏览器回归通过。真实托管服务尚未验证。
