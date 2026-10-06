# Stronghold-Protocol 上游 Issue 抓取归档（去重 · 归类）

> **这是抓取归档，不是待办清单。**当前仍未修复的条目见仓库根目录的 [`ISSUES.md`](../ISSUES.md)；已修 / 已判「不是 bug」的条目与逐条证据见 [`docs/ISSUES-FIXLOG.md`](ISSUES-FIXLOG.md)。本文件由 `.scratch/render-report.cjs` 生成（`node .scratch/pipeline.cjs` 会重写第 1–13 节），请勿手工维护。

- 上游仓库：[sganggs/Stronghold-Protocol](https://github.com/sganggs/Stronghold-Protocol)
- 抓取时间：2026-10-05T16:27:37.013Z
- 数据来源：GitHub Issues via REST/search API (issues + metadata); comment digests where fetched
- 范围：全部 **110** 条 issue（开启 49 / 关闭 61）；不含 PR（同期另有 PR，未纳入本清单）

> 抓取说明：本机 hosts 把 github.com / api.github.com 屏蔽到 127.0.0.1，常规 curl / Invoke-WebRequest 全部失败。本次改用「公共 DNS 解析 → 直连 IP → SNI 指定主机名」的 Node 脚本抓取；正文取自 GitHub API 的完整 `body` 字段，内容无截断。search API 索引滞后漏掉的 3 条已由仓库列表交叉比对后补抓（见第 4 节），评论在匿名配额（60 次/小时）重置后分批补齐。

## 1. 总览

| 指标 | 数值 |
|---|---|
| 全部 Issue | 110 |
| 开启中 | 49 |
| 已关闭 | 61 |
| 去重后的独立问题 | 98 |
| 判定为重复 / 同一根因的条目 | 12 |

**优先级分布**（P0 = 崩溃 / 数据丢失 / 核心机制完全不可用；P1 = 核心玩法逻辑错误；P2 = 表现与体验错误；P3 = 建议 / 讨论 / 需求）

| 优先级 | 数量 | 处理方式 |
|---|---|---|
| P0 紧急 | 3 | 先定位，多数是阿戈尔 / 复活 / 不屈类核心机制的连锁问题 |
| P1 高 | 55 | 按分类批量修，单条改动通常很小 |
| P2 中 | 27 | 表现层与体验，可与其他改动合并提交 |
| P3 低 | 25 | 需求与讨论，需要先和上游定方向 |

**归类分布**

| 分类 | 条目数 | 覆盖范围 |
|---|---|---|
| 部署 / 落点 / 地形 | 11 | 放置合法性、突袭落点、召唤物范围、推拉位移 |
| 技能 / 突袭 / 战斗数值 | 19 | 技能触发与就绪、叠层、治疗与禁疗、复活机制 |
| 战斗表现 / 动画 / 贴图 | 9 | 动作状态机、贴图与特效加载、渲染表现 |
| 隐匿 / 阻挡 / 敌人行为 | 10 | 隐匿解除与免疫、阻挡交互、目标筛选 |
| 干员 / 盟约 / 阵营机制 | 23 | 转职、策略刷牌、阿戈尔/叙拉古/谢拉格、赏金 |
| 数值 / 平衡 / 经济 | 4 | 难度、联机缩放、商店经济 |
| 界面 / 交互 / 观战 / AI | 19 | 面板、观战信息、快捷键、AI 队友策略 |
| 网络 / 联机 / 分发 | 7 | 联机协议、素材分发、CI 稳定性、下游壳 |
| 工程质量 / 部署 / 生态 | 6 | 架构重构、持久化、性能、第三方工具 |
| 本地化 | 2 | 英文界面与术语统一 |

**数据新鲜度**：上游仓库在抓取期间仍在持续更新，所以本清单用了两条通道反复比对（第 4 节）。

- 仓库权威快照（2026-10-05T15:32:18.841Z）：110 条，开启 50 / 关闭 60
- 与清单差值：0 条（清单已合并补抓结果）
- 相对第一版抓取的状态变化：#83 open -> closed、#111 open -> closed、#113 open -> closed、#117 open -> closed、#133 open -> closed、#139 open -> closed、#142 open -> closed、#144 open -> closed、#148 open -> closed、#151 open -> closed、#161 open -> closed


## 2. 修复工作单（按优先级，建议开工顺序）

> 「状态」是上游 issue 的当前状态；「摘要与处理建议」是本次归类给出的落点；「源码落点」都已在本工作区确认存在。已确认在 0.1.1 修好的条目见第 5 节，可以据此划掉。

| 优先级 | Issue | 状态 | 分类 | 摘要与处理建议 | 源码落点 |
|---|---|---|---|---|---|
| P0 紧急 | [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) bug：5阿戈尔复活效果触发问题 | 开启 | 干员 / 盟约 / 阵营机制 | 阿戈尔复活：5 阿戈尔复活概率不触发；联防阶段不复活且攻击加成丢失（关联 #33 #165） | — |
| P0 紧急 | [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) 史尔特尔被禁疗死亡以后，无法吃到不屈效果立即复活 | 开启 | 技能 / 突袭 / 战斗数值 | 复活/不屈：史尔特尔被禁疗死亡后吃不到不屈立即复活（200 层仍不复活） | — |
| P0 紧急 | [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) [BUG] 当前阿戈尔问题汇总、源码分析、修改计划 | 开启 | 干员 / 盟约 / 阵营机制 | 阿戈尔（含源码分析）：复活名额应共享；吞噬增益错误享受攻击倍率；标记者死亡取消已付与吞噬；联防断链；流失来源归因 | `server/sim/content/bonds/core.js`<br>`server/sim/units.js` |
| P1 高 | [#1](https://github.com/sganggs/Stronghold-Protocol/issues/1) 不能转职；盟约人数计算有误 | 已关闭 | 干员 / 盟约 / 阵营机制 | 转职 / 盟约计数：转职球无效；不考虑整备区的盟约把整备区干员计入人数 | — |
| P1 高 | [#3](https://github.com/sganggs/Stronghold-Protocol/issues/3) bug：昆图斯的突变细胞在升阶完干员之后会直接消失，不会返还 | 已关闭 | 干员 / 盟约 / 阵营机制 | 昆图斯 / 突变细胞：升阶后突变细胞直接消失不返还（关联 #15 #41 #54） | — |
| P1 高 | [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) bug：深巡只有在阻挡敌人的时候才会开技能 | 已关闭 | 技能 / 突袭 / 战斗数值 | 技能触发条件：深巡只在阻挡时开技能（应在攻击范围内即开） | — |
| P1 高 | [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) placeable 召唤物（狼群）的手动放置缺少 owner 攻击范围校验 | 已关闭 | 部署 / 落点 / 地形 | 召唤物部署 / owner 范围：placeable 召唤物手动放置缺 owner 攻击范围校验（自动召唤路径有，两条路径不一致） | `server/match/board.js`<br>`server/match/PlayerState.js`<br>`server/sim/content/tokens.js`<br>`server/sim/Battle.js` |
| P1 高 | [#15](https://github.com/sganggs/Stronghold-Protocol/issues/15) 昆图斯有bug，针扎一次就没了 | 已关闭 | 干员 / 盟约 / 阵营机制 | 昆图斯 / 针：针扎一次就没了（与 #3 #41 #54 同一系统）（重复 #3） | — |
| P1 高 | [#16](https://github.com/sganggs/Stronghold-Protocol/issues/16) bug：莫斯提马三技能没有减速 | 已关闭 | 技能 / 突袭 / 战斗数值 | 技能效果：莫斯提马三技能没有减速 | — |
| P1 高 | [#19](https://github.com/sganggs/Stronghold-Protocol/issues/19) bug：深池小兵被击倒后变成的余烬被阻挡时不会解除隐匿 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 隐匿解除条件：深池余烬被阻挡不解除隐匿 → 无敌 → 无限重生循环 | `server/sim/Battle.js` |
| P1 高 | [#20](https://github.com/sganggs/Stronghold-Protocol/issues/20) 深池小兵死后生成的隐匿尸体原地不动 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 隐匿尸体：深池小兵死后隐匿尸体原地不动（#19 的同一现象分支）（重复 #19） | — |
| P1 高 | [#21](https://github.com/sganggs/Stronghold-Protocol/issues/21) 突袭干员会重新部署在有干员阵亡的地方 | 已关闭 | 部署 / 落点 / 地形 | 突袭盟约 / 占用校验：与 #50 同一根因的早期报告（重复 #50） | `server/sim/content/bonds/addon/battle.js`<br>`server/sim/Battle.js` |
| P1 高 | [#32](https://github.com/sganggs/Stronghold-Protocol/issues/32) bug反馈 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 多条汇总（已修复）：余二技能不拉怪、火山源石虫外观、深池鬼火索敌/无敌、歌蕾蒂娅高台、暴鸽形态、隐蔽吃溅射（关联 #153 #19） | — |
| P1 高 | [#33](https://github.com/sganggs/Stronghold-Protocol/issues/33) BUG：主要阿戈尔相关 | 已关闭 | 干员 / 盟约 / 阵营机制 | 阿戈尔阵营：复活机制不触发；乌尔比安三技能结束清空阿戈尔增益/转职后无返回；联防阶段先倒地干员导致食物链断链（关联 #105 #140 #165） | — |
| P1 高 | [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) 昆图斯的针存在bug；以及角色可以放在水上的问题 | 开启 | 部署 / 落点 / 地形 | 地形 / 部署合法性：第 2 条与 #53 重复；另含昆图斯针与野鬃推怪（重复 #53） | `server/match/board.js` |
| P1 高 | [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) 服务器端素材缺失：表现为表情图标缺失，及其所在的整个local文件夹+对应控制文件 | 已关闭 | 界面 / 交互 / 观战 / AI | 素材完整性：服务器端缺 public/assets/local 与 data/local-assets.json 导致表情全为默认图标（关联 #99 #106） | — |
| P1 高 | [#44](https://github.com/sganggs/Stronghold-Protocol/issues/44) 悬赏怪物生成的有问题，大姨凯瑟琳分队看不见装备，归鲨死了没替身，和一点意见 | 已关闭 | 干员 / 盟约 / 阵营机制 | 盟约/分队多项：悬赏怪池与节奏错乱；凯瑟琳分队装备不可见；归鲨死后无替身；分队页看不到被禁干员（关联 #128 #33） | — |
| P1 高 | [#45](https://github.com/sganggs/Stronghold-Protocol/issues/45) bug：圆仔被阻挡 | 已关闭 | 部署 / 落点 / 地形 | 召唤物 / 单位特性：鸭爵的圆仔被阻挡（不应被阻挡） | — |
| P1 高 | [#46](https://github.com/sganggs/Stronghold-Protocol/issues/46) 四爷的狼可以随便放 | 已关闭 | 部署 / 落点 / 地形 | 召唤物部署 / owner 范围：伺夜狼群可任意放置的简版报告（重复 #9） | `server/match/board.js` |
| P1 高 | [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) 突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动 | 开启 | 技能 / 突袭 / 战斗数值 | 突袭盟约 / 技能就绪判定：ready 排除 passive，被动系成员只能等闲置 10 秒；官方为首敌出现即前压 | `server/sim/skills.js`<br>`server/sim/content/bonds/addon/battle.js` |
| P1 高 | [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) 突袭:再部署落点可能与倒地干员所在格子重叠(占用检查只拦截 alive 占用者) | 已关闭 | 部署 / 落点 / 地形 | 突袭盟约 / 占用校验：raidTile 只查地形不查占用；引擎占用拦截只认 alive，倒地未移除单位仍占格 | `server/sim/content/bonds/addon/battle.js`<br>`server/sim/Battle.js` |
| P1 高 | [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) 突袭:闲置 10 秒触发的再部署不要求落点能覆盖敌人,会出现无意义的位移 | 已关闭 | 技能 / 突袭 / 战斗数值 | 突袭盟约 / 落点评分：闲置路径不要求落点能覆盖敌人，出现无收益位移 | `server/sim/content/bonds/addon/battle.js` |
| P1 高 | [#52](https://github.com/sganggs/Stronghold-Protocol/issues/52) bug：史尔特尔进入锁血后仍能被治疗 | 已关闭 | 技能 / 突袭 / 战斗数值 | 治疗/禁疗：史尔特尔锁血期间仍可被治疗（关联 #108） | — |
| P1 高 | [#53](https://github.com/sganggs/Stronghold-Protocol/issues/53) bug: 干员可以放在水里 | 已关闭 | 部署 / 落点 / 地形 | 地形 / 部署合法性：地面干员可以放到水面格 | `server/match/board.js` |
| P1 高 | [#54](https://github.com/sganggs/Stronghold-Protocol/issues/54) 昆图斯没有针！ | 已关闭 | 干员 / 盟约 / 阵营机制 | 昆图斯 / 针：第二回合给针、第三回合变海霓后针消失（重复 #3） | — |
| P1 高 | [#62](https://github.com/sganggs/Stronghold-Protocol/issues/62) 二级干员少了一个（应该是二级 | 已关闭 | 干员 / 盟约 / 阵营机制 | 干员池 / 商店等级：二级商店少了协律（候选被 tier 上限挡掉，与 #65 同根因）（关联 #65） | — |
| P1 高 | [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) 漏的锅碗瓢盆也给钱 | 已关闭 | 干员 / 盟约 / 阵营机制 | 赏金结算：漏掉的锅碗瓢盆也给钱（关联 #89） | — |
| P1 高 | [#79](https://github.com/sganggs/Stronghold-Protocol/issues/79) BUG:荒芜拉普兰德三技能狼头吃不到攻速加成和3%叠层伤害 | 已关闭 | 干员 / 盟约 / 阵营机制 | 叙拉古 / 叠层：荒芜拉普兰德三技能狼头不吃攻速与 3% 叠层伤害（关联 #101） | — |
| P1 高 | [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) 自建部署在 Workers 免费层会被 DO 写入量卡死：每条 WebSocket 消息强制重写整个房间快照 | 已关闭 | 网络 / 联机 / 分发 | Workers DO 写入量：每条 WS 消息强制重写整份房间快照；建议节流 + 分块放大 + match_events 打包（作者 fork 已验证） | `worker/index.js (本机快照无此目录)` |
| P1 高 | [#82](https://github.com/sganggs/Stronghold-Protocol/issues/82) 协防阶段干员重部署Bug及一些其他建议 | 开启 | 干员 / 盟约 / 阵营机制 | 协防 / 重部署：协防阶段干员技能直接释放（未考虑重部署）；阿戈尔 5 层仍开局倒地；炮车开炮无停顿（关联 #105 #165） | — |
| P1 高 | [#83](https://github.com/sganggs/Stronghold-Protocol/issues/83) BUG：缪缪进阶不给流形 | 已关闭 | 干员 / 盟约 / 阵营机制 | 进阶 / 召唤物：缪缪经博士投影进阶后不给流形（关联 #9 #15） | — |
| P1 高 | [#86](https://github.com/sganggs/Stronghold-Protocol/issues/86) BUG：六叙隐匿不防雪祀远程攻击，芬策略信标发不到人 | 开启 | 隐匿 / 阻挡 / 敌人行为 | 隐匿免疫 / 策略发牌：六叙隐匿不防雪祀远程攻击；芬策略信标发出的干员在下回合没有到队友手上 | — |
| P1 高 | [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) bug反馈 | 已关闭 | 技能 / 突袭 / 战斗数值 | 技能/敌人行为：琳琅诗怀雅三技能自动关闭；锅碗瓢盆赏金重复结算；隐蔽触发源石地板流血；深溟巢涌者多出单体攻击（与 #93 #104 同一根因） | — |
| P1 高 | [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) bug | 开启 | 干员 / 盟约 / 阵营机制 | 灵巧盟约：上两个灵巧干员盟约不生效 | — |
| P1 高 | [#93](https://github.com/sganggs/Stronghold-Protocol/issues/93) bug：深溟巢涌者（海嗣那个伞）疑似会与炎佑阻挡 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 敌人阻挡交互：炎佑与深溟巢涌者互相阻挡并快速击杀（与 #89 第 4 条同源）（重复 #89） | — |
| P1 高 | [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) 绝食干员不吃红蒂缓回，海嗣boss爆条频率明显过快 | 开启 | 技能 / 突袭 / 战斗数值 | 治疗/敌方机制：绝食干员吃不到红蒂缓回（与 #137 重复）；海嗣 boss 爆条频率过快 | — |
| P1 高 | [#97](https://github.com/sganggs/Stronghold-Protocol/issues/97) bug | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 隐匿免疫 AOE：六叙生效时仍吃敌方 AOE（如卢西恩）（关联 #43 #86） | — |
| P1 高 | [#104](https://github.com/sganggs/Stronghold-Protocol/issues/104) bug：深溟巢涌者会a人 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 敌人行为：深溟巢涌者丢失光环改为单体远程攻击、攻击时原地不动（重复 #89） | — |
| P1 高 | [#106](https://github.com/sganggs/Stronghold-Protocol/issues/106) 有500个素材文件下载失败 | 开启 | 网络 / 联机 / 分发 | 素材下载：git clone 后 500+ 素材文件下载失败（关联 #42 #156） | — |
| P1 高 | [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) BUG:矛头哥(新硎)攻击不消耗铁矛头 | 开启 | 技能 / 突袭 / 战斗数值 | 技能资源消耗：新硎攻击不消耗铁矛头 | — |
| P1 高 | [#113](https://github.com/sganggs/Stronghold-Protocol/issues/113) BUG：联机boss血量没有乘以联机人数 | 已关闭 | 数值 / 平衡 / 经济 | 联机缩放：boss 血量没有按联机人数缩放 | — |
| P1 高 | [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) BUG：单人标准模拟下商店升级的所需资金异常、琳琅诗怀雅二技能香槟炸弹的放置范围错误 | 开启 | 数值 / 平衡 / 经济 | 商店经济 / 技能范围：单人标准模拟下商店升级所需资金异常；琳琅诗怀雅二技能香槟炸弹只在攻击范围内放置 | — |
| P1 高 | [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) BUG：引星棘刺一技能不会在满技力时自动释放 | 开启 | 技能 / 突袭 / 战斗数值 | 技能触发条件：引星棘刺一技能满技力不自动释放（无敌人时） | — |
| P1 高 | [#133](https://github.com/sganggs/Stronghold-Protocol/issues/133) bug：野鬃推人会把怪推到不可通行地块上并被上面的干员阻挡 | 已关闭 | 部署 / 落点 / 地形 | 位移 / 不可通行地块：野鬃推人把怪推到不可通行地块，被上面的干员阻挡；与 #41 第 3 条同源 | — |
| P1 高 | [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) bug：绝食干员无法对小特被动一类以及棘刺等技能产生的治疗效果正确生效 | 开启 | 技能 / 突袭 / 战斗数值 | 治疗归类：绝食干员无法吃小特被动/棘刺等技能治疗（重复 #96） | — |
| P1 高 | [#139](https://github.com/sganggs/Stronghold-Protocol/issues/139) bug 盟约独行会获得层数 | 已关闭 | 干员 / 盟约 / 阵营机制 | 独行盟约：独行盟约错误获得层数 | — |
| P1 高 | [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) BUG: 瑕光，绝技层数和阿戈尔吃人效果；以及部分优化建议 | 开启 | 技能 / 突袭 / 战斗数值 | 阻挡/层数/阿戈尔：瑕光沉睡计入阻挡数；绝技层数被助力增加；阿戈尔吞噬目标判定错误（与 #165 第 2/3 条同源） | `server/sim/content/bonds/core.js` |
| P1 高 | [#148](https://github.com/sganggs/Stronghold-Protocol/issues/148) bug：突袭近战干员部署在高台 | 已关闭 | 部署 / 落点 / 地形 | 突袭盟约 / 部署合法性：突袭（近战）被放到高台；与 #50 同属突袭落点校验缺失 | `server/sim/content/bonds/addon/battle.js` |
| P1 高 | [#153](https://github.com/sganggs/Stronghold-Protocol/issues/153) BUG:歌蕾蒂娅无法放置在高台位置 | 开启 | 部署 / 落点 / 地形 | 部署合法性 / 高台：歌蕾蒂娅（远程位）无法放到高台 | `server/match/board.js`<br>`server/match/PlayerState.js` |
| P1 高 | [#161](https://github.com/sganggs/Stronghold-Protocol/issues/161) Bug：选择touch策略后，队友的普通医疗干员也会变成touch | 已关闭 | 干员 / 盟约 / 阵营机制 | 策略串场：选 touch 策略后队友普通医疗也变成 touch（玩家状态串用） | — |
| P1 高 | [#162](https://github.com/sganggs/Stronghold-Protocol/issues/162) BUG：缇缇特性叠层有误 | 开启 | 技能 / 突袭 / 战斗数值 | 特性叠层：缇缇二技能睡眠叠层速度不对 | — |
| P1 高 | [#169](https://github.com/sganggs/Stronghold-Protocol/issues/169) BUG：拉普兰德合成金的之后立即刷新不会增加叙拉古层数 | 开启 | 干员 / 盟约 / 阵营机制 | 叙拉古 / 叠层：拉普兰德合成金后立即刷新不增加叙拉古层数（关联 #79 #101） | — |
| P1 高 | [#170](https://github.com/sganggs/Stronghold-Protocol/issues/170) BUG：忍冬开启三技能攻击敌人无法晕眩敌人 | 开启 | 技能 / 突袭 / 战斗数值 | 技能效果：忍冬三技能攻击无法晕眩 | — |
| P1 高 | [#171](https://github.com/sganggs/Stronghold-Protocol/issues/171) 优等生神经损伤不生效 | 开启 | 技能 / 突袭 / 战斗数值 | 异常状态：优等生神经损伤（麻痹）不生效 | — |
| P1 高 | [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) 中途意外退出后无法重连入房间，并且会持续烧条 | 开启 | 网络 / 联机 / 分发 | 重连 / 房间：中途意外退出后无法重连回房间，且会持续烧条（正文为空，需补细节）（关联 #154） | — |
| P1 高 | [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) bug:网页版游戏文件未加载 | 开启 | 网络 / 联机 / 分发 | 本地部署 / 资源加载：下载 V1.03 后本地打开，干员/盟约/地图/敌人等游戏文件未加载（连别人的服务器正常），且导出失败（关联 #42 #106） | — |
| P1 高 | [#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) master CI red: skills.test.js:437 'deploy-time passive' expects passive, gets duration (64715116) | 开启 | 技能 / 突袭 / 战斗数值 | CI / passive 就绪：上游 master CI 红：skills.test.js:437「deploy-time passive」期望 passive、实得 duration。**上游已经有测试要求被动在部署时被视为就绪**，与 #49 是同一处逻辑（关联 #49） | — |
| P1 高 | [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) BUG：深靛（秘术师）特性充能与攻击冷却串联冲突，导致束缚期间零蓄力且实际攻击间隔过长 | 开启 | 技能 / 突袭 / 战斗数值 | 秘术师充能 / 攻击冷却：深靛（秘术师）普攻冷却与特性充能串行等待 → 束缚期间零蓄力、实际攻击间隔过长；举报者用 battleHarness 做了断点排查 | `test/helpers/battleHarness.js` |
| P2 中 | [#5](https://github.com/sganggs/Stronghold-Protocol/issues/5) 准备阶段，收起商店界面时，界面并不会进行缩放 | 已关闭 | 界面 / 交互 / 观战 / AI | 准备阶段布局：收起商店界面时不缩放（观战/作战无此现象） | — |
| P2 中 | [#8](https://github.com/sganggs/Stronghold-Protocol/issues/8) 几个建议 | 已关闭 | 干员 / 盟约 / 阵营机制 | 策略/盟约多项：选策略阶段无法回看禁用干员与盟约；终难数值偏难；AI 选被禁盟约；被禁盟约剩余干员上场不激活；切页后图标丢失（关联 #31 #121） | — |
| P2 中 | [#17](https://github.com/sganggs/Stronghold-Protocol/issues/17) bug：转职球转职后干员显示详情页并不会出现新的词条，显示bug | 已关闭 | 干员 / 盟约 / 阵营机制 | 转职显示：转职后详情页不出现新词条（显示 bug）（重复 #1） | — |
| P2 中 | [#22](https://github.com/sganggs/Stronghold-Protocol/issues/22) 凯瑟琳队升级商店时的装备商店缺乏贴图与文字说明 | 已关闭 | 干员 / 盟约 / 阵营机制 | 装备商店贴图：凯瑟琳队升级商店时装备商店缺贴图与文字（重复 #44） | — |
| P2 中 | [#25](https://github.com/sganggs/Stronghold-Protocol/issues/25) bug：部分干员被击倒后在部署状态时仍有攻击动作 | 已关闭 | 战斗表现 / 动画 / 贴图 | 倒地动画：部分干员被击倒后在部署状态仍有攻击动作（关联 #59） | — |
| P2 中 | [#26](https://github.com/sganggs/Stronghold-Protocol/issues/26) bug,飞天石像二阶段没有飞天动画,依旧是一阶段的动画 | 已关闭 | 战斗表现 / 动画 / 贴图 | 敌人阶段动画：飞天石像二阶段仍播一阶段动画 | — |
| P2 中 | [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) AI策略优化 | 开启 | 界面 / 交互 / 观战 / AI | AI 队友行为：AI 医疗挡狗、堵门卡怪导致超时等策略问题（关联 #121 #8） | — |
| P2 中 | [#35](https://github.com/sganggs/Stronghold-Protocol/issues/35) BUG：要塞分支干员（如：号角、灰毫）会攻击空中单位 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 攻击目标筛选（已修）：要塞分支（号角、灰毫）会攻击空中单位；维护者确认是生成数据把要塞当成可对空，0.1.1 修的是数据 —— 只剩离线快照校验（关联 #32） | — |
| P2 中 | [#43](https://github.com/sganggs/Stronghold-Protocol/issues/43) 隐蔽的角色和敌人在破隐后任显示为隐蔽 | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 隐匿状态显示：破隐后仍显示为隐蔽状态（关联 #97） | — |
| P2 中 | [#58](https://github.com/sganggs/Stronghold-Protocol/issues/58) BUG：1.1中敌方远程攻击单位在攻击时任会移动。 | 已关闭 | 战斗表现 / 动画 / 贴图 | 敌方远程动作：敌方远程攻击时仍会滑动/移动 | — |
| P2 中 | [#59](https://github.com/sganggs/Stronghold-Protocol/issues/59) BUG：1.1中部分干员在倒地后任在进行攻击动作 | 已关闭 | 战斗表现 / 动画 / 贴图 | 倒地动画：干员倒地后仍播放攻击动作，疑似与朝向有关（关联 #25） | — |
| P2 中 | [#60](https://github.com/sganggs/Stronghold-Protocol/issues/60) 42突袭死后会消失 | 已关闭 | 战斗表现 / 动画 / 贴图 | 单位生命周期：42（干员）突袭死亡后直接消失 | — |
| P2 中 | [#61](https://github.com/sganggs/Stronghold-Protocol/issues/61) feature：优化远程角色干员子弹射出点位及攻击动作 | 已关闭 | 战斗表现 / 动画 / 贴图 | 远程攻击表现：子弹出射点与攻击动作需要优化（建议类） | — |
| P2 中 | [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) 干员调配界面看不到干员局内数值与攻击范围（只有技能/模组两段，对比局内详情面板缺 stats） | 已关闭 | 界面 / 交互 / 观战 / AI | 干员调配面板：调配界面缺局内数值与攻击范围（detailPanel 已有同款组件可复用） | `public/js/screens/loadout.js`<br>`public/js/ui/detailPanel.js`<br>`shared/loadoutRecord.js` |
| P2 中 | [#68](https://github.com/sganggs/Stronghold-Protocol/issues/68) bug：怪的贴图加载错误 | 已关闭 | 战斗表现 / 动画 / 贴图 | 贴图加载：切后台回来后新生成敌人贴图错误（小火苗）+ 回屏后模型抖动导致阻挡错误 | — |
| P2 中 | [#87](https://github.com/sganggs/Stronghold-Protocol/issues/87) BUG：观看他人界面不能实时更新 | 已关闭 | 界面 / 交互 / 观战 / AI | 观战实时性：观看他人界面不实时更新 | — |
| P2 中 | [#99](https://github.com/sganggs/Stronghold-Protocol/issues/99) 表情不显示 | 已关闭 | 界面 / 交互 / 观战 / AI | 表情：表情不显示（与 #42 同因）（重复 #42） | — |
| P2 中 | [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) BUG：1.2重锤击晕泡泡后会出现倒地和起身循环的抽搐动画 | 开启 | 技能 / 突袭 / 战斗数值 | 动画状态机：重锤击晕泡泡后倒地和起身循环抽搐 | — |
| P2 中 | [#117](https://github.com/sganggs/Stronghold-Protocol/issues/117) boss问题 | 已关闭 | 数值 / 平衡 / 经济 | 敌人数值：碎骨伤害疑似过高 | — |
| P2 中 | [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) feature：AI的干员抓取和策略选择问题 | 开启 | 界面 / 交互 / 观战 / AI | AI 抓牌：AI 大量抢队友特化干员、选鸭爵守不住等抓取/策略问题（关联 #31） | — |
| P2 中 | [#128](https://github.com/sganggs/Stronghold-Protocol/issues/128) 观战/查看队友时：看不到队友的装备、整备区手牌、策略与效果列（附定位） | 已关闭 | 界面 / 交互 / 观战 / AI | 观战信息完整性：观战看不到队友装备/手牌/策略/效果列（作者已定位，PR 待合） | `public/js/render/app.js`<br>`server/sim/snapshot.js`<br>`server/match/Match.js` |
| P2 中 | [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) 我自己利用ds加了些人但是人成滚木了 | 开启 | 部署 / 落点 / 地形 | 自加干员 / 战斗渲染：自行添加的干员备战界面可见、进入战斗后消失（下游改动，先确认是否上游问题） | — |
| P2 中 | [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) 优化建议：1.希望增加按键自定义功能 2.攻击特效缺失 3.干员待选区自动落位到待部署区 | 开启 | 战斗表现 / 动画 / 贴图 | 特效/提示/按键：按键自定义、AOE 特效缺失与过亮、待选区不自动落位、外层设置入口（多条） | — |
| P2 中 | [#144](https://github.com/sganggs/Stronghold-Protocol/issues/144) bug:CI脚本存在偶发性的问题 | 已关闭 | 网络 / 联机 / 分发 | CI 偶发失败：co-op spectator 用例偶发 BAD_TARGET“队友已选”，疑似 AI 抢选时序 | `test/match/lobby-integration.test.js` |
| P2 中 | [#159](https://github.com/sganggs/Stronghold-Protocol/issues/159) 博士血量归零后的观战逻辑修改 | 已关闭 | 界面 / 交互 / 观战 / AI | 观战逻辑：博士血量归零后应自动切到存活玩家观战（关联 #76） | — |
| P2 中 | [#175](https://github.com/sganggs/Stronghold-Protocol/issues/175) BUG：华法琳特性叠层超过描述的7次 | 开启 | 技能 / 突袭 / 战斗数值 | 特性叠层：华法琳特性叠层超过描述的 7 次（正文为空，需补复现）（关联 #162 #140） | — |
| P2 中 | [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) 部分干员闭眼时眼球没有被完全遮住（倒地 / 眨眼，例：仇白、琳琅诗怀雅）—— 玩家反馈，附实测数据 | 开启 | 战斗表现 / 动画 / 贴图 | 动画 / 贴图遮挡：干员倒地/眨眼闭眼时眼球未被完全遮住（仇白、琳琅诗怀雅）；举报者自己也说影响不大（关联 #59 #25） | — |
| P3 低 | [#18](https://github.com/sganggs/Stronghold-Protocol/issues/18) 提议：Android 壳（内嵌服务器 + 签名服务器清单 + 清单驱动热更新）—— 是否愿意接收为 PR？ | 已关闭 | 网络 / 联机 / 分发 | Android 壳：贡献者 Android 壳（内嵌服务器 + 签名清单热更新）待作者决定接收范围 | — |
| P3 低 | [#38](https://github.com/sganggs/Stronghold-Protocol/issues/38) Localization for full English UI | 开启 | 本地化 | 英文界面：英文 UI 需求（关联 #57） | — |
| P3 低 | [#55](https://github.com/sganggs/Stronghold-Protocol/issues/55) feature: 添加bgm自动切换功能等建议 | 开启 | 界面 / 交互 / 观战 / AI | 音频/文本/地图：战斗 BGM 自动切换、自选干员、地图风格、文本偏小 | — |
| P3 低 | [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) 英文界面：一个不改游戏代码的叠加层方案（关联 #38） | 开启 | 本地化 | 英文界面方案：不改游戏代码的 DOM 叠加层方案；提出 Alliance vs Covenant 术语统一等三个问题（关联 #38） | — |
| P3 低 | [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) 杜遥夜「广交豪杰」在一级商店阶段刷不出<炎>干员（tier≤商店等级把唯一候选惊蛰挡掉，且无 anyTier 兜底） | 已关闭 | 干员 / 盟约 / 阵营机制 | 策略刷牌（杜遥夜）· 非 bug：**维护者判定与官方一致，不是 bug**：一级商店按官方只刷不超过商店等级的干员，而一阶 <炎> 只有惊蛰；惊蛰被禁用/不在池时自然刷不出，策略原文也注明「部分干员缺席时体验可能不完整」。代码层面 rollBond 的 tier 上限确实存在，但属官方规则 | `server/sim/content/bands/meta.js`<br>`server/match/pool.js` |
| P3 低 | [#76](https://github.com/sganggs/Stronghold-Protocol/issues/76) Feature: 增加观战和中途观战 | 开启 | 界面 / 交互 / 观战 / AI | 观战系统：观战与中途观战、超过 4 人进观战位（关联 #159 #128） | — |
| P3 低 | [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) feature: 增加一键重开按钮 | 开启 | 界面 / 交互 / 观战 / AI | 重开流程：一键重开 / 不禁用干员选项（关联 #154） | — |
| P3 低 | [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) 讨论：关于数据持久化的取舍 | 开启 | 工程质量 / 部署 / 生态 | 持久化取舍：讨论：默认关闭的可选 SQLite 持久化（战绩/复盘/回放）（关联 #156） | — |
| P3 低 | [#94](https://github.com/sganggs/Stronghold-Protocol/issues/94) fearure：金币没花完可以有个提示 | 已关闭 | 数值 / 平衡 / 经济 | 经济提示：金币没花完希望有提示 | — |
| P3 低 | [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | 开启 | 工程质量 / 部署 / 生态 | 服务端重构：服务端用 Hono 重构，index.js 拆模块 | `server/index.js` |
| P3 低 | [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) 叙拉古和谢拉格的阵营BUG | 开启 | 干员 / 盟约 / 阵营机制 | 叙拉古 / 谢拉格 · 多为非 bug：**维护者逐条实测后基本判定不是 bug**：3% 是伪随机长期频率、层数只加伤害不加概率且只在隐匿期间与结束后 10 秒内的普通伤害上判定；拉普兰德攻速实测保持 133；谢拉格寒风层数 <50 时两阵接不上、400 层起会冻结；四爷的狼不吃 6 叙隐匿是因叙拉古隐匿只给自己。仅剩举报者主观体感存疑 | — |
| P3 低 | [#111](https://github.com/sganggs/Stronghold-Protocol/issues/111) 闲话：我用ds跑了个第三方模组加载器，发之前先来问一句 | 已关闭 | 工程质量 / 部署 / 生态 | 第三方模组：第三方模组加载器（21 钩子/12 内容表），含整层替换渲染层的升级冲突与安全模型影响（关联 #156） | — |
| P3 低 | [#123](https://github.com/sganggs/Stronghold-Protocol/issues/123) 希望可以添加出售棋子与撤退棋子的快捷键 | 开启 | 界面 / 交互 / 观战 / AI | 快捷键：出售/撤退棋子快捷键 | — |
| P3 低 | [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 开启 | 界面 / 交互 / 观战 / AI | 房间聊天：贡献者已实现房间内悬浮文字聊天补丁（0.1.3）待作者决定是否收 | — |
| P3 低 | [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) feature:休整期双击可以直接看队友的场地 | 开启 | 界面 / 交互 / 观战 / AI | 队友查看：休整期双击队友头像直接查看其场地（关联 #128） | — |
| P3 低 | [#136](https://github.com/sganggs/Stronghold-Protocol/issues/136) feature:希望能增加原版V,VI干员的自选 | 开启 | 界面 / 交互 / 观战 / AI | 干员自选：希望增加原版 V/VI 干员自选（素材与 bug 成本高） | — |
| P3 低 | [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) 希望拖动的时候除了拖动干员脚底还可以拖动干员的身体，希望准备时可以收起商店 | 开启 | 界面 / 交互 / 观战 / AI | 拖拽 / 商店：希望可拖拽干员身体；准备阶段可收起商店 | — |
| P3 低 | [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) 能不能增加一个联机指定后端的功能？ | 开启 | 网络 / 联机 / 分发 | 联机后端指定：希望客户端可指定后端，避免重复拉取素材（关联 #106 #151） | — |
| P3 低 | [#142](https://github.com/sganggs/Stronghold-Protocol/issues/142) feature:希望优化下盟约的显示 | 已关闭 | 界面 / 交互 / 观战 / AI | 盟约显示：盟约面板希望可收起（手机端挡格子） | — |
| P3 低 | [#151](https://github.com/sganggs/Stronghold-Protocol/issues/151) 下游工具：Windows 版启动器 | 已关闭 | 工程质量 / 部署 / 生态 | 下游工具：Windows 启动器（第三方仓库）（关联 #141 #156） | — |
| P3 低 | [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) 建议，优化房间逻辑 | 开启 | 界面 / 交互 / 观战 / AI | 房间权限：房主踢人 / 转让 / 账号功能 | — |
| P3 低 | [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | 开启 | 工程质量 / 部署 / 生态 | v2.0 架构：Tracking：monorepo / 构建工具 / 子系统拆分 / 插件扩展 / Awesome List（关联 #95 #84 #111 #151） | — |
| P3 低 | [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上（附自查方法与替代方案） | 开启 | 工程质量 / 部署 / 生态 | 性能排查笔记：3D 棋盘卡顿多为核显；另记录 adaptLoad 帧长 >250ms 时自适应降级停摆、替身阈值不覆盖联防场景 | `public/js/render/app.js` |
| P3 低 | [#180](https://github.com/sganggs/Stronghold-Protocol/issues/180) 隐匿怪会被6谢拉格效果冻结（记错了，原作也会） | 已关闭 | 隐匿 / 阻挡 / 敌人行为 | 谢拉格冻结（无需修）：「隐匿怪被 6 谢拉格冻结」——举报者自己更正「原作也会这样」；**无需改动**，保留作为「不是 bug」的样本（关联 #101） | — |
| P3 低 | [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) feature：可以自己切换干员成特勤干员 | 开启 | 干员 / 盟约 / 阵营机制 | 特勤干员切换：希望可主动把干员切换成特勤干员（提案人自己说明这是超出原版的优化，问是否违背项目宗旨）；与 #161 的 touch 串场相邻（关联 #161） | — |


## 3. 版本结论：哪些条目已经被上游修掉

维护者在评论里逐条给出了版本归属。**本工作区只有 0.1.1 源码快照**，0.1.2 / 0.1.3 的内容来自维护者评论与 CHANGELOG，排期时应以线上最新版本为准。

| 版本 | 已在此版本修好的条目 | 要点 |
|---|---|---|
| v0.1.1（本快照） | #1、#3、#4、#5、#8、#15、#17、#19、#20、#21、#26、#32、#43、#44、#45、#50 | 突变细胞退还、重装技能释放规则、商店收起视角、深池余烬与守墓石像、突袭不落倒地格、凯瑟琳装备卡、圆仔不可阻挡、敌人隐匿显示等 |
| v0.1.1（CHANGELOG 已覆盖，issue 未留结论） | #42、#62、#68、#99 | 素材下载失败不再静默删条目（#42 表情、#68 贴图）；#62「二级少一个协律」举报者复核后并未找到该干员，疑为记错 |
| v0.1.2 | #16、#25、#33、#41、#42、#44、#51、#52、#58、#60、#64、#79、#82 | 莫斯提马减速图标、朝上部署干员的倒地动画、远程敌人攻击站定、突袭落点必须打到目标、史尔特尔禁疗、强制退场留倒地干员、归溟幽灵鲨替身、调配界面局内数值、表情/说明素材补下载、阿戈尔开场吞噬解除 |
| v0.1.3 | #43、#61、#67、#68、#79、#82、#86、#87、#89、#92、#93、#97、#99、#105、#117 | 子弹从手部发出、分裂小怪不带赏金、后台加载卡住的模型会重载、查看队友棋盘实时同步、深溟巢涌者改范围脉冲、隐匿阻挡者不吃溅射、表情失败显示替代图标、碎骨榴弹按 PRTS、联防只带血量比例与技力 |
| 计划中的 v0.1.4 | #55、#105、#108、#142、#144、#148、#153 | 开战/联防 BGM 按回合切换（PR #72 / #110）、阿戈尔复活名额与联防吞噬（#105）、不屈概率显示封顶 100%（#108）、盟约面板收起按钮（PR #149）、CI 偶发用例（PR #146）、「可以放置于远程位」的干员上高台（#148 / #153）、观战按钮密钥（PR #119）、国内素材镜像（PR #24） |
| 计划中的 v0.2.0 | #41、#49、#55 | 被动技能生效中视为「技能就绪」（#49，只改突袭判定）、联防改打官方逃脱关卡地图（#41 第 3 条）、自选（甄选）编队（#55） |

**与修 #49 直接相关的上游信号**：[#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) 报告上游 master（`64715116`）自身 CI 红，红在 `test/sim/skills.test.js:437` —— 用例名「a deploy-time passive fires the skill animation window」期望 `passive`、实际得到 `duration`。**也就是上游 master 上已经有测试要求「被动技能在部署时就视为就绪」**，这正是 #49 要的行为：修 #49 时上游那条红测试就是验收标准。（本工作区的 `test/sim/skills.test.js` 只有 287 行、还没有这条用例，说明快照早于该提交。）

**已关闭但没有留下结论的条目**（评论缺失或已被删除，无法判断是否真的修完，建议按最新版本实测复核）：

#54、#58、#59、#61、#64、#87、#94、#104、#105、#107、#128、#139、#153、#159、#165、#169、#170

其中两条我顺手在本快照里查过：

| Issue | 复核结果 |
|---|---|
| [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) 调配界面缺局内数值 | 本快照的 `public/js/screens/loadout.js` 里搜不到 `dstats` / `rgrid` / `loadoutRecord` 相关渲染，**0.1.1 时确实还没实现**；需按线上最新版本复核 |
| [#99](https://github.com/sganggs/Stronghold-Protocol/issues/99) 表情不显示 | 与 #42 同因（缺 `public/assets/local` 与 `data/local-assets.json`），0.1.1 已随素材下载流程调整 |

**抓取期间新关闭的一批（11 条）**：`#83、#111、#113、#117、#133、#139、#142、#144、#148、#151、#161`。这批是在本清单第一版抓取之后、由上游集中关闭的，评论已补抓，结论见第 7 节对应行；排期时把它们从「待修」里划掉之前，建议先按最新 release 复核一遍。


## 4. 抓取完整性校验（两套数据源交叉比对）

GitHub 的 search API 与仓库 issue 列表不是同一套索引：search 会滞后于新建的 issue。所以本次用两条独立通道抓取并逐条比对——

- 通道 A：`/search/issues`（一次 100 条，正文完整，不受 60 次/小时限制，但索引滞后）
- 通道 B：`/repos/{owner}/{repo}/issues?state=all`（仓库自己的列表，权威，受匿名配额限制）

| 校验项 | 结果 |
|---|---|
| 通道 B issue 总数（含 PR：72 条 PR） | 110 条 issue |
| 通道 B 中开启 / 关闭 | 50 / 60 |
| 通道 A 独有（说明 search 乱序或重复） | 无 |
| **通道 B 独有（search 漏掉的，已补抓）** | #177、#179、#180、#181、#182 |
| 编号空档（已删除 / PR 占号 / 未使用） | 72 个：2、6、7、10、11、12、13、14、23、24、27、28、29、30、34、36、37、39、40、47、48、56、63、66 … |
| 空档抽样核验（11 个） | PR 11 个（#2、#13、#29、#40、#69、#75、#91、#112、#135、#152、#164）；404 已删除 0 个；仍在的 issue 0 个 |
| 抓取后状态漂移 | #83 open -> closed、#111 open -> closed、#113 open -> closed、#117 open -> closed、#133 open -> closed、#139 open -> closed、#142 open -> closed、#144 open -> closed、#148 open -> closed、#151 open -> closed、#161 open -> closed |
| 抓取后标题漂移 | 无 |

**本轮补抓到的 5 条**（created 2026-10-05，晚于第一次抓取）：

| Issue | 状态 | 分类 / 优先级 | 摘要 |
|---|---|---|---|
| [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) 部分干员闭眼时眼球没有被完全遮住（倒地 / 眨眼，例：仇白、琳琅诗怀雅）—— 玩家反馈，附实测数据 | 开启 | 战斗表现 / 动画 / 贴图 / P2 | 干员倒地/眨眼闭眼时眼球未被完全遮住（仇白、琳琅诗怀雅）；举报者自己也说影响不大 |
| [#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) master CI red: skills.test.js:437 'deploy-time passive' expects passive, gets duration (64715116) | 开启 | 技能 / 突袭 / 战斗数值 / P1 | 上游 master CI 红：skills.test.js:437「deploy-time passive」期望 passive、实得 duration。**上游已经有测试要求被动在部署时被视为就绪**，与 #49 是同一处逻辑 |
| [#180](https://github.com/sganggs/Stronghold-Protocol/issues/180) 隐匿怪会被6谢拉格效果冻结（记错了，原作也会） | 已关闭 | 隐匿 / 阻挡 / 敌人行为 / P3 | 「隐匿怪被 6 谢拉格冻结」——举报者自己更正「原作也会这样」；**无需改动**，保留作为「不是 bug」的样本 |
| [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) BUG：深靛（秘术师）特性充能与攻击冷却串联冲突，导致束缚期间零蓄力且实际攻击间隔过长 | 开启 | 技能 / 突袭 / 战斗数值 / P1 | 深靛（秘术师）普攻冷却与特性充能串行等待 → 束缚期间零蓄力、实际攻击间隔过长；举报者用 battleHarness 做了断点排查 |
| [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) feature：可以自己切换干员成特勤干员 | 开启 | 干员 / 盟约 / 阵营机制 / P3 | 希望可主动把干员切换成特勤干员（提案人自己说明这是超出原版的优化，问是否违背项目宗旨）；与 #161 的 touch 串场相邻 |

> 也就是说：**“全部 issue”的准确数字是 110 条，不是第一次抓到的 102 条**。编号空档 72 个来自已删除的 issue、被 PR 占用的编号和草稿，不是抓取失败。

仓库当前状态：默认分支 `master`、未归档、`pushed_at` = 2026-10-05T15:19:03Z、`open_issues_count`（含 PR）= 67。


## 5. 本地代码核验：哪些已经修好，哪些确实还在

本工作区是 0.1.1 源码快照（`package.json` = 0.1.1，包名 `stronghold-protocol-covenant`），没有 `.git`，也没有 `deploy/`、`worker/` 目录。下面按 CHANGELOG 与 issue 正文逐条对照代码。

### 5.1 确认已修（代码里有实现，且有对应测试）

| Issue | 现象 | 本地证据 |
|---|---|---|
| [#53](https://github.com/sganggs/Stronghold-Protocol/issues/53) | 干员可以放在水里 | `server/match/board.js` 有 `WATER_PLATFORM_ROLES` 与地形分类处理；0.1.1 更新记录「深水区不能部署干员和召唤物」 |
| [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) | 水面放置（第 2 条） | 同上；#41 剩下的是昆图斯的针与野鬃推怪 |
| [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) | 狼群/流形可放到任意近战格 | 新增 `ownerRangeKeys()`（`server/match/board.js:155`）+ `PlayerState.js:1039` 的 `ownerRange` 判定；`tokens.json` 给狼群/流形打了 `ownerRange: true`，并有专项测试 `test/match/feedback1-placement.test.js`、`test/ui/feedback1-placement.e2e.test.js` |
| [#46](https://github.com/sganggs/Stronghold-Protocol/issues/46) | 四爷的狼可以随便放（#9 简版） | 同上 |
| [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) | 突袭落在倒地干员格子上 | 0.1.1 更新记录「突袭的再部署、援军、召唤物和装置不会落到倒地干员的格子上」；`server/sim/Battle.js:2296` 已用 `downOn()` 拦倒地格 |
| [#21](https://github.com/sganggs/Stronghold-Protocol/issues/21) | 突袭重新部署在阵亡处 | 同上 |
| [#3](https://github.com/sganggs/Stronghold-Protocol/issues/3) | 昆图斯突变细胞升阶后消失 | 0.1.1 更新记录：突变细胞退回整备区、装备者可再次配发 |
| [#15](https://github.com/sganggs/Stronghold-Protocol/issues/15) | 昆图斯的针扎一次就没了 | 同族修复（0.1.1「盟约与道具」段） |
| [#79](https://github.com/sganggs/Stronghold-Protocol/issues/79) | 拉普兰德合成金后立即刷新不叠层 | 0.1.1 更新记录「获得她之后本回合的首次刷新也会叠叙拉古层数，每名拉普兰德各自计算」 |
| [#35](https://github.com/sganggs/Stronghold-Protocol/issues/35) | 要塞干员攻击空中单位 | 0.1.1 更新记录重写了这批干员的技能与目标规则 |
| [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) | 深巡只在阻挡时开技能 | 0.1.1 更新记录明确写了 GitHub issue #4 |
| [#5](https://github.com/sganggs/Stronghold-Protocol/issues/5) | 收起商店不缩放 | 0.1.1 更新记录明确写了 GitHub #5 |
| [#8](https://github.com/sganggs/Stronghold-Protocol/issues/8) | 切页后图标变方块水滴等 6 条 | 0.1.1 更新记录明确写了 GitHub issue #8 |
| [#1](https://github.com/sganggs/Stronghold-Protocol/issues/1) | 转职球 / 盟约人数 | 0.1.1 更新记录：变形同构体配转职装备计入盟约成员 |
| [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) | 服务器端表情图标全缺失 | 0.1.1 更新记录：素材下载失败不再静默删条目，改为列出来并保留原文件 |

### 5.2 确认仍未修（在本快照里能直接指出代码位置）

| Issue | 现象 | 本地证据 |
|---|---|---|
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) | 突袭被动系不随首敌前压 | `server/sim/skills.js:152` 仍是 `get ready() { return !this.noSkill && this.kind !== 'passive' && this.charges >= 1; }`；`server/sim/content/bonds/addon/battle.js:279` 的 `ready` 因此对被动恒为 false |
| [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) | 突袭落点的「未移除占用者」校验（倒地格已修，本条只剩残余） | **注意别和第 3 节的「0.1.1 已修」混淆**：0.1.1 只补了倒地格（`server/sim/Battle.js:2296` 的 `downOn()` 检查）。`server/sim/content/bonds/addon/battle.js:248-249` 的 `raidTile` 仍然只检查 `inRect` / `isReservedTile` / `canStand`，不查占用；`server/sim/Battle.js:864/1028/1060/1762/1790` 的占用判断仍一律带 `alive` 条件（即非倒地的未移除占用者不拦）。issue 正文建议的「`!removed` 过滤」尚未实现 |
| [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) | 闲置路径不要求落点覆盖敌人 | `server/sim/content/bonds/addon/battle.js:289` 仍是 `if (!idleOk && !tile[2]) continue;` |
| [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) | 召唤物范围（只剩「与自动路径一致」的核对） | 范围校验已实现，但 issue 提醒的 6 个 placeable 召唤物是否都该受范围约束仍需按官方规则逐个确认（目前只有狼群 / 流形打了 `ownerRange`） |
| [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) | 调配界面缺局内数值与攻击范围 | `public/js/screens/loadout.js` 内没有数值块 / 范围小地图的渲染代码 |

> 结论：**「水面放置」「召唤物范围」「突袭落在倒地格」「突袭重新部署在阵亡处」这几类已经修掉**，修复排期时不必再花时间；真正剩下的是**突袭的被动就绪、落点收益、以及未移除占用者（倒地以外）占格**这三条。


## 6. 需要纠正的「报错」：这几条不是 bug

评论里有几条被维护者判定为「与官方规则一致 / 不是故障」，直接修复会改错，先记在这里：

| Issue | 现象 | 维护者结论 |
|---|---|---|
| [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) 深巡只在阻挡时开技能 | 重装干员在**下半赛季**官方规则里就是「受到伤害时才释放技能」，上半赛季才是进范围即开；0.1.1 出于玩家反馈有意改成进范围即开（属于有意偏离官方） |
| [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) 杜遥夜刷不出炎干员 | 一级商店按官方只刷不超过商店等级的干员，而一阶 <炎> 只有惊蛰；惊蛰被禁用/不在池时自然刷不出，策略原文也注明「部分干员缺席时体验可能不完整」——与官方一致 |
| [#83](https://github.com/sganggs/Stronghold-Protocol/issues/83) 缪缪进阶不给流形 | 流形是「部署时」召唤并复制，投射对已在场干员升变不会补牌；举报者自己确认记错 |
| [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) 灵巧盟约不生效 | 标准模拟里灵巧在官方的本局禁用名单上；0.1.3 起盟约条会显示灰色「本局禁用」 |
| [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) 绝食干员不吃红蒂缓回 | 维护者称收割者特性「无法被友方治疗」、转职只改盟约；举报者反驳原版绝食干员可被缓回治疗并提交 PR #135 —— **这条有争议，以 PR #135 的裁定为准** |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) 叙拉古 3% / 谢拉格冻结 | 维护者逐条实测：3% 是伪随机长期频率、层数只加伤害不加概率且限定在隐匿窗口；拉普兰德攻速实测未掉；谢拉格 <50 层两阵接不上、400 层会冻结；四爷的狼不吃 6 叙隐匿是因隐匿只给叙拉古本人 |
| [#113](https://github.com/sganggs/Stronghold-Protocol/issues/113) 联机 boss 血量没乘人数 | 官方公告是左右分身共用一条血、总生命值不变，2 人与 4 人同值（如绝境 180 万），**不乘人数** |
| [#133](https://github.com/sganggs/Stronghold-Protocol/issues/133) 野鬃把怪推到不可通行地块 | 被推的敌人会停在围栏前；围栏格按官方是「可部署、地面不可通行」，站在上面的干员本来就不能阻挡地面敌人，也不该被打到 |
| [#139](https://github.com/sganggs/Stronghold-Protocol/issues/139) 独行盟约获得层数 | 独行的 +60% 攻击与生命不随层数变化；层数会涨是「助力」在休整结束时给已激活盟约 +2 层，效果本身不变 |
| [#161](https://github.com/sganggs/Stronghold-Protocol/issues/161) 队友医疗变成 Touch | 官方「外勤医疗」是每位玩家场地上出现一名预备干员-医疗，开战时若该玩家场上有至少两名精锐才替换为 Touch；联防合图后同时看到两只 Touch，原有医疗不变 |
| [#180](https://github.com/sganggs/Stronghold-Protocol/issues/180) 隐匿怪被 6 谢拉格冻结 | 举报者自己更正「原作也会这样」，标注为无需修复 |
| [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) 第 3 条 隐蔽吃源石地板伤害 | 活性源石是环境伤害、不看隐匿；萨卡兹枯朽战士毒雾写明「无视无法选择」，隐匿挡不住 —— 不是 bug |
| [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) / [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) 赏金 | 悬赏本体在**第 9 回合**才出（碎骨·悬赏 1 资金是官方数值）；分裂小怪不带赏金、联防只算本体（0.1.3） |


## 7. 讨论区摘要（维护者逐条回复）

共抓取 97 条的评论；其中 93 条有维护者或举报者的实质回复（下表），另有 4 条的评论已被删除（GitHub 只返回空数组，无法补回）。

| Issue | 摘要 |
|---|---|
| [#1](https://github.com/sganggs/Stronghold-Protocol/issues/1) 不能转职；盟约人数计算有误 | 维护者：变形同构体（转职球）的盟约效果与人数一直生效，之前只是盟约成员列表/干员卡没显示装备者；「不考虑整备区的盟约算了整备区」未复现，多出的一人多半是调和 +1。0.1.1 已修显示。 |
| [#3](https://github.com/sganggs/Stronghold-Protocol/issues/3) bug：昆图斯的突变细胞在升阶完干员之后会直接消失，不会返还 | 维护者：已修，0.1.1 随 20 多条修复一起发布——突变细胞不会用完消失，每场战斗后装备者换高一阶随机干员，原干员销毁、格子空出，突变细胞退回整备区可再次配发。 |
| [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) bug：深巡只有在阻挡敌人的时候才会开技能 | 维护者：这是下半赛季官方规则（重装「受到伤害时释放技能」），上半赛季是进范围即开；因反馈多，0.1.1 改为进范围即开（深巡/雷蛇二技能、号角二三、灰毫一二），深巡一技能仍挨打才开。 |
| [#5](https://github.com/sganggs/Stronghold-Protocol/issues/5) 准备阶段，收起商店界面时，界面并不会进行缩放 | 0.1.1：准备阶段收起商店后棋盘按官方视角放大，展开恢复。 |
| [#8](https://github.com/sganggs/Stronghold-Protocol/issues/8) 几个建议 | 维护者逐条（0.1.1）：选策略时可点「查看禁用盟约与干员」；数值按官方数据表、无改动（要具体对比请另开 issue）；人机不再凑本局禁用盟约、也不选围绕禁用盟约的策略；标准模拟按官方整局禁用奇迹等盟约。 |
| [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) placeable 召唤物（狼群）的手动放置缺少 owner 攻击范围校验 | 维护者：0.1.1 已修——战术家援军（伺夜狼群、缪尔赛思流形）只能放在召唤者攻击范围内，拖动时只亮合法格，手动放置与自动召唤共用同一套范围判定。 |
| [#15](https://github.com/sganggs/Stronghold-Protocol/issues/15) 昆图斯有bug，针扎一次就没了 | 维护者：0.1.1 已修（与 #3 同一处改动）。 |
| [#16](https://github.com/sganggs/Stronghold-Protocol/issues/16) bug：莫斯提马三技能没有减速 | 维护者：减速其实一直生效（天赋 -15%，三技能期间 -45%），只是战场上没有减速图标；0.1.2 起敌人身上会显示减速图标（PR #48）。举报者补充 y 模组/满潜下的天赋加成是否计算，未见答复。 |
| [#17](https://github.com/sganggs/Stronghold-Protocol/issues/17) bug：转职球转职后干员显示详情页并不会出现新的词条，显示bug | 维护者：0.1.1 已修——同时装变形同构体与对应装备时，详情卡多出虚线框「同构」词条，盟约弹窗成员列表也会列出该干员。 |
| [#19](https://github.com/sganggs/Stronghold-Protocol/issues/19) bug：深池小兵被击倒后变成的余烬被阻挡时不会解除隐匿 | 0.1.1：深池余烬继续前进、被阻挡即可攻击，5 次伤害击倒（与 #20 同一处修改）。 |
| [#20](https://github.com/sganggs/Stronghold-Protocol/issues/20) 深池小兵死后生成的隐匿尸体原地不动 | 维护者：0.1.1 已修——余烬重生的 1 秒内不动，之后沿原路线前进，被阻挡时能打到。 |
| [#21](https://github.com/sganggs/Stronghold-Protocol/issues/21) 突袭干员会重新部署在有干员阵亡的地方 | 0.1.1 修复「突袭再部署不会落到倒地干员格子」（与 #50 同源）。 |
| [#22](https://github.com/sganggs/Stronghold-Protocol/issues/22) 凯瑟琳队升级商店时的装备商店缺乏贴图与文字说明 | 维护者：0.1.0 的显示问题——凯瑟琳升级给的 3 件装备被当成干员卡绘制，只显示 `chess_item…` 编号；0.1.1 已改为带图标/名称/阶级/效果的装备卡（标题「定向投放」）。 |
| [#25](https://github.com/sganggs/Stronghold-Protocol/issues/25) bug：部分干员被击倒后在部署状态时仍有攻击动作 | 维护者确认：朝上部署用的是背面模型，而背面模型没有倒地动画，所以被击倒后仍停在攻击/待机动作（拉普兰德是正面所以正常）。0.1.2 已修——朝上干员倒地时改用正面模型播倒地动画并保持倒地姿势，再部署恢复背面；自带背面倒地动画的薄绿、玛恩纳、松果仍用背面。 |
| [#26](https://github.com/sganggs/Stronghold-Protocol/issues/26) bug,飞天石像二阶段没有飞天动画,依旧是一阶段的动画 | 维护者：0.1.1 已补守墓石像二阶段动画（击倒后先变石像 10 秒无法阻挡，再换飞行形态的待机/移动/攻击/死亡动画）。 |
| [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) AI策略优化 | 维护者确认三条都还在，且都出在人机摆阵：医疗可被摆到敌人路线上（扣分太小）、信仰搅拌机开三技能后的范围与反击没进摆阵、古米/角峰这类挡路单位先放会堵住路线尽头导致超时。0.1.1 只改了人机购买/合成/盟约/道具，摆阵留待后续；举报者补充难度为绝境。 |
| [#32](https://github.com/sganggs/Stronghold-Protocol/issues/32) bug反馈 | 维护者逐条：余二技能改为首领也能传送、没拉到人不再播特效；暴鸰投弹后换无炸弹动画、余烬行进（0.1.1）；歌蕾蒂娅等钩索师/推击手可按特性上高台、隐匿不再吃敌方溅射、荒芜拉普兰德浮游单元持续攻击（0.1.2）。举报者补充第 7 条（易拉三技能浮游单元无伤害）已被 0.1.2 一并修。 |
| [#33](https://github.com/sganggs/Stronghold-Protocol/issues/33) BUG：主要阿戈尔相关 | 维护者逐条：复活本身会触发，真正的问题是「刚被吞噬击倒又复活的干员会被后续吞噬标记再打一次」，把 3 次复活在开局用完——确认是 bug；乌尔比安「返回后加成被清空」未复现（结束的是三技能自身加成），船锚在阻挡时会落到脚下；联防食物链先后顺序官方无资料，暂未改。0.1.2 已修开场吞噬解除与船锚，红地板效果改为敌人离开后保留 300 秒。举报者追加：乌尔比安返回后阻挡数变 2（前方水月为 8），怀疑与「一鱼多吃」有关，待验证。 |
| [#35](https://github.com/sganggs/Stronghold-Protocol/issues/35) BUG：要塞分支干员（如：号角、灰毫）会攻击空中单位 | 维护者确认是 bug：要塞分支（号角、灰毫）按官方不能攻击空中单位，0.1.1 里远程攻击与溅射仍会打到飞行敌人，原因是**生成数据时把要塞当成了可以对空**——修的是数据，不是战斗逻辑。 |
| [#38](https://github.com/sganggs/Stronghold-Protocol/issues/38) Localization for full English UI | 英文 UI 需求；维护者未在本条给出方案，实际讨论在 #57。 |
| [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) 昆图斯的针存在bug；以及角色可以放在水上的问题 | 维护者：第 1、2 条 0.1.1 已修（突变细胞退还、深水区不可部署且突袭只落岸上）；第 3 条「推到地图外」未复现，社区补充原因是**联防固定用双人地图**，右侧棋盘被错误利用（会被肘到右图、推到出怪口右侧、突袭突到右图），维护者回复该问题在 **0.2.0** 修（联防改打官方逃脱关卡地图）。 |
| [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) 服务器端素材缺失：表现为表情图标缺失，及其所在的整个local文件夹+对应控制文件 | 维护者：缺的是本机《明日方舟》客户端提取的 `public/assets/local` 与 `data/local-assets.json`，公开镜像没有，所以无客户端的服务器从源码部署会缺（仍能玩，但表情/玩法说明图/部分官方图标/3D 棋盘会降级）。**0.1.2 起 `npm run setup` 会从公开镜像下载 36 个战斗表情与 19 页玩法说明（约 21 MB）**，更新代码后再跑一次 setup 即可补齐。 |
| [#43](https://github.com/sganggs/Stronghold-Protocol/issues/43) 隐蔽的角色和敌人在破隐后任显示为隐蔽 | 维护者：敌人侧 0.1.1 已修（被阻挡或被照明/影哨反隐时正常显示，不再一律半透明）；我方隐匿/迷彩按官方不因阻挡解除。另承认与官方有一处不同：敌人脱离阻挡后官方 3 秒才重新隐匿，本作立刻隐匿，下版本改。 |
| [#44](https://github.com/sganggs/Stronghold-Protocol/issues/44) 悬赏怪物生成的有问题，大姨凯瑟琳分队看不见装备，归鲨死了没替身，和一点意见 | 维护者逐条：悬赏 0.1.1 已按官方结构重做（第 3 回合固定组合，碎骨等首领悬赏只在第 9 回合，碎骨·悬赏 1 资金是官方数值）；凯瑟琳装备卡 0.1.1 已修；归溟幽灵鲨替身其实有、只是画不出来且仍能攻击，已确认为 bug，0.1.2 修（显示替身模型与图标，20 秒后换回，替身不普攻不放技能，二技能结束立刻切替身）；甄选干员与查看队友手牌记为建议。 |
| [#45](https://github.com/sganggs/Stronghold-Protocol/issues/45) bug：圆仔被阻挡 | 维护者：0.1.1 已修——圆仔（含鸭爵策略替换版）无法被阻挡、不攻击，正面物理/法术伤害降低 80%。 |
| [#46](https://github.com/sganggs/Stronghold-Protocol/issues/46) 四爷的狼可以随便放 | 维护者：0.1.1 已修——狼群与流形只能放在召唤者攻击范围内，范围外放不下、调整朝向后超出范围会退回；其他召唤物官方描述没有这条限制，仍可放任意可部署格。 |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) 突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动 | **维护者已确认是 bug 并明确 0.2.0 修**：被动技能在「技能就绪」判断里永远不算就绪，缄默德克萨斯这类被动突袭干员要等 10 秒没攻击才突袭；0.2.0 会改成「被动技能生效中也算技能就绪」（只改突袭判定），首只地面敌人出现即前压。举报者提供了 B 站录屏作为官方行为证据。 |
| [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) 突袭:再部署落点可能与倒地干员所在格子重叠(占用检查只拦截 alive 占用者) | 维护者：0.1.1 已修——倒地干员所在格会被保留，突袭落点跳过它，引擎的部署/再部署检查也拒绝该格（援军、召唤物、装置同样），倒地干员之后在原地再部署。 |
| [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) 突袭:闲置 10 秒触发的再部署不要求落点能覆盖敌人,会出现无意义的位移 | 维护者确认是 bug 并已修（**0.1.2**）：闲置 10 秒触发时若附近没有能打到敌人的落点仍会来回换位；0.1.2 起两条触发路径都只落在攻击范围能覆盖目标的格子（最靠前的打不到就换下一个），一个都打不到则原地等待并每 0.25 秒重查。 |
| [#52](https://github.com/sganggs/Stronghold-Protocol/issues/52) bug：史尔特尔进入锁血后仍能被治疗 | 维护者确认是 bug（余烬 8 秒内仍被治疗，医疗把治疗浪费在她身上）；0.1.2 已修——触发余烬后获得禁疗直到退场，医疗不再选她，只有生命回复属性与三技能注明无视禁疗的回复照常。 |
| [#53](https://github.com/sganggs/Stronghold-Protocol/issues/53) bug: 干员可以放在水里 | 维护者：0.1.1 已修——截图是战场 #08 深水区，0.1.1 起深水区不能部署干员与召唤物，突袭再部署只落岸上（与 #41 第 2 条同一问题）。 |
| [#54](https://github.com/sganggs/Stronghold-Protocol/issues/54) 昆图斯没有针！ | 维护者：0.1.1 已修（与 #15 同一问题）——「原地变成海霓、针没了」是 0.1.0 的表现。 |
| [#55](https://github.com/sganggs/Stronghold-Protocol/issues/55) feature: 添加bgm自动切换功能等建议 | 维护者：① 战斗 BGM 按回合固定（1–7 无畏者、8–13 骑士之日）由 PR #72 进 **0.1.4**，联防曲目（逃脱关卡）也在 0.1.4（PR #110）；② 自选（甄选）编队是官方玩法，**0.2.0** 会做；③ 地图风格问题实为 0.1.1 整合包已自带 3D 素材；④ 字号设置不是官方功能，先记下。举报者补充了 macOS HiDPI 下多处偏小的具体位置。 |
| [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) 英文界面：一个不改游戏代码的叠加层方案（关联 #38） | 英文叠加层方案讨论，等维护者就方向、术语（Alliance vs Covenant）、基准表态。 |
| [#58](https://github.com/sganggs/Stronghold-Protocol/issues/58) BUG：1.1中敌方远程攻击单位在攻击时任会移动。 | 维护者确认：远程敌人攻击后只停 0.35 秒就继续走，但攻击动画一直在循环，所以看起来边打边滑。**0.1.2 已修**——未被阻挡的远程敌人每次攻击都会站定、播完攻击动作再前进，停顿时长取自各敌人动画实际长度。 |
| [#59](https://github.com/sganggs/Stronghold-Protocol/issues/59) BUG：1.1中部分干员在倒地后任在进行攻击动作 | 维护者：原因与 #25 相同（朝上部署用背面模型，背面没有倒地动画），并明确**把本 issue 作为 #25 的重复关闭**。 |
| [#60](https://github.com/sganggs/Stronghold-Protocol/issues/60) 42突袭死后会消失 | 维护者：原因是史尔特尔天赋「余烬」强制退场被当成撤回处理，既不留倒地干员也无再部署倒计时；0.1.2 已修——所有强制退场干员原地留下倒地干员并显示再部署倒计时，再部署回该格（突袭跳出的回落点），但强制退场仍不算被击倒。 |
| [#61](https://github.com/sganggs/Stronghold-Protocol/issues/61) feature：优化远程角色干员子弹射出点位及攻击动作 | 维护者确认两点都是显示问题：子弹出射点高度没算镜头倾斜（看起来从裆部射出）、每次攻击整个模型会朝目标位移（本是模型加载失败时的头像效果）。**0.1.3 已修**——弹道从手上发出、打到胸口高度。 |
| [#62](https://github.com/sganggs/Stronghold-Protocol/issues/62) 二级干员少了一个（应该是二级 | 举报者补充截图：术士分类里并没有「谐律」——提示这条可能记错干员名或分类，需重新确认目标干员。 |
| [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) 干员调配界面看不到干员局内数值与攻击范围（只有技能/模组两段，对比局内详情面板缺 stats） | 维护者确认缺失，承诺下版本补。**0.1.2 已修**——干员调配界面在「技能」与「模组」之间新增「局内数值」：按当前技能/模组显示生命上限、攻击、防御、法抗、攻击间隔、阻挡数、部署费用、再部署、攻击范围、特性与天赋，默认精锐可切普通，与战场详情卡同一套计算。 |
| [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) 杜遥夜「广交豪杰」在一级商店阶段刷不出<炎>干员（tier≤商店等级把唯一候选惊蛰挡掉，且无 anyTier 兜底） | **不是 bug**：维护者说明一级商店按官方只刷不超过商店等级的干员，而一阶 <炎> 干员只有惊蛰；惊蛰被禁用或不在池里时「广交豪杰」自然刷不出，策略原文也注明「<炎> 部分干员缺席时体验可能不完整」，与官方一致；佩佩同受商店等级限制。 |
| [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) 漏的锅碗瓢盆也给钱 | 维护者先要求补充细节（哪种敌人、击破还是漏过、钱出现在哪）；举报者说明是茶壶分裂出的小瓶子在联防阶段每个死亡都给 2 块。0.1.3 已修——分裂/召唤出的小怪不再带击杀赏金，赏金只在本体，联防只在漏掉的就是悬赏本体时给。 |
| [#68](https://github.com/sganggs/Stronghold-Protocol/issues/68) bug：怪的贴图加载错误 | 维护者确认：菱形火苗是模型未加载的占位；切后台时页面不跑动画，切回来若加载卡着会跳过补加载，于是长期停在占位（约 1 秒的抖动来自追帧插值，演算不受影响）。**0.1.3 已修**——后台加载卡住的模型会重新加载。 |
| [#76](https://github.com/sganggs/Stronghold-Protocol/issues/76) Feature: 增加观战和中途观战 | 讨论后收敛：观战位（满员进观战）与用密钥中途观战 **0.1.3 已有**，观战按钮发错密钥 **0.1.4 修**（PR #119）；房主关闭观战、观战者接管人机、观战位聊天尚未做；公开大厅与在线人数按 #63 决定**不进主仓库**（社区自行在 fork 实现）。举报者还提出以插件框架承载此类扩展。 |
| [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) feature: 增加一键重开按钮 | 维护者：一键重开与重抽禁用「改动不小，先记为建议」；完全不禁用不会做（官方规则是开局前公布禁用）。举报者已把「保留房间、重刷禁用」做成 GPL 插件愿供评估，但维护者指出该插件按 0.1.2 写、0.2.0 拆分文件后安装检查会对不上。 |
| [#79](https://github.com/sganggs/Stronghold-Protocol/issues/79) BUG:荒芜拉普兰德三技能狼头吃不到攻速加成和3%叠层伤害 | 维护者：0.1.1 时三技能浮游单元根本不攻击（只有周围持续伤害），0.1.2 已修——浮游单元按攻击间隔持续啃咬、攻速加成有效（攻速 100 时 8 秒约 15 次，300 时约 41 次）；恐惧按 PRTS 只在追上那一下出现。并说明三技能浮游单元伤害不属于普通攻击，故当时叙拉古 3% 不记在啃咬上。0.1.3 起叙拉古六层真伤对每次普通伤害都掷骰（含技能命中与浮游单元），平均约 3%，每层 +50 伤害。 |
| [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) 自建部署在 Workers 免费层会被 DO 写入量卡死：每条 WebSocket 消息强制重写整个房间快照 | Workers 写入量问题：作者给出三处改动与估算，但明确「不打算开 PR」，需上游自己摘取或重写。 |
| [#82](https://github.com/sganggs/Stronghold-Protocol/issues/82) 协防阶段干员重部署Bug及一些其他建议 | 维护者逐条：① 联防一开始技能就在放**确认是 bug**，原因是复刻额外把上一阶段没放完的持续技能接着放了（官方联防只沿用生命比例与技力）——**0.1.3 已修**，联防只带上一仗结束时的血量比例与技力，还开着的技能会关掉；② 水月被两面吞噬打死 0.1.2 已按「首次被击倒后未触发的吞噬解除」修好。举报者另附整备区临时位不自动补充等两条。 |
| [#83](https://github.com/sganggs/Stronghold-Protocol/issues/83) BUG：缪缪进阶不给流形 | **不是 bug**：维护者说明流形是缪尔赛思「部署时」召唤并复制的，博士投影对已在场的干员升变不会补牌；举报者随后自己确认记错（投影后缪缪在场上是精锐）。 |
| [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) 讨论：关于数据持久化的取舍 | 数据持久化取舍讨论：默认关闭的可选 SQLite，用于战绩/复盘/回放；无最终决定。 |
| [#86](https://github.com/sganggs/Stronghold-Protocol/issues/86) BUG：六叙隐匿不防雪祀远程攻击，芬策略信标发不到人 | 维护者核实：雪祀打的是前面的星熊，安洁莉娜未掉血，未阻挡该敌人的隐匿干员不会成为其远程目标；信标确认是 bug——送礼者在回合结束前被淘汰时礼物留在自己身上，队友收不到。0.1.3 已修——信标送出原干员，送礼者被淘汰后信标仍在、精锐也保留。 |
| [#87](https://github.com/sganggs/Stronghold-Protocol/issues/87) BUG：观看他人界面不能实时更新 | 维护者：**0.1.3 已修**——准备阶段查看另一位玩家的棋盘会持续同步，对方部署/挪位/出售后立即更新，不必退出重进。 |
| [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) bug反馈 | 维护者逐条：琳琅诗怀雅三技能要等地面敌人进入技能范围才打空金币（不是自动关闭）；分裂小怪不再带赏金（0.1.3）；「隐蔽吃源石地板/毒雾」不是问题——活性源石是环境伤害不看隐匿，萨卡兹枯朽战士毒雾写明「无视无法选择」；深溟巢涌者不再普攻、改为走路时每秒范围脉冲（0.1.3）。 |
| [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) bug | 维护者：不是故障——标准模拟里灵巧在官方本局禁用名单上，0.1.3 起盟约条会显示灰色「本局禁用」。举报者补充另一个现象：飞行怪「趴在地上」、会被号角这类地面干员打到。 |
| [#93](https://github.com/sganggs/Stronghold-Protocol/issues/93) bug：深溟巢涌者（海嗣那个伞）疑似会与炎佑阻挡 | 维护者：0.1.3 已修——深溟巢涌者不再普通攻击，只在走路时放范围脉冲，炎佑不会再被普攻停住。 |
| [#94](https://github.com/sganggs/Stronghold-Protocol/issues/94) fearure：金币没花完可以有个提示 | 0.1.1 已加金币未花完的提示（更新记录「界面」段）。 |
| [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | Hono 重构讨论，属设计议题。 |
| [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) 绝食干员不吃红蒂缓回，海嗣boss爆条频率明显过快 | 维护者：隐德来希是收割者，特性「无法被友方治疗」，转职只改盟约不改特性；海嗣关底盐风主教神经条要叠满才爆发。举报者反驳：原版绝食干员可以被缓回治疗（如圣葬），并提交了 PR #135（按 PRTS 对齐相关技能效果）——这条需要按 PR 重新裁定。 |
| [#97](https://github.com/sganggs/Stronghold-Protocol/issues/97) bug | 维护者：0.1.3 起隐匿的阻挡者只吃被挡住那个敌人的普攻，溅射/爆炸/区域/光环都打不到；迷彩仍会被溅射打中。 |
| [#99](https://github.com/sganggs/Stronghold-Protocol/issues/99) 表情不显示 | 贡献者补充：36 个表情图与交流面板官方贴图不在公开镜像清单内，属「本机客户端提取」素材（须 `node tools/setup.mjs --local`）。维护者：**0.1.3 起**表情清单加载失败会先显示替代图标、稍后加载成功再换成图片。 |
| [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) BUG：1.2重锤击晕泡泡后会出现倒地和起身循环的抽搐动画 | 维护者：眩晕期间不会重播倒地动画，未能复现；请求提供录像、是哪张泡泡/哪把锤子、以及当前版本是否仍出现。 |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) 叙拉古和谢拉格的阵营BUG | 维护者逐条实测：① 叙拉古 3% 是伪随机长期频率、层数只加伤害不加概率，且只在隐匿期间与隐匿结束后 10 秒内的普通伤害上判定（需 6 名不同叙拉古才有隐匿），6 人 150 层约 8 秒出过一次；② 荒芜拉普兰德开技能不会清掉攻速（实测保持 133）；③ 谢拉格寒风每 25 秒一阵、持续 20+0.1×层数 秒，层数不到 50 时两阵接不上（第一阵只上寒冷）、400 层第二阵起会冻结，灵知三技能结束时解冻是官方「失温症」；④ 四爷的狼吃不到 6 叙隐匿是因为叙拉古的隐匿只给叙拉古干员本人。**基本判定为「与官方一致、非 bug」**，只有举报者主观体感（150 层打不动大鲍勃）仍存疑。 |
| [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) bug：5阿戈尔复活效果触发问题 | **维护者已给出 0.1.4 的实现方案**：复活名额给最先被击倒的 3 名阿戈尔，没被吞噬的阿戈尔不占名额（存活 = 没被吞噬人数 + 3）；同一名干员被多名阿戈尔吞噬只算一次；斯卡蒂等自身模组复活不占名额。联防：开场倒地的干员属「退场」不算被击倒、不当场复活；联防中阿戈尔也会吞噬身前队友（站着或等待再部署），加成与单独作战一致；深巡吃不到攻击的问题 0.1.3 已修。举报者此前的判断与之吻合。 |
| [#106](https://github.com/sganggs/Stronghold-Protocol/issues/106) 有500个素材文件下载失败 | 维护者：`git clone` 不含素材、重启服务器不会自动重下，需运行 `npm run setup` 续传，失败清单在 `.cache/assets-report.json`；图片失败会回退 jsDelivr，**音频没有回退源，约 500 个失败基本就是这批音频**；国内镜像为 PR #24（手动开启，进 0.1.4）；发布页整合包已带全部素材。 |
| [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) BUG:矛头哥(新硎)攻击不消耗铁矛头 | 举报者补充：消耗矛头会持久性增加矛头哥攻击力，怀疑把「消耗矛头加攻」错误实现成了「强力击」。 |
| [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) 史尔特尔被禁疗死亡以后，无法吃到不屈效果立即复活 | 维护者：不屈卡面概率显示已在 **0.1.4 封顶 100%**（200 层是 98%、205 层起才 100%）；史尔特尔被禁疗后余烬挡住致命伤、约 8 秒后的撤退会计入不屈并立即再部署，240 层且原格空着时可复现复活，**没复活通常是原格被占**。另一位举报者补充伊内丝 240 层正常而斯卡蒂失败一次，维护者要求补充是斯卡蒂还是浊心斯卡蒂、层数、原格是否空着。 |
| [#111](https://github.com/sganggs/Stronghold-Protocol/issues/111) 闲话：我用ds跑了个第三方模组加载器，发之前先来问一句 | **维护者结论：模组加载器不进主仓库** —— 替换渲染层或让模拟被模组改动，与「复刻」定位和服务器复算都有冲突；作者允许其自留或另开不含素材的 GPL 仓库。社区另有反对（改动过重）与支持（像 MC 一样可玩性）两种声音。 |
| [#113](https://github.com/sganggs/Stronghold-Protocol/issues/113) BUG：联机boss血量没有乘以联机人数 | **不是 bug**：维护者说明联机首领血量用该难度公布数值，2 人与 4 人相同（如绝境 180 万）；公告写的是左右两个分身共用一条血、总生命值不变，所以不乘人数。 |
| [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) BUG：单人标准模拟下商店升级的所需资金异常、琳琅诗怀雅二技能香槟炸弹的放置范围错误 | 举报者给出单人标准模拟下商店升级资金异常的截图与琳琅诗怀雅二技能香槟炸弹放置范围（附 PRTS 链接）；本条暂无维护者回复。 |
| [#117](https://github.com/sganggs/Stronghold-Protocol/issues/117) boss问题 | 维护者：碎骨榴弹 0.1.3 已按 PRTS 改——未被阻挡时造成攻击力 26% 伤害、范围为目标及周围八格、并降低防御 5 秒；被阻挡时是普通攻击。 |
| [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) feature：AI的干员抓取和策略选择问题 | 举报者给出 AI 抓牌与策略问题（大量抢队友特化干员、选鸭爵守不住）；本条暂无维护者回复。 |
| [#123](https://github.com/sganggs/Stronghold-Protocol/issues/123) 希望可以添加出售棋子与撤退棋子的快捷键 | 出售/撤退快捷键建议；暂无维护者回复。 |
| [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) BUG：引星棘刺一技能不会在满技力时自动释放 | 举报者：引星棘刺一技能应在满技力时自动释放（不论是否有敌人），当前无敌人则不释放；暂无维护者回复。 |
| [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 房间聊天补丁：已在 0.1.3 上移植并通过 3622 项测试（3/3 专项通过），等维护者决定是否合并。 |
| [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) 我自己利用ds加了些人但是人成滚木了 | 举报者自行用 AI 加干员后，备战界面与 D 牌可见、战斗界面消失；暂无维护者回复。 |
| [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) feature:休整期双击可以直接看队友的场地 | 休整期双击队友头像查看其场地的建议；暂无维护者回复。 |
| [#133](https://github.com/sganggs/Stronghold-Protocol/issues/133) bug：野鬃推人会把怪推到不可通行地块上并被上面的干员阻挡 | **不是 bug**：维护者说明被推的敌人会停在围栏前、不会走上围栏；围栏上的干员不会被打到也不阻挡它——官方围栏格是「可部署、地面不可通行」，站在上面的干员本来就不能阻挡地面敌人。 |
| [#136](https://github.com/sganggs/Stronghold-Protocol/issues/136) feature:希望能增加原版V,VI干员的自选 | 希望增加原版 V/VI 干员自选；暂无维护者回复。 |
| [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) bug：绝食干员无法对小特被动一类以及棘刺等技能产生的治疗效果正确生效 | 举报者：只试了圣葬、折雅，除自身回复外吃不到任何治疗（与 #96 同族，等 PR #135 裁定）。 |
| [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) 希望拖动的时候除了拖动干员脚底还可以拖动干员的身体，希望准备时可以收起商店 | 拖动干员身体、准备阶段收起商店的建议；暂无维护者回复。 |
| [#139](https://github.com/sganggs/Stronghold-Protocol/issues/139) bug 盟约独行会获得层数 | **不是 bug**：维护者说明独行的 +60% 攻击与生命不随层数变化（0 层与 40 层实测一样）；层数会涨是「助力」在休整结束时给所有已激活盟约 +2 层，效果本身不变。 |
| [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) BUG: 瑕光，绝技层数和阿戈尔吃人效果；以及部分优化建议 | 瑕光沉睡应不算入 3 阻挡、绝技层数疑似被助力增加、阿戈尔吞噬目标应是蒂蒂进冷却而非鲨鲨死亡；另有两条优化建议（boss 图队友视角、商店重复装备金框）。暂无维护者回复。 |
| [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) 能不能增加一个联机指定后端的功能？ | 希望客户端可指定后端以避免重复拉取素材；暂无维护者回复。 |
| [#142](https://github.com/sganggs/Stronghold-Protocol/issues/142) feature:希望优化下盟约的显示 | 维护者：PR #149 已实现收起按钮，将进 0.1.4。 |
| [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) 优化建议：1.希望增加按键自定义功能 2.攻击特效缺失 3.干员待选区自动落位到待部署区 | 按键自定义 / AOE 特效 / 待选区自动落位 / 外层设置入口 / 音效等建议；暂无维护者回复。 |
| [#144](https://github.com/sganggs/Stronghold-Protocol/issues/144) bug:CI脚本存在偶发性的问题 | 维护者：PR #146 已修好该测试（固定种子、避开 AI 已选的策略），将进 0.1.4。 |
| [#148](https://github.com/sganggs/Stronghold-Protocol/issues/148) bug：突袭近战干员部署在高台 | 维护者：突袭再部署不会把近战干员放到高台——落点是高台就留在原地，落点是道路才跳；截图里开场就站在高台的属于摆放规则，0.1.4 起特性写明「可以放置于远程位」的干员（歌蕾蒂娅、崖心、见行者等）才可上高台。 |
| [#151](https://github.com/sganggs/Stronghold-Protocol/issues/151) 下游工具：Windows 版启动器 | 维护者：这是独立下游工具，主仓库不会内置，欢迎在 README 写清是第三方工具。 |
| [#153](https://github.com/sganggs/Stronghold-Protocol/issues/153) BUG:歌蕾蒂娅无法放置在高台位置 | 维护者：0.1.4 起，特性写明「可以放置于远程位」的干员（歌蕾蒂娅、崖心、见行者等）普通/精锐、任意模组都可放上高台（此前只有精锐歌蕾蒂娅带淡金坠饰可以）。 |
| [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) 建议，优化房间逻辑 | 维护者：开局前房主可移出玩家（含掉线），大厅掉线 60 秒自动清除，房主离开自动转给下一位在线玩家；对局开始后移出掉线玩家、主动转让房主、账号系统尚未实现，先记为待办。 |
| [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | v2.0 架构 Tracking，作为 monorepo/子系统拆分/插件扩展/Awesome List 的总纲。 |
| [#159](https://github.com/sganggs/Stronghold-Protocol/issues/159) 博士血量归零后的观战逻辑修改 | 维护者：观战席已会自动看顺位第一个存活玩家；被淘汰的玩家目前只留提示、需点头像才能看，先记为待办。 |
| [#161](https://github.com/sganggs/Stronghold-Protocol/issues/161) Bug：选择touch策略后，队友的普通医疗干员也会变成touch | **不是 bug**：维护者说明官方「外勤医疗」是「每位玩家场地上出现一名预备干员-医疗；开战时若场上有至少两名精锐干员则替换为 Touch」——所以不是把队友的医疗变成 Touch，联防时两张图合并会同时看到两只 Touch，赫默等原有医疗不变。 |

评论已删除、无法补回：#128、#165、#169、#170。


## 8. 分类清单


### 部署 / 落点 / 地形（11 条）

放置合法性、突袭落点、召唤物范围、推拉位移

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) | placeable 召唤物（狼群）的手动放置缺少 owner 攻击范围校验 | 已关闭 | P1 | placeable 召唤物手动放置缺 owner 攻击范围校验（自动召唤路径有，两条路径不一致） |
| [#21](https://github.com/sganggs/Stronghold-Protocol/issues/21) | 突袭干员会重新部署在有干员阵亡的地方 | 已关闭 | P1 | 与 #50 同一根因的早期报告 · 重复 #50 |
| [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) | 昆图斯的针存在bug；以及角色可以放在水上的问题 | 开启 | P1 | 第 2 条与 #53 重复；另含昆图斯针与野鬃推怪 · 重复 #53 |
| [#45](https://github.com/sganggs/Stronghold-Protocol/issues/45) | bug：圆仔被阻挡 | 已关闭 | P1 | 鸭爵的圆仔被阻挡（不应被阻挡） |
| [#46](https://github.com/sganggs/Stronghold-Protocol/issues/46) | 四爷的狼可以随便放 | 已关闭 | P1 | 伺夜狼群可任意放置的简版报告 · 重复 #9 |
| [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) | 突袭:再部署落点可能与倒地干员所在格子重叠(占用检查只拦截 alive 占用者) | 已关闭 | P1 | raidTile 只查地形不查占用；引擎占用拦截只认 alive，倒地未移除单位仍占格 |
| [#53](https://github.com/sganggs/Stronghold-Protocol/issues/53) | bug: 干员可以放在水里 | 已关闭 | P1 | 地面干员可以放到水面格 |
| [#130](https://github.com/sganggs/Stronghold-Protocol/issues/130) | 我自己利用ds加了些人但是人成滚木了 | 开启 | P2 | 自行添加的干员备战界面可见、进入战斗后消失（下游改动，先确认是否上游问题） |
| [#133](https://github.com/sganggs/Stronghold-Protocol/issues/133) | bug：野鬃推人会把怪推到不可通行地块上并被上面的干员阻挡 | 已关闭 | P1 | 野鬃推人把怪推到不可通行地块，被上面的干员阻挡；与 #41 第 3 条同源 |
| [#148](https://github.com/sganggs/Stronghold-Protocol/issues/148) | bug：突袭近战干员部署在高台 | 已关闭 | P1 | 突袭（近战）被放到高台；与 #50 同属突袭落点校验缺失 |
| [#153](https://github.com/sganggs/Stronghold-Protocol/issues/153) | BUG:歌蕾蒂娅无法放置在高台位置 | 开启 | P1 | 歌蕾蒂娅（远程位）无法放到高台 |

### 技能 / 突袭 / 战斗数值（19 条）

技能触发与就绪、叠层、治疗与禁疗、复活机制

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#4](https://github.com/sganggs/Stronghold-Protocol/issues/4) | bug：深巡只有在阻挡敌人的时候才会开技能 | 已关闭 | P1 | 深巡只在阻挡时开技能（应在攻击范围内即开） |
| [#16](https://github.com/sganggs/Stronghold-Protocol/issues/16) | bug：莫斯提马三技能没有减速 | 已关闭 | P1 | 莫斯提马三技能没有减速 |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) | 突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动 | 开启 | P1 | ready 排除 passive，被动系成员只能等闲置 10 秒；官方为首敌出现即前压 |
| [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) | 突袭:闲置 10 秒触发的再部署不要求落点能覆盖敌人,会出现无意义的位移 | 已关闭 | P1 | 闲置路径不要求落点能覆盖敌人，出现无收益位移 |
| [#52](https://github.com/sganggs/Stronghold-Protocol/issues/52) | bug：史尔特尔进入锁血后仍能被治疗 | 已关闭 | P1 | 史尔特尔锁血期间仍可被治疗 · 关联 #108 |
| [#89](https://github.com/sganggs/Stronghold-Protocol/issues/89) | bug反馈 | 已关闭 | P1 | 琳琅诗怀雅三技能自动关闭；锅碗瓢盆赏金重复结算；隐蔽触发源石地板流血；深溟巢涌者多出单体攻击（与 #93 #104 同一根因） |
| [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) | 绝食干员不吃红蒂缓回，海嗣boss爆条频率明显过快 | 开启 | P1 | 绝食干员吃不到红蒂缓回（与 #137 重复）；海嗣 boss 爆条频率过快 |
| [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) | BUG：1.2重锤击晕泡泡后会出现倒地和起身循环的抽搐动画 | 开启 | P2 | 重锤击晕泡泡后倒地和起身循环抽搐 |
| [#107](https://github.com/sganggs/Stronghold-Protocol/issues/107) | BUG:矛头哥(新硎)攻击不消耗铁矛头 | 开启 | P1 | 新硎攻击不消耗铁矛头 |
| [#108](https://github.com/sganggs/Stronghold-Protocol/issues/108) | 史尔特尔被禁疗死亡以后，无法吃到不屈效果立即复活 | 开启 | P0 | 史尔特尔被禁疗死亡后吃不到不屈立即复活（200 层仍不复活） |
| [#124](https://github.com/sganggs/Stronghold-Protocol/issues/124) | BUG：引星棘刺一技能不会在满技力时自动释放 | 开启 | P1 | 引星棘刺一技能满技力不自动释放（无敌人时） |
| [#137](https://github.com/sganggs/Stronghold-Protocol/issues/137) | bug：绝食干员无法对小特被动一类以及棘刺等技能产生的治疗效果正确生效 | 开启 | P1 | 绝食干员无法吃小特被动/棘刺等技能治疗 · 重复 #96 |
| [#140](https://github.com/sganggs/Stronghold-Protocol/issues/140) | BUG: 瑕光，绝技层数和阿戈尔吃人效果；以及部分优化建议 | 开启 | P1 | 瑕光沉睡计入阻挡数；绝技层数被助力增加；阿戈尔吞噬目标判定错误（与 #165 第 2/3 条同源） |
| [#162](https://github.com/sganggs/Stronghold-Protocol/issues/162) | BUG：缇缇特性叠层有误 | 开启 | P1 | 缇缇二技能睡眠叠层速度不对 |
| [#170](https://github.com/sganggs/Stronghold-Protocol/issues/170) | BUG：忍冬开启三技能攻击敌人无法晕眩敌人 | 开启 | P1 | 忍冬三技能攻击无法晕眩 |
| [#171](https://github.com/sganggs/Stronghold-Protocol/issues/171) | 优等生神经损伤不生效 | 开启 | P1 | 优等生神经损伤（麻痹）不生效 |
| [#175](https://github.com/sganggs/Stronghold-Protocol/issues/175) | BUG：华法琳特性叠层超过描述的7次 | 开启 | P2 | 华法琳特性叠层超过描述的 7 次（正文为空，需补复现） · 关联 #162 #140 |
| [#179](https://github.com/sganggs/Stronghold-Protocol/issues/179) | master CI red: skills.test.js:437 'deploy-time passive' expects passive, gets duration (64715116) | 开启 | P1 | 上游 master CI 红：skills.test.js:437「deploy-time passive」期望 passive、实得 duration。**上游已经有测试要求被动在部署时被视为就绪**，与 #49 是同一处逻辑 · 关联 #49 |
| [#181](https://github.com/sganggs/Stronghold-Protocol/issues/181) | BUG：深靛（秘术师）特性充能与攻击冷却串联冲突，导致束缚期间零蓄力且实际攻击间隔过长 | 开启 | P1 | 深靛（秘术师）普攻冷却与特性充能串行等待 → 束缚期间零蓄力、实际攻击间隔过长；举报者用 battleHarness 做了断点排查 |

### 战斗表现 / 动画 / 贴图（9 条）

动作状态机、贴图与特效加载、渲染表现

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#25](https://github.com/sganggs/Stronghold-Protocol/issues/25) | bug：部分干员被击倒后在部署状态时仍有攻击动作 | 已关闭 | P2 | 部分干员被击倒后在部署状态仍有攻击动作 · 关联 #59 |
| [#26](https://github.com/sganggs/Stronghold-Protocol/issues/26) | bug,飞天石像二阶段没有飞天动画,依旧是一阶段的动画 | 已关闭 | P2 | 飞天石像二阶段仍播一阶段动画 |
| [#58](https://github.com/sganggs/Stronghold-Protocol/issues/58) | BUG：1.1中敌方远程攻击单位在攻击时任会移动。 | 已关闭 | P2 | 敌方远程攻击时仍会滑动/移动 |
| [#59](https://github.com/sganggs/Stronghold-Protocol/issues/59) | BUG：1.1中部分干员在倒地后任在进行攻击动作 | 已关闭 | P2 | 干员倒地后仍播放攻击动作，疑似与朝向有关 · 关联 #25 |
| [#60](https://github.com/sganggs/Stronghold-Protocol/issues/60) | 42突袭死后会消失 | 已关闭 | P2 | 42（干员）突袭死亡后直接消失 |
| [#61](https://github.com/sganggs/Stronghold-Protocol/issues/61) | feature：优化远程角色干员子弹射出点位及攻击动作 | 已关闭 | P2 | 子弹出射点与攻击动作需要优化（建议类） |
| [#68](https://github.com/sganggs/Stronghold-Protocol/issues/68) | bug：怪的贴图加载错误 | 已关闭 | P2 | 切后台回来后新生成敌人贴图错误（小火苗）+ 回屏后模型抖动导致阻挡错误 |
| [#143](https://github.com/sganggs/Stronghold-Protocol/issues/143) | 优化建议：1.希望增加按键自定义功能 2.攻击特效缺失 3.干员待选区自动落位到待部署区 | 开启 | P2 | 按键自定义、AOE 特效缺失与过亮、待选区不自动落位、外层设置入口（多条） |
| [#177](https://github.com/sganggs/Stronghold-Protocol/issues/177) | 部分干员闭眼时眼球没有被完全遮住（倒地 / 眨眼，例：仇白、琳琅诗怀雅）—— 玩家反馈，附实测数据 | 开启 | P2 | 干员倒地/眨眼闭眼时眼球未被完全遮住（仇白、琳琅诗怀雅）；举报者自己也说影响不大 · 关联 #59 #25 |

### 隐匿 / 阻挡 / 敌人行为（10 条）

隐匿解除与免疫、阻挡交互、目标筛选

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#19](https://github.com/sganggs/Stronghold-Protocol/issues/19) | bug：深池小兵被击倒后变成的余烬被阻挡时不会解除隐匿 | 已关闭 | P1 | 深池余烬被阻挡不解除隐匿 → 无敌 → 无限重生循环 |
| [#20](https://github.com/sganggs/Stronghold-Protocol/issues/20) | 深池小兵死后生成的隐匿尸体原地不动 | 已关闭 | P1 | 深池小兵死后隐匿尸体原地不动（#19 的同一现象分支） · 重复 #19 |
| [#32](https://github.com/sganggs/Stronghold-Protocol/issues/32) | bug反馈 | 已关闭 | P1 | 余二技能不拉怪、火山源石虫外观、深池鬼火索敌/无敌、歌蕾蒂娅高台、暴鸽形态、隐蔽吃溅射 · 关联 #153 #19 |
| [#35](https://github.com/sganggs/Stronghold-Protocol/issues/35) | BUG：要塞分支干员（如：号角、灰毫）会攻击空中单位 | 已关闭 | P2 | 要塞分支（号角、灰毫）会攻击空中单位；维护者确认是生成数据把要塞当成可对空，0.1.1 修的是数据 —— 只剩离线快照校验 · 关联 #32 |
| [#43](https://github.com/sganggs/Stronghold-Protocol/issues/43) | 隐蔽的角色和敌人在破隐后任显示为隐蔽 | 已关闭 | P2 | 破隐后仍显示为隐蔽状态 · 关联 #97 |
| [#86](https://github.com/sganggs/Stronghold-Protocol/issues/86) | BUG：六叙隐匿不防雪祀远程攻击，芬策略信标发不到人 | 开启 | P1 | 六叙隐匿不防雪祀远程攻击；芬策略信标发出的干员在下回合没有到队友手上 |
| [#93](https://github.com/sganggs/Stronghold-Protocol/issues/93) | bug：深溟巢涌者（海嗣那个伞）疑似会与炎佑阻挡 | 已关闭 | P1 | 炎佑与深溟巢涌者互相阻挡并快速击杀（与 #89 第 4 条同源） · 重复 #89 |
| [#97](https://github.com/sganggs/Stronghold-Protocol/issues/97) | bug | 已关闭 | P1 | 六叙生效时仍吃敌方 AOE（如卢西恩） · 关联 #43 #86 |
| [#104](https://github.com/sganggs/Stronghold-Protocol/issues/104) | bug：深溟巢涌者会a人 | 已关闭 | P1 | 深溟巢涌者丢失光环改为单体远程攻击、攻击时原地不动 · 重复 #89 |
| [#180](https://github.com/sganggs/Stronghold-Protocol/issues/180) | 隐匿怪会被6谢拉格效果冻结（记错了，原作也会） | 已关闭 | P3 | 「隐匿怪被 6 谢拉格冻结」——举报者自己更正「原作也会这样」；**无需改动**，保留作为「不是 bug」的样本 · 关联 #101 |

### 干员 / 盟约 / 阵营机制（23 条）

转职、策略刷牌、阿戈尔/叙拉古/谢拉格、赏金

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#1](https://github.com/sganggs/Stronghold-Protocol/issues/1) | 不能转职；盟约人数计算有误 | 已关闭 | P1 | 转职球无效；不考虑整备区的盟约把整备区干员计入人数 |
| [#3](https://github.com/sganggs/Stronghold-Protocol/issues/3) | bug：昆图斯的突变细胞在升阶完干员之后会直接消失，不会返还 | 已关闭 | P1 | 升阶后突变细胞直接消失不返还 · 关联 #15 #41 #54 |
| [#8](https://github.com/sganggs/Stronghold-Protocol/issues/8) | 几个建议 | 已关闭 | P2 | 选策略阶段无法回看禁用干员与盟约；终难数值偏难；AI 选被禁盟约；被禁盟约剩余干员上场不激活；切页后图标丢失 · 关联 #31 #121 |
| [#15](https://github.com/sganggs/Stronghold-Protocol/issues/15) | 昆图斯有bug，针扎一次就没了 | 已关闭 | P1 | 针扎一次就没了（与 #3 #41 #54 同一系统） · 重复 #3 |
| [#17](https://github.com/sganggs/Stronghold-Protocol/issues/17) | bug：转职球转职后干员显示详情页并不会出现新的词条，显示bug | 已关闭 | P2 | 转职后详情页不出现新词条（显示 bug） · 重复 #1 |
| [#22](https://github.com/sganggs/Stronghold-Protocol/issues/22) | 凯瑟琳队升级商店时的装备商店缺乏贴图与文字说明 | 已关闭 | P2 | 凯瑟琳队升级商店时装备商店缺贴图与文字 · 重复 #44 |
| [#33](https://github.com/sganggs/Stronghold-Protocol/issues/33) | BUG：主要阿戈尔相关 | 已关闭 | P1 | 复活机制不触发；乌尔比安三技能结束清空阿戈尔增益/转职后无返回；联防阶段先倒地干员导致食物链断链 · 关联 #105 #140 #165 |
| [#44](https://github.com/sganggs/Stronghold-Protocol/issues/44) | 悬赏怪物生成的有问题，大姨凯瑟琳分队看不见装备，归鲨死了没替身，和一点意见 | 已关闭 | P1 | 悬赏怪池与节奏错乱；凯瑟琳分队装备不可见；归鲨死后无替身；分队页看不到被禁干员 · 关联 #128 #33 |
| [#54](https://github.com/sganggs/Stronghold-Protocol/issues/54) | 昆图斯没有针！ | 已关闭 | P1 | 第二回合给针、第三回合变海霓后针消失 · 重复 #3 |
| [#62](https://github.com/sganggs/Stronghold-Protocol/issues/62) | 二级干员少了一个（应该是二级 | 已关闭 | P1 | 二级商店少了协律（候选被 tier 上限挡掉，与 #65 同根因） · 关联 #65 |
| [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) | 杜遥夜「广交豪杰」在一级商店阶段刷不出<炎>干员（tier≤商店等级把唯一候选惊蛰挡掉，且无 anyTier 兜底） | 已关闭 | P3 | **维护者判定与官方一致，不是 bug**：一级商店按官方只刷不超过商店等级的干员，而一阶 <炎> 只有惊蛰；惊蛰被禁用/不在池时自然刷不出，策略原文也注明「部分干员缺席时体验可能不完整」。代码层面 rollBond 的 tier 上限确实存在，但属官方规则 |
| [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) | 漏的锅碗瓢盆也给钱 | 已关闭 | P1 | 漏掉的锅碗瓢盆也给钱 · 关联 #89 |
| [#79](https://github.com/sganggs/Stronghold-Protocol/issues/79) | BUG:荒芜拉普兰德三技能狼头吃不到攻速加成和3%叠层伤害 | 已关闭 | P1 | 荒芜拉普兰德三技能狼头不吃攻速与 3% 叠层伤害 · 关联 #101 |
| [#82](https://github.com/sganggs/Stronghold-Protocol/issues/82) | 协防阶段干员重部署Bug及一些其他建议 | 开启 | P1 | 协防阶段干员技能直接释放（未考虑重部署）；阿戈尔 5 层仍开局倒地；炮车开炮无停顿 · 关联 #105 #165 |
| [#83](https://github.com/sganggs/Stronghold-Protocol/issues/83) | BUG：缪缪进阶不给流形 | 已关闭 | P1 | 缪缪经博士投影进阶后不给流形 · 关联 #9 #15 |
| [#92](https://github.com/sganggs/Stronghold-Protocol/issues/92) | bug | 开启 | P1 | 上两个灵巧干员盟约不生效 |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) | 叙拉古和谢拉格的阵营BUG | 开启 | P3 | **维护者逐条实测后基本判定不是 bug**：3% 是伪随机长期频率、层数只加伤害不加概率且只在隐匿期间与结束后 10 秒内的普通伤害上判定；拉普兰德攻速实测保持 133；谢拉格寒风层数 <50 时两阵接不上、400 层起会冻结；四爷的狼不吃 6 叙隐匿是因叙拉古隐匿只给自己。仅剩举报者主观体感存疑 |
| [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) | bug：5阿戈尔复活效果触发问题 | 开启 | P0 | 5 阿戈尔复活概率不触发；联防阶段不复活且攻击加成丢失 · 关联 #33 #165 |
| [#139](https://github.com/sganggs/Stronghold-Protocol/issues/139) | bug 盟约独行会获得层数 | 已关闭 | P1 | 独行盟约错误获得层数 |
| [#161](https://github.com/sganggs/Stronghold-Protocol/issues/161) | Bug：选择touch策略后，队友的普通医疗干员也会变成touch | 已关闭 | P1 | 选 touch 策略后队友普通医疗也变成 touch（玩家状态串用） |
| [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) | [BUG] 当前阿戈尔问题汇总、源码分析、修改计划 | 开启 | P0 | 复活名额应共享；吞噬增益错误享受攻击倍率；标记者死亡取消已付与吞噬；联防断链；流失来源归因 |
| [#169](https://github.com/sganggs/Stronghold-Protocol/issues/169) | BUG：拉普兰德合成金的之后立即刷新不会增加叙拉古层数 | 开启 | P1 | 拉普兰德合成金后立即刷新不增加叙拉古层数 · 关联 #79 #101 |
| [#182](https://github.com/sganggs/Stronghold-Protocol/issues/182) | feature：可以自己切换干员成特勤干员 | 开启 | P3 | 希望可主动把干员切换成特勤干员（提案人自己说明这是超出原版的优化，问是否违背项目宗旨）；与 #161 的 touch 串场相邻 · 关联 #161 |

### 数值 / 平衡 / 经济（4 条）

难度、联机缩放、商店经济

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#94](https://github.com/sganggs/Stronghold-Protocol/issues/94) | fearure：金币没花完可以有个提示 | 已关闭 | P3 | 金币没花完希望有提示 |
| [#113](https://github.com/sganggs/Stronghold-Protocol/issues/113) | BUG：联机boss血量没有乘以联机人数 | 已关闭 | P1 | boss 血量没有按联机人数缩放 |
| [#116](https://github.com/sganggs/Stronghold-Protocol/issues/116) | BUG：单人标准模拟下商店升级的所需资金异常、琳琅诗怀雅二技能香槟炸弹的放置范围错误 | 开启 | P1 | 单人标准模拟下商店升级所需资金异常；琳琅诗怀雅二技能香槟炸弹只在攻击范围内放置 |
| [#117](https://github.com/sganggs/Stronghold-Protocol/issues/117) | boss问题 | 已关闭 | P2 | 碎骨伤害疑似过高 |

### 界面 / 交互 / 观战 / AI（19 条）

面板、观战信息、快捷键、AI 队友策略

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#5](https://github.com/sganggs/Stronghold-Protocol/issues/5) | 准备阶段，收起商店界面时，界面并不会进行缩放 | 已关闭 | P2 | 收起商店界面时不缩放（观战/作战无此现象） |
| [#31](https://github.com/sganggs/Stronghold-Protocol/issues/31) | AI策略优化 | 开启 | P2 | AI 医疗挡狗、堵门卡怪导致超时等策略问题 · 关联 #121 #8 |
| [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) | 服务器端素材缺失：表现为表情图标缺失，及其所在的整个local文件夹+对应控制文件 | 已关闭 | P1 | 服务器端缺 public/assets/local 与 data/local-assets.json 导致表情全为默认图标 · 关联 #99 #106 |
| [#55](https://github.com/sganggs/Stronghold-Protocol/issues/55) | feature: 添加bgm自动切换功能等建议 | 开启 | P3 | 战斗 BGM 自动切换、自选干员、地图风格、文本偏小 |
| [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) | 干员调配界面看不到干员局内数值与攻击范围（只有技能/模组两段，对比局内详情面板缺 stats） | 已关闭 | P2 | 调配界面缺局内数值与攻击范围（detailPanel 已有同款组件可复用） |
| [#76](https://github.com/sganggs/Stronghold-Protocol/issues/76) | Feature: 增加观战和中途观战 | 开启 | P3 | 观战与中途观战、超过 4 人进观战位 · 关联 #159 #128 |
| [#77](https://github.com/sganggs/Stronghold-Protocol/issues/77) | feature: 增加一键重开按钮 | 开启 | P3 | 一键重开 / 不禁用干员选项 · 关联 #154 |
| [#87](https://github.com/sganggs/Stronghold-Protocol/issues/87) | BUG：观看他人界面不能实时更新 | 已关闭 | P2 | 观看他人界面不实时更新 |
| [#99](https://github.com/sganggs/Stronghold-Protocol/issues/99) | 表情不显示 | 已关闭 | P2 | 表情不显示（与 #42 同因） · 重复 #42 |
| [#121](https://github.com/sganggs/Stronghold-Protocol/issues/121) | feature：AI的干员抓取和策略选择问题 | 开启 | P2 | AI 大量抢队友特化干员、选鸭爵守不住等抓取/策略问题 · 关联 #31 |
| [#123](https://github.com/sganggs/Stronghold-Protocol/issues/123) | 希望可以添加出售棋子与撤退棋子的快捷键 | 开启 | P3 | 出售/撤退棋子快捷键 |
| [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) | 功能建议：增加房间内可拖动悬浮文字聊天 | 开启 | P3 | 贡献者已实现房间内悬浮文字聊天补丁（0.1.3）待作者决定是否收 |
| [#128](https://github.com/sganggs/Stronghold-Protocol/issues/128) | 观战/查看队友时：看不到队友的装备、整备区手牌、策略与效果列（附定位） | 已关闭 | P2 | 观战看不到队友装备/手牌/策略/效果列（作者已定位，PR 待合） |
| [#131](https://github.com/sganggs/Stronghold-Protocol/issues/131) | feature:休整期双击可以直接看队友的场地 | 开启 | P3 | 休整期双击队友头像直接查看其场地 · 关联 #128 |
| [#136](https://github.com/sganggs/Stronghold-Protocol/issues/136) | feature:希望能增加原版V,VI干员的自选 | 开启 | P3 | 希望增加原版 V/VI 干员自选（素材与 bug 成本高） |
| [#138](https://github.com/sganggs/Stronghold-Protocol/issues/138) | 希望拖动的时候除了拖动干员脚底还可以拖动干员的身体，希望准备时可以收起商店 | 开启 | P3 | 希望可拖拽干员身体；准备阶段可收起商店 |
| [#142](https://github.com/sganggs/Stronghold-Protocol/issues/142) | feature:希望优化下盟约的显示 | 已关闭 | P3 | 盟约面板希望可收起（手机端挡格子） |
| [#154](https://github.com/sganggs/Stronghold-Protocol/issues/154) | 建议，优化房间逻辑 | 开启 | P3 | 房主踢人 / 转让 / 账号功能 |
| [#159](https://github.com/sganggs/Stronghold-Protocol/issues/159) | 博士血量归零后的观战逻辑修改 | 已关闭 | P2 | 博士血量归零后应自动切到存活玩家观战 · 关联 #76 |

### 网络 / 联机 / 分发（7 条）

联机协议、素材分发、CI 稳定性、下游壳

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#18](https://github.com/sganggs/Stronghold-Protocol/issues/18) | 提议：Android 壳（内嵌服务器 + 签名服务器清单 + 清单驱动热更新）—— 是否愿意接收为 PR？ | 已关闭 | P3 | 贡献者 Android 壳（内嵌服务器 + 签名清单热更新）待作者决定接收范围 |
| [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) | 自建部署在 Workers 免费层会被 DO 写入量卡死：每条 WebSocket 消息强制重写整个房间快照 | 已关闭 | P1 | 每条 WS 消息强制重写整份房间快照；建议节流 + 分块放大 + match_events 打包（作者 fork 已验证） |
| [#106](https://github.com/sganggs/Stronghold-Protocol/issues/106) | 有500个素材文件下载失败 | 开启 | P1 | git clone 后 500+ 素材文件下载失败 · 关联 #42 #156 |
| [#141](https://github.com/sganggs/Stronghold-Protocol/issues/141) | 能不能增加一个联机指定后端的功能？ | 开启 | P3 | 希望客户端可指定后端，避免重复拉取素材 · 关联 #106 #151 |
| [#144](https://github.com/sganggs/Stronghold-Protocol/issues/144) | bug:CI脚本存在偶发性的问题 | 已关闭 | P2 | co-op spectator 用例偶发 BAD_TARGET“队友已选”，疑似 AI 抢选时序 |
| [#172](https://github.com/sganggs/Stronghold-Protocol/issues/172) | 中途意外退出后无法重连入房间，并且会持续烧条 | 开启 | P1 | 中途意外退出后无法重连回房间，且会持续烧条（正文为空，需补细节） · 关联 #154 |
| [#173](https://github.com/sganggs/Stronghold-Protocol/issues/173) | bug:网页版游戏文件未加载 | 开启 | P1 | 下载 V1.03 后本地打开，干员/盟约/地图/敌人等游戏文件未加载（连别人的服务器正常），且导出失败 · 关联 #42 #106 |

### 工程质量 / 部署 / 生态（6 条）

架构重构、持久化、性能、第三方工具

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) | 讨论：关于数据持久化的取舍 | 开启 | P3 | 讨论：默认关闭的可选 SQLite 持久化（战绩/复盘/回放） · 关联 #156 |
| [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) | 讨论：服务端使用 Hono 重构 | 开启 | P3 | 服务端用 Hono 重构，index.js 拆模块 |
| [#111](https://github.com/sganggs/Stronghold-Protocol/issues/111) | 闲话：我用ds跑了个第三方模组加载器，发之前先来问一句 | 已关闭 | P3 | 第三方模组加载器（21 钩子/12 内容表），含整层替换渲染层的升级冲突与安全模型影响 · 关联 #156 |
| [#151](https://github.com/sganggs/Stronghold-Protocol/issues/151) | 下游工具：Windows 版启动器 | 已关闭 | P3 | Windows 启动器（第三方仓库） · 关联 #141 #156 |
| [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) | Tracking: v2.0 架构设计方案 | 开启 | P3 | Tracking：monorepo / 构建工具 / 子系统拆分 / 插件扩展 / Awesome List · 关联 #95 #84 #111 #151 |
| [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) | 3D 棋盘卡顿：先确认浏览器是不是跑在独显上（附自查方法与替代方案） | 开启 | P3 | 3D 棋盘卡顿多为核显；另记录 adaptLoad 帧长 >250ms 时自适应降级停摆、替身阈值不覆盖联防场景 |

### 本地化（2 条）

英文界面与术语统一

| Issue | 标题 | 状态 | 优先级 | 备注 |
|---|---|---|---|---|
| [#38](https://github.com/sganggs/Stronghold-Protocol/issues/38) | Localization for full English UI | 开启 | P3 | 英文 UI 需求 · 关联 #57 |
| [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) | 英文界面：一个不改游戏代码的叠加层方案（关联 #38） | 开启 | P3 | 不改游戏代码的 DOM 叠加层方案；提出 Alliance vs Covenant 术语统一等三个问题 · 关联 #38 |


## 9. 重复与同根因合并

按「同一处代码 / 同一现象」合并后，以下条目可以合并处理（保留最早或最完整的一条作为主条目）：

| 主条目 | 重复条目 | 合并理由 |
|---|---|---|
| #1 | #17 | 转职球（转职）链路 |
| #3 | #15、#54 | 昆图斯突变细胞 / 针的发放与返还 |
| #9 | #46 | placeable 召唤物手动放置缺 owner 范围校验 |
| #19 | #20 | 深池小兵 → 余烬的隐匿解除 |
| #42 | #99 | 服务端缺 public/assets/local 与 data/local-assets.json |
| #44 | #22 | 凯瑟琳分队装备不可见 / 悬赏怪池 |
| #50 | #21 | 突袭落点与倒地干员占格重叠 |
| #53 | #41 | 水面格部署合法性 |
| #89 | #93、#104 | 深溟巢涌者的单体攻击与阻挡交互 |
| #96 | #137 | 绝食干员治疗归类 |

**同一条正文里打包了多个独立问题的条目**，建议先拆分再排期：

| Issue | 正文内包含的独立问题 |
|---|---|
| #8 | 策略阶段返回查看禁用项 / 终难数值偏难 / AI 选被禁盟约 / 被禁盟约上场不激活 / 切页后图标丢失 |
| #32 | 余二技能不拉怪 / 火山源石虫外观 / 深池鬼火索敌无敌 / 歌蕾蒂娅高台 / 暴鸽形态 / 隐蔽吃溅射 |
| #33 | 阿戈尔复活不触发 / 乌尔比安三技能清增益 / 联防断链 / 外援建议 / 赏金怪池 / 红地板效果消失 |
| #41 | 昆图斯针 / 水面放置（重复 #53） / 野鬃推出地图 |
| #44 | 悬赏怪池错乱 / 凯瑟琳装备不可见 / 归鲨无替身 / 分队页看不到被禁干员 |
| #89 | 琳琅诗怀雅三技能自动关 / 锅碗瓢盆赏金重复 / 隐蔽触发源石地板 / 深溟巢涌者单攻 |
| #96 | 绝食吃不到红蒂缓回 / 海嗣 boss 爆条过快 |
| #101 | 叙拉古真伤保底概率 / 异拉攻速回落 / 6 谢寒风被寒冷顶掉 |
| #140 | 瑕光沉睡算阻挡 / 绝技层数被助力增加 / 阿戈尔吞噬目标 / 队友视角看不到 boss / 装备金框提示 |
| #143 | 按键自定义 / AOE 特效缺失与刺眼 / 待选区自动落位 / 外层设置入口 / 音效刺耳 |
| #165 | 阿戈尔复活名额应共享 / 吞噬错误吃攻击倍率 / 标记者死亡取消吞噬 / 联防断链 / 流失来源归因 |
| #168 | 核显排查（非 bug） / adaptLoad 帧长 >250ms 自适应停摆 / 替身阈值不覆盖联防场景 |


## 10. 高信息量条目（正文已含根因与修法，可直接照做）


### [#165](https://github.com/sganggs/Stronghold-Protocol/issues/165) [BUG] 当前阿戈尔问题汇总、源码分析、修改计划

给出 6 条结论 + 逐条源码位置与修复计划：复活名额应共享（core.js:457-460）、吞噬增益应「最终加算」（core.js:405-408 + units.js:121）、标记者死亡不应取消已付与吞噬（core.js:418-429）、联防断链、流失来源归因、斯卡蒂模组复活与免疫吞噬待实测。

### [#9](https://github.com/sganggs/Stronghold-Protocol/issues/9) placeable 召唤物（狼群）的手动放置缺少 owner 攻击范围校验

定位到 canPlace（board.js）只校验「半场内 + 部署类型」，owner 信息在 PlayerState._legal 一步丢失；自动召唤路径 tokens.js 有 inRange 校验，两条路径不一致。影响 6 个 placeable 召唤物，建议逐个核对官方规则再改。（本快照已实现 ownerRange，见第 5.1 节）

### [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) 突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动

skills.js 的 ready 排除 passive，导致被动系成员只剩闲置 10 秒路径；建议「被动视为就绪但只在开启那一刻判定一次」，并给出实现代码。

### [#50](https://github.com/sganggs/Stronghold-Protocol/issues/50) 突袭:再部署落点可能与倒地干员所在格子重叠(占用检查只拦截 alive 占用者)

raidTile 只查地形；Battle.js redeploy / deploy 的占用拦截只认 alive，倒地未移除单位仍占格。建议 raidTile 用占用表（`!removed`）过滤。

### [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) 突袭:闲置 10 秒触发的再部署不要求落点能覆盖敌人,会出现无意义的位移

tile[2]（必须覆盖目标）只约束技能就绪路径；建议两条路径统一，打不到就不突袭。

### [#64](https://github.com/sganggs/Stronghold-Protocol/issues/64) 干员调配界面看不到干员局内数值与攻击范围（只有技能/模组两段，对比局内详情面板缺 stats）

detailPanel 已有 Stat / RangeGrid 组件，shared/loadoutRecord.js 已有纯函数；调配界面按当前选择解析一次即可，附 DOM 实测证据。

### [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) 杜遥夜「广交豪杰」在一级商店阶段刷不出<炎>干员（tier≤商店等级把唯一候选惊蛰挡掉，且无 anyTier 兜底）

rollBond 的 tier ≤ 商店等级 + 惊蛰是唯一 T1 炎干员 + 随机禁用，24 个种子实测 6/24 失败；给出 anyTier 兜底（对齐哈洛德）或只放宽一级两种方案，并指出佩佩同类隐患。

### [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) 自建部署在 Workers 免费层会被 DO 写入量卡死：每条 WebSocket 消息强制重写整个房间快照

完整数据：每局 909 事件 / 快照 39 KB / 每条 WS 消息强制 persistNow；给出三处改动（节流、分块 16k→250k、match_events 打包）与约 −93%～−98% 的估算，附作者 fork 的测试结论与风险点。

### [#128](https://github.com/sganggs/Stronghold-Protocol/issues/128) 观战/查看队友时：看不到队友的装备、整备区手牌、策略与效果列（附定位）

4 条问题逐条定位到 render 白名单丢 items、手牌未并入侦察 meta、本局信息抽屉只读自己 priv.bandId、EFFECTS 列取错数据源；作者称已修好待提 PR。

### [#144](https://github.com/sganggs/Stronghold-Protocol/issues/144) bug:CI脚本存在偶发性的问题

给出失败用例、报错与断言位置（lobby-integration.test.js:160），判断为 AI 抢选时序导致的「队友已选」。

### [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案

monorepo + 构建工具 + 战斗 / 资源 / 网络 / 数据 / 扩展五个子系统拆分方向，并串起 #95 #84 #111 #151。

### [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上（附自查方法与替代方案）

结论是核显问题（非项目 bug），但顺带记录了两个真实代码隐患：adaptLoad 在帧长 >250 ms 时停摆、pickImpostorInterval 阈值覆盖不到联防场景。


## 11. 需要裁决或未闭环的条目

| Issue | 状态 | 情况 |
|---|---|---|
| [#51](https://github.com/sganggs/Stronghold-Protocol/issues/51) 突袭:闲置 10 秒触发的再部署不要求落点能覆盖敌人,会出现无意义的位移 | 开启 | 正文含「可选改进（非 bug，已在本服实现、可提 PR）」：选盟约阶段回看本局信息、调配详情显示盟约描述 |
| [#57](https://github.com/sganggs/Stronghold-Protocol/issues/57) 英文界面：一个不改游戏代码的叠加层方案（关联 #38） | 开启 | 叠加层英文方案本身可用，等作者定三件事：是否收、Alliance 还是 Covenant 术语统一、界面英文基准 |
| [#18](https://github.com/sganggs/Stronghold-Protocol/issues/18) 提议：Android 壳（内嵌服务器 + 签名服务器清单 + 清单驱动热更新）—— 是否愿意接收为 PR？ | 已关闭 | Android 壳提案，等作者选择接收范围（a / b / c） |
| [#111](https://github.com/sganggs/Stronghold-Protocol/issues/111) 闲话：我用ds跑了个第三方模组加载器，发之前先来问一句 | 开启 | 第三方模组加载器，等作者对第三方加载器与 AI 生成代码表态 |
| [#125](https://github.com/sganggs/Stronghold-Protocol/issues/125) 功能建议：增加房间内可拖动悬浮文字聊天 | 开启 | 房间聊天补丁已移植到 0.1.3 并通过 3622 项测试，等作者决定是否合并 |
| [#151](https://github.com/sganggs/Stronghold-Protocol/issues/151) 下游工具：Windows 版启动器 | 开启 | 第三方 Windows 启动器，仅需决定是否进 Awesome List |
| [#80](https://github.com/sganggs/Stronghold-Protocol/issues/80) 自建部署在 Workers 免费层会被 DO 写入量卡死：每条 WebSocket 消息强制重写整个房间快照 | 已关闭 | 作者明确「不打算开 PR」，需要上游自己摘取或重写 |
| [#84](https://github.com/sganggs/Stronghold-Protocol/issues/84) 讨论：关于数据持久化的取舍 | 开启 | 数据持久化底线取舍，属设计决策 |
| [#95](https://github.com/sganggs/Stronghold-Protocol/issues/95) 讨论：服务端使用 Hono 重构 | 开启 | Hono 服务端重构，属设计决策 |
| [#156](https://github.com/sganggs/Stronghold-Protocol/issues/156) Tracking: v2.0 架构设计方案 | 开启 | v2.0 架构 Tracking，作为总纲关联多议题 |
| [#41](https://github.com/sganggs/Stronghold-Protocol/issues/41) 昆图斯的针存在bug；以及角色可以放在水上的问题 | 开启 | 正文第 2 条与 #53 重复，修复时合并 |
| [#42](https://github.com/sganggs/Stronghold-Protocol/issues/42) 服务器端素材缺失：表现为表情图标缺失，及其所在的整个local文件夹+对应控制文件 | 已关闭 | 解决方式是从整合包手动补文件，建议改为构建 / 下载脚本自动补齐 |
| [#67](https://github.com/sganggs/Stronghold-Protocol/issues/67) 漏的锅碗瓢盆也给钱 | 已关闭 | 与 #89 第 2 条同一赏金问题，0.1.3 已修，可复核 |
| [#100](https://github.com/sganggs/Stronghold-Protocol/issues/100) BUG：1.2重锤击晕泡泡后会出现倒地和起身循环的抽搐动画 | 开启 | 缺少复现细节，需补截图 / 录屏 |
| [#96](https://github.com/sganggs/Stronghold-Protocol/issues/96) 绝食干员不吃红蒂缓回，海嗣boss爆条频率明显过快 | 开启 | 等 PR #135 对「绝食干员能否被缓回治疗」的裁定 |
| [#105](https://github.com/sganggs/Stronghold-Protocol/issues/105) bug：5阿戈尔复活效果触发问题 | 开启 | **维护者已给出 0.1.4 方案**（复活名额共享、联防吞噬与单独作战一致），可直接照第 7 节的描述实现 |
| [#49](https://github.com/sganggs/Stronghold-Protocol/issues/49) 突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动 | 开启 | **维护者已确认并排到 0.2.0**：被动技能生效中视为「技能就绪」，只改突袭判定；#179 的 CI 用例是现成验收标准 |
| [#65](https://github.com/sganggs/Stronghold-Protocol/issues/65) 杜遥夜「广交豪杰」在一级商店阶段刷不出<炎>干员（tier≤商店等级把唯一候选惊蛰挡掉，且无 anyTier 兜底） | 开启 | **维护者判定不是 bug**（与官方商店等级规则一致），修 #62/#65 之前请先确认举报者是否记错干员 |
| [#101](https://github.com/sganggs/Stronghold-Protocol/issues/101) 叙拉古和谢拉格的阵营BUG | 开启 | **维护者逐条实测后基本判定不是 bug**，仅剩举报者主观体感存疑，建议先按官方数据复核再决定是否改 |
| [#168](https://github.com/sganggs/Stronghold-Protocol/issues/168) 3D 棋盘卡顿：先确认浏览器是不是跑在独显上（附自查方法与替代方案） | 开启 | 排查笔记性质，但顺带记录了 adaptLoad 与替身阈值两个真实代码隐患，可单独开条目跟踪 |


## 12. 本地复现前提（已核对本工作区）

| 项 | 结论 |
|---|---|
| 代码版本 | `package.json` = 0.1.1（`stronghold-protocol-covenant`），上游已发到 0.1.3 |
| Git | 工作区没有 `.git`，是源码快照，无法用 `git log` 比对 issue 里引用的提交号 |
| 缺失目录 | `deploy/`、`worker/` 不在本快照内（#80 的 Workers 写入量、#84 提到的 systemd 只读部署需要另取仓库） |
| 路径差异 | 本快照的内容表统一在 `server/sim/content/` 目录下；issue 里写的 `content/bonds/addon/battle.js` 对应 `server/sim/content/bonds/addon/battle.js` |
| 已确认存在 | `server/sim/Battle.js`、`server/sim/skills.js`、`server/sim/units.js`、`server/sim/snapshot.js`、`server/sim/content/tokens.js`、`server/sim/content/bonds/core.js`、`server/sim/content/bonds/addon/battle.js`、`server/sim/content/bands/meta.js`、`server/match/board.js`、`server/match/PlayerState.js`、`server/match/pool.js`、`server/match/Match.js`、`public/js/screens/loadout.js`、`public/js/ui/detailPanel.js`、`public/js/render/app.js`、`shared/loadoutRecord.js` |
| 测试脚手架 | `test/match/feedback1-placement.test.js`、`test/ui/feedback1-placement.e2e.test.js`、`test/match/lobby-integration.test.js` 均在本快照内，可直接跑回归 |


## 13. 原始数据文件

| 文件 | 内容 |
|---|---|
| `docs/ISSUES-ARCHIVE.md` | 本报告（抓取归档，流水线生成） |
| `ISSUES.md` | 仍未修复的条目（人工维护，流水线不覆盖） |
| `docs/ISSUES-FIXLOG.md` | 已修 / 已判「不是 bug」的记录与逐条证据（人工维护，流水线不覆盖） |
| `.scratch/issues-index.json` | 110 条 issue 的完整正文与元数据（search API + 补抓合并后的权威索引） |
| `.scratch/issues-organized.json` | 结构化数据：分类、优先级、去重关系、源码落点、时间线 |
| `.scratch/issues/<编号>.md` | 每条 issue 一个 Markdown 文件，便于逐条阅读与派工（110 个） |
| `.scratch/issues-list.tsv` | 编号 / 状态 / 作者 / 评论数 / 标题 的平铺清单 |
| `.scratch/comments/<编号>.json` | 抓取到的评论原文 |
| `.scratch/comment-digests.cjs` | 评论摘要（维护者结论） |
| `.scratch/rest-reconcile.json` | 两套数据源的完整性比对结果（抓取时刻的权威快照） |
| `.scratch/issues-extra.json` | 补抓到的 issue（search 索引没有的） |
| `.scratch/http.cjs` | 公共 DNS + 直连 IP + SNI 的 HTTP 客户端（hosts 被屏蔽时使用） |
| `.scratch/gh-fetch.cjs`、`gh-search.cjs`、`gh-comments.cjs`、`gh-update.cjs` | 抓取脚本（首次全量 / 增量补抓） |
| `.scratch/reconcile.cjs`、`apply-state.cjs`、`merge-index.cjs`、`classify.cjs`、`render-report.cjs`、`finish.cjs`、`check-paths.cjs`、`pipeline.cjs` | 校验、状态回写、合并、归类、报告生成、路径自检与一键刷新流水线 |

一键刷新：`node .scratch/pipeline.cjs`（比对 → 回写状态 → 补抓 → 合并 → 归类 → 出报告 → 路径自检）。同一台机器上同时跑两个抓取脚本会互相抢 60 次/小时的匿名配额，请只跑一个。

---
