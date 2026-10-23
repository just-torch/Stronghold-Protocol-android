# Stronghold-Protocol 未修复 Issue 清单（本地 fork）

- 上游仓库：[sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)
- 条目数：**14**（P0 0 / P1 2 / P2 4 / P3 8）
- 口径：上游 issue 抓取于 2026-10-05（110 条）；本地树合并 upstream 0.1.3 后于 2026-10-06 逐条复核，同日又按「较严重影响体验」筛出 17 条实测修掉 10 条。**2026-10-06 稍后：上游 v0.1.4 已并入本树**——它按官方把高台、阿戈尔、沉睡、缇缇、引星棘刺等一批规则改对了（#165 随之结案，见 FIXLOG §6），本文件因此只剩 24 条。**2026-10-07：上游 v0.2.0 与 v0.2.1 也已并入本树**——0.2.0 修掉 #96 / #137（生命回复速度不再算作治疗）、#175（华法琳 7 / 14 层按客户端数据）、#136（自选编队即原版 V / VI 干员自选）、#38 / #57（官方英文界面取代叠加层方案，#57 需求已闭环），另有 6 条被上游做掉一半（见 FIXLOG §7），本文件因此只剩 18 条。**2026-10-13：上游 v0.2.2–v0.2.5 也已并入本树**——四个版本一起修掉 #177（闭眼时眼球仍露出，0.2.2 §27.40 按真实 pixi-spine 重做）、#131（休整期双击队友头像直接看他的场地）、#77（房主发起「重刷本局」，全体真人同意后重抽开局）、#84（统计页只存本机、明确不做服务端持久化），并把 #138 又做掉一半（准备就绪时商店自动收起，0.2.2 §27.49），本文件因此只剩 14 条（见 FIXLOG §9）。**2026-10-17：上游 v0.2.6 与 v0.3.0 也已并入本树**——0.2.6 的是官方战斗特效、机器人站位与采购、临时整备区改为可排队（PR #630）、素材包导入，v0.3.0 的是整套插件系统（数据 / DSL / 外观 / 界面插件、工作台 `/studio/`、沙箱与 CSP）。两者**没有关闭本清单里的任何一条**，但让 5 条的状态发生了变化（#31 / #121 的机器人、#143 的特效、#156 的插件扩展、#141 的安卓端指定后端、#173 的分发），仍是 14 条（见 FIXLOG §10）。本文件**只列仍然成立的条目**。
- 配套文件
  - [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) — 已修 / 已判「不是 bug」/ 已闭环 / 上游已排期的记录与逐条证据（**动手之前先查这里**，避免重复修；含 2026-10-06 两轮复核原文与探针数据）
  - [`docs/ISSUES-ARCHIVE.md`](docs/ISSUES-ARCHIVE.md) — 110 条 issue 的抓取归档：总览、分类、讨论区摘要、原始数据清单（由 `.scratch/render-report.cjs` 生成，勿手工维护）
- 维护方式见 §4；`test/docs-consistency.test.js` 会检查本文件与 FIXLOG 的编号不重叠。

## 1. 一览

