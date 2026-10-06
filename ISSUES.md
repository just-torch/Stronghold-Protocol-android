# Stronghold-Protocol 未修复 Issue 清单（本地 fork）

- 上游仓库：[sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)
- 条目数：**25**（P0 0 / P1 5 / P2 6 / P3 14）
- 口径：上游 issue 抓取于 2026-10-05（110 条）；本地树合并 upstream 0.1.3 后于 2026-10-06 逐条复核，同日又按「较严重影响体验」筛出 17 条实测修掉 10 条。本文件**只列仍然成立的条目**。
- 配套文件
  - [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) — 已修 / 已判「不是 bug」/ 已闭环 / 上游已排期的记录与逐条证据（**动手之前先查这里**，避免重复修；含 2026-10-06 两轮复核原文与探针数据）
  - [`docs/ISSUES-ARCHIVE.md`](docs/ISSUES-ARCHIVE.md) — 110 条 issue 的抓取归档：总览、分类、讨论区摘要、原始数据清单（由 `.scratch/render-report.cjs` 生成，勿手工维护）
- 维护方式见 §4；`test/docs-consistency.test.js` 会检查本文件与 FIXLOG 的编号不重叠。

## 1. 一览

| 优先级 | Issue | 分类 | 现象 | 为什么还没修 / 下一步 |
|---|---|---|---|---|
| P1 | [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) 绝食干员不吃红蒂缓回，海嗣 boss 爆条频率明显过快 | 技能 / 治疗 | 红蒂、魔王吟游者、调香师天赋、瑕光 S2 对「绝食」干员回血恒为 0，同一效果对普通干员正常（实测 +31 / +256） | **等上游裁定**：维护者在 issue 里两次否认这是 bug，举报者提交 PR #135 反驳。实现方案已明确（见 §2.1），差的是裁定；另「爆条频率」子项尚未复核 |
| P1 | [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) 绝食干员无法对小特被动、棘刺等技能产生的治疗生效 | 技能 / 治疗 | 与 #96 同一处治疗闸门 | 与 #96 合并处理（同一根因、同一裁定） |
| P1 | [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) 当前阿戈尔问题汇总（5 子项） | 干员 / 盟约 | 复活名额、吞噬增益倍率、标记者离场、联防断链、流失来源归因 | 子项 1（复活名额）与 4（联防断链）已修；**剩下 3 项都是规则之争**（见 §2.2），改与不改都要先有官方依据；子项 1 的排序口径还与上游 0.1.4 的方案不同，属 0.1.4 范围 |
| P1 | [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) 中途意外退出后无法重连入房间，并且会持续烧条 | 网络 / 联机 | 对局中途意外退出（刷新 / 断网 / 杀进程）后回不去房间，且轮询持续「烧条」 | **缺复现细节**（issue 正文为空）：需要模式（单机 / 联机）、退出方式与控制台报错；状态机在 `public/js/store.js`、`public/js/net.js`、`server/lobby.js`，要浏览器 e2e（`SP_E2E=1`）才能覆盖 |
| P1 | [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) 网页版游戏文件未加载 | 网络 / 分发 | 下载源码包后本地打开，干员 / 盟约 / 地图 / 敌人全不加载（连别人的服务器正常） | 代码侧已修（导出失败不再静默）；**剩分发与文档**（见 §2.3）：`.gitignore` 不含素材，不跑 `npm run setup` 就是零美术，`file://` 直接打开必然失败 |
| P2 | [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) AI 策略优化 | 界面 / AI | AI 队友用医疗挡狗、堵门卡怪导致超时等 | AI 手感类，`server/match/bot.js` 仍是既有策略；改之前先和上游对齐「AI 应该多强」，否则只是换一种主观 |
| P2 | [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) AI 的干员抓取和策略选择问题 | 界面 / AI | AI 大量抢队友特化干员、选鸭爵守不住 | 与 #31 同一处（`server/match/bot.js` 的抓取与策略权重），同上 |
| P2 | [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) 自己加的人变成「滚木」 | 部署 / 渲染 | 自行添加的干员备战界面可见、进战斗后消失 | **无法确证**：战斗侧唯一能「删人」的地方是 `server/sim/Battle.js` 对未知 chess 静默返回 null（只写服务端日志），而 `normalizeChess` 永不返回 null → 只可能是「服务端数据源与浏览器自拉的数据不一致」。需要举报人的 chessId、改动文件清单与控制台报错 |
| P2 | [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) 按键自定义；攻击特效缺失；待选区自动落位 | 战斗表现 / 界面 | 三条功能性建议 | 只做了「商店条可折叠 + `C` 键」（`docs/DESIGN.md` §21.33）。待选区自动落位本树确实没做（进手牌只有显式 `stow()`）；「AOE 特效缺失」的判定只认 5 个子职业（`public/js/render/fx.js` 的 `SPLASH_SUBS`），正确做法是按同一 `attackId` 的命中数聚合——**单纯加白名单会误伤**（玛恩纳普攻是单体），属渲染重构 |
| P2 | [#175](https://github.com/sganggs/Stronghold-Protocol/issues/175) 华法琳特性叠层超过描述的 7 次 | 技能 / 数值 | 数据文案写「至多 7/14 层」，实测按 PRTS 3/27 公告叠到 12/24 | **只差文案**：模拟侧按公告（`GRANTED_CAP_OVERRIDE` 12/24）是对的；本树没有 desc override 通道，需随下一次数据重建一起改 `data/garrisons.json` |
| P2 | [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) 部分干员闭眼时眼球没有被完全遮住（仇白、琳琅诗怀雅） | 战斗表现 / 贴图 | 倒地 / 眨眼时眼球露出 | 渲染表现，举报者自己也说影响不大；未做 |
| P3 | [#38](https://github.com/sganggs/Stronghold-Protocol/issues/38) Localization for full English UI | 本地化 | 完整英文界面 | CHANGELOG 明确「#38 保持开放」；与 #57 同一需求，需先定术语与基准 |
| P3 | [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) 英文界面：一个不改游戏代码的叠加层方案 | 本地化 | DOM 叠加层方案（含 Alliance vs Covenant 术语统一等三个问题） | 等上游表态（是否收、术语、基准）；方案本身可用 |
| P3 | [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) feature: 增加一键重开按钮 | 界面 / 交互 | 一键重开 / 不禁用干员选项 | 功能请求，无对应条目 |
| P3 | [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) 讨论：关于数据持久化的取舍 | 工程质量 | 默认关闭的可选 SQLite 持久化（战绩 / 复盘 / 回放） | 设计决策；要先定「默认关 + 不引入运维负担」的边界 |
| P3 | [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | 工程质量 | `server/index.js` 拆模块、换 Hono | 架构设计决策；本树也没有 `worker/`、`deploy/` |
| P3 | [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 界面 / 交互 | 房间聊天补丁（贡献者已实现 0.1.3 版） | 补丁在上游待决定是否合并；本树未合 |
| P3 | [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) 休整期双击可以直接看队友的场地 | 界面 / 交互 | 双击队友头像直接查看其场地 | 相邻能力已有（观战跟随移动、观战可见手牌），双击手势本身没做 |
| P3 | [#136](https://github.com/sganggs/Stronghold-Protocol/issues/136) feature: 希望能增加原版 V,VI 干员的自选 | 界面 / 交互 | 原版 V/VI 干员自选 | 功能请求；素材与 bug 成本高，需上游表态 |
| P3 | [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) 拖动干员身体也能拖；准备时可以收起商店 | 界面 / 交互 | 拖拽热区、商店折叠 | 商店折叠已做（`C` 键，§21.33）；拖动热区未做——本树是**有意**按「地上方格」拾取（§18.1 玩家实测 #4 的结论），改回拖身体要先推翻那条结论 |
| P3 | [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) 能不能增加一个联机指定后端的功能 | 网络 / 联机 | 客户端可指定后端，避免重复拉取素材 | 功能请求，与 #173 的素材分发相邻 |
| P3 | [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) 建议，优化房间逻辑 | 界面 / 交互 | 房主踢人 / 转让 / 账号功能 | 0.1.3 已加观战席（§23.19）与房主踢人（§23.12），其余（转让 / 账号）待定 |
| P3 | [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | 工程质量 | monorepo / 构建工具 / 子系统拆分 / 插件扩展 | 路线图性质，随 #84 / #95 一起定 |
| P3 | [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上 | 工程质量 / 性能 | 排查笔记，另记录两个**真实代码隐患** | 可单独开条目跟踪：`adaptLoad` 帧长 > 250 ms 时自适应降级停摆、替身阈值不覆盖联防场景（`public/js/render/app.js`） |
| P3 | [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) feature：可以自己切换干员成特勤干员 | 干员 / 盟约 | 主动把干员切换成特勤干员 | 提案人自己说明这是超出原版的优化，需上游表态（与 touch 策略的相邻行为见 FIXLOG 的 #161 行） |

## 2. 需要展开的三条

### 2.1 #96 / #137 —— 绝食 × 治疗（差裁定，不差实现）

- 唯一治疗闸门是 `server/sim/damage.js` 的 `noHeal` 判定（一刀切），所以红蒂 / 魔王缓回、调香师天赋、瑕光 S2 对绝食干员**全为 0**，同一效果对普通干员正常（3 s 内 +31 / +256）。
- 引擎**已有**「生命回复速度」通道（`server/sim/Battle.js` 的 `hpRegen`，绕过 `noHeal` 与治疗加成）：把那 4 处 `battle.heal` 换成 `addBuff hpRegen` 即可修，改动面很小。
- 卡在裁定上：维护者两次否认这是 bug，举报者的 PR #135 待合并；而且举报材料里对「引星棘刺一技能这类技能治疗该不该被绝食挡住」本身也自相矛盾。**故只记录证据不改代码。**

### 2.2 #165 —— 阿戈尔 5 个子项

| 子项 | 状态 |
|---|---|
| 1 复活名额应共享 | 已修（§23.20 按站位给最靠前的三人）；与上游 0.1.4 的「按被击倒顺序」方案不同，属 0.1.4 范围 |
| 2 吞噬增益错误享受攻击倍率 | **仍成立但属规则之争**：本树只有 `atkFlat`（直接加算）/ `atkPct`（直接乘算）/ `atkMul`（最终乘算）三桶，探针 `base.atk 1000 → devour atkFlat 2000 → atkPct 1.00 → s.atk 6000`（官方读法应为 4000）；本树没有「最终加算」桶，增删都是改规则 |
| 3 标记者死亡取消已付与的吞噬 | **仍成立但属规则之争**：§23.2 把「标记者离场后不再产生标记」写成有意实现（PRTS 只描述目标侧）；探针 A→B→C 链中 B 被击倒后 C 只吃 1 次 5000（B 存活则 2 次） |
| 4 联防断链 | 已修（§23.2 按「自己那一仗之后倒地」计数） |
| 5 流失来源归因 | 仍成立：流失事件的 `source` 记成标记者，官方应为目标自身；只影响结算归属，不影响玩法 |

落点：`server/sim/content/bonds/core.js`、`server/sim/units.js`。

### 2.3 #173 —— 分发与文档

- 已核实**本树没有清单级缺陷**：`data/assets.json` 的 5699 条 `/assets` 与 1481 条 local 路径 0 缺失、0 大小写错。
- 根因是分发：源码 ZIP / `git clone` 不带素材（`.gitignore` 排除），不跑 `npm run setup` 就是零美术；`file://` 直接打开必然失败（全站根绝对路径），所以「连别人的服务器正常、本地打开全空」。
- 待办：在 `README.md` / `docs/DEPLOY.md` / `docs/PLAYING.md` 里把「解压后必须先 `npm run setup`（或直接用整合包 / Windows 便携包）」写成显式步骤，并考虑给「素材目录为空」一个启动前的显式报错。属分发与文档，不是引擎缺陷。

## 3. 本轮附带发现（尚无 issue 编号）

- **技能范围型 MANUAL 技能的触发策略**：带 `SKILL_RANGE` 的 MANUAL 技能走 `DEFAULT` 还是 `SKILL_RANGE`，决定它「能不能自动开到打得到敌人的那一刻」。复核忍冬三技能时实测：只有技能 +1 距离内的敌人时 `cast = false`（`DEFAULT` 要求初始射程内有敌人）。属策略裁定，未改。
- **AOE 特效聚合**：见 §1 的 #143 行（应按同一 `attackId` 的命中数聚合，而不是扩白名单）。
- **绝食 × 生命回复通道**：见 §2.1（差的是裁定，不是实现）。

## 4. 维护方式

- 本文件**只列仍然成立的条目**；一旦修掉（或判定不是 bug），把该行移入 [`docs/ISSUES-FIXLOG.md`](docs/ISSUES-FIXLOG.md) 并补上 `docs/DESIGN.md` 的章节与回归测试，编号不再出现在本文件里。
- FIXLOG 顶部的 `<!-- settled: … -->` / `<!-- pending: … -->` / `<!-- issue-total: … -->` 三个注释是机器可读的：`test/docs-consistency.test.js` 用它们断言「已判定 + 未复核 + 本清单」正好覆盖全部 110 条，且互不重叠——所以移动条目时**必须同时更新注释**。
- 抓取数据与上游状态属 `docs/ISSUES-ARCHIVE.md`（第 1–13 节由抓取流水线生成）。那套流水线（`.scratch/`：抓取脚本、110 条正文与评论、归类结果）是维护者本机工具，**没有随本分支发布**；本文件与 FIXLOG 是人工维护，流水线不会覆盖它们。
