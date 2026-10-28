# 词间 · 个人英语词汇学习软件

手机优先的React PWA。六级与考研为学习主线，雅思作为补充。

## 当前状态

已有可运行的本地学习版本：认义/听辨/拼写/语境练习、FSRS复习、15/30分钟预算、词包导入、薄弱项、收藏、JSON备份恢复与离线应用壳。

当前内置24条原创演示内容，考试标签用于验证流程，不能视作完整书籍词库。JSON词包格式见 `public/example-wordpack.json`。

云端作答、私有词包、收藏、学习预算和每日新词分配的同步代码及SQL已提供。用户尚无Supabase项目，因此没有真实服务、登录和双设备联网验收记录。计时与起点抽查目前仍保留在本机。

## 启动

需要Node.js 22.12+（本地验证为24.19.0）。在仓库根目录运行：

```sh
npm ci
npm run dev
```

本机打开控制台输出的Local地址。手机与电脑在同一局域网时可尝试Network地址；手机PWA安装和Service Worker离线能力需要HTTPS环境，本机localhost用于开发验证。当前未对外部署。

## 验证

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

本机端到端测试默认使用已安装Chrome；CI使用Playwright Chromium。生产预览：`npm run preview`。离线验证须先在线加载生产页面并完成缓存，不能用dev服务代替。

## 私有云端接入

1. 在你控制的Supabase项目中依次执行 `supabase/migrations/001_events.sql` 和 `supabase/migrations/002_private_metadata.sql`。脚本为首次初始化脚本，重复运行策略创建语句会提示策略已存在。
2. 关闭公开注册，在控制台创建个人测试账号。应用有密码恢复入口；需要配置邮件服务，并在真实服务验证邮件流程。
3. 将 `.env.example` 复制为 `.env.local`，填写项目URL及可公开的publishable/anon key；不要填写service-role或secret key。`.env.local`被Git忽略。
4. 重启开发服务，或重新构建并部署HTTPS版本。在“我的”中登录；该操作会把本机作答关联至该账号。关联后本机数据不能自动改归另一个账号。
5. 第一台设备完成上传后，第二台设备以同账号登录并同步，获取私有词条和作答。手工迁移的自定义词包必须保留相同知识点ID。
6. 两台设备分别断网作答、修改不同词条、取消收藏，再联网同步，核对词条集合、收藏、预算、每日分配和到期安排。相同基础事件产生的并发记录保留历史，调度采用最保守评级。
7. 用第二个测试账号验证不能读取第一个账号的记录。客户端没有UPDATE/DELETE策略，事件只追加；上传重试按账号和事件ID去重。

尚未验收的范围：托管Supabase的真实RLS隔离、首次登录与账号绑定、真机双端联网同步、网络可达性和密码恢复。代码已通过双本地存储、模拟传输及本地PostgreSQL策略测试；这些不能替代真实服务验收。

密码找回入口通过邮箱发送重置链接。部署时需将应用地址（包括路径）加入 Supabase Auth 的 Redirect URLs，并配置可发送邮件的服务；点击邮件链接后在应用内设置新密码。实际邮件投递及跨设备打开链接尚未验证。

## 数据与恢复

学习记录保存在当前浏览器IndexedDB。清理网站数据、卸载浏览器或切换浏览器可能失去尚未同步的记录。请使用“我的 → 导出备份”，并保存到自己选择的位置。

恢复先验证完整文件，再在事务中合并。重复记录按ID去重；收藏及当天新点分配取并集；已有设置保留。恢复文件不替换当前云端账号绑定。备份包含待同步的词条/设置操作，按操作ID去重；恢复时会过滤与“保留当前预算、收藏取并集”相冲突的旧操作，避免同步后再次覆盖。

同一个单词的新义项或新能力使用不同ID；不同词书应引用同一知识点，不能分别建立重复卡片。

## 云端Codex接手

当前开发分支为 `codex/vocabulary-app`。先读取：

- `docs/PROGRESS.md`：最近验证、已知缺口与继续顺序。
- `docs/superpowers/specs/2026-10-28-personal-vocabulary-design.md`：整体设计。
- `docs/superpowers/plans/2026-10-28-vocabulary-app.md`：实施步骤。

在没有真实服务配置时继续完成本地功能和自动检查。不要创建收费资源或把凭证提交到Git。

## 候选词表与个人校对

运行下面命令可重新获取候选拼写与来源信息：

```sh
node scripts/prepare-candidates.mjs
```

输出到被Git忽略的 `.local-wordpacks/`，包括红宝书2026社区候选词表、六级社区词表与刘洪波雅思社区词表。仅保留单词/短语拼写，不复制原书释义、例句或音频。每份文件保留抓取日期、源文件SHA256及来源URL。

