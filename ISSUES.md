# Stronghold-Protocol 未修复 Issue 清单（本地 fork）

- 上游仓库：[sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)
- 条目数：**18**（P0 0 / P1 2 / P2 5 / P3 11）
- 口径：上游 issue 抓取于 2026-10-05（110 条）；本地树合并 upstream 0.1.3 后于 2026-10-06 逐条复核，同日又按「较严重影响体验」筛出 17 条实测修掉 10 条。**2026-10-06 稍后：上游 v0.1.4 已并入本树**——它按官方把高台、阿戈尔、沉睡、缇缇、引星棘刺等一批规则改对了（#165 随之结案，见 FIXLOG §6），本文件因此只剩 24 条。**2026-10-07：上游 v0.2.0 与 v0.2.1 也已并入本树**——0.2.0 修掉 #96 / #137（生命回复速度不再算作治疗）、#175（华法琳 7 / 14 层按客户端数据）、#136（自选编队即原版 V / VI 干员自选）、#38 / #57（官方英文界面取代叠加层方案，#57 需求已闭环），另有 6 条被上游做掉一半（见 FIXLOG §7），本文件因此只剩 18 条。本文件**只列仍然成立的条目**。
- 配套文件
  - [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) — 已修 / 已判「不是 bug」/ 已闭环 / 上游已排期的记录与逐条证据（**动手之前先查这里**，避免重复修；含 2026-10-06 两轮复核原文与探针数据）
  - [`docs/ISSUES-ARCHIVE.md`](docs/ISSUES-ARCHIVE.md) — 110 条 issue 的抓取归档：总览、分类、讨论区摘要、原始数据清单（由 `.scratch/render-report.cjs` 生成，勿手工维护）
- 维护方式见 §4；`test/docs-consistency.test.js` 会检查本文件与 FIXLOG 的编号不重叠。

## 1. 一览