| 优先级 | Issue | 分类 | 现象 | 为什么还没修 / 下一步 |
|---|---|---|---|---|
| P1 | [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) 中途意外退出后无法重连入房间，并且会持续烧条 | 网络 / 联机 | 对局中途意外退出（刷新 / 断网 / 杀进程）后回不去房间，且轮询持续「烧条」 | **缺复现细节**（issue 正文为空）：需要模式（单机 / 联机）、退出方式与控制台报错；状态机在 `public/js/store.js`、`public/js/net.js`、`server/lobby.js`，要浏览器 e2e（`SP_E2E=1`）才能覆盖 |
| P1 | [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) 网页版游戏文件未加载 | 网络 / 分发 | 下载源码包后本地打开，干员 / 盟约 / 地图 / 敌人全不加载（连别人的服务器正常） | **大部分已修（上游 0.2.0 / 0.3.0）**：数据没载入时给出明确提示、三个标签页都拒绝导入、已保存的干员持有 / 自选编队不再被清空；分发侧上游 0.2.0/0.2.1 补了精简包、更新包、README 安装方式与启动校验，0.3.0 又补了**素材包 `Stronghold-Protocol-v0.3.0-assets.zip` 与标题画面的「导入素材包」**（从 zip 或自己的文件夹导入，只收哈希一致的文件）——「下载源码包后没有素材」这条因此有了明确出路。仍差：`docs/PLAYING.md` 里没有安装步骤（它是玩法指南），`file://` 直接打开仍必然失败（见 §2.1） |
| P2 | [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) AI 策略优化 | 界面 / AI | AI 队友用医疗挡狗、堵门卡怪导致超时等 | **上游 0.2.6 已改掉这条的主诉**（`server/match/bot.js`：有阻挡的医疗优先站路径外、其次站队友火力覆盖的路格，[ASSUMED] 标注 #577/#315；孤立重卫移到队友火力能覆盖的合法路格，PR #452）；「堵门卡怪」没有单独复现，本条目本身就是「AI 应该多强」的主观题——动手前先和上游对齐，否则只是换一种主观 |
| P2 | [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) AI 的干员抓取和策略选择问题 | 界面 / AI | AI 大量抢队友特化干员、选鸭爵守不住 | 上游 0.2.6 的采购规则改为**按实际手牌容量**计算阵容、同分时买更便宜的（#315），试算也改用真实开战输入评估布阵；「抢特化干员」与「鸭爵守不住」的具体复现没有逐条回应，与 #31 同一处（`server/match/bot.js`） |
| P2 | [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) 自己加的人变成「滚木」 | 部署 / 渲染 | 自行添加的干员备战界面可见、进战斗后消失 | **无法确证**：战斗侧唯一能「删人」的地方是 `server/sim/Battle.js` 对未知 chess 静默返回 null（只写服务端日志），而 `normalizeChess` 永不返回 null → 只可能是「服务端数据源与浏览器自拉的数据不一致」。需要举报人的 chessId、改动文件清单与控制台报错 |
| P2 | [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) 按键自定义；攻击特效缺失；待选区自动落位 | 战斗表现 / 界面 | 三条功能性建议 | **自定义快捷键已由上游 0.2.0 实现**（设置 → 快捷键，`public/js/ui/gameLogic/shortcuts.js`）；**「AOE 特效缺失」在 0.2.6 之后有了官方的路**：服主用 `tools/local-extract/fx.py` 提取官方战斗特效（本树的整合包已带 `data/local-fx.json` 与 `public/assets/local/fx/**`），设置里的「官方特效」开启后普攻 / 弹道 / 命中 / 溅射直接按客户端特效绘制，不再依赖本作的判断（`public/js/render/fx/numbers.js` 的 `SPLASH_SUBS` 5 子职业白名单只在关闭或没有提取时生效）；仍差**待选区自动落位**（进手牌仍只有显式 `stow()`，`server/match/player/pieces.js`） |
| P3 | [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | 工程质量 | `server/index.js` 拆模块、换 Hono | **上游 0.2.0 已把 `server/index.js` 拆成 `server/http/*`**（本树已合并）；Hono 仍未采用（依赖表里没有，仍是 `node:http` + `ws`）——换框架仍是设计决策 |
| P3 | [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 界面 / 交互 | 房间聊天补丁（贡献者已实现 0.1.3 版） | 补丁在上游待决定是否合并；本树未合 |
| P3 | [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) 拖动干员身体也能拖；准备时可以收起商店 | 界面 / 交互 | 拖拽热区、商店折叠 | **商店折叠上游 0.2.2 §27.49 也做了**（`readyShopFold` 读服务端确认后的 `m.private.ready`，与本树 §21.38 的两段确认天然兼容——只有第二次点击才让服务端把 `ready` 置真，取消准备一定展开；合并后只留一条实现，见 FIXLOG §9.2）；拖动热区仍未做——本树是**有意**按「地上方格」拾取（§18.1 玩家实测 #4 的结论），改回拖身体要先推翻那条结论 |
| P3 | [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) 能不能增加一个联机指定后端的功能 | 网络 / 联机 | 客户端可指定后端，避免重复拉取素材 | **本 fork 的安卓端已经有了**：启动器「加入房间」可以填 `1.2.3.4:3000` / `https://主机/?room=CODE`（`android/web/launcher.js` `normaliseAddress`），也有局域网自动发现（`android/scripts/nodejs-template/lan/*`），指向的后端就是别人的服务器；网页端仍然只能从当前站点取素材，与 #173 的素材分发相邻 |
| P3 | [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) 建议，优化房间逻辑 | 界面 / 交互 | 房主踢人 / 转让 / 账号功能 | 0.1.3 起已有观战席、房主踢人与房主离开时的自动转交；**主动转让房主与账号系统**仍未做（全仓无 transfer 处理器；0.3.0 的房间插件面板是房主权限，不是转让） |
| P3 | [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | 工程质量 | monorepo / 构建工具 / 子系统拆分 / 插件扩展 | **「子系统拆分」子项已由上游 0.2.0 落地**（按职责拆大文件 + `docs/ARCHITECTURE.md` + ESLint / 类型 / 导入边界 + 黄金结果），**「插件扩展」子项已由上游 0.3.0 整套落地**（`plugins/` 数据 / DSL / 外观 / 界面插件、`shared/plugins/**`、工作台 `/studio/`、沙箱与 CSP、DSL schema）；monorepo、构建工具与整体方案仍未定 |
| P3 | [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上 | 工程质量 / 性能 | 排查笔记，另记录两个**真实代码隐患** | 可单独开条目跟踪：`adaptLoad` 帧长 > 250 ms 时自适应降级停摆、替身阈值不覆盖联防场景（`public/js/render/app.js`） |
| P3 | [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) feature：可以自己切换干员成特勤干员 | 干员 / 盟约 | 主动把干员切换成特勤干员 | 提案人自己说明这是超出原版的优化，需上游表态（与 touch 策略的相邻行为见 FIXLOG 的 #161 行） |

## 2. 需要展开的一条

### 2.1 #173 —— 分发与文档

- 上游 0.2.0 已经修掉**代码侧**（数据没载入时报出缺哪个文件，三个标签页都拒绝导入，已保存的持有 / 自选不再被清空），上游 0.2.0 / 0.2.1 又补齐了分发侧（完整包 / 精简包 / 更新包三种发布形态、README 的两种安装方式、`docs/DEPLOY.md` 排障、`npm run doctor` 的文件校验、启动时的清单校验），0.3.0 再补上**标题画面的「导入素材包」**与维护者提供的 `Stronghold-Protocol-v0.3.0-assets.zip`：下载了代码 / 精简包的玩家可以从 zip 或自己的文件夹导入素材（只收下与服务器清单哈希一致的文件，不上传），不必再等服务器逐个下载。
- 本树核实过**没有清单级缺陷**：`data/assets.json` 现在的 16 712 条 `/assets` 路径（连同两份本地提取清单共 30 936 条）在本机**全部在盘**（见 §4）。
- 仍差的部分不是引擎：`file://` 直接打开源码目录必然失败（全站根绝对路径），且 `docs/PLAYING.md` 是玩法指南、不含安装步骤。后续若要彻底闭环，考虑在「素材目录为空」时给启动前的显式报错。
## 3. 本轮附带发现（尚无 issue 编号）

- **技能范围型 MANUAL 技能的触发策略**：带 `SKILL_RANGE` 的 MANUAL 技能走 `DEFAULT` 还是 `SKILL_RANGE`，决定它「能不能自动开到打得到敌人的那一刻」。复核忍冬三技能时实测：只有技能 +1 距离内的敌人时 `cast = false`（`DEFAULT` 要求初始射程内有敌人）。属策略裁定，未改。
- **AOE 特效聚合**：见 §1 的 #143 行（应按同一 `attackId` 的命中数聚合，而不是扩白名单）。
- **绝食 × 生命回复通道**：#96 / #137 已由上游 0.2.0 按「生命回复速度不再算作治疗」修好（`server/sim/damage.js` 的 `hpRegen` 通道，见 FIXLOG §7）；原报告里「海嗣 boss 爆条频率」子项仍未单独复核。

## 4. 维护方式

- 本文件**只列仍然成立的条目**；一旦修掉（或判定不是 bug），把该行移入 [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) 并补上 `docs/DESIGN.md` 的章节与回归测试，编号不再出现在本文件里。
- FIXLOG 顶部的 `<!-- settled: … -->` / `<!-- pending: … -->` / `<!-- issue-total: … -->` 三个注释是机器可读的：`test/docs-consistency.test.js` 用它们断言「已判定 + 未复核 + 本清单」正好覆盖全部 110 条，且互不重叠——所以移动条目时**必须同时更新注释**。
- 素材（`public/assets`、`public/fonts`）不在版本库里：本机用 `node tools/fetch-assets.mjs` 从社区镜像补齐（`--asset-source=mirror` 是慢但全的那条路）。**2026-10-07 复核：上游 `data/assets.json` 的 7969 条路径已全部在盘**（包括多萝西 S3 的语音 `/assets/audio/voice/cn/char_4048_doroth/cn_027.mp3`，30 947 B），清单本身保持上游原样、不做裁剪。
  - **2026-10-13（并入 v0.2.2–v0.2.5）复核：清单涨到 10 963 条 URL（10 956 个文件 / 581 MB / 192 个带日文语音的干员），本机缺的 2 971 条也已全部在盘**。缺的那批来自上游 v0.2.5 的**完整整合包** `Stronghold-Protocol-v0.2.5.zip`（579 MB）：新干员 `char_4231_clemnt`（头像 / 立绘 / 前后 Spine / 技能图标 / 语音）、255 个新音效，以及 **2 702 个日文语音文件**（`/assets/audio/voice/jp/**`，0.2.2 起的第二套语音）。取之前先按该包自带的 `MANIFEST.json` 逐文件核对 sha256（**6476/6476 相同**），再逐条按清单路径拷贝，拷完复核「清单里 0 条缺失」。
  - **2026-10-17（并入 v0.2.6–v0.3.0）复核：三份清单合起来 30 936 条 URL，本机 0 条缺失**——`data/assets.json` **16 712** 条（0.2.6 起多了英语 / 韩语 / 本土语言配音：`/assets/audio/voice/` 下 jp 2 688 + cn 2 688 + en 2 548 + kr 2 548 + native 616），本地提取的两份 `data/local-assets.json` **1 690** 条与 `data/local-fx.json` **12 534** 条（0.3.0 的**官方战斗特效**，DESIGN §33）。素材仍取自上游的完整整合包 `Stronghold-Protocol-v0.3.0.zip`（840 MB）。取之前先核对它自带的 `MANIFEST.json`（6 837 条 / 99.2 MB）：**6 818 条与本机 v0.3.0 源码树逐字节相同**，剩下 19 条都能解释——10 条是 `npm install` 生成的（`public/vendor/*` 9 个与 `packs/index.json`，本机有、tag 里没有），7 条是发布打包的改写（`CHANGELOG.md` / `README.md` / `THIRD-PARTY-NOTICES.md` / `docs/{PLAYING,DEPLOY,PLUGINS}.md` 的链接改写成 GitHub 绝对地址、`package.json` 去掉开发脚本），2 条是 npm 自己的 `.bin/acorn` 与 `.package-lock.json`；**代码树（`server/ shared/ public/js public/css public/i18n public/studio tools/ plugins/ schemas/ data/ scripts/ types/`）没有任何一条不同**。随后按大小差异覆写 / 补齐 `public/assets/**`（**18 403 个文件 / 388.9 MB**），并接受整合包里更新的本地提取清单。现在 `public/assets` 是 **31 021 个文件 / 1 124 MB**（其中 `local` 14 309 个 / 365 MB，`fx` 12 534 个 / 213 MB），`public` 合计 31 331 个 / 1 140 MB。
- **39 个召唤物模型已补齐**（2026-10-07）：`data/assets.json` 里 45 个没有 `spine` 的 token 中，39 个带 `spineLocal`（其余 6 个游戏里本来就没有模型）。取上游 v0.2.1 完整整合包 `Stronghold-Protocol-v0.2.1.zip` 的 `public/assets/local/spine/token/`（117 个文件 = 39 × {skel,atlas,png}，3.48 MB）与它那版 `data/local-assets.json`（62 组 / 1598 个文件，全部在盘）。该包的代码树已按官方 `MANIFEST.json` 逐文件核对 sha256（6443/6443 相同），可确认不是被篡改的镜像内容。
  - 这批文件**不在版本库里**（`docs/ASSETS.md` 把它定为**可选**叠加层：提取到就用，没有就按设计退回头像菱形，`public/js/assets.js spineEntry` → `localSpineEntry`）。换机器要重现只有两条路：装游戏客户端跑 `python tools/local-extract/extract.py TOKEN_SPINES --only spine/token`（需要 UnityPy / lz4 / Pillow，默认找 `C:/Program Files/Hypergryph Launcher/games/Arknights/Arknights_Data/StreamingAssets/AB/Windows`，也可 `--game <AB 根>`），或直接从上游完整整合包取那两个路径。本机没有游戏客户端（三条默认路径都不存在）。
  - 39 个 id 的骨骼元数据（skel/atlas/贴图名、pma、动画名、bounds）本来就已提交在 `tools/assets/local-token-spines.json`；补入后 `test/local-token-models.test.js` 里原本 skip 的「提取出的模型必须与已提交元数据一致」用例已实际执行并通过——即这 117 个文件与元数据逐项吻合。
  - **2026-10-13：本地叠加层跟着 v0.2.5 的整合包扩到 75 组 / 1658 个文件**（v0.2.5 完整的 `data/local-assets.json` 直接覆盖本机那份，62 组里没有一组是本机独有的）。新增 60 个文件 / 35.1 MB：11 张**官方战场场景**（`/assets/local/scene/<map>/{scene.bin,lm*.webp}` + `scene/tex/*.webp`，0.2.5 的新素材，`docs/history/0.2.5.md` §30.x / `test/scene-assets.test.js`）与第 40 个召唤物模型 `token_10031_swire2_gdtrap`。`public/assets/local` 因此从 74 MB 涨到 109 MB。这批同样**不在版本库里**，重现途径与上面两条相同（`--scenes` 走 `tools/local-extract/scenes.py` / `fetch_scenes.py`）。
- **本 fork 自带的界面文案已补齐四种语言**（2026-10-13）：调试控制台（§21.34）、准备就绪两段确认（§21.38）、商店条折叠（§21.33）、导出被拒提示（§21.51）、` · {layers} 层` 后缀共 78 条 msgid 原先只在 `public/i18n/en.json` 里，而四个语言包都声明 `complete`——现在 zh-TW / ja / ko 也都有了（用词沿用各包既有译法：整備區 / 整備エリア / 정비 구역、調度中心 / 管理センター / 보급센터，专有名词取 `data/i18n/<lang>.json` 的官方名），`node tools/i18n.mjs check --all --strict` 四种语言都是 100 % / 0 errors。
- 抓取数据与上游状态属 `docs/ISSUES-ARCHIVE.md`（第 1–13 节由抓取流水线生成）。那套流水线（`.scratch/`：抓取脚本、110 条正文与评论、归类结果）是维护者本机工具，**没有随本分支发布**；本文件与 FIXLOG 是人工维护，流水线不会覆盖它们。