在“我的 → 导入个人词包”导入JSON，预览后确认。候选项不能直接开始练习；到“词库 → 待校对”填写义项并确认后才能进入日常任务。补充不同义项使用“另存新义项”。

2026-10-28抓取观察：红宝书4770个不同拼写、六级2345个、雅思3697个（包含同条目中的拼写变体）。这些数字不是官方全书词数；词表完整性、版本对应和校对仍需继续核实。

## 原创学术词汇练习包

“我的 → 预览原创学术词汇练习包”每组提供 6 个知识点，四组可分别预览并确认导入；也可下载 JSON 后通过“导入个人词包”选择文件。首次在线加载生产版本并完成缓存后，预览和导入可离线使用。重复导入按 ID 合并，不增加重复条目；你已校对过的义项在重复导入时会被保留并明确提示，不会被默认内容静默覆盖，如需用导入版本替换请重新校对。内容为本项目原创中文释义和例句，考试标签仅作为学习方向，不代表正版教材或官方大纲的逐条对应。词形在本地三份社区候选列表中出现，但候选列表不代表教材完整性。第三组为 anticipate、component、conduct、consistent、contrast、potential，均为三份社区候选拼写列表的交集词形，义项为本项目原创整理，每词只取一个核心义项，音标与音频尚未接入。第四组为 accurate、adequate、arrange、aspect、concern、conclude，同样为三份社区候选拼写列表的交集词形，且不在演示内容和前三组中，义项为本项目原创整理，每词只取一个核心义项，音标与音频尚未接入，不发布公开下载入口，不推断出版社授权。

义项核对参考：[assess](https://dictionary.cambridge.org/dictionary/english/assess)、[evaluate](https://dictionary.cambridge.org/dictionary/english/evaluate)、[assume](https://dictionary.cambridge.org/dictionary/english/assume)、[sufficient](https://dictionary.cambridge.org/dictionary/english/sufficient)、[interpret](https://dictionary.cambridge.org/dictionary/english/interpret)、[derive](https://dictionary.cambridge.org/dictionary/english/derive)。第二组义项核对参考：[evidence](https://dictionary.cambridge.org/dictionary/english/evidence)、[approach](https://dictionary.cambridge.org/dictionary/english/approach)、[adapt](https://dictionary.cambridge.org/dictionary/english/adapt)、[establish](https://dictionary.cambridge.org/dictionary/english/establish)、[maintain](https://dictionary.cambridge.org/dictionary/english/maintain)、[estimate](https://dictionary.cambridge.org/dictionary/english/estimate)。例句及译文由本项目编写。

## 起点抽查与时间预算

起点抽查从已核对的认义内容中取最多24项，加入少量听辨和拼写，支持中途保存。结果只说明样本表现，与正式复习记录分开。演示内容未做难度分层，不能据此给出考试成绩或CEFR等级。

学习时记录前台活动时间，后台暂停。达到15/30分钟后允许完成当前题，再结束本组。时间按上海学习日保存；单卡超过120秒的停留不用于估时。过去7天至少有3个已结束学习日后，才根据完成情况调整新点目标；样本不足不提高任务量。这些是产品启发规则，仍需个人试用验证。

## 本地技能与插件备份

`tooling-backup/README.md`提供技能/插件快照、版本与文件校验清单，以及Python跨平台恢复命令。云端环境可在准备阶段运行 `python3 tooling-backup/restore.py --target "$PWD"`，恢复个人技能到本仓库`.agents/skills/`。插件源码快照与平台授权分别处理，不携带登录态。归档完整性和恢复行为也纳入CI检查。

## 私有内容同步规则

每次词条、收藏、预算和每日分配修改，都与待同步操作在同一IndexedDB事务内保存。操作ID不可变，网络重试不会重复创建操作。新数据库版本自动增加操作表，不删除旧版作答。

- 两设备新增不同词条时保留两边内容；同ID不同单词/能力会拒绝合并。
- 同一词条的修改、收藏添加/取消及预算冲突按服务器接收序号决定；这不是按设备时钟比较。
- 每日已分配新点取并集，避免同步后忘掉另一端已经分配的内容。
- 上传期间的新修改保持待同步，并触发下一轮交换；上传失败不清除本机记录。
- 初次接入时为既有词库与偏好生成一次基线操作。
- 目前没有词条删除操作；起点抽查和活动时间不在这一轮自动同步范围。

测试中的PGlite运行实际PostgreSQL迁移与RLS，但身份上下文由测试夹具提供，不是真实Supabase登录或托管网络。生产前仍应执行上面的真实双账号/双设备流程。