| 优先级 | Issue | 分类 | 现象 | 为什么还没修 / 下一步 |
|---|---|---|---|---|
| P1 | [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) 中途意外退出后无法重连入房间，并且会持续烧条 | 网络 / 联机 | 对局中途意外退出（刷新 / 断网 / 杀进程）后回不去房间，且轮询持续「烧条」 | **缺复现细节**（issue 正文为空）：需要模式（单机 / 联机）、退出方式与控制台报错；状态机在 `public/js/store.js`、`public/js/net.js`、`server/lobby.js`，要浏览器 e2e（`SP_E2E=1`）才能覆盖 |
| P1 | [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) 网页版游戏文件未加载 | 网络 / 分发 | 下载源码包后本地打开，干员 / 盟约 / 地图 / 敌人全不加载（连别人的服务器正常） | **大部分已修（上游 0.2.0）**：数据没载入时给出明确提示、三个标签页都拒绝导入、已保存的干员持有 / 自选编队不再被清空；分发侧上游 0.2.0/0.2.1 又补了精简包、更新包、README 安装方式与启动校验。仍差：`docs/PLAYING.md` 里没有安装步骤（它是玩法指南），`file://` 直接打开仍必然失败（见 §2.1） |
| P2 | [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) AI 策略优化 | 界面 / AI | AI 队友用医疗挡狗、堵门卡怪导致超时等 | AI 手感类，`server/match/bot.js` 仍是既有策略；改之前先和上游对齐「AI 应该多强」，否则只是换一种主观 |
| P2 | [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) AI 的干员抓取和策略选择问题 | 界面 / AI | AI 大量抢队友特化干员、选鸭爵守不住 | 与 #31 同一处（`server/match/bot.js` 的抓取与策略权重），同上 |
| P2 | [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) 自己加的人变成「滚木」 | 部署 / 渲染 | 自行添加的干员备战界面可见、进战斗后消失 | **无法确证**：战斗侧唯一能「删人」的地方是 `server/sim/Battle.js` 对未知 chess 静默返回 null（只写服务端日志），而 `normalizeChess` 永不返回 null → 只可能是「服务端数据源与浏览器自拉的数据不一致」。需要举报人的 chessId、改动文件清单与控制台报错 |
| P2 | [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) 按键自定义；攻击特效缺失；待选区自动落位 | 战斗表现 / 界面 | 三条功能性建议 | **自定义快捷键已由上游 0.2.0 实现**（设置 → 快捷键，`public/js/ui/gameLogic/shortcuts.js`）；仍差两条：待选区自动落位（进手牌仍只有显式 `stow()`，`server/match/player/pieces.js`）与「AOE 特效缺失」——判定只认 5 个子职业（`public/js/render/fx/numbers.js` 的 `SPLASH_SUBS`），正确做法是按同一 `attackId` 的命中数聚合，**单纯加白名单会误伤**（玛恩纳普攻是单体） |
| P2 | [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) 部分干员闭眼时眼球没有被完全遮住（仇白、琳琅诗怀雅） | 战斗表现 / 贴图 | 倒地 / 眨眼时眼球露出 | 渲染表现，举报者自己也说影响不大；未做 |
| P3 | [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) feature: 增加一键重开按钮 | 界面 / 交互 | 一键重开 / 不禁用干员选项 | 功能请求，无对应条目 |
| P3 | [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) 讨论：关于数据持久化的取舍 | 工程质量 | 默认关闭的可选 SQLite 持久化（战绩 / 复盘 / 回放） | 设计决策；要先定「默认关 + 不引入运维负担」的边界 |
| P3 | [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | 工程质量 | `server/index.js` 拆模块、换 Hono | **上游 0.2.0 已把 `server/index.js` 拆成 `server/http/*`**（本树已合并）；Hono 仍未采用（依赖表里没有，仍是 `node:http` + `ws`）——换框架仍是设计决策 |
| P3 | [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 界面 / 交互 | 房间聊天补丁（贡献者已实现 0.1.3 版） | 补丁在上游待决定是否合并；本树未合 |
| P3 | [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) 休整期双击可以直接看队友的场地 | 界面 / 交互 | 双击队友头像直接查看其场地 | 相邻能力已有（观战跟随移动、观战可见手牌），双击手势本身没做 |
| P3 | [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) 拖动干员身体也能拖；准备时可以收起商店 | 界面 / 交互 | 拖拽热区、商店折叠 | **商店折叠上游 0.2.0 也实现了**（与本地 §21.33 合并后只留一条实现）；拖动热区仍未做——本树是**有意**按「地上方格」拾取（§18.1 玩家实测 #4 的结论），改回拖身体要先推翻那条结论 |
| P3 | [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) 能不能增加一个联机指定后端的功能 | 网络 / 联机 | 客户端可指定后端，避免重复拉取素材 | 功能请求，与 #173 的素材分发相邻 |
| P3 | [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) 建议，优化房间逻辑 | 界面 / 交互 | 房主踢人 / 转让 / 账号功能 | 0.1.3 起已有观战席、房主踢人与房主离开时的自动转交；**主动转让房主与账号系统**仍未做（全仓无 transfer 处理器） |
| P3 | [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | 工程质量 | monorepo / 构建工具 / 子系统拆分 / 插件扩展 | **「子系统拆分」子项已由上游 0.2.0 落地**（按职责拆大文件 + `docs/ARCHITECTURE.md` + ESLint / 类型 / 导入边界 + 黄金结果）；monorepo、构建工具、插件扩展与整体方案仍未定，随 #84 / #95 一起定 |
| P3 | [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上 | 工程质量 / 性能 | 排查笔记，另记录两个**真实代码隐患** | 可单独开条目跟踪：`adaptLoad` 帧长 > 250 ms 时自适应降级停摆、替身阈值不覆盖联防场景（`public/js/render/app.js`） |
| P3 | [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) feature：可以自己切换干员成特勤干员 | 干员 / 盟约 | 主动把干员切换成特勤干员 | 提案人自己说明这是超出原版的优化，需上游表态（与 touch 策略的相邻行为见 FIXLOG 的 #161 行） |

## 2. 需要展开的一条

### 2.1 #173 —— 分发与文档

- 上游 0.2.0 已经修掉**代码侧**（数据没载入时报出缺哪个文件，三个标签页都拒绝导入，已保存的持有 / 自选不再被清空），上游 0.2.0 / 0.2.1 又补齐了分发侧（完整包 / 精简包 / 更新包三种发布形态、README 的两种安装方式、`docs/DEPLOY.md` 排障、`npm run doctor` 的文件校验、启动时的清单校验）。
- 本树核实过**没有清单级缺陷**：`data/assets.json` 的 7969 条 `/assets` 路径在本机下到 7968 条（缺的那 1 条见 §4）。
- 仍差的部分不是引擎：`file://` 直接打开源码目录必然失败（全站根绝对路径），且 `docs/PLAYING.md` 是玩法指南、不含安装步骤。后续若要彻底闭环，考虑在「素材目录为空」时给启动前的显式报错。
## 3. 本轮附带发现（尚无 issue 编号）

- **技能范围型 MANUAL 技能的触发策略**：带 `SKILL_RANGE` 的 MANUAL 技能走 `DEFAULT` 还是 `SKILL_RANGE`，决定它「能不能自动开到打得到敌人的那一刻」。复核忍冬三技能时实测：只有技能 +1 距离内的敌人时 `cast = false`（`DEFAULT` 要求初始射程内有敌人）。属策略裁定，未改。
- **AOE 特效聚合**：见 §1 的 #143 行（应按同一 `attackId` 的命中数聚合，而不是扩白名单）。
- **绝食 × 生命回复通道**：#96 / #137 已由上游 0.2.0 按「生命回复速度不再算作治疗」修好（`server/sim/damage.js` 的 `hpRegen` 通道，见 FIXLOG §7）；原报告里「海嗣 boss 爆条频率」子项仍未单独复核。

## 4. 维护方式

- 本文件**只列仍然成立的条目**；一旦修掉（或判定不是 bug），把该行移入 [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) 并补上 `docs/DESIGN.md` 的章节与回归测试，编号不再出现在本文件里。
- FIXLOG 顶部的 `<!-- settled: … -->` / `<!-- pending: … -->` / `<!-- issue-total: … -->` 三个注释是机器可读的：`test/docs-consistency.test.js` 用它们断言「已判定 + 未复核 + 本清单」正好覆盖全部 110 条，且互不重叠——所以移动条目时**必须同时更新注释**。
- 素材（`public/assets`、`public/fonts`）不在版本库里：本机用 `node tools/fetch-assets.mjs` 从社区镜像补齐（`--asset-source=mirror` 是慢但全的那条路）。截至 2026-10-07，上游 `data/assets.json` 的 7969 条路径里只有 1 条下不到——多萝西 S3 的语音 `/assets/audio/voice/cn/char_4048_doroth/cn_027.mp3`；另有 39 个召唤物模型只存在于上游的完整整合包（`tools/local-extract` 从游戏客户端提取），本树拿不到，这些召唤物显示头像。清单本身保持上游原样，不做裁剪。
- 抓取数据与上游状态属 `docs/ISSUES-ARCHIVE.md`（第 1–13 节由抓取流水线生成）。那套流水线（`.scratch/`：抓取脚本、110 条正文与评论、归类结果）是维护者本机工具，**没有随本分支发布**；本文件与 FIXLOG 是人工维护，流水线不会覆盖它们。
