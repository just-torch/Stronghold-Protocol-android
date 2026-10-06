# 修复与判定记录（`ISSUES.md` 的配套）

> `ISSUES.md` 只列**仍未修复**的条目；本文件记录**已经不成立**的条目：已修 / 已判「不是 bug」/ 已闭环 / 上游已排期。动手之前先查这里，避免重复修。
> 抓取数据（110 条 issue 的总览、分类、讨论摘要、原始数据清单）见 [`docs/ISSUES-ARCHIVE.md`](ISSUES-ARCHIVE.md)，它由抓取流水线生成——那套流水线（`.scratch/`）是维护者本机工具，没有随本分支发布；本文件与 `ISSUES.md` 是人工维护。

判定口径：`docs/DESIGN.md` 第 22–24 章与本地 §21.x 是否有对应修复条目，加上本机实测（探针用完即删，证据见本文 §6 中照录原文的第 15.4 节）。「上游已修」按维护者评论 / CHANGELOG 引用判定；标「已排期 / 未复核」的表示上游已关闭或已排入版本，但本树没有单独复核过。

<!-- issue-total: 110 -->
<!-- settled: 1 3 4 5 8 9 15 16 17 18 19 20 21 22 25 26 32 33 35 41 42 43 44 45 46 49 50 51 52 53 54 55 58 59 60 61 62 64 65 67 68 76 79 80 82 83 86 87 89 92 93 94 97 99 100 101 104 105 106 107 108 111 113 116 117 123 124 128 133 139 140 148 151 153 159 161 162 169 170 171 179 180 181 -->
<!-- pending: 142 144 -->

## 1. 本轮实测修复（本地 fork，2026-10-06）

每条都有新回归测试，并记在 `docs/DESIGN.md`；逐条探针证据见本文 §6 中照录原文的第 15.4 节。

