# Android APK 与局域网联机

把《卫戍协议：盟约》打包成一个**手机可以直接开服**的 APK：APK 里内嵌了 Node.js 运行时、整个游戏服务器和全部
美术 / 音频素材，装好之后**一台手机点「建立主机」就是服务器**，同一 Wi-Fi 下的其他手机（装同一个 APK，或者
直接用浏览器）打开主机地址就能加入，全程不需要电脑、不需要联网。

同一 Wi-Fi 上开服的手机还会被**自动搜索到**（UDP 广播，见[局域网自动发现](#局域网自动发现)），加入方在首页就能
直接看到「谁在开服、有什么房间」并一键进去——不需要抄 IP。

> [!NOTE]
> 这是本项目官方源码之外的一层 Android 封装，**全部集中在本目录 `android/` 内**。游戏本身的代码
> （`server/`、`shared/`、`public/`、`data/`）**没有做任何修改**，被封装的服务器就是原版服务器；
> 仓库根目录除多了这一个 `android/` 文件夹之外，与原版完全一致。

---

## 目录

- [成品](#成品) · [验证情况](#验证情况) · [安装](#安装) · [怎么联机](#怎么联机) · [局域网自动发现](#局域网自动发现)
- [主机注意事项](#主机注意事项) · [兼容性](#兼容性) · [从源码重新构建](#从源码重新构建) · [工作原理](#工作原理)
- [目录结构](#目录结构) · [排错](#排错) · [已知限制](#已知限制) · [许可与素材](#许可与素材)

---

## 成品

| 项目 | 值 |
|---|---|
| 文件 | `android/dist/Stronghold-Protocol-0.2.1-arm64.apk` |
| 体积 | **633.6 MB**（APK 内 10 646 个条目；0.2.0 的自选干员素材与语音把它从 0.1.4 的 479.9 MB 推上来，0.2.1 又从上游完整整合包补入 39 个召唤物模型，+3.6 MB） |
| 架构 | `arm64-v8a`（只有这一个；2016 年以后几乎所有的 Android 手机） |
| 系统要求 | `minSdkVersion 23`（Android 6.0）／`targetSdkVersion 35`；**建议 Android 8.0 以上**，并保持「Android System WebView」/ Chrome 为较新版本 |
| 内嵌运行时 | Node.js 24.5.0（`lib/arm64-v8a/libnode.so`，约 93 MB，`extractNativeLibs=false`，直接从 APK 加载） |
| 内嵌服务器 | `assets/public/nodejs/`：`server/ shared/ data/ public/ node_modules/ws lan/` + `index.js` |
| 内含素材 | `public/` 整棵树 9 783 个文件 / 约 546 MB（其中 `public/assets/**` 9 603 个文件 / 约 533 MB，含 191 名干员的战斗语音与战斗 BGM、官方 3D 棋盘贴图、39 个召唤物模型，前提是打包时 `public/assets/local/` 已存在） |
| 服务器依赖 | 只有 `ws` |
| 新增权限 | **无**。自动搜索走 UDP 广播，`INTERNET` 权限就够（组播才需要 `CHANGE_WIFI_MULTICAST_STATE`） |
| 发现协议端口 | UDP `45777`（主机广播到这里，加入方监听）与 `45778`（加入方询问，主机监听），见[局域网自动发现](#局域网自动发现) |
| 签名 | 自签名，v1 + v2 方案（`android/android/stronghold-release.jks`，由构建脚本自动生成） |
| 应用名 / 包名 | 卫戍协议：盟约 / `io.github.sganggs.strongholdprotocol` |

另外还可以构建一份**测试版 APK**（`-Variant devtest`，见[测试版 APK](#测试版-apkadjacent)）：同一个游戏、另一个包名
（`…strongholdprotocol.dev`）、应用名「卫戍协议：盟约·测试」、版本号 `0.2.1-dev`，**可以和正式版同时装在手机上**，
并且内嵌服务器的**调试控制台**强制开着。

APK 体积较大的原因是**素材必须随包分发**：主机手机要能在完全离线、不联外网的情况下把素材发给同一 Wi-Fi 里的
其他玩家。这和 Releases 里的「整合包」是同一个思路。

## 验证情况

打包完成后做过的检查（这个 App 只能跑在 arm64 真机上：`libnode.so` 只有 arm64 版本，x86 模拟器装不了）：

- `aapt2 dump badging`：包名、版本、`minSdkVersion 23` / `targetSdkVersion 35`、`native-code: 'arm64-v8a'`、
  `INTERNET` 权限、应用名「卫戍协议：盟约」、启动 Activity 都正确。
- `aapt2 dump xmltree`：`usesCleartextTraffic=true`（局域网是 http，必须）、`largeHeap=true`、
  `hardwareAccelerated=true`，release 包里没有 `debuggable`。
- `apksigner verify`：v1 + v2 签名通过，签名者 `CN=Stronghold Protocol Fan Build`。
- `zipalign -c 4` 与 `zipalign -c -P 16 4` 都通过：**16 KB 页对齐**也满足，Android 15 起 arm64 设备用
  16 KB 内存页，未对齐的 `libnode.so` 会装不上。
- `classes.dex` 里能查到 `MainActivity`、`NodeProcess` 与
  `net/hampoelz/capacitor/nodejs/CapacitorNodeJSPlugin`（也就是 `capacitor.plugins.json` 指向的那个类），
  说明插件类没有被裁掉。
- APK 内容清点：`lib/arm64-v8a/{libnode.so, libnative-lib.so, libc++_shared.so}`、
  `assets/builtin_modules/bridge/**`（Node 侧 `require('bridge')` 用）、`assets/public/{index.html,launcher.js,launcher.css,vendor/*}`、
  `assets/public/nodejs/**`（含自动搜索用的 `lan/{protocol,net,announce,host}.mjs`）、
  `assets/public/nodejs/public/assets/**` 7 200 个素材、`assets/capacitor.config.json`
  里 `server.allowNavigation: ["*"]` 与 `startMode: "manual"` 都在。
- `classes.dex` 里也能查到 `io/github/sganggs/strongholdprotocol/lan/{LanDiscoveryPlugin,LanDiscoveryCore}`
  与 `getHosts`（`@PluginMethod`），且 `assets/public/index.html` 里搜到的房间列表 DOM（`card-lan` /
  `host-list` / `discover-state` / `btn-rescan` / `host-rival`）都在——也就是说自动搜索没有被装配过程丢掉。
- **把 `android/web/nodejs/` 用桌面 Node 直接跑了一遍**：服务器正常启动，`/`、`/healthz`、`/data/*`、
  `/data.js`、`/shared/*`、`/sim/*` 都返回 200，`/sim/nodeData.js` 正确地 404；真实素材
  （`.png` / `.mp3` / `.skel` / `.atlas`）MIME 与大小正确；WebSocket `/ws` 升级成功，发
  `{"t":"hello",...}` 收到了 `{"t":"welcome","playerId":…,"token":…}`。
- **最强的那个检查：把服务器从 APK 里解出来再跑一遍**。按插件的做法（`assets/public/nodejs` →
  `<filesDir>/nodejs/public`，`assets/builtin_modules` → `<filesDir>/nodejs/builtin_modules` 并挂到
  `NODE_PATH`）把 APK 里的那棵树提取出来（10 193 个文件 / 566 MB，与装配结果一致），然后：
  - `require('bridge')` 经 `NODE_PATH` **确实解析到了**（在 Windows 上它走 `process.send` 分支并抛出
    「No IPC channel has been established…」，被入口的 try/catch 接住后照常继续——真机 `process.platform`
    是 `android`，会走 `_linkedBinding('nativeBridge')` 分支）；
  - 服务器正常监听，并打印出真实局域网地址（`http://26.42.62.124:3200`、`http://10.128.158.169:3200`），
    也就是启动器要显示、并通过 `server-ready` 回传给 WebView 的那两个值，说明 `os.networkInterfaces()` 这条路是通的；
  - 所有 HTTP 端点、真实素材、`/ws` 升级全部同前；
  - 连了**两个**客户端，各自拿到不同的 `playerId` 与 `token`——即「多人从局域网加入」在协议层是通的。

  这排除了「APK 打包过程把服务器或素材弄坏」的可能：APK 里那份字节解出来就是一台可用的服务器。
- **真机跑通（2026-10-06，SM-C7000 / Android 8.0）**：把系统 WebView 从 ROM 自带的 66 升到 138 之后，
  这台机器上从启动器一路点到选人全部正常（截图见[兼容性](#兼容性)）。在这之前跑不了是 WebView 太老，
  不是打包问题——同一个 APK、同一台机器，只换了 WebView。

### 自动搜索的验证

`node android/scripts/lan-verify.mjs` 会跑四段检查，全绿（`android/scripts/lan-verify.mjs` 自己就是这套检查的
实现，随源码一起提交，可以随时重跑）：

| 段 | 检查什么 | 结果 |
|---|---|---|
| 1 protocol | Node 广播端 ↔ Node 搜索端（走回环，私有端口） | instance id、游戏端口、房间列表（含 `inMatch`）全部原样到达 |
| 2 java | Node 广播端 ↔ **APK 里那个 Java 搜索端**（用 JDK 现场 `javac` 编译后直接 `java` 运行） | 同一份 `LanDiscoveryCore.java`，在桌面 JVM 上正确解出了 JS 写出的 ID 与房间列表 |
| 3 broadcast | 换成真正的 `255.255.255.255` / 子网定向广播（不走回环捷径） | 本机收到（`255.255.255.255, 26.255.255.255, 192.168.43.255`） |
| 4 host | **真服务器 + 真广播端 + 真 WebSocket 客户端建房间** | 搜索方被告知了刚建出来的房间码（`SQVM`、`GLDC` 等），也就是「一键加入 ABCD」这条数据链是通的 |

第 2 段是这里最有价值的一步：自动搜索被实现了两遍（JS 广播、Java 搜索），而**手机上跑不了测试**，所以把
Java 那份挪到桌面 JVM 上、对着真正的 JS 广播端跑，等于在没有真机的情况下验证了「两边说的是同一种话」。
`android/test/lan-protocol.test.js` 里还有一组测试直接读 `LanDiscoveryCore.java`，断言常量（魔数、版本、两个端口、
体积上限）和 JS 那份一致——防止以后只改了一边。

另外用 `node android/scripts/lan-tool.mjs announce` + `scan` 做过一次跨进程实测：一个进程当主机、另一个进程搜索，
在 `192.168.43.253` 与 `26.42.62.124` 两个网卡上都搜到了，房间码与人数字段正确。

- **仍未验证**的部分（只能在真机上确认）：Android 的 `AssetManager` 把约 543 MB 素材解压到私有目录的实际过程、
  WebView 从启动器导航到局域网地址、**Capacitor 把 `LanDiscovery` 插件暴露给启动器页面的那一段**、手机 Wi-Fi 上
  的 UDP 广播收发、以及真机上的完整对局。见[排错](#排错)。

## 安装

1. 把 APK 传到手机（数据线、微信文件传输、网盘、`adb install` 都行）。
2. 在手机上点开安装。系统会提示「来自未知来源的应用」，按提示允许（这是自签名 APK 的正常提示）。
   - 用 `adb`：`adb install -r android\dist\Stronghold-Protocol-0.2.1-arm64.apk`
3. 首次启动会稍慢：点「建立主机」后，应用要把约 543 MB 的游戏文件从 APK 里解压到自己的私有目录
   （界面上会显示「正在准备游戏文件（已用 N 秒）」）。**这一步每个版本只做一次**，之后再启动就很快。

## 怎么联机

> [!IMPORTANT]
> **所有人必须在同一台服务器上。** 两台手机都点「建立主机」会得到两个**互不相通**的游戏：房间存在服务器的内存里
> （`server/lobby.js` 的 `Map`），客户端连的是 `ws://<当前页面地址>/ws`，两个服务器之间没有任何通道，协议上也不
> 可能让它们进同一局。想一起玩，就**一台点「建立主机」，其他全部点「加入房间」**。
> 从第一个安卓包（0.1.1）起，开服的那台手机会自动出现在别人的首页列表里；如果两台都开了服，主机界面上也会直接提示
> 「同一 Wi-Fi 上还有另一台主机」。

### 主机（开服的那台手机）

1. 打开应用 → **建立主机** → 等待解压和启动完成。
2. 界面会列出形如 `http://192.168.1.23:3000` 的局域网地址，以及一个「复制地址」按钮。同一 Wi-Fi 下的朋友
   **打开应用就能在首页看到这台主机**，不需要你抄地址给他们；想手动发也可以复制地址。
3. 点「进入游戏」。进游戏后创建房间（**同盟模拟** → 创建房间），房间里的「复制链接」还会复制出
   `http://192.168.1.23:3000/?room=密钥` 这样的完整邀请链接，发给朋友最省事。

> 主机进入游戏后使用的是自己的**局域网地址**而不是 `127.0.0.1`，就是为了让房间里的「复制链接」生成朋友能直接
> 打开的地址。如果个别路由器不允许设备访问自己的局域网 IP，主机卡片下方有一个
> 「局域网地址进不去？改用本机地址进入」的备用入口。

### 主机（用电脑开服，可选）

如果主机是**电脑**而不是手机，**不要直接用 `npm start`**：原版服务器不会广播任何东西，手机自然搜不到它
（广播端只在内嵌 APK 的 Node 入口里，原版服务器一个字节都没改）。用同一个广播端开服即可：

```powershell
node android\scripts\host-with-lan.mjs                        # 等价于 npm start，外加广播
node android\scripts\host-with-lan.mjs --port 3000 --name "客厅电脑"
```

它会照常打印局域网地址，并且**必须再放行一次 Windows 防火墙**，否则手机能搜到却打不开页面：

```powershell
netsh advfirewall firewall add rule name="Stronghold Protocol 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
```

这一步的原理值得知道：广播是**出站**流量，防火墙不拦，所以「能搜到」和「能打开」是两件独立的事——能搜到但一直
转圈，就是入站 TCP 被挡了。（和原版 [docs/DEPLOY.md](../docs/DEPLOY.md) 第 1.2 节说的同一条规则；手机开服没有
这个问题，Android 没有这种入站规则。）

如果服务器已经在用别的方式跑了，也可以只补一个广播端：`node android\scripts\lan-tool.mjs announce --port 3000`。
但它读不到另一个进程的大厅，**广播里没有房号**，朋友得自己看你屏幕上的 4 位密钥；`host-with-lan.mjs` 才在同一个
进程里，能把房号一起播出去、让手机上直接出现「加入 ABCD」按钮。

### 加入的朋友

打开应用，**首页会自动列出同一 Wi-Fi 上正在开服的主机**，以及它当前有哪些房间：

```
同一 Wi-Fi 上正在开服的房间                              找到 1 台
  Pixel 7 的主机   192.168.1.23:3000
  1 个房间可以加入
  [ 加入 ABCD（2/4） ] [ 只进大厅 ]
```

点房间按钮会直接以 `?room=ABCD` 进游戏（游戏客户端会自动加入该房间），点「只进大厅」则进大厅自己建房/填密钥。
搜索是自动的，也可以点「重新搜索」手动刷新。

三种方式，任选：

| 方式 | 怎么做 | 适合 |
|---|---|---|
| **自动搜索**（推荐） | 打开应用 → 首页列表里点房间 → 自动进入 | 朋友也装了这个 APK |
| **同一个 APK，手输地址** | 打开应用 → **加入房间** → 填 `192.168.1.23:3000`（或粘贴主机发来的完整链接）→ 连接 | 搜索不到时的兜底（访客网络、跨网段、VPN） |
| **直接用浏览器** | 手机 / 电脑浏览器打开 `http://192.168.1.23:3000/?room=密钥` | 朋友没装 APK；电脑上玩也行 |

打开页面后输入昵称 → 同盟模拟 → 加入房间（链接里带 `?room=` 时会自动填好密钥）。

其他细节和网页版完全一致：最多 4 人合作，空位可以加 AI，断线 10 分钟内重开页面可以回到原座位。玩法见
[docs/PLAYING.md](../docs/PLAYING.md)。

## 局域网自动发现

### 为什么需要它

游戏是**单服务器权威**结构：

- `server/lobby.js` 把房间存在**进程内的 `Map`** 里（`this.rooms = new Map()`），房间码只是这台服务器上的一个键；
- `public/js/net.js` 的 `defaultWsUrl()` 是 `` `${scheme}://${location.host}/ws` ``，也就是「连我正在浏览的这台服务器」。

所以两台手机各自开服，就是两台**互不知情**的服务器：A 的房间对 B 不存在，任何协议层的努力都变不了这一点
（除非把两个服务器做成联邦，那等于重写游戏）。唯一能让两拨人进同一局的办法，是**让其中一方不再当服务器，而是当
另一方的客户端**——自动搜索就是把这一步从「抄 IP、手输」变成「点一下」。

### 谁在广播

只有**真正在当主机的那个进程**会广播，所以：

| 主机是谁 | 广播从哪来 | 命令 |
|---|---|---|
| 手机 App | APK 内嵌的 Node 入口（`lan/host.mjs`） | 点「建立主机」即可，自动的 |
| 电脑 | **必须显式启动广播端**（原版 `npm start` 不广播） | `node android\scripts\host-with-lan.mjs` |
| 电脑，服务器已经在别处跑着 | 单独的广播端（**没有房号**） | `node android\scripts\lan-tool.mjs announce --port 3000` |

这是最容易踩的坑：`npm start` 起来的是一台**完全沉默**的服务器，手机搜不到不是搜索坏了，而是那边根本没人说话。
（原版服务器不改一行代码是这个封装的前提，所以广播只能外挂。）

### 怎么实现的

```
主机手机                                        加入的手机
┌──────────────────────────────┐               ┌──────────────────────────────┐
│ Node 24（内嵌）               │               │ WebView（启动器页面）         │
│  server/index.js  ← 原版服务器 │               │  └ Capacitor 插件             │
│  lan/announce.mjs ← 广播端    │               │      LanDiscoveryPlugin       │
│      │ 每 2 秒广播 `here`      │               │       └ LanDiscoveryCore.java │
│      │ 并回答 `who`            │               │          每 2.5 秒广播 `who`   │
└──────┼───────────────────────┘               └──────────┼───────────────────┘
       │  UDP → 255.255.255.255:45777                        │  UDP → :45778
       │  以及每张网卡的子网定向广播（如 192.168.1.255）        │
       └────────────────────────────────────────────────────►│
       ◄────────────────────────────────────────────────────┘
              `here` 里带着：主机名、游戏端口、房号列表、人数
```

- **两个端口，不是一个**：`45777` 是主机广播的目的端口（加入方 `bind` 它），`45778` 是加入方询问的目的端口（主机
  `bind` 它）。同一台设备上两个 UDP socket 不能绑同一个端口，而**主机自己也在搜索**（用来提示「同一 Wi-Fi 上还有
  另一台主机」），所以必须分开。
- **报文**是一段 UTF-8 文本，一行一个 `key=value`（`sp=splan` / `v=1` / `t=here|who` / `id` / `name` / `port` /
  `rooms`）。**故意不用 JSON**：搜索端是 Java 写的，而它必须能脱离 Android 用桌面 JVM 跑起来做验证
  （见[验证情况](#自动搜索的验证)），行格式在两种语言里各 20 行就能解析，Java 里塞一个 JSON 解析器不值得。
  单个报文 < 200 字节，最多播 8 个房间。
- **频率与超时**：主机每 2 秒广播一次，加入方每 2.5 秒问一次（这样打开首页几乎立刻有结果，不用等下一次广播），
  8 秒没收到就把它从列表里移除。一个包 200 字节、2 秒一次，对续航的影响可以忽略。
- **房间码**：`lan/protocol.mjs` 的 `roomListFromLobby()` 只**读** `lobby.rooms`（公开字段），把每个房间的
  房号 / 模式 / 难度 / 人数 / 是否对局中放进广播里，于是加入方可以一键 `?room=ABCD` 直接进房
  （`public/js/main.js` 本来就会记住并自动加入 `?room=`）。所有读取都包在 `try/catch` 里，以后大厅内部结构变了
  只会退化成「不显示房号」，不会把主机拖崩。
- **搜索端为什么会话在 Java 里**（而不是复用内嵌的 Node）：`NodeJS.start()` 每次都会把约 543 MB 素材从 APK
  复制到私有目录——插件的 `FileOperations.CopyAssetDir` 对每个文件无条件重写，没有任何「已存在就跳过」的判断。
  而加入方本来是**最轻**的路径（不需要服务器），如果为了听一个 UDP 包就先解压整个游戏，体验会明显变差。所以
  搜索端是 `LanDiscoveryCore.java`（只用 `java.net`，不依赖 Android，也就能在桌面 JVM 上验证）
  + `LanDiscoveryPlugin.java`（Capacitor 桥）。

### 可行性评估

**结论：可行，而且已经做进 APK。** 这是逐个技术选择的实际判断：

| 方案 | 判断 |
|---|---|
| **UDP 广播**（采用） | 同一个子网内几乎总是通的；**不需要任何新权限**（`INTERNET` 就够，只有组播才需要 `CHANGE_WIFI_MULTICAST_STATE`）；报文里能带房号等结构化信息 |
| mDNS / Android `NsdManager` | 能跨子网、更「标准」，但 Android 上多播被 AP 过滤 / 省电模式掐掉的情况很多，`NsdManager` 历史上 bug 不少，而且解析服务还得自己写。收益（跨子网）对本项目意义不大——跨子网本来就该手输地址或走 VPN |
| 网段扫描 + HTTP 探测 | 在 WebView 里做不了：跨源 `fetch` 的响应体读不到（`/healthz` 没有 CORS 头），`mode:'no-cors'` 只能知道「有东西应答」，分不清是不是游戏服务器；254 个并发请求在手机上也又慢又费电 |
| 让内嵌 Node 同时当搜索端 | 可行但代价大：见上面的 543 MB 复制问题。加入方不该为了搜索先解压游戏 |

**可靠的部分**（已验证，见[自动搜索的验证](#自动搜索的验证)）：报文格式、解析、广播地址计算、超时与去重、
「真服务器 + 真广播端 + 真房间码」这条链，以及 Java 那份代码在桌面 JVM 上对着真 JS 广播端的行为。

**不可靠 / 有边界的部分**（设计上已经接受，并保留了手输地址这条兜底路径）：

- **只在同一个广播域内有效**。跨网段、跨 VLAN，或者走 Tailscale / ZeroTier 这类点对点 VPN 时，广播可能根本不到
  对端。这些场景本来就要按 [联机方式](../README.md#联机方式) 里写的用虚拟 IP 手输地址。
- **AP 隔离**（访客 Wi-Fi、酒店、部分校园网）会同时挡掉广播和 HTTP，两种方式都进不去。
- **部分路由器**的 Wi-Fi 省电 / 多播转换会丢广播包。所以是「每 2 秒重复 + 可手动刷新」，而不是「播一次就等」。
- **固定端口**：同网段的其他设备也用这两个端口不影响（每台设备的端口空间是独立的）；但**同一台设备**上如果有别的
  进程占了 `45777/45778`，广播会失败——这时主机卡片上会显示具体的 socket 错误，加入方仍可手输地址。
- **设备有多张网卡时会重复发现**（Wi-Fi + VPN + 热点）。启动器会按主机 id 合并成一行，并优先使用 `192.168` /
  `10.` / `172.16-31.` 这类常规局域网地址，其余地址折叠成「（另有 …）」。
- **任何在同一 Wi-Fi 上的人都能看到广播**（包括房号），和 HTTP 服务器本身的暴露面一致：只把地址发给朋友，
  不要公开发布。
- 应用进入后台时双方都会停止收发广播（`LanDiscoveryPlugin` 在 `handleOnPause` 里停、`handleOnResume` 里恢复；
  Node 进程随服务器一起活）。

### 相关命令

```powershell
# 完整的自动搜索验证（四段，含 Java 那份代码在桌面 JVM 上跑）
node android\scripts\lan-verify.mjs

# 电脑开服 + 广播（手机是玩家时用这个，不要用 npm start）
node android\scripts\host-with-lan.mjs --port 3000 --name "客厅电脑"

# 从电脑上看手机有没有在广播（手机没有控制台，这是唯一的观察窗口）
node android\scripts\lan-tool.mjs scan --seconds 6

# 哪一边断了？网卡 / 广播目标 / 听到什么 / 本机服务器是否在应答
node android\scripts\lan-tool.mjs doctor --port 3000

# 服务器已经在别处跑着，只补广播（没有房号）
node android\scripts\lan-tool.mjs announce --port 3000 --name "客厅主机" --room ABCD

# 单元测试
node android\test\lan-protocol.test.js
```

`doctor` 会把三类失败分开显示，因为它们在手机上看起来一模一样（「搜不到 / 打不开」）：

1. **本机网络**——列出每张网卡的地址与它将使用的广播目标。手机和电脑共用的那个网段必须出现在「广播目标」里
   （多网卡时尤其要看：VPN 的 `26.x`、`100.x` 也在这里）。
2. **听 N 秒**——本机现在能听到哪些主机的广播。什么都不显示 ⇒ 反方向（手机→电脑）不通，或者对端没有广播。
3. **本机服务器**——对 `127.0.0.1` 和每张网卡的 `http://<IP>:<端口>/healthz` 各发一次请求。回环通、局域网地址
   不通 ⇒ 服务器没绑到 `0.0.0.0`（本项目的启动方式不会，但换过启动脚本就可能）。

## 主机注意事项

- **主机手机必须是「服务器」本身**：主机关掉应用（或在后台被系统回收）所有对局就结束了。服务器把房间存在内存里，
  没有存档。
- 主机和朋友必须在**同一个 Wi-Fi / 同一个路由器**下；访客网络常开启「AP 隔离」，会导致朋友连不上。
- 主机建议插着电、屏幕别让它睡太久。第一次启动记得把地址先发给朋友再进游戏。
- 手机上没有防火墙要配置（Windows 那套 `netsh advfirewall` 不适用于 Android）。

## 兼容性

- **只支持 arm64-v8a**。这是内嵌运行时的限制：`@jadejr/capacitor-nodejs` 只提供 `arm64-v8a` 的 `libnode.so`。
  2016 年之后的手机基本都是 arm64；很老的 32 位机型装不上。
- **x86 / x86_64 模拟器跑不了**（同样因为没有对应架构的 `libnode.so`）。想在电脑上跑请直接用原版的
  `npm start`，见 [README](../README.md)。
- **需要较新的系统 WebView（Chrome ≥ 80），否则整机前端都不执行。** 前端用了可选链 `?.` 与空值合并 `??`
  （`public/js/**` 里大量出现，例如 `screens/game.js` 113 处、`ui/console.js` 42 处），`android/web/launcher.js`
  里还有数字分隔符 `120_000`（Chrome 75+）。WebView 版本不够时：**首页的静态 HTML 仍会画出来，但
  `launcher.js` 与游戏本体都解析失败，点「建立主机」毫无反应**（只有一个 CSS 聚焦环），
  看起来像「点了没反应」而不是报错。
  - **本机实测设备 SM-C7000（Android 8.0，ROM 自带 WebView `66.0.3359.126`，无 Play 商店、`lastUpdateTime`
    是 ROM 的占位值，从未更新过）原先正是这个状态**：用 CDP 在该 WebView 里自测，数字分隔符 / 可选链 / 空值合并
    **全部** `SyntaxError`，`Object.fromEntries`、`Array.prototype.flatMap`、`String.prototype.replaceAll`
    **都不存在**（即 2018 年的 Chrome 66 水平）。这台手机上的 Android 版从 0.1.1 起就没能进过游戏
    （`test/e2e/out/device-launch-0.1.*.png` 四张「启动正常」截图都是同一张静态首页，274799 B）——这是 WebView
    版本问题，不是打包问题。桌面 / 局域网版不受影响。
  - **2026-10-06 已解决**：给这台机器侧载了 Google 原签名的 `com.google.android.webview 138.0.7204.181`
    （Android 8/9 能用的最后一档，139 起 `minSdk` 提到 29），**真机上完整流程跑通**：启动器 →
    建立主机（服务器就绪、列出局域网地址）→ 进入游戏 → 协议选择 → 独立模拟休息室 → 战前简报 → 选人。
    UA 已经是 `Chrome/138.0.7204.181`，能力探针全绿；证据截图见
    `test/e2e/out/device-launch-0.1.3-wv138.png`（启动器，和上面那张 274799 B 的静态首页对照着看：
    搜索状态文字、提示语、按钮交互都是脚本画出来的）、`device-game-landscape-wv138.png`（游戏首页）、
    `device-solo-prep-wv138.png`（独立模拟休息室）、`device-draft-wv138.png`（选人）。
    怎么升、怎么回滚见[升级系统 WebView](#升级系统-webview没有-play-商店的机型)。
  - **坑：不能装只有 arm32 的 WebView 包**。这个 App 是 arm64-v8a（`libnode.so` 只有 arm64），而系统 WebView
    属于「已更新的系统应用」：只装 `..._min26_arm32.apk` 时 `primaryCpuAbi=armeabi-v7a` 且
    `secondaryCpuAbi=null`，于是每个 **64 位**进程加载 WebView 都会
    `UnsatisfiedLinkError: .../lib/armeabi-v7a/libwebviewchromium.so is 32-bit instead of 64-bit`
    （框架还会弹「Android System WebView 已停止运行」），**App 直接全黑**——
    `test/e2e/out/device-check-wv133-launch.png` 就是那张黑屏。换成带 arm64 的包之后
    `primaryCpuAbi=armeabi-v7a` / `secondaryCpuAbi=arm64-v8a`，32 位和 64 位应用都能用。
  - 排查手法（release 包默认开着 WebView 调试）：`node android\scripts\device-cdp.mjs --default`
    会自己找 `@webview_devtools_remote_<pid>`、建 `adb forward`、跑一组能力探针（UA / 数字分隔符 /
    可选链 / 空值合并 / `Object.fromEntries` / `flatMap` / `replaceAll`）。也可以
    `node android\scripts\device-cdp.mjs --list` 看当前页面，或
    `node android\scripts\device-cdp.mjs 'document.getElementById("btn-host").click()'` 直接驱动界面。
    注意 WebView 太老时 `input tap` 只能点亮 CSS 聚焦环，`document.querySelector(...).click()` 也没反应，
    都属于「脚本没跑起来」。
- 画面用 WebGL 渲染，老设备可以在游戏「设置」里调低画质，或访问时加 `?board=2d`。

### 升级系统 WebView（没有 Play 商店的机型）

国产 ROM / 无 GMS 的机器上系统 WebView 可能还停在 2018 年，而且**没有 Play 商店就升不了**（本机 SM-C7000 就是：
`pm list packages` 里没有 `com.android.vending`）。侧载即可，仓库里有脚本：

```powershell
pwsh -NoProfile -File android\scripts\webview-update.ps1        # 读设备 API 级别 → 下载 → 安装 → 打印验证
pwsh -NoProfile -File android\scripts\webview-update.ps1 -DownloadOnly -AndroidVersion 26   # 不插手机，先下包
pwsh -NoProfile -File android\scripts\webview-update.ps1 -Apk D:\dl\webview.apk             # 装现成的包
```

它钉住的构建都是 Google 原签名的 `com.google.android.webview`，来自
[kiosk-satellite-apk-mirror](https://github.com/davidcoulson/kiosk-satellite-apk-mirror)（release 资产 URL 固定、
README 公布校验和；同一批构建在 [JonaNorman/WebViewPackage](https://github.com/JonaNorman/WebViewPackage) 也有存档）：

| 设备 API | 版本 | 文件 | ABI | SHA-256 |
|---|---|---|---|---|
| 26–28（Android 8.0–9） | 138.0.7204.181 | `google-webview-138.0.7204.181.apk`（212 MB） | arm64-v8a + armeabi-v7a | `ef90254b3fd31edfc8c8cd35dbfbc4d81a2a4554a278b5cad9d4acfdd85e59ca` |
| 32+（Android 12L+） | 153.0.8010.36 | `google-webview-153.0.8010.36.apk`（256 MB） | arm64-v8a + armeabi-v7a | `fc03b62418543ec2027b0a2a02af4887eebd2b1e394e5403f8cde62823582034` |

几件容易踩的事：

- **只认 `com.google.android.webview`**：本机 framework 的白名单里就这一条
  （`aapt2 dump xmltree android\.build\webview-update\framework-res.apk --file res/xml/config_webview_packages.xml`，
  从设备 pull 出的 `framework-res.apk`）。LineageOS / Cromite / Mulch 那些 `com.android.webview` 构建装上去
  也不会被选为 WebView 提供者——包名都不同，装了只是多一个 WebView。
- **版本上限由设备 API 决定**：139 起 `minSdk` 提到 29，所以 Android 8/9 最高就是 138（该包 `maxSdkVersion=28`）。
- **必须选带 arm64 的包**（原因见上一条）。装完确认一次：
  `adb shell dumpsys package com.google.android.webview | Select-String primaryCpuAbi`，要能看到
  `secondaryCpuAbi=arm64-v8a`。
- **下载很慢，脚本已经处理**：本机到 `objects.githubusercontent.com` 单连接只有 20–40 KB/s（212 MB 得下 6 小时），
  所以脚本拆成 1.5 MB 分片、16 个并发连接抓（直连实测 ~0.2–0.5 MB/s，走 `gh-proxy.com` 镜像 ~1 MB/s，
  每三次尝试会换一次镜像），**断点续传**：分片留在
  `android\.build\webview-update\<文件名>.chunks\`，重跑跳过已完成的分片，全部到齐才拼接并校验 SHA-256。
- **回滚**：`android\.build\webview-update\system-webview-66.apk` 是从这台机器 `/system/app/WebViewGoogle`
  拉下来的原始包，`adb install -r -d <它>` 即可退回 ROM 自带的 66（签名相同、版本更低，所以要 `-d`）。

## 从源码重新构建

### 前置条件

- Windows + PowerShell 7（`pwsh`）
- Node.js 22 或 24
- JDK 17 以上（构建脚本会自动从 `PATH` 上找 `java`）
- 仓库根目录已经执行过 `npm install` 和 `npm run setup`（需要 `public/assets`，约 530 MB）
- **磁盘**：`android/.build/`（Android SDK + NDK + Gradle，约 4 GB）+ `android/web/nodejs`（约 563 MB）
  + `android/android/app/src/main/assets/public`（又一份约 563 MB）+ 构建中间产物。建议预留 12 GB。

> 不需要预装 Android Studio。下面的脚本会把 Android SDK、NDK、CMake、Gradle 全部装到仓库内的
> `android/.build/`，不写用户目录，也不需要管理员权限；不需要时删掉 `android/.build/` 即可。

### 两条命令

下面所有命令都在**游戏仓库根目录**执行（脚本会自己找 `android/` 和游戏源码的位置）。

```powershell
# 1. 安装 Android SDK / NDK / CMake（约 2.7 GB，只需一次）
pwsh -NoProfile -File android\scripts\setup-sdk.ps1

# 2. 装配 web/nodejs + 同步原生工程 + 打签名 APK（一步到位）
pwsh -NoProfile -File android\scripts\build-apk.ps1
```

`build-apk.ps1` 会依次做四件事，每一步也可以单独跑：

| 步骤 | 单独执行 | 说明 |
|---|---|---|
| 1 | `node android\scripts\assemble-nodejs.mjs` | 把 `server/ shared/ data/ public/` 和 `node_modules/ws` 镜像到 `android/web/nodejs/`，并写入内嵌服务器的入口 `index.js` |
| 2 | `cd android; npx cap sync android` | 把 `web/` 复制进 `android/android/app/src/main/assets/public/`，并刷新插件接线 |
| 3 | `cd android\android; .\gradlew.bat assembleRelease` | 编译 APK（用 `gradlew` 需要 Gradle 能从 `services.gradle.org` 下载发行包，见下方说明） |
| 4 | — | 把 APK 复制到 `android/dist/` |

常用开关：

```powershell
pwsh -File android\scripts\build-apk.ps1 -SkipAssemble    # 第 1 步没改动时跳过（快）
pwsh -File android\scripts\build-apk.ps1 -SkipSync        # 跳过第 2 步
pwsh -File android\scripts\build-apk.ps1 -DebugBuild      # 出 debuggable 的 APK
pwsh -File android\scripts\build-apk.ps1 -Clean           # 先 gradle clean
pwsh -File android\scripts\build-apk.ps1 -Variant devtest  # 出可共存的测试版 APK（见下）
```

### 测试版 APK（可与正式版共存）

`-Variant devtest` 用同一棵树打出**第二个 App**，装到手机上不会覆盖正式版：

| | 正式版（默认） | 测试版（`-Variant devtest`） |
|---|---|---|
| 产物 | `android/dist/Stronghold-Protocol-0.2.1-arm64.apk` | `android/dist/Stronghold-Protocol-0.2.1-dev-arm64.apk` |
| 包名 | `io.github.sganggs.strongholdprotocol` | `io.github.sganggs.strongholdprotocol.dev` |
| 应用名 | 卫戍协议：盟约 | 卫戍协议：盟约·测试 |
| 版本名 | `0.2.1` | `0.2.1-dev`（versionCode 相同） |
| 内嵌服务器的调试控制台 | 服务器默认 `auto`：**本机**（App 自己的 WebView）有控制台 | `SP_CONSOLE=1`：**所有**连到这台测试版 App 的客户端都有（包括局域网里加入的朋友） |
| 签名 | 同一个自签名密钥 | 同一个自签名密钥 |

```powershell
# 打包测试版（不动 dist/ 里的正式版；产物是另一个文件名）
pwsh -NoProfile -File android\scripts\build-apk.ps1 -Variant devtest
```

调试控制台本身见 [DESIGN §21.33](../docs/DESIGN.md) 与 [PLAYING.md §11](../docs/PLAYING.md)：右下角的终端按钮或
`` ` `` 键，可以任意获得干员 / 装备、改资金、盟约层数与调度中心等级。测试版把它强制打开是为了「测试时随手造状态」，
正式版保持服务器自己的规则（只有本机客户端有），这样和朋友联机时不会突然变成作弊器。

两个 App 各自的自动搜索、建服、联机互不影响（包名不同 = 两个独立应用）；**测试版和正式版各自开服仍然是两个
互不相通的服务器**，局域网里想一起玩还是只有一台当主机。

改完启动器 / 自动搜索之后，`android/package.json` 里还有几个脚本（都可以在仓库根目录直接 `node` 调用）：

```powershell
node android\test\launcher.test.js        # 启动器 31 项检查
node android\test\lan-protocol.test.js    # 广播协议 37 项检查（含 Java/JS 常量一致性）
node android\scripts\lan-verify.mjs       # 四段自动搜索验证，见「局域网自动发现」
node android\scripts\host-with-lan.mjs    # 电脑开服 + 广播（排查「手机搜不到电脑」）
node android\scripts\lan-tool.mjs doctor  # 分开显示网卡 / 广播 / 本机服务器三件事
```

### 关于 Gradle（只影响本机这个沙箱环境）

在这台机器上 `gradlew` 无法自己下载 Gradle，因为 `services.gradle.org` 会 307 跳到 GitHub Releases，而
`github.com` / `release-assets.githubusercontent.com` 下发的证书链**缺少中间证书**——Windows Schannel 会通过
AIA 自动补齐，OpenSSL（Node）和 JDK 都不会。所以 `build-apk.ps1` 不调用 `gradlew`，而是：

1. 用 Node 下载同一个 Gradle 发行包（先试官方地址并开启 Node 24 的 `--use-system-ca`，失败则回退到
   `mirrors.cloud.tencent.com` / `mirrors.huaweicloud.com`）；
2. 用 Gradle 官方发布的 `.sha256` 校验；
3. 解压到 `android/.build/gradle-<版本>` 并直接调用。

依赖解析不受影响：`repo.maven.apache.org`、`dl.google.com`、`plugins.gradle.org` 的证书链都是完整的。
在正常的网络环境下直接 `cd android\android; .\gradlew.bat assembleRelease` 也可以。

### 改签名 / 换包名

- 签名：删掉 `android/android/stronghold-release.jks` 和 `keystore.properties` 重新跑构建脚本，或自己改
  `keystore.properties`。正式对外分发请换成自己妥善保管的密钥。
- 包名 / 版本：`android/capacitor.config.json` 的 `appId`、`android/android/app/build.gradle` 的
  `versionCode` / `versionName`。测试版的后缀（`.dev` 包名、`-dev` 版本名）在同一个文件的 `devtest` build type 里。
- 应用显示名：`android/android/app/src/main/res/values/strings.xml` 的 `app_name`（测试版是
  `android/android/app/src/devtest/res/values/strings.xml`，覆盖同一项）。

## 工作原理

```
┌─────────────────────── 主机手机（Android） ───────────────────────┐
│  Capacitor Activity                                               │
│   ├─ WebView ──────────────► http://<局域网IP>:3000/             │
│   │    （游戏客户端：PixiJS + pixi-spine + three.js）             │
│   ├─ LanDiscoveryPlugin ──► LanDiscoveryCore.java                 │
│   │    （加入方：UDP 搜索局域网上的主机，见「局域网自动发现」）      │
│   └─ @jadejr/capacitor-nodejs                                     │
│        └─ 内嵌 Node.js 24 (libnode.so)                            │
│             └─ web/nodejs/index.js                                │
│                  ├─ lan/host.mjs                                  │
│                  │    ├─ server/index.js  ← 原版服务器，未做修改   │
│                  │    │    ├─ HTTP 静态服务：public/ data/ shared/ sim/
│                  │    │    └─ WebSocket /ws：大厅 + 对局引擎       │
│                  │    └─ lan/announce.mjs ← 广播端（UDP 45777/45778）
└───────────────────────────────────────────────────────────────────┘
              ▲                              ▲
              │ http://<IP>:3000             │ ws://<IP>:3000/ws
   其他手机（同一个 APK：自动搜索 +「加入房间」，或任意浏览器）
```

几个关键点：

- **原版服务器零修改**。`server/index.js` 用 `import.meta.url` 推算仓库根目录，所以只要 `server/`、`shared/`、
  `data/`、`public/` 保持同级，它就当自己是原版项目，默认端口 3000、监听 `0.0.0.0`。自动搜索也没有动它：
  广播端是 `web/nodejs/lan/` 里新增的独立模块，只**读**大厅的公开字段（见[局域网自动发现](#局域网自动发现)）。
- **两件事在 Android 侧，两件事在 Node 侧**：游戏服务器和广播端在 Node 里；启动器界面和 UDP 搜索在 WebView / Java 里。
  这样加入方（不跑服务器的那台）不需要先解压 394 MB 素材就能搜到主机。
- **启动顺序**：启动器页面（Capacitor 本地页面）先 `NodeJS.start()`，插件把 APK 里的
  `assets/public/nodejs/**` 解压到 `/data/data/<包名>/files/nodejs/public/`，然后启动 Node；Node 侧用内置的
  `bridge` 模块把 `server-ready`（含端口、局域网地址、主机名、广播状态）回传给启动器；启动器再把 WebView 导航到
  `<局域网IP>:3000`。CSS/JS 里的 `capacitor.config.json` `server.allowNavigation: ["*"]` 就是为此需要的。
  搜索则是独立的：`LanDiscovery` 插件的 `start()` 一进首页就调用，进游戏前 `stop()`。
- **战斗仍然在各玩家的浏览器（WebView）里模拟**，服务器只负责回合、经济和校验——和原版设计一致，所以手机当
  主机也不会被 3 个战场的模拟压垮。
- **素材只随 APK 分发一次**：其他玩家首次进入时从主机手机通过局域网下载（之后走 WebView 缓存），对局中流量很小。

## 目录结构

**所有由这一层封装新增的东西都在 `android/` 里**；游戏仓库的原有目录（`server/`、`shared/`、`public/`、`data/`、
`docs/`、`test/`、`scripts/`、`tools/`）一个文件都没有改动。路径都相对仓库根目录。

| 路径 | 是否提交 | 内容 |
|---|---|---|
| `android/README.md` | 是 | 本文件 |
| `android/package.json` | 是 | Capacitor 依赖（`@capacitor/*`、`@jadejr/capacitor-nodejs`）与 `npm run` 脚本 |
| `android/capacitor.config.json` | 是 | `webDir`、插件配置、`allowNavigation` |
| `android/web/index.html`、`launcher.css`、`launcher.js` | 是 | 启动器界面（建立主机 / 加入房间 / 搜到的房间列表） |
| `android/web/nodejs/` | 否（生成） | 被内嵌的服务器：`server/ shared/ data/ public/ node_modules/ws lan/` + `index.js` |
| `android/web/vendor/` | 否（生成） | 从 `node_modules` 取出的 `capacitor.js` 与 `capacitor-nodejs.js` |
| `android/android/` | 是 | 原生工程（`cap add android` 生成后再手工配置） |
| `android/android/app/src/main/java/…/MainActivity.java` | 是 | 注册 `LanDiscoveryPlugin`（必须在 `super.onCreate()` 之前） |
| `android/android/app/src/main/java/…/lan/LanDiscoveryCore.java` | 是 | UDP 搜索端：**纯 `java.net`**，不依赖 Android，所以能在桌面 JVM 上验证 |
| `android/android/app/src/main/java/…/lan/LanDiscoveryPlugin.java` | 是 | Capacitor 桥：`start` / `stop` / `getHosts` / `status` |
| `android/android/app/src/devtest/res/values/strings.xml` | 是 | 测试版 build type 的应用名覆盖（`-Variant devtest`） |
| `android/scripts/setup-sdk.ps1` | 是 | 安装 Android SDK / NDK / CMake |
| `android/scripts/assemble-nodejs.mjs` | 是 | 装配 `android/web/nodejs` |
| `android/scripts/build-apk.ps1` | 是 | 一键构建（含 Gradle 获取与校验、签名） |
| `android/scripts/nodejs-template/` | 是 | 内嵌服务器的入口 `index.js`、`package.json` 与 `lan/`（广播端 + 协议） |
| `android/scripts/nodejs-template/lan/protocol.mjs` | 是 | 广播协议的**规范实现**：端口、报文编解码、房间列表 |
| `android/scripts/nodejs-template/lan/net.mjs` | 是 | 广播地址计算（`255.255.255.255` + 每张网卡的子网定向广播） |
| `android/scripts/nodejs-template/lan/announce.mjs` | 是 | 广播端（主机侧） |
| `android/scripts/nodejs-template/lan/wire.mjs` | 是 | 把广播端挂到一个已启动的服务器上（APK 和电脑共用这一处接线） |
| `android/scripts/nodejs-template/lan/host.mjs` | 是 | APK 里「当主机」的装配：原版服务器 + 广播端 |
| `android/scripts/host-with-lan.mjs` | 是 | **电脑**开服 + 广播（替代 `npm start`，见[怎么联机](#怎么联机)） |
| `android/scripts/lib/download.mjs` | 是 | 可续传、带校验的 HTTPS 下载器 |
| `android/scripts/lib/lan-seeker.mjs` | 是 | PC 侧的 Node 搜索端（给工具和测试用；APK 里的搜索端是 Java） |
| `android/scripts/lan-tool.mjs` | 是 | `scan` / `doctor` / `announce` 命令行工具 |
| `android/scripts/lan-verify.mjs` | 是 | 四段自动搜索验证（含用 `javac` 编译并运行 APK 里那个 Java 类） |
| `android/scripts/device-cdp.mjs` | 是 | 在真机 WebView 里跑 JS（CDP）：`--list` / `--default` 能力探针 / 任意表达式，见[兼容性](#兼容性) |
| `android/scripts/webview-update.ps1` | 是 | 给没有 Play 商店的机型侧载系统 WebView（下载 / 断点续传 / 安装 / 验证），见[升级系统 WebView](#升级系统-webview没有-play-商店的机型) |
| `android/test/launcher.test.js` | 是 | 启动器 30 项检查，`node android/test/launcher.test.js` 单独运行 |
| `android/test/lan-protocol.test.js` | 是 | 广播协议 37 项检查，含与 `LanDiscoveryCore.java` 常量一致性，`node android/test/lan-protocol.test.js` |
| `android/test/java/LanProbe.java` | 是 | 在桌面 JVM 上运行 `LanDiscoveryCore` 的测试入口（被 `lan-verify.mjs` 使用） |
| `android/.build/` | 否（生成） | Android SDK、NDK、CMake、Gradle、各种缓存。约 4 GB，可随时删除 |
| `android/dist/` | 否（生成） | 产出的 APK |

## 排错

| 现象 | 处理 |
|---|---|
| **手机搜不到电脑上开服的房间** | **最常见的原因：电脑上的服务器根本没在广播。** 原版 `npm start` 是一台完全沉默的服务器（广播端只在内嵌 APK 的 Node 入口里）。改成 `node android\scripts\host-with-lan.mjs`；服务器已经在跑就补一个 `node android\scripts\lan-tool.mjs announce --port 3000`（没有房号）。还搜不到就跑 `node android\scripts\lan-tool.mjs doctor --port 3000`，它会分开显示「网卡与广播目标 / 听到什么 / 本机服务器是否应答」 |
| **能搜到电脑，但打开一直转圈 / 打不开** | Windows 防火墙挡了入站 TCP（广播是出站流量，不受影响，所以现象就是「看得见、进不去」）。放行一次：`netsh advfirewall firewall add rule name="Stronghold Protocol 3000" dir=in action=allow protocol=TCP localport=3000 profile=private,domain`。用手机热点时 Windows 常把该网络标成「公用网络」，所以 `profile=private,domain` 可能不生效，加一条 `profile=public` 或把网络改成「专用」 |
| 两台手机都点了「建立主机」，互相看不到 | **这是设计使然**，不是 bug：两个服务器之间没有任何通道，房间只存在各自的内存里。让其中一方回到首页点「加入房间」（或直接点首页搜到的房间）。两台都在开服时，主机界面上会提示「同一 Wi-Fi 上还有另一台主机」 |
| 首页搜不到主机 | 确认对方已经点了「建立主机」并且**已经进入游戏**（广播端在服务器起来之后才开始播）；确认两台连的是同一个 Wi-Fi（不是访客网络 / 不同频段的不同 SSID）；点「重新搜索」；还不行就用「加入房间」手输地址。注意广播只在**同一个子网**内有效，跨网段或走 VPN 时请手输虚拟 IP |
| 搜到的列表里同一台主机出现两次 | 已经按主机 id 合并过了，并会优先使用 `192.168.*` / `10.*` 这类常规地址，其余地址显示为「（另有 …）」。如果两台设备各有多张网卡（Wi-Fi + VPN + 热点），这属于正常现象，任意一个地址都能用 |
| 主机卡片提示「自动广播不可用」 | 广播端自己报了 socket 错误（常见：端口 `45777/45778` 被同一台设备上的其它进程占了，或没有可用的网络接口）。**不影响游戏**：朋友仍可用「加入房间」手输地址 |
| 加入方提示「搜索端口用不了」 | 同理，是加入方手机上 `LanDiscoveryCore` 的 socket 错误，文字就是系统给的错误原因。手输地址这条路径不受影响 |
| 装了但提示「应用未安装」 | 多半是机型不是 arm64，或者 APK 传输过程中损坏（重新传一次，必要时比对文件大小） |
| 首页静态字画出来了，但点「建立主机」没反应（只有一个聚焦环） | 系统 WebView 太老（< Chrome 80）：前端用了可选链 / 空值合并，整机脚本都不执行。跑 `node android\scripts\device-cdp.mjs --default` 一眼就能看出来（`SyntaxError` + 一堆 `undefined`），然后按[升级系统 WebView](#升级系统-webview没有-play-商店的机型)侧载一个新包 |
| 启动后全黑 / 弹「Android System WebView 已停止运行」 | 装的是**只有 arm32** 的 WebView 包，64 位进程加载不了（logcat 里是 `UnsatisfiedLinkError ... is 32-bit instead of 64-bit`）。换成带 arm64 的包重装；确认 `dumpsys package com.google.android.webview` 里 `secondaryCpuAbi=arm64-v8a` |
| 点「建立主机」后一直停在准备界面 | 首次解压约 394 MB，低端机可能要 1–3 分钟，界面会显示已用秒数。超过 5 分钟仍未进入再看下一行 |
| 启动失败，提示端口被占用 | 通常是上一次的服务器还在跑：从最近任务里彻底划掉应用再重开 |
| 朋友打不开地址 | 确认用的是 `192.168.x.x` 而不是 `127.0.0.1`；确认在同一个 Wi-Fi；访客网络 / 酒店 Wi-Fi 常有「AP 隔离」；确认地址里的 `:3000` 没丢 |
| 主机自己进不去局域网地址 | 用主机卡片下方的「改用本机地址进入」进游戏；朋友仍用上面列出的局域网地址 |
| 画面是占位图、没有声音 | `public/assets` 在打包时就不完整。在仓库根目录重跑 `node tools/setup.mjs`，再重新构建 |
| 3D 棋盘没出现 | 打包时 `public/assets/local/` 为空（本机没有从明日方舟客户端提取过贴图），会自动用 2D 棋盘，其他功能不受影响 |
| 想接日志排查 | 用 `adb logcat -s NodeJS-Engine CapacitorNodeJS Capacitor` 看 Node 侧和插件的输出；游戏内也可以开 WebView 远程调试（`chrome://inspect`），或者用仓库里的 `node android\scripts\device-cdp.mjs --list` / `--default` / `'<表达式>'` 直接在真机 WebView 里跑 JS |
| 电脑上想看手机到底播了什么 | `node android\scripts\lan-tool.mjs scan --seconds 6`（需要电脑和手机在同一网段） |
| 构建时报 `PKIX path building failed` | 见[关于 Gradle](#关于-gradle只影响本机这个沙箱环境)；用 `build-apk.ps1` 而不是 `gradlew` |
| 构建卡在 `:jadejr-capacitor-nodejs:configureCMakeRelWithDebInfo[arm64-v8a]` 长时间不动 | 这是**受限令牌（沙箱）**下的现象：Gradle 派生的 `cmake` / `ninja` 子进程会挂住，对应的 `configure_stdout.txt` / `configure_stderr.txt` 一直是 0 字节。在**非受限 / 完全权限**的环境下重跑 `build-apk.ps1` 即可（正常终端不会遇到）。判断方法：`Get-Process cmake,ninja` 还在、但 CPU 增量为 0 |
| 构建时 `sdkmanager` 说 `Failed to download any source lists` | `sdkmanager` 需要能写 `ANDROID_USER_HOME`（默认 `~/.android`）。`setup-sdk.ps1` 已经把它指到 `android/.build/android-user`，手工调用时也要设这个环境变量 |
| `lan-verify.mjs` 第 3 段（broadcast）没过 | 前两段过了就说明代码没问题，是本机防火墙拦了入站 UDP（Windows 上很常见）。第 3 段本来就不会让整体失败，只打印提示 |

## 手机横屏显示（2026-10-04）

手机横屏（20:9，CSS 视口 915×412 / 800×360）看起来比 3:2 平板（1280×822）「地图小」，原因不在设置，在几何：

- 备战阶段的地图必须把「待命区 → 场地最后排」那 6 行夹在顶栏（回合 / 休整 + 盟约条）和商店栏之间
  （`public/js/render/projection.js` 的 `clearHud` keep 带）。这条带子深 5.36 格，所以 **HUD 每占 1 px 高，地图每格就少
  0.19 px**；而地图自身投影约 2.2:1、手机屏幕 2.22:1，它只受高度限制，**永远填不满宽度**（平板 1.56:1 才填得满）。
- 换句话说：手机上「地图变大」和「商店栏保持原高度」是同一笔预算的两头。商店栏占底部 2.64 rem = 108 px
  （412 px 的 26 %），是最大的一笔。**按用户决定，商店栏保持原样**（2.24 rem 卡片、立绘完整、字没变小）；
  手机断点里现在只动盟约条这一层纯图标的外框（圆盘两次变大，顶带 2.16 rem → 2.05 rem：圆盘 .62 rem、人数方块悬在
  外圈之上，所以条子必须比顶栏面板低一点才能放下它），并让备战相机改成「填满 HUD 让出的空间」
  而不是停在官方 1080p 构图上（`PHONE_FILL_MAX_H = 460`，与这条 CSS 断点是同一个数字，有测试盯着）。
- **想要大图时点商店栏的「收起」**：商店栏一收，底部带子从 108.6 px 掉到 35 px，备战每格立刻到 **51.4 px**
  （战斗的 88 %，915×412）——这是原版就有的功能，不改任何东西。

实测（`node android/scripts/fit-check.mjs PREP --viewport 915x412 --viewport 800x360 --viewport 1280x822`，
在真渲染里量 DOM 与 `tileScreen`；原版数字按同一条 keep 带公式推算）：

| 视口 | HUD 占比 | 备战每格 | 原版 | 战斗每格 | 备战 / 战斗 |
| --- | --- | --- | --- | --- | --- |
| 915×412 手机 | 43.5 % | **43.7 px** | ≈ 40 px | 58.6 px | 68 % → **74 %** |
| 800×360 手机 | 49.8 % | **33.8 px** | ≈ 30 px | 51.2 px | 68 % → **66 %** |
| 1280×822 平板 | 39.1 % | 77.4 px | 77.4 px | 102.4 px | 75 %（不变） |
| 1920×1080 桌面 | 44.5 % | 111.8 px | 111.8 px | 153.7 px | 73 %（不变） |

想再大一点的话，唯一的口子是商店卡的高度：卡片每矮 10 px，地图每格约 +2 px（两端都实测过——1.06 rem 卡片能到
53.4 px，代价是立绘基本没了）。随时可以再调。

没动：`css/theme.css` 的 40 px 字号地板、战斗相机、平板构图。
回归测试：`node --test test/render/phone-camera-fill.test.js test/ui/hud-bands.test.js`。

### 刘海 / 挖孔：默认全屏，不留边条（第二轮修正）

第一版按「别让画面跑到刘海下面」用了两种官方手段，结果在小米 14 Pro（3200×1440，横屏刘海在左侧）上量出来是
**左边 168 px + 上边 168 px 白条**（像素 RGB 250,250,250），用户报「这么大的左空白和上空白」。原因有两条：

- `android.adjustMarginsForEdgeToEdge = "auto"`（Capacitor 7）在 Android 15+ 会给 WebView 加「系统栏 + 挖孔」的外边距；
- 让出来的那块显示的是**窗口背景**，而 AppCompat 默认在日间模式下是白的 —— 配置里的 `backgroundColor` 只设 WebView
  自己，管不到窗口。

现在改成（`android/android/app/src/main/java/.../MainActivity.java` + `res/values/styles.xml`）：

1. `onCreate` / `onResume` 里隐藏系统栏（`WindowInsetsControllerCompat.hide(systemBars())` +
   `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`）—— **默认全屏**，从屏幕边缘滑一下可以用临时栏，游戏自己的 ⛶ 照旧可用。
2. 不再设置 `windowLayoutInDisplayCutoutMode`，也不再给 WebView 加边距（`android.adjustMarginsForEdgeToEdge` 已移除）：
   画面铺满整屏，没有边条。
3. `android:windowBackground = #FF111614`（游戏底板色）：启动窗口、以及任何 ROM 强加的 letterbox 都只会是深色，
   不会再出现白条。

**那挖孔怎么办？** 游戏本体自己已经处理了：`css/devices.css` 第 2 节把 HUD 层和每个屏幕放进
`env(safe-area-inset-*)`（隐藏系统栏之后 WebView 仍然照常上报挖孔 inset），所以备战 / 战斗的 HUD 从 `--sa-l` /
`--sa-t` 开始，队伍面板、角落按钮都让开挖孔；画布是全屏的，但棋盘左边缘本来就在 `hudPadding` 的 2.25 rem（90 px）
之外 —— 挖孔只会压到深色底板，不会挡住任何可读或可点的东西。启动器页面的边距也补上了左右安全区
（`android/web/launcher.css`）。

## 已知限制

- 只有 arm64，且没有 iOS / 桌面端的封装。
- **两台手机各自开服不能联机**，永远不能：房间是单个服务器进程内的状态。一台开服、其他加入，这是唯一的玩法。
  从第一个安卓包（0.1.1）起首页会自动搜索主机，就是为了让这件事变成点一下。
- **自动搜索只有在同一个广播域（同一个子网）内有效**，跨网段 / 走 VPN 时请手输地址。详细边界见
  [局域网自动发现](#局域网自动发现)。
- **自动搜索的原生那一段还没有在真机上跑过**。能做的前置验证都做了（协议一致性测试、用桌面 JVM 运行 APK 里那份
  `LanDiscoveryCore` 对着真广播端跑、跨进程实测），但 `LanDiscoveryPlugin` 经 Capacitor 暴露给启动器页面、
  以及手机 Wi-Fi 上的广播收发，只能等真机确认。搜不到时手输地址这条路一直可用。
- **主机必须保持应用在前台**。把应用切到后台、锁屏时间过长，Android 可能回收进程，所有对局就结束了。加入方同理
  （Android 会冻结后台 WebView 的 WebSocket）。一起玩的时候正常使用即可。
- 服务器没有账号系统：知道地址的人都能进来。**只把地址发给朋友，不要公开发布**（这条和原版一致）。自动搜索的广播
  同样对同一网段可见（含房号），暴露面和 HTTP 服务器本身一致。
- 重启应用 = 重启服务器 = 结束所有对局；独立模拟的「24 小时内回来继续」在手机上也一样只在应用进程存活期间有效。
- APK 用一次性自签名密钥签名，不要当成正式发布版本。
- release 包里 `webContentsDebuggingEnabled` 是**开着**的（方便用 `chrome://inspect` 排查渲染问题）。要在意这点的话，
  把 `android/capacitor.config.json` 里的 `android.webContentsDebuggingEnabled` 改成 `false` 再重新构建。

## 许可与素材

- 这一层 Android 封装（`android/`、`android/scripts/`）随项目本体以 **GPL-3.0-or-later** 发布。
- APK **内包含**《明日方舟》的美术、音频与数据，版权归上海鹰角网络 / Yostar 所有，**不适用 GPL**，仅限学习
  交流与个人非商业使用，**严禁任何形式的盈利或再分发素材**。完整条款见 [NOTICE.md](../NOTICE.md)。
- 第三方组件：`@capacitor/core`、`@capacitor/android`、`@capacitor/cli`（MIT）、
  `@jadejr/capacitor-nodejs`（MIT，内含基于 [nodejs-mobile](https://github.com/nodejs-mobile/nodejs-mobile)
  的 `libnode.so`，遵循其各自许可）。清单见 [THIRD-PARTY-NOTICES.md](../THIRD-PARTY-NOTICES.md)。

## 素材：已补全（2026-10-06）

`public/assets/**` 现在与 `data/assets.json` 清单**完全一致：5 699 条引用 0 缺失**（`node --test test/assets.test.js` 46/46 通过）。
两批素材的来源不同：

- **36 个战斗表情 + 19 页玩法说明**：来自上游 `v0.1.3` 的发布压缩包（`Stronghold-Protocol-v0.1.3.zip`）。本机当时缺的 7 个 png
  按清单拷进 `public/assets/ui/emoticon/**`、`public/assets/ui/guide/**`，其余 5 515 个已存在的文件一个没覆盖。
- **1 675 个干员战斗语音 + 5 个战斗 BGM**：**不在任何发布包里**（`v0.1.3` 与 `v0.1.1` 两个包的 `public/assets/audio/voice/**`
  都是 0 个文件），2026-10-06 在能直连 `raw.githubusercontent.com` 的网络下用 `npm run assets` 抓齐：本次
  **下载 1 680 个文件 / 47.1 MB，跳过已存在 4 022 个，`err=0`**。
  - 语音为 CN（`--voice-lang=cn`；120 个干员 × 战斗真正会触发的槽位 = 1 675 个 mp3，加上盘上原有的 5 个共 1 680）。
  - 新增的 5 个 BGM 是 0.1.3 之后才有的：每回合换曲 `m_bat_kazimierz2_1_intro/loop`、`m_bat_kazimierz2_2_loop`，
    以及联防腐蚀 `m_bat_corrosion_intro/loop`（`public/assets/audio/bgm/` 现共 19 个 mp3）。
  - 这些条目**本来就在 `data/assets.json` 里**，所以补上文件即生效、不用等清单重建。`npm run assets` 会顺手重写清单，但
    `hash` 仍是 `9e240a72da75` —— 该字段是清单正文（即全部素材引用）的内容哈希，它不变就证明 **5 699 条引用一条没增删**；
    唯一变化的是派生字段 `stats.bytes`（旧值是陈旧的，现在等于盘上实际合计 331 563 786 B = 316.2 MiB）。
- 仍未取到的只有 1 个非清单项：`enemies.enemy_5601_entlec.icon`（上游资料库本身没有，抓取脚本已按既有逻辑跳过并从清单省略）。

### 抓取时的环境坑：TLS 证书链

如果本机走的是**会替换证书链的代理 / 防火墙 / 杀软**，典型症状是 `npm run assets` 全程报
`unable to verify the first certificate`（`ok=0`、`err` 一路涨，最后 Node 进程还可能在 Windows 上以 `0xC0000409` 硬崩），
但 PowerShell 里 `Invoke-WebRequest` 同一个 URL 却是 200 —— 因为 PowerShell 走 Windows 证书库，Node 只认自带的 CA 列表。
加 `--use-system-ca` 即可让 Node 也读系统证书库（`NODE_OPTIONS` 形式更省事，`npm run assets` 可以原样跑）：

```powershell
$env:NODE_OPTIONS = '--use-system-ca'
npm run assets          # 等价于 node --use-system-ca tools/vendor.mjs + tools/fetch-assets.mjs
```

（这跟 `android/scripts/build-apk.ps1` 里给 Gradle 写的那段是同一类问题：`github.com` /
`release-assets.githubusercontent.com` 只发不完整的证书链，Windows Schannel 会静默走 AIA 补中间证书，
OpenSSL 侧（Node、JDK）不会。）

自检手法（第一条报错、第二条 200，就是这个原因）：

```powershell
node -e "fetch('https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/voice/README.md').then(r=>console.log(r.status)).catch(e=>console.log(e.message))"
node --use-system-ca -e "fetch('https://raw.githubusercontent.com/ArknightsAssets/ArknightsAssets2/voice/README.md').then(r=>console.log(r.status)).catch(e=>console.log(e.message))"
```

（`tools/assets/sources.mjs` 里语音/BGM 只挂 `raw.githubusercontent.com`：`ArknightsAssets2` 的 `voice` 分支没有 jsDelivr 镜像，
所以这里没有 fallback 可退。）

测试方面：`test/assets.test.js` 的「every manifest path exists on disk」是**严格**的——5 699 条引用一条都不能缺（语音 / BGM 也不再有例外，
2026-10-06 抓齐后已把之前为「本机没素材」加的宽容判定撤掉）；浏览器 e2e 也不再忽略 `/media|assets/audio` 的 404（`test/e2e/client.mjs`、
`test/ui/mock|leftovers|real.e2e.test.js`），所以一条素材缺了就会在 e2e 里暴露。
本机实测：`/media/voice/cn/char_102_texas/cn_020` 与 `/media/bgm/m_bat_kazimierz2_2_loop` 均 200 / `audio/mpeg`。