| Issue | 原优先级 | 结论与证据 |
|---|---|---|
| [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) | P0 | 报告的现象（200 层、原格空着）不复现；真正可复现的是**落点被占时这次不屈被静默吃掉**。新增 `u.freeRedeploy`：`Battle._checkRedeploys` 零费用放回、`_deploy` 清位（DESIGN §21.48） |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) | P1 | 突袭的「技能就绪」改为包含**生效中的被动**（`kind === 'passive'` 与 `duration + activateOnDeploy` 两种形态），只动突袭判定（§21.42）；`test/sim/issue49-raid-passive.test.js` |
| [#162](https://github.com/sganggs/Stronghold-Protocol/issues/162) | P1 | 缇缇特性叠层改为「每次成功施加都计数」（冻结仍按「进入」），上限 24/48（§21.44）；`test/content/garrisons_battle.test.js` |
| [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) | P1 | 秘术师蓄力钟改读引擎自己的 `profile.canAttack`，与 `atkCd` 解耦（§21.46）；`test/sim/issue181-mystic-store.test.js` |
| [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) | P1 | 引星棘刺 S1 补 `trigger: 'SP_FULL'`，重新落回 AUTO 的满技力释放（§21.47）；`test/content/kits_alt_t5.test.js` |
| [#171](https://github.com/sganggs/Stronghold-Protocol/issues/171) | P1 | 引擎侧本就生效，缺的是客户端图标表：补 `palsy` / `attract` / `reveal` 与兜底正则（§21.49）；`test/render/tiles.test.js` |
| [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) | P1 | 资金经复核**不是 bug**（与官方表 1/1/5/8/10 逐一吻合）；香槟炸弹放置范围改为自身十字 5 格并挂在攻击周期上（§21.45）；`test/content/kits_t3.test.js` |
| [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) | P2 | 倒地/起身抽搐的真因是渲染层用旧快照复活、又用新快照按倒；改成 down 列表权威（§21.50）；`test/render/downelem.browser.test.js` |
| [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) | P1 | 复核为**已修**：`kitBlades` 每次攻击消耗 1 枚、`maxStacks` 4 层封顶（实测伤害 1350→5670 后不再涨），死亡时断刃生成矛头 |
| [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) | P1 | **部分**：清单级缺陷不存在（5699 条 `/assets` + 1481 条 local 路径 0 缺失）；唯一代码缺陷「导出失败静默」已改（§21.51）。**分发与文档部分仍留在 `ISSUES.md`** |

## 2. 上游版本归属（0.1.1 / 0.1.2 / 0.1.3 已声明修复）

逐条要点与证据见 [`docs/ISSUES-ARCHIVE.md`](ISSUES-ARCHIVE.md) 的第 3 节（版本结论）与第 5.1 节（本地核验）。

| 版本 | 已在此版本修好的条目 |
|---|---|
| v0.1.1 | [#1](https://github.com/sganggs/Stronghold-Protocol/issues/1) 转职 / 盟约计数 · [#3](https://github.com/sganggs/Stronghold-Protocol/issues/3) [#15](https://github.com/sganggs/Stronghold-Protocol/issues/15) [#54](https://github.com/sganggs/Stronghold-Protocol/issues/54) 昆图斯突变细胞与针 · [#5](https://github.com/sganggs/Stronghold-Protocol/issues/5) 收起商店不缩放 · [#8](https://github.com/sganggs/Stronghold-Protocol/issues/8) 切页后图标丢失等 6 条 · [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) [#46](https://github.com/sganggs/Stronghold-Protocol/issues/46) 召唤物 owner 攻击范围（`ownerRangeKeys()` + `tokens.json ownerRange` + 专项测试）· [#17](https://github.com/sganggs/Stronghold-Protocol/issues/17) 转职后详情词条 · [#19](https://github.com/sganggs/Stronghold-Protocol/issues/19) [#20](https://github.com/sganggs/Stronghold-Protocol/issues/20) 深池余烬与隐匿尸体 · [#21](https://github.com/sganggs/Stronghold-Protocol/issues/21) 突袭不落倒地格 · [#22](https://github.com/sganggs/Stronghold-Protocol/issues/22) 凯瑟琳装备商店贴图（重复 #44）· [#26](https://github.com/sganggs/Stronghold-Protocol/issues/26) 飞天石像二阶段动画 · [#32](https://github.com/sganggs/Stronghold-Protocol/issues/32) 余二技能 / 火山源石虫 / 深池鬼火 / 歌蕾蒂娅高台 / 暴鸽 / 隐蔽溅射汇总 · [#35](https://github.com/sganggs/Stronghold-Protocol/issues/35) 要塞对空（数据重写）· [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) 水面放置与昆图斯的针 · [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) [#99](https://github.com/sganggs/Stronghold-Protocol/issues/99) 素材 / 表情下载 · [#43](https://github.com/sganggs/Stronghold-Protocol/issues/43) 破隐后仍显示为隐蔽 · [#45](https://github.com/sganggs/Stronghold-Protocol/issues/45) 圆仔不可阻挡 · [#53](https://github.com/sganggs/Stronghold-Protocol/issues/53) 深水区不能部署 |
| v0.1.2 | [#16](https://github.com/sganggs/Stronghold-Protocol/issues/16) 莫斯提马三技能减速 · [#25](https://github.com/sganggs/Stronghold-Protocol/issues/25) [#59](https://github.com/sganggs/Stronghold-Protocol/issues/59) 倒地动画与攻击动作 · [#33](https://github.com/sganggs/Stronghold-Protocol/issues/33) 阿戈尔开场吞噬解除 · [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) 突袭落点必须打到目标 · [#52](https://github.com/sganggs/Stronghold-Protocol/issues/52) 史尔特尔余烬期间禁疗 · [#58](https://github.com/sganggs/Stronghold-Protocol/issues/58) 远程敌人攻击站定 · [#60](https://github.com/sganggs/Stronghold-Protocol/issues/60) 归溟幽灵鲨替身 · [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) 调配界面局内数值（§22.16）· [#79](https://github.com/sganggs/Stronghold-Protocol/issues/79) 拉普兰德 3% 与攻速 · [#82](https://github.com/sganggs/Stronghold-Protocol/issues/82) 联防只带血量比例与技力 |
| v0.1.3 | [#44](https://github.com/sganggs/Stronghold-Protocol/issues/44) 观战可见队友装备与手牌 · [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) 突袭落点占用（`isReservedTile` 同时拦 alive 与未移除的倒地单位）· [#55](https://github.com/sganggs/Stronghold-Protocol/issues/55) 战斗 BGM 按回合切换 · [#61](https://github.com/sganggs/Stronghold-Protocol/issues/61) 子弹从手部发出 · [#68](https://github.com/sganggs/Stronghold-Protocol/issues/68) 后台加载卡住的模型会重载 · [#76](https://github.com/sganggs/Stronghold-Protocol/issues/76) 观战席（`MAX_SPECTATORS = 2`）· [#86](https://github.com/sganggs/Stronghold-Protocol/issues/86) 芬的信标 · [#87](https://github.com/sganggs/Stronghold-Protocol/issues/87) 观战实时同步 · [#93](https://github.com/sganggs/Stronghold-Protocol/issues/93) [#104](https://github.com/sganggs/Stronghold-Protocol/issues/104) 深溟巢涌者改范围脉冲 · [#97](https://github.com/sganggs/Stronghold-Protocol/issues/97) 隐匿阻挡者不吃溅射 · [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) 阿戈尔复活名额按站位 · [#117](https://github.com/sganggs/Stronghold-Protocol/issues/117) 碎骨榴弹按 PRTS · [#123](https://github.com/sganggs/Stronghold-Protocol/issues/123) 出售 / 撤退快捷键 |
| v0.1.4 / 0.2.0（上游已排期） | [#148](https://github.com/sganggs/Stronghold-Protocol/issues/148) [#153](https://github.com/sganggs/Stronghold-Protocol/issues/153) 「可以放置于远程位」的干员上高台（§22.6 / §23.35） |

## 3. 本地 fork 早先修复（§21.31–§21.41）

| Issue | 结论与证据 |
|---|---|
| [#169](https://github.com/sganggs/Stronghold-Protocol/issues/169) | 拉普兰德本回合首次刷新必须是能加层的那次（§21.32）+ 精锐合并后再次触发（§21.35），`match/PlayerState.js` / `content/garrisons/meta.js`，配回归测试 |
| [#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) | 上游 master 的 CI 红（`test/sim/skills.test.js:437`「deploy-time passive」）在本树已按新行为改写，本机实测 17/17 通过 |
| [#128](https://github.com/sganggs/Stronghold-Protocol/issues/128) | 观战/查看队友可见手牌、临时整备区、装备、策略与效果列（提交 `bce1827` + DESIGN §23.19） |

## 4. 已判「不是 bug」/ 不可复现（不要再改，改了就是改规则）

| Issue | 结论 |
|---|---|
| [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) | 本轮实测：瑕光 S2 沉睡的敌人**仍占阻挡数**（官方备注一致）；「绝技层数被助力 +2」是助力的定义，而绝技的战斗效果只读场上精锐数、不读层数 → 是显示误导，不是数值错误 |
| [#170](https://github.com/sganggs/Stronghold-Protocol/issues/170) | 本轮实测引擎侧不复现：技能期间每次攻击都上晕眩、时长恰为 `attack@stun` 0.2，+1 攻击距离也生效；正文为空、评论已删（`.scratch/comments/170.json` = `[]`），无法确证玩家所指。**附带发现**（已记入 `ISSUES.md` §3）：带技能范围的 MANUAL 技能走 `DEFAULT` 还是 `SKILL_RANGE` 会决定「能否自动开到打得到敌人的那一刻」，属策略裁定 |
| [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) | 标准模拟里灵巧在官方的本局禁用名单上；0.1.3 起盟约条显示灰色「本局禁用」（§23.30） |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) | 维护者逐条实测：3% 是伪随机长期频率、层数只加伤害不加概率、谢拉格冻结按层数、四爷的狼不吃 6 叙隐匿是因隐匿只给叙拉古人（叙拉古 6 的掷骰范围另由 §23.29 收紧） |
| [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) | 重装干员下半赛季官方规则就是「受到伤害时才释放技能」；0.1.1 出于玩家反馈**有意**改成进范围即开 |
| [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) | 一级商店按官方只刷不超过商店等级的干员，而一阶 `<炎>` 只有惊蛰；策略原文也注明「部分干员缺席时体验可能不完整」 |
| [#62](https://github.com/sganggs/Stronghold-Protocol/issues/62) | 「二级少一个协律」：举报者复核后并未找到该干员，疑为记错（与 #65 同一商店等级规则） |
| [#83](https://github.com/sganggs/Stronghold-Protocol/issues/83) | 流形是「部署时」召唤并复制，对已在场干员升变不会补牌；举报者自己确认记错 |
| [#113](https://github.com/sganggs/Stronghold-Protocol/issues/113) | 官方公告是左右分身共用一条血、总生命值不变，**不乘人数** |
| [#133](https://github.com/sganggs/Stronghold-Protocol/issues/133) | 被推的敌人会停在围栏前；围栏格按官方「可部署、地面不可通行」，站在上面的干员本来就不能阻挡地面敌人 |
| [#139](https://github.com/sganggs/Stronghold-Protocol/issues/139) | 独行的 +60% 不随层数变化；层数会涨是「助力」在休整结束时给已激活盟约 +2 层，效果本身不变 |
| [#161](https://github.com/sganggs/Stronghold-Protocol/issues/161) | 官方「外勤医疗」是每位玩家场地上出现一名预备干员-医疗，开战时若该玩家场上有至少两名精锐才替换为 Touch；不是状态串用 |
| [#180](https://github.com/sganggs/Stronghold-Protocol/issues/180) | 举报者自己更正「原作也会这样」，标注为无需修复 |
| [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) 第 3 条 / [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) | 活性源石是环境伤害、不看隐匿（萨卡兹枯朽战士毒雾写明「无视无法选择」）；赏金：悬赏本体第 9 回合才出，分裂小怪不带赏金（0.1.3） |

## 5. 本地已闭环 / 上游已排期

| Issue | 结论 |
|---|---|
| [#106](https://github.com/sganggs/Stronghold-Protocol/issues/106) | **本树已闭环**：工具侧先改好（失败不再静默删条目，§22.5），随后抓到全部语音与 BGM，`data/assets.json` 的 5699 条引用 0 缺失（`test/assets.test.js` 严格通过）。**分发侧根因**（源码 ZIP / `clone` 不含素材）留在 `ISSUES.md` 的 #173 行 |
| [#18](https://github.com/sganggs/Stronghold-Protocol/issues/18) | Android 壳提案：本树已有 `android/`（内嵌服务器 + 清单驱动热更新，见 `android/README.md`、`docs/DESIGN.md` §21.22–§21.25），无待办 |
| [#151](https://github.com/sganggs/Stronghold-Protocol/issues/151) | 下游 Windows 启动器：本树已有 `scripts/make-windows-bundle.mjs` + `scripts/launch.mjs` + 双击 `启动游戏.bat`（`docs/WINDOWS.md`），无待办 |
| [#94](https://github.com/sganggs/Stronghold-Protocol/issues/94) | 金币没花完的提示已实现：准备就绪前弹「剩余资金 / FUNDS LEFT —— 还有 N 资金未使用。休整期结束时，本回合的剩余资金将清零」（`public/js/ui/gameLogic.js`） |
| [#159](https://github.com/sganggs/Stronghold-Protocol/issues/159) | 生命值归零即进入观战视图：`public/js/screens/game.js` 的 `spectating = !alive`，休整期自动显示首个仍在局内的玩家，顶部常驻「观战中 · 点击左侧成员头像切换查看」 |
| [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) | Workers DO 写入量：作者明确不收 PR、需上游自己摘取；本树没有 `worker/`，不在本 fork 范围内 |
| [#111](https://github.com/sganggs/Stronghold-Protocol/issues/111) | 第三方模组加载器：提案性质，等上游表态，本树无待办 |
| [#142](https://github.com/sganggs/Stronghold-Protocol/issues/142) | 盟约面板可收起：上游排入 v0.1.4（PR #149），**本树未单独复核** |
| [#144](https://github.com/sganggs/Stronghold-Protocol/issues/144) | CI 偶发失败：上游排入 v0.1.4（PR #146），**本树未单独复核**；本机全量单元测试两轮全绿（含 `test/match/lobby-integration.test.js`） |

## 6. 抓取后的两轮复核原文（2026-10-06）

以下照录当时的原文（标题层级下调一级，章节号沿用原文），其中「第 2 节 / 第 5 节 / 第 6 节 / 第 10 节」等指 [`docs/ISSUES-ARCHIVE.md`](ISSUES-ARCHIVE.md) 的对应小节。

### 14. 复核：合并 upstream 0.1.3（master）之后的「仍未修复」清单（2026-10-06）

本地树已把上游 `master` 合并进来（v0.1.2 与 v0.1.3 两章共 161 个提交，加 0.1.3 之后 18 个提交），`package.json` 随上游变为 **0.1.3**。本节按**合并后的代码**重新筛选第 2 节那 49 条「开启」条目。

**判定方法（引用级筛选，不是逐条复现）**

| 证据 | 说明 |
|---|---|
| `docs/DESIGN.md` 第 22 章 | 0.1.2 的逐条修复（16 条，标题里带 issue 号） |
| `docs/DESIGN.md` 第 23 章 | 0.1.3 的逐条修复（39 条，含社区报告与 GitHub issue 号） |
| `docs/DESIGN.md` 第 24 章 / 本地 §21.31–§21.43 | 0.1.3 之后的提交与**本地 fork** 的修复记录 |
| `CHANGELOG.md` | 0.1.2 / 0.1.3 条目里 `（GitHub #N）` 的引用 |
| `git log v0.1.1..master` | 178 个提交、其中 99 个标题带 `#号`（PR 号已剔除） |
| 本机实测 | `node --test` 3824 项 / 3813 通过；浏览器 e2e 129 项 / 125 通过（2026-10-06 复核后本机为 **3840 项 / 3829 通过**，唯一失败项是 CPU 性能基准，单独跑通过） |

判定为「已修」要求上游或本地**明确声明**修了这一条（设计文档条目、提交标题或本地 §21.x）。因此 14.2 里凡是没有对应条目的，含义是「上游没有声明修掉它」，而不是「已经实测仍然坏」——标「需复核」的表示证据间接或只覆盖了报告的一部分，动手前建议先按正文复现一次。

#### 14.1 已修 / 已实现（可以从工作单里划掉）

| Issue | 原优先级 | 判定 | 证据（合并后的树） |
|---|---|---|---|
| [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) | P0 | 已修 | §22.3 阿戈尔吞噬跳过已被它击倒的成员；§23.2 联防按「自己那一仗之后倒地」计数；§23.20 五层三次复活**按站位给最靠前的三人**（正是 #105/#165 要的「名额共享」） |
| [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) | P1 | 已修（子项均已覆盖） | 水面放置：0.1.1「深水区不能部署干员和召唤物」（`server/match/board.js`）；昆图斯的针：#15 同族（0.1.1 盟约与道具段）；野鬃推怪：第 6 节已判定为官方行为 |
| [#82](https://github.com/sganggs/Stronghold-Protocol/issues/82) | P1 | 已修 | §23.1 联防只带血量比例与技力、不带未结束的技能；CHANGELOG 0.1.3（GitHub #82） |
| [#86](https://github.com/sganggs/Stronghold-Protocol/issues/86) | P1 | 已修 | §23.9 芬的信标送出原本那名干员、送礼者被淘汰后信标仍在（`match/builtinMeta.js`）；CHANGELOG 0.1.3（GitHub #86） |
| [#153](https://github.com/sganggs/Stronghold-Protocol/issues/153) | P1 | 已修 | §22.6 钩索师/推击手按官方特性可放高台；§23.35 精锐歌蕾蒂娅带 HOK-Y（`shared/highGround.js`）；CHANGELOG「歌蕾蒂娅等钩索师、推击手…可以部署到高台上」 |
| [#169](https://github.com/sganggs/Stronghold-Protocol/issues/169) | P1 | 已修（**本地 fork**） | §21.32「拉普兰德本回合的首次刷新必须是能加层的那次」+ §21.35「精锐合并后再次触发」，`match/PlayerState.js`／`content/garrisons/meta.js`，配回归测试 |
| [#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) | P1 | 已修 | #109／#160 的重部署技能生命周期（提交 `ffdb129`、`8774379`）；`test/sim/skills.test.js` 本机实测 **17/17 通过**（第 437 行那条断言已按新行为改写） |
| [#76](https://github.com/sganggs/Stronghold-Protocol/issues/76) | P3（功能） | 已实现 | §23.19 观战席：`shared/constants.js MAX_SPECTATORS = 2`，`test/ui/spectator.e2e.test.js` 通过 |
| [#123](https://github.com/sganggs/Stronghold-Protocol/issues/123) | P3（功能） | 已实现 | 提交 `3f05c65`：`ui/gameLogic.js shortcutFor` 的 `KeyQ → retreat`、`KeyX → sell`（记录在 #114） |
| [#55](https://github.com/sganggs/Stronghold-Protocol/issues/55) | P3（功能） | 已实现 | 提交 `777aee7` 战斗 BGM 按回合切换（`public/js/audio.js` 的 `bgm.combatAlts`）+ `bd892a4` 联防腐蚀曲 |

同一次复核里还可以划掉本清单**其他小节**的几条：

| 条目 | 原结论 | 现在的结论 | 证据 |
|---|---|---|---|
| [#128](https://github.com/sganggs/Stronghold-Protocol/issues/128)（第 10 节） | 观战看不到队友装备/手牌/策略 | 已修 | 提交 `bce1827`「Watching a teammate shows their hand, 临时整备区, equipment, strategy and effects (#129)」+ §23.19 |
| [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64)（第 5.2 节） | 调配界面缺局内数值 | 已修 | §22.16 新增「局内数值」（`public/js/screens/loadout.js statsPreview`、`css/screens/loadout.css .lo-sec--stats`） |
| [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51)（第 5.2 节） | 突袭闲置再部署不要求覆盖敌人 | 已修 | §22.2（`server/sim/content/bonds/addon/battle.js` 的 `raidPoll / raidTile`；不再是「只看 idleOk」） |
| [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50)（第 5.2 节「残余」） | 占用检查只认 alive | 复核通过 | `server/sim/Battle.js isReservedTile` 同时拦「alive 占用者」和「未移除的倒地干员/召唤物」（`a.alive \|\| a.removed` 过滤后回到 `restTile`）；`raidTile` 走同一判定 |
| [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9)（第 5.2 节「只剩核对」） | placeable 召唤物范围校验 | 已实现，只剩规则核对 | `ownerRangeKeys()` + `tokens.json ownerRange` + `test/match/feedback1-placement.test.js`；剩下的是「6 个 placeable 是否都该受约束」的官方规则核对，不是代码缺口 |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49)（第 14.2 节） | 突袭被动系不随首敌前压 | 已修（**本地 fork**） | §21.42：`content/bonds/addon/battle.js` 的 `raidPoll` 把「生效中的被动」也算作「技能就绪」——`kind === 'passive'`（琳琅诗怀雅 S1/S2）**与** `duration + activateOnDeploy`（真实成员：缄默德克萨斯 S1–S3、宴 S2、斯卡蒂 S2、耀骑士临光 S2，由 `generic.js:150-154` 改判而来）两种形态都覆盖，配 `test/sim/issue49-raid-passive.test.js`；`sim/skills.js` 的 `get ready()` 保持原样（被动永远不充能是官方规则，改的是突袭的判定） |

#### 14.2 仍未修复（合并后仍然成立的清单，36 条；**其中 10 条已由 §15 清掉、2 条改判，以 §15 为准**）

| 优先级 | Issue | 现象 | 判定依据 / 复核建议 |
|---|---|---|---|
| P0 | [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) | 史尔特尔被禁疗死亡后吃不到不屈立即复活 | 0.1.2 只修了「余烬期间禁疗」（§22.7 = #52），不屈 × 禁疗死亡的交互没有条目；建议按正文在 `content/bonds/addon/battle.js` 的不屈分支复现 |
| P1 | [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) | 绝食干员不吃红蒂缓回 | 第 6 节记为争议条，等 PR #135 的裁定；本次合并没有相关提交 |
| P1 | [#106](https://github.com/sganggs/Stronghold-Protocol/issues/106) | 有 500 个素材文件下载失败 | **2026-10-06 已闭环**：工具侧先改好（失败不再静默删条目、列出来并可重试，§22.5），随后在能直连 `raw.githubusercontent.com` 的网络（Node 加 `--use-system-ca` 走系统证书库）抓到全部语音与 BGM，`data/assets.json` 的 5 699 条引用现在 **0 缺失**（`test/assets.test.js` 严格通过；`android/README.md` 记了过程） |
| P1 | [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) | 矛头哥（新硎）攻击不消耗铁矛头 | 代码里已有 `enemy_1208_msfji_2 // 铁矛头 · 30 hits`、`enemy_1207_sfji_2 kitBlades`（`server/sim/content/enemies.js`）→ **需复核**：30 次计数与「消耗」表现是否与报告一致 |
| P1 | [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) | 单人标准模拟商店升级资金异常；琳琅诗怀雅二技能香槟炸弹放置范围错误 | 0.1.3 只碰了琳琅诗怀雅 S1（§23.8）与 S3（§23.34），资金与香槟炸弹范围无条目 |
| P1 | [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) | 引星棘刺一技能不会在满技力时自动释放 | 无条目（§23.4 是「眩晕不打断自然回技力」，另一件事） |
| P1 | [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) | 绝食干员对小特被动、棘刺等技能治疗不生效 | 无条目（§23.28 改的是「地面干员」判定：不屈／战栗／休谟斯） |
| P1 | [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) | 瑕光绝技层数；阿戈尔吃人 | 阿戈尔部分随 §22.3／§23.2／§23.20 改过，瑕光层数无条目 → **需复核** |
| P1 | [#162](https://github.com/sganggs/Stronghold-Protocol/issues/162) | 缇缇特性叠层有误 | 无条目 |
| P1 | [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) | 阿戈尔问题汇总（5 个子项） | **部分已修**：复活名额共享（§23.20）、吞噬跳过已击倒成员（§22.3）、联防断链计数（§23.2）都有了；剩「吞噬增益是否错误享受攻击倍率」「标记者死亡取消已付与吞噬」「流失来源归因」→ 按 #165 的子项逐条复核 |
| P1 | [#170](https://github.com/sganggs/Stronghold-Protocol/issues/170) | 忍冬开启三技能无法晕眩敌人 | 无条目（§23.29 只改了叙拉古 6 的掷骰范围） |
| P1 | [#171](https://github.com/sganggs/Stronghold-Protocol/issues/171) | 优等生神经损伤不生效 | 无条目 |
| P1 | [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) | 中途意外退出后无法重连入房间，并持续烧条 | 无条目；相关状态机在 `public/js/store.js`／`net.js`，建议按正文复现 |
| P1 | [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) | 网页版游戏文件未加载 | 无条目（#106 的素材分发是相邻问题） |
| P1 | [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) | 深靛（秘术师）充能与攻击冷却串联冲突 | 无条目 |
| P2 | [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) | AI 策略优化 | 无条目（AI 仍是 `server/match/bot.js` 的既有策略） |
| P2 | [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) | 重锤击晕泡泡后倒地/起身抽搐动画 | 无条目（§23.28 是「地面干员」判定） |
| P2 | [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) | AI 的干员抓取与策略选择 | 无条目 |
| P2 | [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) | 自己加的人变成「滚木」 | 无条目（自定义单位的数据/渲染校验） |
| P2 | [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) | 按键自定义；攻击特效缺失；待选区自动落位 | 只做了「商店条可折叠 + `C` 键」（§21.33，本地），这三项仍未做 |
| P2 | [#175](https://github.com/sganggs/Stronghold-Protocol/issues/175) | 华法琳特性叠层超过描述的 7 次 | 无条目 |
| P2 | [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) | 部分干员闭眼时眼球没被完全遮住 | 无条目（渲染表现） |
| P3 | [#38](https://github.com/sganggs/Stronghold-Protocol/issues/38) | 完整英文界面 | §22.5 只改了英文标题（Stronghold Protocol: Alliance），CHANGELOG 明确「#38 保持开放」 |
| P3 | [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) | 英文界面叠加层方案 | 无条目（关联 #38） |
| P3 | [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) | 一键重开按钮 | 无条目 |
| P3 | [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) | 数据持久化的取舍（讨论） | 无条目 |
| P3 | [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) | 服务端用 Hono 重构（讨论） | 无条目（本快照也没有 `worker/`、`deploy/`） |
| P3 | [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) | 房间内可拖动的悬浮文字聊天 | 无条目 |
| P3 | [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) | 休整期双击直接看队友场地 | 相邻能力已有（§23.36 观战跟随移动、#129 观战手牌），双击手势本身没做 |
| P3 | [#136](https://github.com/sganggs/Stronghold-Protocol/issues/136) | 原版 V/VI 干员自选 | 无条目 |
| P3 | [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) | 拖动干员身体也能拖；准备时可收起商店 | 商店折叠已做（§21.33 本地，`C` 键），拖动热区未做 |
| P3 | [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) | 联机指定后端 | 无条目 |
| P3 | [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) | 优化房间逻辑 | 无条目（0.1.3 加了观战席与房主踢人：§23.19／§23.12） |
| P3 | [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) | v2.0 架构设计方案（tracking） | 上游仍开着，属路线图 |
| P3 | [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) | 3D 棋盘卡顿的排查建议 | 无条目 |
| P3 | [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) | 自行切换干员成特勤干员 | 功能请求，无条目 |

#### 14.3 已澄清「不是 bug」、不需要改（2 条）

| Issue | 优先级 | 结论 |
|---|---|---|
| [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) | P1 | 标准模拟里灵巧在官方的本局禁用名单上；0.1.3 起盟约条会显示灰色「本局禁用」（§23.30）——不是故障 |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) | P3 | 维护者逐条实测：3% 是伪随机长期频率、层数只加伤害不加概率、谢拉格冻结按层数、四爷的狼不吃 6 叙隐匿是因隐匿只给叙拉古人——不是故障（其中叙拉古 6 的掷骰范围另由 §23.29 收紧） |

#### 14.4 小结（合并后）

| 状态 | 条数 | 明细 |
|---|---|---|
| 已修 / 已实现 | 20 | #41 #55 #76 #82 #86 #105 #123 #153 #169 #179 + 本轮 §15.1 的 #49 #100 #107 #108 #116 #124 #162 #171 #181 #173（#173 只修了「导出静默失败」，素材分发部分属文档/工具，见 §15.1） |
| 已澄清「不是 bug」/ 不可复现 | 4 | #92 #101 + 本轮改判的 #140（实测与官方一致）、#170（引擎侧不复现） |
| 仍需处理 | **25** | P0 0／P1 5（#96 #137 #165 #172 #173）／P2 6（#31 #121 #130 #143 #175 #177）／P3 14（#38 #57 #77 #84 #95 #125 #131 #136 #138 #141 #154 #156 #168 #182） |
| 合计 | 49 | 与第 2 节「开启」条目一致 |

> 本轮筛选口径与逐条证据见 **§15**：#96/#137 与 #165 是规则之争（等上游裁定 / 属 0.1.4），#172 需要浏览器 e2e，#130 需要举报人补数据，#143 属功能与渲染重构，#175 只差文案（需随数据重建），#173 剩余部分是分发与文档。

> 另外，第 5.2 节「确认仍未修」里只剩 **#49** 一条仍然成立（见 14.2 第一行）；#50、#51、#64、#9 已由 0.1.2/0.1.3 或本机复核改判（见 14.1 的第二张表）。


### 15. 本轮（2026-10-06）「较严重影响体验」的问题筛选与逐一修复

从 14.2 的 36 条里按「影响玩法正确性 / 玩家一定能感知」筛出 **17 条**（P0 1、P1 12、P2 4），逐条用真实数据实测（`test/helpers/battleHarness.js` + 真实 `data/*.json`，探针用完即删）；**10 条改了代码**（每条都有新回归测试，并记在 `docs/DESIGN.md` 的 §21.42–§21.51），**2 条改判**，**5 条维持原判**并写下原因。全量单元测试：**314 个文件 / 3731 项 / 0 失败**（`test/sim/perf.test.js`、`test/sim/robustness.test.js` 两条 CPU 基准需独占运行）。

#### 15.1 已修（10 条，取代 14.2 中对应行的判定）

| Issue | 现象 | 修复 | 回归测试 |
|---|---|---|---|
| [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) P0 | 史尔特尔禁疗死亡后吃不到不屈立即复活 | 报告的现象（200 层、原格空着）**不复现**：200/240 层 × 5 种子都是 8.03 s 余烬撤退后当场 `redeploy`。真正可复现的是**落点被占时这次 proc 被静默吃掉**——只实现了 PRTS「立刻重新部署」的前半句，没实现「令受益者**下次部署**的再部署时间和费用归零」；同场景下普通被击倒也一样，所以不是史尔特尔专属。新增 `u.freeRedeploy`：`Battle._checkRedeploys` 对置位单位零费用放回，`_deploy` 清位（§21.48） | `test/content/feedback3-indom-exits.test.js`（占格→掷中→存下、落点空出即刻免费回来） |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) P1 | 突袭被动系不随首敌前压 | 只把 `kind === 'passive'` 算就绪**没用**：`generic.js:150-154` 把「被动 + 有 duration」改判成 `duration + activateOnDeploy`，真实成员（缄默德克萨斯 S1–S3、宴 S2、斯卡蒂 S2、耀骑士临光 S2）全是这一形态。判定改为「生效中的被动（含 `activateOnDeploy`）也算技能就绪」，只动突袭（§21.42） | `test/sim/issue49-raid-passive.test.js`（两种形态各 2 例 + 真实干员 5 技能 × 早期前压） |
| [#162](https://github.com/sganggs/Stronghold-Protocol/issues/162) P1 | 缇缇特性叠层有误 | `garrison_125` 按「新进入」计数，而她的 S2 每 0.25 s 重复施加睡眠，4 个敌人永远卡在 4/24 层。改为**每次成功施加都计数**（冻结那条仍按「进入」，其文案就是「进入冻结时」），上限 24/48 生效（§21.44） | `test/content/garrisons_battle.test.js`（刷新也算一次、40 次刷新到上限） |
| [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) P1 | 深靛充能与攻击冷却串联 | 蓄力钟被 `atkCd <= 0 && !hadTarget` 闸住：冷却内开始的束缚零蓄力、无目标首颗要 2×interval。改为直接读引擎自己的闸门 `profile.canAttack`、与 `atkCd` 解耦；能接敌时清零进度（§21.46） | `test/sim/issue181-mystic-store.test.js`（无目标首颗 1×interval、束缚中照常蓄力、解控即开火） |
| [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) P1 | 引星棘刺一技能不满技力自动释放 | 本仓库约定 AUTO 技能由 kit 自己写 `trigger: 'SP_FULL'`（已有 6 处），这把 S1 漏了 → 落到数据的 `DEFAULT`（射程内有敌人才开）。补上该行（§21.47） | `test/content/kits_alt_t5.test.js`（空场、无敌人也释放，`rule === 'SP_FULL'`） |
| [#171](https://github.com/sganggs/Stronghold-Protocol/issues/171) P1 | 优等生神经损伤不生效 | **引擎侧完全生效**（爆发→3 层麻痹→各抵消一次普攻，服务端也发了 `['status', id, 'palsy', 1]`），缺的是客户端：`STATUS_ICON/STATUS_GUESS/STATUS_KEYS` 都没有 `palsy` → `statusIconKey` 返回 null → 图标被丢弃。补 `palsy`/`attract`/`reveal` 三个图标与兜底正则（§21.49） | `test/render/tiles.test.js`（把 sim 的整张状态表对账到客户端图标表——这正是原先缺失的检查） |
| [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) P1 | 商店升级资金异常；香槟炸弹范围错误 | **资金不是 bug**：单人标准模拟 = `mode_single_funny`，官方原价 1/1/5/8/10、每回合 −1 最低 0、升级后按新等级重置，与三张截图逐一吻合（`test/match/economy.test.js` 早已钉死）。**香槟炸弹已修**：放置范围从技能攻击范围（`1-1`，只有正前 1 格）改为自身十字 5 格，有敌人丢敌人格，且挂在攻击周期上——没敌人也会丢（§21.45） | `test/content/kits_t3.test.js`（首颗炸弹在无敌人时落下、落点属十字、阵亡格仍不放） |
| [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) P2 | 击晕后倒地/起身循环抽搐 | 找到机制：`syncBattle` 用**旧快照**插值的 sample 判「活着」→ `revive()`，同一帧稍后又用**新快照**的 `down` 把它按倒（`die()` 又把 `dying` 清零）→ 每个渲染帧复活/倒地一次（16 ms 帧 vs ~100 ms 快照 ≈ 六次）。改成 down 列表权威：新快照说倒地就不复活（§21.50） | `test/render/downelem.browser.test.js`（`RENDER_E2E=1`，倒地倒计时/再部署整段通过） |
| [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) P1 | 新硎攻击不消耗铁矛头 | **已复核为已修**：`kitBlades` 每次攻击消耗 1 枚并 `refresh:'stack'`，`maxStacks = cnt(4)` 封顶，实测伤害 1350→2430→3510→4590→5670 后不再涨（×4.2 封顶），死亡时未消耗的断刃生成矛头 | `test/content/enemies_bosses.test.js`（257/257） |
| [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) P1 | 网页版游戏文件未加载 / 导出失败 | **本树没有清单级缺陷**：5699 条 `/assets` 与 1481 条 local 路径 0 缺失、0 大小写错。根因是分发（`.gitignore` 不含素材 → 源码 ZIP/`clone` 未跑 `npm run setup` 就是零美术；`file://` 直接打开必然失败，全站根绝对路径）。**唯一代码缺陷是「导出失败静默」**，已改成拒绝下载时提示改用「复制」（§21.51） | `test/ui/loadout.e2e.test.js`（成功路径不变） |

#### 15.2 复核后改判（2 条，不需要修）

| Issue | 原判 | 复核结论 |
|---|---|---|
| [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) P1 | 瑕光绝技层数；阿戈尔吃人 | **不是 bug**（实测）：瑕光 S2 沉睡后 3 个被睡敌人**仍占阻挡数**（`blocking = 3`、`blockedBy` 未清），与维护者引用的官方备注一致；「绝技层数被助力 +2」是助力的定义（休整结束给每个已激活盟约 +2 层），而绝技的战斗效果只读场上精锐数、不读层数（`addon/battle.js:196-204`），所以是**显示误导**而非数值错误 |
| [#170](https://github.com/sganggs/Stronghold-Protocol/issues/170) P1 | 忍冬三技能攻击无法晕眩 | **引擎侧不复现**：技能期间每次攻击都上晕眩、时长恰为数据的 `attack@stun` 0.2，被阻挡与未被阻挡都成立，技能的 +1 攻击距离也生效，仓库自带用例通过。正文为空、`.scratch/comments/170.json` 为 `[]`（评论已删）→ 无法确证玩家所指；0.2 s 远短于敌人攻击间隔，也可能是观感。**未改**（顺带发现：带技能范围的 MANUAL 技能走 `DEFAULT` 还是 `SKILL_RANGE` 会决定「能否自动开到打得到敌人的那一刻」，属于策略裁定，另记） |

#### 15.3 维持原判、本轮未改（5 条，附原因）

| Issue | 为什么没改 |
|---|---|
| [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) / [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) P1 | 实测确认：`damage.js:513-517` 是唯一治疗闸门，`noHeal` 一刀切，所以红蒂/魔王缓回、调香师天赋、瑕光 S2 对绝食干员**全为 0**，同一效果对普通干员正常。引擎**已有**「生命回复速度」通道（`Battle.js` 的 `hpRegen`，绕过 noHeal 与治疗加成），把这 4 处 `battle.heal` 换成 `addBuff hpRegen` 即可修——但维护者两次否认这是 bug、PR #135 待裁定，且 #124 之外还有「引星棘刺 S1 该不该挡」的自相矛盾点，**故只记录证据不改代码**，等上游裁定 |
| [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) P1 | 子项 2/3/5 确认仍成立，但都是**规则之争**：§23.2 把「标记者离场后不再产生标记」写成有意实现（「PRTS 只描述目标侧」）；「吞噬增益应最终加算」在本树没有官方依据（引擎只有 直接加算 / 直接乘算 / 最终乘算 三桶，`atkFlat` 走的是第一桶），增删都是改规则；子项 5（流失来源归因）只影响结算归属、不影响玩法。子项 1（复活名额按位置 vs 按被击倒顺序）与上游 0.1.4 方案不同，属 0.1.4 范围，**均未改**，逐条证据见 §15.4 |
| [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) P2 | **无法确证**：战斗侧唯一能「删人」的地方是 `Battle.js:274` 对未知 chess 静默 `return null`（只写服务端日志），而 `normalizeChess` 永不返回 null → 只可能是「服务端数据源与浏览器自拉的数据不一致」。需要举报人的 chessId、改动文件清单与控制台报错才能定位 |
| [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) P2 | 「待选区自动落位」本树确实没做（进手牌只有显式 `stow()`），但属功能建议；「AOE 特效缺失」的判定只认 5 个子职业（`render/fx.js SPLASH_SUBS`），解放者/伏击客/炼金师不在内——**单纯加白名单会误伤**（玛恩纳普攻是单体），正确做法是按同一 `attackId` 的命中数聚合，属渲染重构，本轮未动 |
| [#175](https://github.com/sganggs/Stronghold-Protocol/issues/175) P2 | 确认存在：`data/garrisons.json` 文案写「至多7/14层」，而 `GRANTED_CAP_OVERRIDE` 按 PRTS 3/27 公告用 12/24（实测 30 次开技能叠到 12）。模拟侧按公告是对的，**缺的是文案同步**——本树没有 desc override 通道，只能随下一次数据重建一起改，故未改 |

#### 15.4 逐条实测证据（本轮探针，脚本已删）

- **#108**：真数据 `chess_char_5_07_a`，`indomShip {count:2, layers=200/240}`，5 种子 × 2 档：`deaths=[...:retreat@8.03]`、`alive=true deploySeq=2`（原格空着必复活）；把落点占用后：`mem.indomShip` 已写入、`redeploy() === false`、`respawnAt=78.0`（未清零）、`indomFreeDeploy=undefined`、落点空出后照常扣 16 DP——**与「不屈通用」的普通被击倒（reason `killed`）完全一致**。
- **#181**：深靛 (10,3) + 1e7 木桩 (10,6)，束缚 4 s：旧行为 `t=3.03 atkCd=0 stored=0 storeAcc=0`（束缚 2.76 s 零蓄力）、`t=4.27 即时平 A 且 1.23 s 进度作废`；无敌人时首颗 `6.07 = 2×interval`，对照「部署后从未有敌人」是 `3.07`。修复后束缚 3 s 内 `stored=1`、无敌人首颗 `1×interval`。
- **#171**：神经损伤 `neural@19.77` 爆发 → `palsy value=3`，深池伙友卫队攻击时间戳 `[0.1, 4.1, 8.1, 12.2, 16.2, 32.3]`（20.2/24.2/28.2 三次被吃掉）；客户端 `statusIconKey('palsy') === null`、`STATUS_KEYS` 无 `palsy`。
- **#162**：13.6 s 内 181 次睡眠施加、仅 5 次 `entered`，层数恒定 4/24。
- **#116**：`mode_single_funny` 升级价实测 `R1=1 → R2=0（L2 重置为 1）→ R3=0 → R4=0 → L3=5`，与官方表 `1,1,5,8,10` 及三张截图一致；香槟炸弹落点偏移实测旧行为只有 `(0,1)`、无敌人时 0 颗。
- **#107**：`enemy_1207_sfji_2` 十次命中 `1350 / 2430 / 3510 / 4590 / 5670 / … 5670`（4 层封顶）。
- **#170**：忍冬 S3 期间 `stuns=12`（每次攻击一次，`dur=0.2`），`rangeKeys=3`；只在技能 +1 距离内的敌人时 `cast=false`（DEFAULT 策略要初始射程内有敌人）。
- **#165**：吞噬探针 `base.atk 1000 → devour atkFlat 2000 → atkPct 1.00 → s.atk 6000`（最终加算读法应为 4000）；A→B→C 链中 B 被击倒后 C 只吃 1 次 5000（B 存活则 2 次）；流失事件 `source = 标记者`（官方应为目标自身）。
- **#96/#137**：红蒂 (atk 323.3) / 魔王吟游者 / 调香师对收割者与不屈者 3 s 内回血 0，同一效果对普通干员 +31/+256。闸门位置 `damage.js:513-517`。
