# 卫戍协议：盟约 — Web Remake · This fork's deviations (FORK-DEVIATIONS.md)

This file is the fork's counterpart to upstream's `docs/DESIGN.md`. Upstream **v0.2.0** turned that file into an index
and moved the rules to `docs/design/*` (the current rules by area) and the revisions to `docs/history/*` (the evidence
behind each rule). **v0.2.1** (merged into this tree the same day) adds `docs/history/0.2.1.md` — §26 — and changes rules
without moving anything else. The fork's own changes are in neither, so they live **here**, under their original section
numbers.

Upstream's section numbers are global and never change; code, tests and the other documents cite them as "DESIGN §N".
The fork's sections keep chapter 21, sit immediately after upstream's own §21.30 (干员战斗语音, which is upstream's and
not ours) and run **§21.31–§21.62**, so every "DESIGN §21.34" in a comment, a test name or another document still
resolves. §21.30 is reproduced below only as the anchor the fork's numbering hangs off.

**What these sections are.** Each §21.31–§21.62 entry is something this fork did on top of the upstream release named
in its title: a player report fixed here, an owner decision, or a deliberate deviation from the official game. Several
of them are **Android / packaging / phone-layout work** (`android/`, `docs/DEPLOY.md`, the phone HUD) and one is the
maintainer's own test tool (the debug console); those have no upstream counterpart at all and must never be dropped
when upstream is merged. The file paths inside the entries name the **pre-0.2.0** layout (`kits/tierN.js`,
`content/garrisons/*.js`, `sim/Battle.js` …), which 0.2.0 split into modules; a port has to map them.

**v0.2.0 implemented some of these itself.** The rule is one implementation only, and upstream's is the baseline, so
where upstream 0.2.0 fixed the same thing the fork drops its own version and keeps upstream's — the entry below is
then kept verbatim as history (the reasoning and the tests it names are still what the fork's issues refer to) and
carries a **v0.2.0 status** line under its heading. The table is the summary:

| section | what it is | status after the v0.2.0 + v0.2.1 merges |
|---|---|---|
| §21.30 | 干员战斗语音 — an operator's official lines, in battle only | **upstream's own section** (already in v0.1.4; now [history/0.1.1.md](history/0.1.1.md) §21.30) — not a fork change |
| §21.31 | 变形同构体 counts for operator talents and tokens | **keep (port)**: upstream's `inFaction` (kits/shared/tier5.js) still reads the raw record, so the four talent / token sites need the fork's `unitBonds` reading — see §21.43 for the second half |
| §21.32 | 拉普兰德's first refresh must be one that can pay out | **withdrawn in the v0.2.0 merge**: the `requireActive` gate is gone — upstream pinned the official reading of the same community report (`test/match/feedback5-bench-traits.test.js`: "a refresh made while 叙拉古 is inactive spends it"); see the §21.32 note below |
| §21.33 | The shop bar's row is one box in every state, and `C` folds it | **keep, partly overlapping**: upstream 0.2.0 has the shop fold and the shop-collapsed camera (public issue #5, §10) but no `--shopbar-row` constant and no `C` shortcut; port the rest |
| §21.34 | The debug console (`g.dbg*`) | **keep (fork-only)**: upstream has no console — `server/match/console.js`, `ui/console.js`, `shared/constants.js CONSOLE_LIMITS` / `ERR.NO_CONSOLE` and the five protocol messages are all this fork's (its `docs/PLAYING.md` section is **§14** after the v0.2.5 merge: 0.2.2–0.2.5 added §12 反馈问题 and §13 统计（本机）after upstream's §11 快捷键) |
| §21.35 | A promoted 拉普兰德 fires again | **superseded by upstream** (GitHub #169, [history/0.2.0.md](history/0.2.0.md), META.md "an elite merged in a round is a new piece"): 0.2.0 made a merged elite a newly gained piece whose per-piece counters start at 0 — the same rule |
| §21.36 | The bond strip's discs are bigger, the count chip sits outside | **keep (fork-only)**: upstream's `.bslot .bond` is the old size and has no count chip |
| §21.37 | A bounty enemy's content-spawned child carries no bounty | **superseded**: upstream's §23.25 ([history/0.1.3.md](history/0.1.3.md), already in v0.1.4) fixed the same pair of files; the fork's own `[ASSUMED]` note survives in the entry |
| §21.38 | 准备就绪 asks twice | **keep (fork-only)**: upstream has no armed / confirm state (`READY_CONFIRM_MS`, `.readybtn.is-armed`) |
| §21.39 | The count badge leaves the discs (follow-up to §21.36) | **keep (fork-only)** |
| §21.40 | A 本局禁用 disc keeps the layers it holds | **keep (fork-only)**: upstream's `ui/bondStrip.js` deliberately shows no stack count on an `off` disc |
| §21.41 | The rotate hint follows the primary pointer | **keep (fork-only)**: upstream's `ui/device.js` has no `pointerCoarse` feature class |
| §21.42 | 突袭 counts a passive skill as 「技能就绪」 | **superseded by upstream** (GitHub #49 → [history/0.2.0.md](history/0.2.0.md) §25.6.7, CHANGELOG.md) |
| §21.43 | "【X】干员" is the 盟约's membership, not the character's nation | **keep (port)**: the same four `inFaction` / `isLaterano` / `isKazimierz` / `isKjerag` sites as §21.31 |
| §21.44 | 缇缇's 封护 stacks on every 沉睡 application | **superseded**: upstream's §24.8 ([history/0.1.4.md](history/0.1.4.md), already in v0.1.4) is the same fix and 0.2.0's CHANGELOG repeats it |
| §21.45 | 琳琅诗怀雅 S2's 香槟炸弹 placement | **superseded by upstream** (GitHub #116 item 2 → [history/0.2.0.md](history/0.2.0.md) §25.6.1) |
| §21.46 | 秘术师 charges on its own clock | **superseded by upstream** (GitHub #181 → [history/0.2.0.md](history/0.2.0.md) §25.7.1) |
| §21.47 | 引星棘刺 S1 is an AUTO skill that fires when SP fills | **superseded by upstream** (GitHub #124 → CHANGELOG.md, §25.7) |
| §21.48 | 不屈 banks a refused landing instead of spending the roll | **keep (port)**: upstream's 不屈 banks only the 傀儡师 switch (`u.mem.indomFreeDeploy`) and still spends the roll when `battle.redeploy` refuses |
| §21.49 | 麻痹, 诱导 and 暴露 have status icons | **keep (fork-only)**: upstream's `STATUS_ICON` / `STATUS_KEYS` have no `palsy` / `attract` / `reveal` |
| §21.50 | The newer snapshot owns "is this unit on the field" | **keep (fork-only)**: upstream hoisted the revive into `units.js syncView(v, s, t)`, which still stands a view up from the interpolated (older) sample |
| §21.51 | 导出 says so when the browser refuses the download | **keep (fork-only)**: upstream's `downloadText` is deliberately a silent no-op ("复制 stays available") |
| §21.52 | 首启下载素材 — a slim APK, an art pack and the external art directory | **keep (fork-only)**: Android packaging, the `SP_ASSETS_DIR` mount and the art pack have no upstream counterpart |
| §21.53 | 战斗中观战队友 — a living player may watch a teammate's battle while its own runs | **keep (fork-only, deliberate deviation)**: the official and upstream refuse it (`WRONG_PHASE 'own battle running'`); the own battle keeps running in the runner |
| §21.54 | 作战统计 as a live ranking (伤害 / DPS / 治疗 / HPS, spectated players included) | **keep (fork-only)**: upstream's PR #618 panel is damage-sorted, owner-filtered and not re-sortable |
| §21.55 | 本局地图 — the battlefield drawn in the briefing / 本局信息 | **keep (fork-only)**: upstream names the stage only (`战场#03`) |
| §21.56 | 语音语言 can be previewed in 设置 | **keep (fork-only)**: upstream has the switch and the per-operator picker, no preview of the global dub |
| §21.57 | 层数奖励 — a bond's `<every N layers>` progress in its popup | **keep (fork-only)**: the payout is upstream's (`bonds/core.js` payHammers); the progress line is this fork's answer to the 2026-10-17 report |
| §21.58 | 对局记录与回放 — finished matches stored on the server, replayed from their battle specs (统计数据 → 服务器记录) | **keep (fork-only)**: upstream keeps only the last match's frames in memory for a reconnecting client (`Lobby.buildReplay`); nothing survives a restart and nothing can be replayed |

Appendix A lists the fork's edits that sit *inside* upstream's own sections (§6.3, §8.2, §8.3, §19.8, §21.1, §21.11,
§21.20 and §22's intro) — wording that upstream's `docs/design/*` and `docs/history/*` do not carry. Each one is either
reproduced there verbatim or marked as covered by a §21.3x entry, so nothing the fork wrote in the old DESIGN.md is
lost. Appendix B is the upstream side of the table above.

---

## Merge notes (v0.2.0, this tree)

Decisions the merge took that are not rules, recorded so they are not re-litigated:

* **`docs/PLAYING.md` numbering**: upstream's new §11 is 快捷键, so the fork's console section — §11 in the old
  `docs/PLAYING.md` — is **§12** there now. Every other fork section number is unchanged.
* **`docs/DEPLOY.md`**: the deployment rewrite is upstream's, asset figures included (460 MB of `public/assets`, ≈ 625 MB
  unpacked, the lite pack). The fork's only local edits to that file were the three asset-size numbers (it had measured
  ≈ 380 MB before 0.2.0 added the summon models); the measurement is kept as a parenthetical in the 磁盘 row and upstream's
  numbers govern the setup / Docker text. The fork's deployment docs never described the Android build — that lives in
  `android/README.md` and `docs/WINDOWS.md` — so nothing was lost there.
* **The 拉普兰德 wording in `docs/META.md` / `docs/PLAYING.md`**: upstream's GitHub #169 rule (a merged elite is a new
  piece and fires again) replaces the fork's own wording of §21.35; the fork's clause upstream does not have — a refresh
  that cannot pay out does not count (§21.32) — is woven into the same paragraph.
* **Pairs to port together**: §21.31 + §21.43 are one code change (four talent / token sites), and §21.36 + §21.39 are
  one UI change.

## Merge notes (v0.2.1, this tree)

v0.2.1 landed on top of the v0.2.0 merge the same day (the working tree was the base, so only the delta had to be
decided). Nothing in the table above changes: 0.2.1 re-implemented no fork rule and dropped none.

* **What 0.2.1 brings** ([history/0.2.1.md](history/0.2.1.md) §26): 联防 back on the round's own battlefield (0.2.0's
  flat map is withdrawn), 突袭 may jump to a teammate's half when both halves have operators, **every operator is
  computed at full potential** (潜能), PR #196's refresh snapshot, PR #262 / #272 / #264 / #278 fixes, the flying-height
  and animation work, plus the **update package** (`tools/package-update.mjs`, `MANIFEST.json`, `Stronghold-Protocol-*.zip`
  releases). All of it is upstream's; the fork changes nothing about it, and the Android build ignores the update package
  (the app ships its own staged tree).
* **§21.32 stays withdrawn**: PR #196 changed *when* the refresh dispatch takes its snapshot (a 拉普兰德 gained by 贾维's
  gift waits for the next manual refresh), not whether an unpayable refresh counts — the fork's `requireActive` gate stays
  out, and `docs/META.md` / `test/match/feedback1-meta.test.js` carry both notes side by side.
* **The golden corpus is the merge's best evidence**: of the 283 scenarios in `test/golden/*.json`, exactly **two** differ
  from upstream 0.2.1 — `bond-kjeragShip-high` and `bond-victoriaShip-high` — and both differ only in
  `.hooks.statusApplied` / `.events.status`, because §21.43's membership reading lets 灵知's 【谢拉格】 `resist` aura reach
  members whose `nationId` differs. Every other digest (roster, fields, matches, standins, diy) is byte-identical to
  upstream's.
* **The fork's UI strings are translated since 0.2.0**: the debug console panel, the two-press ready labels, the shop-bar
  tooltips and the refused-download toast go through `t()` / `N_()` and their English msgids live in
  `public/i18n/en.json` (the `complete` pack), so `node tools/i18n.mjs check en --strict` is at 100 %.
* **The 39 summon models come from the full release package, not the source**: upstream extracts them from the game client
  (`tools/local-extract`, `spineLocal`); the source checkout, the community mirrors and every public dump lack them. They
  are in `Stronghold-Protocol-v0.2.1.zip` — the 449 MB **full** package, not the 23 MB `-lite` source zip nor the 2.8 MB
  `-update` payload — so this tree took its `public/assets/local/spine/token/` (117 files = 39 × {skel, atlas, png}) and
  its `data/local-assets.json` (62 groups, a strict superset of the fork's 23), after checking all 6443 `MANIFEST.json`
  code entries of that package against their official sha256 (6443/6443). The files stay out of the repository (an
  optional overlay, `docs/ASSETS.md`): a fresh checkout still needs the local client or that package.
  `test/local-token-models.test.js` now runs its extraction check instead of skipping it. See `ISSUES.md` §4.
* **The `-update.zip` payload doubles as a checksum oracle**: of its 138 files, 119 were already byte-identical to this
  tree and the 18 that differ are exactly the fork's own (console, §21.x UI, i18n, docs); its `MANIFEST.json` also shows
  the merge dropped nothing (of the 582 non-`node_modules` entries, only `packs/index.json` is absent — a runtime
  artifact `tools/packs.mjs` writes and `server/packs.js` serves). Two cleanups came out of that check:
  `server/sim/content/garrisons/meta.js` no longer hoists the locals the withdrawn §21.32 gate left behind (upstream's
  one-line `addAll` again), and `package-lock.json` is upstream's own bytes — the fork's copy differed only in key order
  and one `./` in a `bin` path.

## Merge notes (v0.2.5, this tree)

v0.2.5 is four releases on top of the tree the v0.2.1 merge left (0.2.2 → 0.2.5; [history/0.2.2.md](history/0.2.2.md),
[0.2.3](history/0.2.3.md), [0.2.4](history/0.2.4.md), [0.2.5](history/0.2.5.md)). Nothing in the table below changes:
upstream re-implemented no fork rule and dropped none. The merge was resolved against the **v0.2.1 tag's source** (base)
with the **v0.2.5 tag's source** as theirs — 704 files identical, 407 upstream-only changes, 200 new upstream files, 23
fork files upstream never touches, 104 fork-only files, and 61 changed on both sides (21 of them needed a decision).

* **What 0.2.2–0.2.5 bring**: 教鞭's personal bounty choice (`offerBountyChoice`, `m.private.personalChoice`), 潜能 /
  练度 per operator (`shared/potential.js`, `atPotential`), the PWA (icons, `public/manifest.json`, `public/js/pwa.js`), the
   **文字大小** setting (`--t`), the 统计 screen, the shared equipment stock, the developer simulation checker
  (`public/dev/sim-check.html`, `tools/sim-check.mjs`), 潜能 in the shop, the IPv6 dual-stack bind, bot emotes,
  `AGENTS.md` / `CLAUDE.md`, and 100+ new test files. All of it is upstream's.
* **The conflicts the fork decided** (the rest auto-merged):
  * `public/js/ui/hud.js`, `public/js/screens/game.js`, `public/js/ui/gameActions.js` — 教鞭's `personalChoice` gate and
    the host's `room.removeSpectator` land next to the fork's two-press ready (§21.38): one `ReadyToggle` keeps `armed` /
    `data-armed` / the amber 再点一次确认 and folds in upstream's `ready-why` element and choice reason; `TopBar` takes
    upstream's spectator props alongside `readyArmed`; the `live` ref carries `hasPersonalChoice` **and** the console flags.
  * `public/js/render/app.js` — upstream hoisted the per-view revive/sync into `syncView`; the fork's §21.50 down-list
    guard rides along as `syncView(v, s, renderT, downIds)`, and the slide-start block (PR #380) sits beside it.
  * `server/sim/content/kits/shared/tier5.js` / `tier6.js` / `content/tokens.js` — the fork's `unitBonds` import plus
    upstream's new `hypot` / `atPotential`.
  * `kits/ops/chess_char_4_01-rmixer.js` — the fork's `isLaterano` (§21.31 / §21.43) with upstream's new "latest
    deployed ally" ordering for 教鞭.
  * `server/lobby.js` — the fork's `console` seat flag plus upstream's `ops` (潜能 / 练度) seat field, `checkLoadoutOps` /
    `cultivationCharIds` and `isLoopbackIp` side by side.
  * `public/i18n/en.json` — merged at key level: v0.2.5's 1205 keys in their order, then the fork's own 78 msgids.
  * `test/ui/playtest2.real.e2e.test.js` — upstream's new 教鞭 round-trip block, readying through the fork's two-press
    `client.ready()` instead of `click('.readybtn')`.
  * docs — upstream's new text with the fork's own parts re-appended: the §21.30–§21.51 row in `docs/DESIGN.md` (§27–§30
    kept), the console section in `docs/PLAYING.md` — **§12 → §14**, since 0.2.2–0.2.5 added §12 反馈问题 and §13 统计（本机）
    — the 重刷本局 paragraph stays, plus the `addBounty` bounty-child sentence in
    `docs/META.md`, the two-press ready sentence in 休整期, and the measured asset figures in `docs/DEPLOY.md`.
* **The golden corpus**: `npm run golden:update` recomputed all 287 scenarios (upstream's count; the fork's 18-match
  corpus grew by upstream's two new `-coverage-` matches). Exactly **three** moved, all of them §21.31 / §21.43:
  `bond-kjeragShip-high` (`.hooks.statusApplied` 1579 → 1892, `.events.status` 20 → 21 — upstream's −1 with the fork's
  +313 on top), `bond-victoriaShip-high` (194 → 388, upstream's 194 exactly doubled by the membership reading), and
  upstream's new `coop2-NORMAL-1-coverage-standins`, where the same reading lifts round 13's activated layers
  (kazimierzShip 34 → 50, kjeragShip 80 → 96, swiftShip 129 → 145) so the team clears round 14 and wins instead of
  losing at 13. `roster` / `fields` / `standins` / `diy` stay byte-identical to upstream's.
* **Upstream tests the fork had to adapt** (they pin upstream's own values, not the fork's rules — never the reverse):
  * `test/ui/text-scale.test.js` — `.bslot .bond__name` is `.15rem` here (§21.36 / §21.39), and the fork's
    `public/css/screens/game-console.css` joins `NOT_SCALED` (a test panel that deliberately does not follow the text step).
  * `test/docs-paths.test.js` and `test/package-player.test.js` — upstream's new "shipped markdown" / "packaged
    package.json" checks call `git ls-files`, which a working tree without `.git` cannot answer; they fall back to
    `test/helpers/repoFiles.js`, the same walk the fork's own repository scan already used.
  * `test/scene-assets.test.js` — upstream builds its root with `new URL(import.meta.url).pathname`, which is `D:\D:\…`
    on Windows; the fork uses `fileURLToPath` (upstream runs that test only on POSIX CI).
* **Assets**: `data/assets.json` grew to 10963 URLs (10956 files, 581 MB, 192 JP voice characters). **2971** of them were
  missing in this tree; all 2971 came out of the **full** `Stronghold-Protocol-v0.2.5.zip` (579 MB) after its 6476 code
  entries were checked against its own `MANIFEST.json` (6476/6476 sha256) — the new operator `char_4231_clemnt`, 255 new
  sfx, and the 2702-file **JP voice set** — so every manifest path is on disk again. The optional local overlay grew the
  same way: the package's `data/local-assets.json` (75 groups vs the fork's 62) adds the 11 official battlefield **scene**
  bundles plus `scene/tex` and a 40th summon model, `token_10031_swire2_gdtrap` (`public/assets/local` ≈ 109 MB). None of
  it is in the repository. See `ISSUES.md` §4.
* **`public/i18n/*`**: the fork's 78 msgids now exist in zh-TW / ja / ko as well (upstream never had them, and all four
  packs declare `complete`), so `node tools/i18n.mjs check --all --strict` is 100 % clean in every language. The wording
  follows each pack's own terminology (整備區 / 整備エリア / 정비 구역, 調度中心 / 管理センター / 보급센터, 盟約 / 盟約 /
  맹약) and the official names in `data/i18n/<lang>.json` (イェラグ / 쉐라그, シルバーアッシュ / 실버애쉬).
* **`eslint.config.js`** ignores `.scratch/**` (the fork's local merge tooling and the trees it imports from) and the
  `android/` build outputs, so `npm run lint` is 0 errors on this machine instead of tripping over build products.
* **Known upstream nit kept as-is**: `node tools/check-imports.mjs` lists three `sim-node` violations in
  `server/sim/nodeData.js` (a Node-only loader the sim never ships) in the pristine v0.2.5 tag too; the checker is
  non-strict by default, so `npm run ci` is unaffected.

---

## Merge notes (v0.3.0, this tree)

v0.2.6 and v0.3.0 are two releases on top of the tree the v0.2.5 merge left ([history/0.2.6.md](history/0.2.6.md),
[history/0.3.0.md](history/0.3.0.md)): 0.2.6 is the official battle effects (DESIGN §33), the bot's placement and
purchasing, the expandable temp queue (PR #630), the multi-language voice dubs, the rewritten 统计 screen and the asset
pack, and 0.3.0 is the whole plugin system (data / DSL / cosmetic / UI plugins, the `/studio/` workbench, Forge import,
the script sandbox and the site CSP). Nothing in the table below changes: upstream re-implemented no fork rule and
dropped none. The merge was resolved against the **v0.2.5 tag's source** (base) with the **v0.3.0 tag's source** as
theirs — 924 files identical, 372 upstream-only changes, 400 new upstream files, 37 fork files upstream never touches,
117 fork-only files, and 62 changed on both sides (25 of them needed a decision).

* **What the fork's own features had to be re-attached to**: upstream rewrote the three files the fork's Android work
  lives in, so each is a hand merge rather than a line merge:
  * `server/http/static.js` — upstream added the plugin routes (`/plugins/`, `/cs/`, `/vs/`, `/p/`), the studio guard,
    the sim-worker CSP and the content-hash cache options; the fork's multi-directory mounts (the `assetsDir` mount of
    §21.52 plus `resolveMountFile` / `canFallBack` / `answerStatFailure` / `answerEmptyLocalArt`) are the new mount
    loop, with upstream's studio / simWorker / `hashedFileOpts` guards applied to the resolved file. The `indexed`
    check now also covers the `assets` mount (the external art directory is served with the same content-hash URLs).
  * `server/index.js` — the fork's `console` option is set on the `Lobby` right after `createSessionStack` (still not
    part of upstream's `LOBBY_OPTION_KEYS`), the fork's "wait for the queued `room.closed` frames" block sits between
    `network.close()` and upstream's `assetIndex.close()`, and the asset index is built with
    `rootDirs: { assets: assetsDir }` when an external art directory is configured.
  * `server/http/assetIndex.js` — one new option, `rootDirs`, maps a root to a directory of its own, so the external
    art directory is indexed under the same `assets/…` rels the static handler serves
    (`test/assets-dir.test.js` pins both the hashing and an `immutable` hashed URL through the `assets` mount).
  * `server/http/media.js` / `http/config.js` — the fork's `mediaRoots()` list of audio roots plus upstream's
    `{ urlHash, assetIndex }` argument; `serveDirs` returns `assetsDir` beside upstream's `pluginsDir`.
  * `server/lobby.js` — the fork's `isLoopbackIp` import and its `console` seat field beside upstream's
    `seatSettings(room, s, data)` filtering and the `DIFFICULTIES` / `charPotentialChanges` imports.
  * `public/js/screens/game.js`, `public/js/ui/gameLogic/shortcuts.js`, `shared/constants.js`,
    `server/sim/content/support/index.js`, `tools/fetch-assets.mjs` — the fork's own additions combined with
    upstream's (the 作战统计 block and the new `W` hotkey, `bodyInRange`, `--no-optional-voice`, the plugin error
    codes) instead of one side winning.
  * `public/i18n/*.json` — merged at key level again: upstream's 1789 keys in their order, then the fork's 77 msgids
    (`稀有度` is upstream's now, and took upstream's Japanese `レアリティ` over the fork's `レア度`; all four packs are
    100 % clean under `node tools/i18n.mjs check --all --strict`).
  * `public/js/render/units.js` / `app.js` — §21.50's `syncView(…, downIds)` guard survived upstream's rewrite of the
    view sync untouched, and `app.js` still passes the newest snapshot's `down` list.
  * docs — upstream's new text with the fork's parts re-appended: the §31–§33 rows and the §21.30–§21.51 row in
    `docs/DESIGN.md`, the 休整期 sentence in `docs/PLAYING.md` (upstream's drag-to-prepare text plus the fork's
    two-press ready), the measured asset figures in `docs/DEPLOY.md`, and the console section in `docs/PLAYING.md`
    (still §14).
* **The golden corpus**: `npm run golden:update` recomputed all **288** scenarios (upstream's 21 matches, one more than
  v0.2.5; the fork's corpus grew with it). Exactly **two** moved, both §21.31 / §21.43:
  `bond-kjeragShip-high` (`.hooks.statusApplied` 1538 → 1842, `.events.status` 26 → 27) and
  `bond-victoriaShip-high` (193 → 386 — the fork's membership reading exactly doubles upstream's own number again).
  `roster` / `fields` / `matches` / `standins` / `diy` are byte-identical to upstream's.
* **Upstream tests the fork had to adapt** (they pin upstream's own values or assume a checkout — never a rule):
  * `test/match/console.test.js` — the fork's own test asserted `HAND_FULL` for a full hand and temp; upstream 0.2.6
    (PR #630) made temp an expandable queue, so it now asserts the queued copy and the pool charge. The rule is
    upstream's; the test follows it (`ISSUES-FIXLOG.md` §10.3).
  * `test/asset-index.test.js` — its linked-folder case needs a directory symlink, which Windows without Developer Mode
    refuses with `EPERM`; that one case is skipped where the system refuses (the rest of the suite runs).
  * `tools/package.mjs` — `trackedFiles` / `dirtyFiles` fall back to walking the tree when `git` cannot answer (this
    fork's working copy is not a checkout: it publishes through the GitHub API). A real checkout is unchanged.
  * `test/scene-assets.test.js` (`fileURLToPath`) and `test/ui/text-scale.test.js` (`.15rem`, the console stylesheet)
    keep the v0.2.5 adaptations, which still apply.
  * `test/ui/playtest2.real.e2e.test.js` — upstream's new `assertPen` in prep with the fork's `client.ready()`.
* **Assets**: the three manifests (`data/assets.json` 16 712 URLs, `data/local-assets.json` 1 690,
  `data/local-fx.json` 12 534) hold **30 936** paths and every one is on disk. They come from the **full**
  `Stronghold-Protocol-v0.3.0.zip` (840 MB): 6 818 of its 6 837 `MANIFEST.json` entries are byte-identical to the
  v0.3.0 tree (the rest are `npm install` outputs, the release staging's rewritten doc links and npm's own
  bookkeeping — no code file differs), and `public/assets/**` was then overwritten / completed by size difference
  (18 403 files, 388.9 MB). The new local overlay is 14 309 files / 365 MB — the 12 534 official **battle effects**
  (DESIGN §33) plus the refreshed scene bundles, the new `mesh/trap_110` group and `scene/tex` files upstream added.
  `public/assets` is 31 021 files / 1 124 MB. None of it is in the repository (see `ISSUES.md` §4).
* **`eslint.config.js`**: upstream's own file merged cleanly and the fork's ignores (`.scratch/**`, the `android/` build
  outputs) are still there — `npm run lint` is 0 errors on this machine.
* **Known upstream nit kept as-is**: `node tools/check-imports.mjs` still lists three `sim-node` violations in
  `server/sim/nodeData.js` in the pristine v0.3.0 tag too; the checker is non-strict by default.

---

## Merge notes (v0.3.2 + v0.3.3, this tree)

v0.3.2 and v0.3.3 are two releases on top of the tree the v0.3.1 merge left ([history/0.3.2.md](history/0.3.2.md),
[history/0.3.3.md](history/0.3.3.md)): 0.3.2 is the historical versions (第一期上/下半, 第二期上半), the staged
settlement order (§35.32/§35.33), the attack-slot rules for boss and enemy skills (§35.19/§35.29/§35.52/§35.54/§35.55)
and a long list of operator fixes; 0.3.3 is the shop's equipment slot (§36.1), the 第一期 bench/field swap (§36.2) and
the equipment icon cache (§36.3). Nothing in the table below changes: upstream re-implemented no fork rule and dropped
none. The merge was resolved against the **v0.3.1 tag's source** (base) with the **v0.3.3 tag's source** as theirs —
1 271 paths identical, 377 upstream-only changes, 381 new upstream files, 107 fork-only changes, 140 fork-only files,
66 upstream files the v0.3.1 merge had missed (restored), 1 upstream deletion (`server/sim/damage.js`, whose callers are
`server/sim/attack/*` now) and 168 changed on both sides (86 merged clean, 82 needed a decision).

* **What the fork's own features had to be re-attached to**:
  * `server/lobby.js` — the room's capacity (2–8, §21.59) and the debug console's `console` option (§21.34) beside
    upstream's version vote (`versionVoteMs` / `versionRetryMs` / `versionProposeGapMs`), the fixed `roomCode` and the
    「不限时」 switch (`room.setSoloUnlimited`, `soloUnlimited`). `LOBBY_DEFAULTS` carries both sets of keys, `create()`
    validates capacity and version, `welcomeInfo()` returns `presence` and `versions`.
  * `server/lobby.js` / `shared/protocol.js` — the presence counter (§21.61): S2C `presence {online}`,
    `welcome.presence`, and the `room.setCapacity` validator beside `room.create.capacity`.
  * `server/index.js`, `server/http/{static,websocket}.js` — the fork's `assetsDir` mounts (§21.52) and the match
    history (§21.58) beside upstream's version hosts and sim pool; the static handler keeps the fork's directory
    fallback and applies upstream's `data/versions` gate to the resolved file.
  * `public/js/ui/fieldHost.js`, `public/css/screens/game.css`, `public/css/devices.css` — the bond strip of
    §21.36/§21.39: still `top: 1.27rem` (phones `1.30rem`) with the count badge above the disc, while upstream's
    `bondStripTop` / `bondArrowPx` constants (the 44 px fold arrow, #678) stay in `HUD_REM`.
  * `public/js/screens/{game,lobby,room,settle,stats}.js`, `public/js/ui/{settings,matchInfo,fieldHost}.js` — §21.54
    (live combat ranking), §21.55 (本局地图), §21.56 (voice preview) and §21.60 (read-only teammate shop) re-applied on
    top of upstream's lobby/room/briefing rewrite; the 人数上限 stepper stays in 设置.
  * `public/i18n/*.json` — merged at key level: upstream's 2 375 keys (2 376 in English) in their order, then the
    fork's 166 msgids (`node tools/i18n.mjs check --all --strict`: 2 487 used, four packs 100 %).
* **Restored from upstream**: 66 files the v0.3.1 merge never took (its release package ships only a subset of `test/`),
  e.g. `test/plugins/offers.test.js`, `test/match/rules.test.js`, `test/helpers/officialTables.js` and
  `docs/examples/offers-demo/*`.
* **Golden**: the 27 scenarios the fork's own rules still move (roster 6, bonds 7, fields 1, matches 1, diy 12) were
  regenerated with `npm run golden:update`; the second run is clean (288 scenarios, 6 groups). They are the fork's
  rules still in place — §21.31/§21.43 (变形同构体), §21.42 (突袭), §21.44 (缇缇), §21.45 (琳琅诗怀雅 S2), §21.46
  (秘术师), §21.47 (引星棘刺 S1), §21.48 (不屈) and the `UF.FLYING` snapshot change of fork.3 — not upstream drift.
* **Assets**: the release zip (`Stronghold-Protocol-v0.3.3.zip`, 861 MB) is a player package — its `MANIFEST.json` and
  `test/` are not the source tree, so the code came from the tag and only `public/assets/**` from the zip: 587 new
  files, 114 changed ones, 9 files that exist only here. `public/assets` is 31 608 files / 1 082 MB (WebP-compressed
  art makes it smaller than the 31 021 / 1 124 MB of v0.3.0).
* **Android**: the wrapper (`android/**`, 140 fork-only files) is untouched; `android/scripts/assemble-nodejs.mjs`
  rebuilds its staged `web/nodejs` from this tree.
* **Forge import on Windows**: `server/plugins/forgeImport.js` builds its validation view with a directory symlink,
  which needs `SeCreateSymbolicLinkPrivilege` (Developer Mode or an elevated shell) there; on `win32` a failed
  `symlinkSync` with `EPERM` now retries as a **junction**, which the registry reads as the folder itself. Upstream's
  code path is kept on every other platform, and the symlink-refusing tests still skip where symlinks are refused.

---

## The fork's sections, verbatim (from the pre-merge `docs/DESIGN.md`)

Section numbers unchanged. v0.2.0 status lines are annotations added by the merge; the section bodies are as the fork
wrote them.

---

### 21.30 干员战斗语音: an operator's official lines, in battle only (user request, 2026-10-03) — `tools/assets/plan.mjs` (`voiceSlots`), `tools/assets/audio.mjs` (`indexVoice` / `VOICE_SLOTS` / `VOICE_BATTLE_SLOTS` / `VOICE_PREP_SLOTS` / `VOICE_DIRS`), `tools/assets/cache.mjs`, `tools/fetch-assets.mjs --voice-lang / --voice-all`, `public/js/audio.js` (`VOICE_PRIORITY` / `VOICE_COOLDOWN_MS` / `VoiceGate` / `resultVoiceSlot` / `resultSpeaker` / `voice()`), `server/sim/ai.js performAttack 'engage'`, `battle/runner.js emit('result')`, `screens/game.js onResult`, `ui/detailPanel.js voice`, `ui/settings.js`, `ui/gameLogic.js sanitizeSettings`

> **v0.2.0 status**: upstream's own section (already in v0.1.4) — not a fork change. It now lives in `docs/history/0.1.1.md` §21.30; it is reproduced here only as the anchor of the fork's numbering.

User: 「给每个卫戍干员都加语音」, then, after the first build, 「整备阶段不需要干员语音，战斗开始后才需要语音，也就是只需要作战中语音」.

**Where the lines come from.** Every operator the mode can field already has official battle lines in the same voice dump the BGM and SFX come from — `voice_cn/{charId}/cn_nn.mp3` (JP/EN/KR: `voice/`, `voice_en/`, `voice_kr/`, the same file names, `tools/fetch-assets.mjs --voice-lang=jp|en|kr`). `charword_table.json`'s `placeType` says when each line is used, and `indexVoice()` turns it into the manifest's `audio.voice[charId]`: 行动出发 `start` (BATTLE_START), 行动开始 `faceEnemy` (BATTLE_FACE_ENEMY), 选中干员 `select`, 部署 `place`, 作战中1-4 `skill1..skill4` (BATTLE_SKILL_N), 编入队伍 `squad`, 任命队长 `squadFirst`, 结算 `resultFour/Three/Two/Lose` (完成高难行动 / 3星结束行动 / 非3星结束行动 / 行动失败) and 干员报到 `gacha`. A slot with several lines stays an array and the client draws one. Only the base word key is planned (`wordKey === charId`): the dump has no folder for a skin variant's word key (`char_x_ita`, `char_x_epoque#28`), so those lines 404. **Only the slots a battle can play are planned** (`audio.mjs VOICE_BATTLE_SLOTS`): 干员报到 / 编入队伍 / 任命队长 are lines of the official client's own 养成 / 编队 UI, nothing in this mode ever requests them (`test/docs-consistency.test.js` checks the client's `voice(...)` call sites), and downloading them cost 360 files (19.3 MB) on every run — `--voice-all` adds them back for the complete official set. Measured: 120 of the 121 in-mode charIds have a full set — the 17 预备干员 and the mode's own 盟约·辅助干员 have no battle voice at all, so they simply get no entry — 1680 lines of the 2040 upstream, in a manifest of 5694 files / 324.2 MB (files and `stats.voiceChars` in `data/assets.json`).

**Where each line plays — battle only.** Every line comes from a running battle's own event stream or from its settlement, so no hook needs a phase check and the 休整期 stays silent: the shop does not say 干员报到 (a merge-completing buy neither says 任命队长), a retreat does not say 编入队伍 and dragging a piece onto the board in prep says nothing. In battle: 开战 — the first operator deployed says 行动出发 and the others 部署 (the sim's `deploy` events; `setFieldUnits` resets the flag per field — in this mode every piece enters at once, which is why the gate below exists, and a knocked-out operator's redeploy says 部署 again); 接敌 — the sim's new `['engage', id]` (a unit's first attack that hits an enemy, official ENCOUNTER_ENEMY); 技能 — `skillN` from the unit's `skillIndex` (作战中1-4); 选中 — the detail panel opening on an operator **while a battle runs** (`DetailPanel voice` = the game screen's `combat`); 结算 — `resultVoiceSlot()`: 完美作战 ⇒ 3星结束行动 (绝境 / 终极 ⇒ 完成高难行动), 有漏怪 ⇒ 非3星结束行动, 一个没杀 ⇒ 行动失败, spoken by a drawn operator **of that battle's own field** (`resultSpeaker`, from the result's `perPlayer.unitsEnd`: the operators of that field, survivors first, a summon piece never), driven by the runner's new `emit('result', …)` — never the field on screen, so watching a teammate cannot put their operator's voice on the viewer's settlement line (review on #73). `unitsEnd` names each unit by its chess id (`chess_char_*`), so `onResult` passes the chess record's `charId` as `resultSpeaker`'s `charOf`; as merged, the speaker looked for `char_*` ids only and no battle ever said its settlement line (found while porting #73 to 0.2.0; `test/ui/audio.test.js` runs a real battle result through it).

**Why a channel, not SFX.** Voices are 1–4 s long and a battle deploys eight operators, then fires dozens of skills; playing them like SFX would flood the mix. `VoiceGate` copies the official scheduling data (`audio_data.json battleVoice.voiceTypeOptions`): one line at a time, a 1.2 s global gap, a per-unit per-slot cooldown (10 s for 作战中, 3 s for 接敌, 1.5 s for 选中) and takeover when a line's priority beats the playing one by a margin (the official 0.1 s `crossfade`) — the priorities are the official ones (BATTLE_START 100, ENCOUNTER_ENEMY 90, SKILL_ACTIVE 70, PLACE_CHAR 20, FOCUS_CHAR 10) and the settlement lines get 85, above 作战中 but below 接敌. Every deferred step of a line — its decode, its `onended`, the safety timer — carries its own token and returns without touching the gate once it is stale, so a line taken over while it was still loading can never free the channel its replacement just took (review on #73). The channel has its own gain and its own slider (设置 干员语音 / VOICE; `sanitizeSettings` adds `voice`, so a saved profile without it keeps the default and players can turn voices down without losing SFX). The buffer cache also gained a decoded-PCM budget (64 MB) beside its 180-entry cap: a voice decodes to ~0.4–1.3 MB, and 180 of them would be ~100 MB.

**[ASSUMED].** 接敌 as "the unit's first attack on an enemy" (the official trigger is the first enemy it encounters, not necessarily one it hits) and the settlement mapping (漏怪 ⇒ 非3星, 完美作战 in 绝境 / 终极 ⇒ 完成高难行动) are our readings. Lines follow the field on screen: watching a teammate's battle (前往查看) plays *their* operators' lines, while the settlement line fires for the player's own battle only (`e.own`, `battle/runner.js`) and is spoken by an operator of that battle's own field (`resultSpeaker`). 部署 and 选中干员 stay in the plan although the official groups them with the prep lines: a battle *does* play them (the first operator says 行动出发 and the others 部署, and the detail panel says 选中 while a battle runs), so only the three slots no call site ever asks for are dropped — `VOICE_PRIORITY` / `VOICE_COOLDOWN_MS` keep every level, so `--voice-all` restores 编入队伍 / 任命队长 / 干员报到 for the day the 休整期 speaks again.

- Tests: `test/ui/audio.test.js` (the priority table, the settlement slot and its speaker, the gate's global gap / per-unit cooldown / takeover, the stale-callback regression, and the battle events that drive the lines against a fake Web Audio), `test/ui/gameLogic.test.js` (the `voice` setting), `test/sim/battle.test.js` (the wire format: every emitted tuple is a known `EV` — the new `engage` included); the manifest's 1680 voice paths are covered by `test/assets.test.js`.


### 21.31 变形同构体 counts for operator talents and tokens (player report, the owner's decision 2026-10-04) — `kits/tier1.js` (隐现 火力支援), `kits/tier5.js` (`inFaction`), `kits/tier6.js` (`hasBond`), `tokens.js` (“耀阳”)

- **Reported** (a player after 0.1.1): "变形同构体的效果有问题". The audit found the item's rule implemented in four places (`match/bondsMeta.js pieceBonds`, `sim/content/support/index.js unitBonds` → `isMember`, `support/meta.js withGrants`, `ui/gameLogic.js grantedBonds`) and honoured everywhere the game asks support for membership — the bond counts (prep, both views, the battle input, the battle; all 36 pairings on the real match path), the bond effects (core + add-on, the 6-member tier included), the item gates ("若携带者为【X】盟约干员" = `items/battle.js memberOf`, which reads `unitBonds`), the prep 特质 / 机变 / band dispatch and the client (成员列表, 同构 chip, 天赋栏) — **except four content sites that read the chess record's `bonds` directly**: 隐现 火力支援's 【拉特兰】 ammo-ally pick, `inFaction` (拉特兰 / 卡西米尔 / 谢拉格 / 萨尔贡·米诺斯 ally auras and counts), `hasBond` (蕾缪安's 通缉 marker and S3 ammo share, 新约能天使's 铳弹协约, 耀骑士临光's previous-deploy combo, 荒芜拉普兰德's 叙拉古 count) and “耀阳”'s previous-deploy 卡西米尔 check. A converted wearer was a member of the granted bond for the bond, for equipment and for the UI, but not for those talents.
- **Official**: band 变形者集群 "与特定装备一同装备时装备者将视为特定盟约成员"; the item's eff_acarm073 "携带者获得额外盟约（由另一件携带装备而定）"; the talent list of `trap_1073_acarm073` (14 pairings, PRTS). No primary source states whether "视为成员" reaches the operator talents' own "【X】干员" tests — §21.11 had carried it as [ASSUMED].
- **Decision** (the owner, 2026-10-04): "视为成员" covers them, like it already covered the bond counts, the bond effects and the item gates — fix all four.
- **Now**: each site reads `support.unitBonds(u).includes(bond)` (the same rule `memberOf` uses; 调和's enjoyment is still not a nation/talent membership). One namespace note: `unitBonds` falls back to `u.def.raw.bonds`, so a def that carries only the raw record now counts its bonds too.
- **Not changed**: the bot's item targeting (`match/bot.js targetOf` for a `requiresBondId` item) still looks for a carrier by the record's bonds, so an AI seat never hands a signature item to an operator converted through 变形同构体 — AI behaviour only, the rules above are the player's.
- One-line flip: restore the four `(u.def.bonds || []).includes(…)` expressions (and the §21.11 / §21.20 notes).
- Normative lines rewritten with it: §6.3 (membership), §21.11 (its [ASSUMED] note), §21.20 (the [ASSUMED] list).
- Tests: `test/content/morph-talents.test.js` (one test per site, each failing before the change: 新约能天使 铳弹协约 0.09 → 0.18, 缇缇 勇气的报偿 20 ASPD, “耀阳” 1 → 2 bursts, 隐现's pick), plus the existing morph suites (`test/match/morph-bonds.test.js`, `test/ui/morph-bonds.test.js`, `test/content/items.test.js`) and `test/docs-consistency.test.js`.

### 21.32 拉普兰德's first refresh must be one that can pay out (player report after 0.1.1) — **withdrawn in the v0.2.0 merge**

> **Withdrawn (2026-10-07, the v0.2.0 merge).** Upstream investigated the *same* community report for 0.2.0 and pinned the
> opposite reading: `test/match/feedback5-bench-traits.test.js` — "her trait fires on the first manual refresh she sees
> this round: a refresh made while 叙拉古 is inactive **spends it** … Pins; no change", backed by
> [history/0.1.1.md](history/0.1.1.md) §21.1 ("each copy counts the manual refreshes it sees this round"). The single
> `requireActive` gate before `incPieceCounter` is therefore **removed** from
> `server/sim/content/garrisons/meta.js SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT.onRefresh`, the fork's two tests were
> rewritten to the official behaviour (`test/match/feedback1-meta.test.js`, `test/docs-consistency.test.js`) and the
> player-facing sentences in [PLAYING.md](PLAYING.md) / [META.md](META.md) were dropped. Everything else in the entry
> below (the per-copy counting, §21.35's newly gained piece) still holds. To restore the fork's reading, put
> `if (requireActive && !bonds.some((b) => ctx.bondActive(b))) return;` back in front of the counter and flip the three
> tests back. The rest of this section is the pre-merge record, kept for reference.

- **Reported** (a player after 0.1.1): "拉普兰德的效果期望是获得后第一次刷新生效，实际是下一次'休整期首次刷新'生效".
- **Reproduced** on the real match path (`g.buy` / `g.move` / `g.refresh`): deploy 2 叙拉古, buy 拉普兰德 — she waits in the 整备区, and a hand piece counts for no bond (`computeBonds`, 叙拉古's countMode BOARD), so 叙拉古 is still inactive — refresh: her per-copy counter reached `refresh_cnt` 1 while `addAll(… requireActiveOf(garrison))` had nothing to raise (`PlayerState.addLayers` refuses while the bond is not active), so the round's one trigger was spent on a refresh that granted nothing. Deploy her (3 叙拉古, active) and refresh again: the count was 2 ≠ 1 → still nothing; `pieceRoundCount` is keyed to the round, so the +4 only landed at the **next prep's first refresh** — the exact symptom of the report.
- **Fix**: a refresh is her first refresh of the round only when the effect can pay out — `requireActiveOf(garrison)` and none of `bbStr.bond` active ⇒ the handler returns **before** `incPieceCounter`. Deploying the 3rd 叙拉古 in the same prep (she herself included) leaves the trigger intact, so the next refresh grants +4, and every later refresh of that round is spent exactly as before. Nothing else changes: the per-copy counting, the board-or-hand scope, "temp pieces do not count", the elite-merge and re-bought-copy [ASSUMED]s of §21.1.
- **Official**: garrison_123_a/_b "使**已激活的**【叙拉古】层数+4(+8)" — the effect itself is conditional on the bond, and the trigger instance is what counts (§21.1); PRTS has no note on a refresh taken while the bond is inactive. Read as: an instance's first refresh is the first one it can act on.
- One-line flip: drop the `requireActive` guard before `incPieceCounter` (every manual refresh counts again, as before §21.32).
- Normative lines rewritten with it: §21.1 (the "#1 now" bullet), §21.20 (the [ASSUMED] list), `docs/PLAYING.md` (the player-facing rule), `docs/META.md` (the `onRefresh` row and `incPieceCounter`).
- Tests: `test/match/feedback1-meta.test.js` (new: buy with the bond inactive, refresh → nothing **and the trigger kept**, deploy → refresh → +4 in the same prep, a second refresh → nothing, the next prep's first refresh → +4), the four §21.1 tests unchanged, `test/docs-consistency.test.js`.

### 21.33 The shop bar's row is one box in every state, and C folds it (player report after 0.1.1) — `css/screens/game-shop.css --shopbar-row`, `ui/fieldHost.js hudBands / HUD_REM`, `screens/game.js` (the band re-fit, the `C` key), `ui/shopBar.js`, `ui/gameLogic.js shortcutFor`

- **Reported** (a player after 0.1.1, two screenshots of the same round 11 prep — 1400×636 and 1920×872, both with the promotion reward up): "让休整阶段的商店可收起，以避免阻挡干员整备区；同时稳定场地大小，有人反映有时商店会阻挡场地有时不会". In the first the bar's cards sat over the 整备区 pads; in the second the same bar, the same offer and the same board were clear of them — and the board was framed differently in the two.
- **Reproduced** through the mock harness at both sizes and at 1920×1080 (`test/ui/playtest5-ui.e2e.test.js` §21.33): `phase=PREP` fits the prep camera to the bar of that moment (`hudBands` measures `.shopbar__row`'s top; `clearHud` keeps rows 6.5–12.5 — the bench to the field's back row — between the bands), then the promotion reward replaces the bar's cards and its 晋升奖励 banner — ≈ 2.42rem against the cards' 2.24rem — grew the row by 9.1 px at 1400×636, 11.8 px at 1920×872 and 14.2 px at 1920×1080, pushing the bench pads' near corners under the bar (the first screenshot), while any later camera request re-measured the taller row and re-framed the board (the second).
- **Cause**: the row's height was its content's, and the content changes *within* a prep (the offer banner, a wrapped tool row, a web font that lands late); the band is only read when a camera is requested, and nothing re-reads it afterwards. Whether the bar covered the bench therefore depended on when the camera was last fitted — the report's "有时…有时不会".
- **Official**: the shop bar is one row of cards (research 06 §11.2: the bar spans y 74 %→97 % at 1080p = one row) and a promotion reward is three price-0 cards inside it (research 01 §7 item 3, "the official intro shows 'II 0 ×3'"), so the row the official camera was fitted to is that one row's height — the banner is the remake's label for an offer's source (§21.2), and it has to fit the row rather than grow it.
- **Fix**: the row is one constant box — `.shopbar { --shopbar-row: 2.24rem }`, `.shopbar__row { min-height: calc(var(--shopbar-row) + .2rem + 3px) }`, `.lvcard` / `.scard { height: var(--shopbar-row) }`, and the banner capped at it (`.rwtag { min-height: 0; max-height: var(--shopbar-row); overflow: hidden }`, its title / sub the parts that give way, 稍后 pinned to the bottom). The reserved band is unchanged — `HUD_REM.shopBarTop` stays `0.2 + 0.1 × 2 + 2.24` = 2.64rem, the measured band `.2rem + the row` — so no camera moved and no board changed size: measured 122 px per bench tile at 1920×1080 before and after, and the row's top and height are identical before / after the offer arrives at all three viewports.
- **Second, a safety net** for any HUD box that still changes: `screens/game.js` observes the bar and the bond strip (`ResizeObserver`, one re-fit per frame) and calls the view's `resize()`, which re-measures the band and re-applies the camera in use — no flight, no new request. Verified by growing the strip by content: one re-fit, the board re-framed and the back row clear again.
- **The fold (the report's first half)** already existed — public issue #5 / §21.27, the funds card's ✕ 收起 → the official shop-collapsed camera (measured here: 72 → 87.7 px per bench tile at 1400×636, i.e. +22 %). It is now reachable by keyboard as well: `C` toggles it whenever the bar is shown — it is not a shop action, so it also works while the bar is not editable (准备就绪 / round start), and it is ignored while the enemy pen owns the folded state (the pen restores it on the way back). Both buttons carry the hint (`<kbd>C</kbd>`, `title`).
- One-line flip: drop `.shopbar__row`'s `min-height` and `.rwtag`'s clamp (the row grows with the banner again, and the bench can be covered), or delete the re-fit effect in `screens/game.js`.
- Normative lines rewritten with it: §19.8 (the shop-bar band: the row is one constant box, and a HUD box that changes re-fits the camera), `docs/PLAYING.md` (收起 / C, and that the bar no longer changes the board's framing).
- Tests: `test/ui/playtest5-ui.test.js` (the CSS invariants: the variable, the row's min-height, both card heights, the banner's clamp, and `HUD_REM` derived from the variable), `test/ui/playtest5-ui.e2e.test.js` (§21.33: the offer arriving mid-prep at 1400×636 / 1920×872 / 1920×1080 — the row's top and height, the board's tile size and every bench pad's free fraction unchanged; and `C` folding the bar, the board growing, the bench clear), `test/ui/gameLogic.test.js` (`shortcutFor` `C` → `collapse`), `test/docs-consistency.test.js`.

### 21.34 The debug console: any operator / item, 资金, 盟约层数 and the 调度中心 level, for a connection the host allows (the owner's request, 2026-10-04) — `shared/protocol.js` (the five `g.dbg*`), `shared/constants.js` (`CONSOLE_LIMITS`, `ERR.NO_CONSOLE`), `server/net.js isLoopbackIp`, `server/lobby.js parseConsoleMode / consoleAllowed`, `server/match/console.js`, `match/Match.js` (one dispatch line), `match/PlayerState.js` (`seat.console` → `m.private.console`), `ui/console.js`, `ui/gameActions.js` (`actions.dbg`), `screens/game.js` (the button, the `` ` `` key), `ui/components.js` (the `terminal` glyph), `css/screens/game-console.css`

- **Asked** (the owner, testing the remake himself): "添加一个控制台，让我在测试时能获取任意干员和道具，自主调整货币和盟约层数" — a test tool, not gameplay: put the match into the state he wants to look at (a bond at 200 layers, an elite nobody owns, a level-6 shop) without playing the rounds that reach it.
- **Where it lives**: the panel is `ui/console.js` (one overlay of its own — 干员 / 装备 / 资源 / 盟约 tabs, a search + tier filter, a command line — built from the modal frame's classes but with a light, blur-free backdrop, so the game it is setting up stays readable behind it; the outer div keeps the `modal` class, so the game's R / F / D / Space stay blocked while it is open), opened by the corner's terminal button or the `` ` `` key and mounted by `screens/game.js` **only while `m.private.console` is true**. Its model half — the row builders, the filters, the steppers, the command parser — is hookless (`test/ui/console.test.js`).
- **Who may**: the server, never the client. The lobby decides it per connection in `startMatch` (`consoleAllowed(console, session.addr)`: loopback only under the default `'auto'`), so the packaged Android app and a desktop dev browser have the console while a client over the LAN or the internet does not; `SP_CONSOLE=1` / `0` (`Lobby` option `console`) forces it on / off, and `Match` seats built directly (tests, tools) have it off unless the seat asks. A seat without it gets `ERR.NO_CONSOLE` for every `g.dbg*` — the console does not exist for it (`isLoopbackIp` is strictly narrower than the platform's `isLocalIp`: a tunnel's public client resolves to its own address, so it never qualifies).
- **The five intents** (`server/match/console.js`; each a thin wrapper over the API the game itself uses, so the invariants hold for console-made state too):
  - `g.dbgChess {chessId}` → `PlayerState.acquireChess` with `source: 'console'`: ANY chess record, elite ids included. The shared pool is consulted but never required — a copy is taken when one is left, and a banned / hidden / exhausted operator is created holding 0 copies, exactly like an effect grant with the pool empty (pool.js); merges and the hand → temp overflow behave as for any gain (a third copy still merges to the elite). It answered `HAND_FULL` while hand **and** temp were full until upstream 0.2.6 (PR #630) made the temp queue an expandable one — a gain now queues behind the five visible slots instead (`server/match/player/pieces.js` `stow`), so the fork's branch is the defensive contract with `acquireChess`, not the normal answer (`test/match/console.test.js` pins the queued copy).
  - `g.dbgItem {itemId}` → `acquireItem` (an identical normal pair merges into the golden item).
  - `g.dbgFunds {funds}` → set 资金 outright (0 … 9999; **no** stats — `fundsGained` / `gold` stay the player's own record).
  - `g.dbgLayers {bondId, layers}` → set one bond's 盟约层数 outright (0 … the official `BOND_LAYER_CAP` 999; 0 forgets the entry). A direct write with no `onLayers`: a tester sets a state, he does not play a gain, so layer 特质 do not react (the settling writers go through `addLayers` for the same reason). Layers still do not activate a bond — members do.
  - `g.dbgLevel {level}` → set the 调度中心 level (1 … the mode's `maxShopLevel`, above it `BAD_TARGET`) **and re-roll the shop for that level's slot count** (frozen, unsold slots survive — `rollShop {keepFrozen}` like a round start; `levelUp` itself only moves the level and lets the next refresh follow).
- **Refused**: a finished / disposed match (`WRONG_PHASE`) and an eliminated player (`ELIMINATED`); unknown ids are `BAD_TARGET`. The console ignores 准备就绪 (a tester fixes the state he is looking at) — the *intents are not* phase-gated beyond that, because a grant mid-COMBAT simply waits in the hand and a layer set lands on the next battle.
- **Client**: the panel never mutates state — every tab and every command line goes through `actions.dbg`, i.e. the shared `act()` wrapper (its sound, its error toast), and the next `m.private` redraws the game and the panel. The steppers clamp to `CONSOLE_LIMITS` **before** sending, and the command parser's output is fed to `validateC2S` in the tests, so a typed line is never refused for its shape. Commands: `chess <干员> [精锐]` · `item <装备>` · `funds <资金|±n>` · `bond <盟约> <层数|±n>` · `level <等级|±n>` · `help` (names resolve by exact id, exact name, then the unique partial — an ambiguous term lists its candidates and sends nothing).
- **The row list**: 干员 = every visible non-elite chess by tier then data order (`UnitThumb`, bond chips; hidden / 内置 behind the 隐藏 / 内置 toggle), 装备 = the shop items (非商店 / 奇术 behind its toggle, `ItemIcon`), 盟约 = the mode's bonds **in the data order and never re-sorted by layers** (a row a tester is stepping must not jump; the mode's 本局禁用 bonds sit behind the toggle, tagged) with the current 层数, the ±1 / ±10 steps and a 设为 field.
- One-line flip: set `PlayerState.console = false` (or `SP_CONSOLE=0`) and the whole feature is gone server-side; drop the `m.private.console` gate in `screens/game.js` and the panel is offered to everyone (every intent would then come back `NO_CONSOLE`).
- Normative lines rewritten with it: §8.2 (the C→S list), §8.3 (`m.private.console`), §21.20's decision table is untouched (this is a tool, not a rule); `README.md`'s environment table (`SP_CONSOLE`), `docs/PLAYING.md` §11 (the player-facing panel and what it is offered to).
- Tests: `test/match/console.test.js` (the guard — NO_CONSOLE for a seat without the flag and nothing changes; `m.private.console`; an eliminated player / a finished match; every op incl. pool-empty and banned chess, the elite, the merge by grant, the item pair, the clamping, the level re-roll keeping frozen slots, `validateC2S`'s bounds, `parseConsoleMode` / `consoleAllowed` / `isLoopbackIp` — and over real sockets: a loopback client is granted it and its intents land in `m.private`, a server started with `console: 'off'` refuses them), `test/ui/console.test.js` (the rows / filters against the real data, the steppers, the parser incl. that every command it produces passes `validateC2S`), `test/ui/console.e2e.test.js` (opt-in `SP_E2E=1`: the button and the key, no panel without the grant, a grant through the 干员 tab and through the command line, the funds / level / layer steppers, and the panel fitting 1920×1080 / 844×390 / 756×366), `test/client-static.test.js` (the new module and stylesheet), `test/docs-consistency.test.js`.

### 21.35 A promoted 拉普兰德 fires again: the elite a merge sends is a newly gained operator (player report after 0.1.1) — `match/PlayerState.js _mergeChess / pieceRoundCount / bumpPieceRoundCount`, `sim/content/garrisons/meta.js SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT`, `match/effectsMeta.js incPieceCounter`

> **v0.2.0 status**: **superseded by upstream** — 0.2.0 implemented the same rule itself (GitHub #169: a merged elite is a newly gained piece whose per-piece counters start at 0, so it fires again; `docs/META.md`, `docs/history/0.2.0.md`). Keep upstream's implementation; this entry is history (the paths it names are the pre-0.2.0 layout).

- **Reported** (a player after 0.1.1): "在一个休整阶段，若拉普兰德已触发过效果，参与进阶后的拉普兰德的效果期望是仍能触发，但实际未触发".
- **Reproduced** on the real match path (`g.buy` / `g.move` / `g.refresh`, `test/match/feedback1-meta.test.js`): copy A deployed and copy B in the hand, refresh → +4 (A), refresh → +4 (B), then buy the third copy — the merge consumes A and B and sends the elite. A further refresh that prep granted **nothing**: 0.1.1 carried the consumed copies' highest counter (1) onto the elite in `_mergeChess`, so `incPieceCounter` returned 2 ≠ `refresh_cnt` 1 and her one trigger of the round was already spent.
- **Official**: PRTS 卫戍协议/帮助 §干员的获得与精锐化 — "发送1名【精锐】状态的该干员至手牌区（若消耗已部署至作战区的干员，则发送至作战区对应位置）" — the merge is a **gain**, and garrison_123_a/_b's text is "**获得该干员后**该回合的首次主动刷新…此干员在整备区时也有效". The elite is therefore a 拉普兰德 gained at that moment, and the first refresh after her gain is hers — the same rule that makes a re-bought copy fire (§21.1), and the same reason a copy bought after the round's first refresh still fires (§21.32).
- **Fix**: `_mergeChess` no longer copies the consumed copies' round counters; the elite starts at 0 like every other gained piece. `pieceRoundCount`'s contract and its two comments say so now, and the two [ASSUMED] notes that recorded the old behaviour (§21.1, `garrisons/meta.js`) are gone. Nothing else changes: the per-copy counting, the board-or-hand scope, the single trigger per round, the "only a refresh that can pay out counts" guard (§21.32).
- One-line flip: restore the carry loop in `_mergeChess` (an elite merged from copies that already fired is silent for the rest of the round).
- Normative lines rewritten with it: §21.1 (the "#1 now" bullet and its [ASSUMED] list), §21.20 (the [ASSUMED] list), `docs/META.md` (`onRefresh` / `incPieceCounter`), `docs/PLAYING.md` (拉普兰德's rule).
- Tests: `test/match/feedback1-meta.test.js` (the promoted-elite test now expects the elite's own +8 on the next refresh and only once, with the round's later refreshes still silent; the two [ASSUMED] tests around it unchanged), `test/docs-consistency.test.js`.

### 21.36 The bond strip's discs are bigger and the count chip sits outside them (player report after 0.1.1) — `css/screens/game.css` (`.bslot`, `.bslot .bond`, `.bslot__count`), `css/devices.css` (the short-phone block)

- **Reported** (a player after 0.1.1): "盟约图标过小，数字和图标叠在一起影响阅读" — the strip's discs are 34.7 px at 1280×720 (17.6 px at the supported phone minimum, 1rem = 40 px) and the member / threshold chip ("1/3") is anchored to the slot's top-right corner, where it covered 54 % of the disc and ≈ 13 % of the icon's box.
- **Reproduced** by measuring the boxes in the mock harness (`test/e2e/out/_probe-bond-*.png` during the work, `test/ui/playtest5-ui.e2e.test.js` now): disc 34.7 px with an 11.6 px glyph on the phone, `chipOverDisc 54 %`, `chipOverIcon 13 %` at 1280×720 and 844×390.
- **Official**: research 06 §11.1 — round mint discs with the **stack count over the disc** and the name below; the strip is chrome around a list of icons (css/devices.css's own note). Two numbers on one small disc is a remake addition: the disc carries the round's 层数, the corner chip the 在场 count / next threshold.
- **Fix**: `--bslot-disc` (.60rem on desktop, +15 %; .54rem on short phones, +23 %) drives both the disc and the chip's anchor; the chip moved out of the disc into the slot's corner (`top: -.06rem; right: -.03rem`, `.12rem`, at `-.02rem` on phones so it stays inside the top band); the strip's slot is .78rem (.70rem on phones) and its gap .08rem. The strip's **own box is unchanged** — the name's line-height (1.15) and the disc→name gap (.02rem) give back exactly what the bigger disc takes (`.52 + .05 + 1.5 × .14 ≈ .60 + .02 + 1.15 × .14` = 78 px at 1rem = 100 px, 27 px at 40 px) — so the top band `hudBands` measures is the same, no prep camera moves and no board changes size (122 px per bench tile at 1920×1080 stays). Measured after: disc 40 px at 1280×720, chip over the icon's box 1 % (down from 13 %). (The player's follow-up showed that 1 % was still the icon's top-right edge; §21.39 moves the chip off the disc altogether and keeps this band by starting the strip higher.)
- One-line flip: `--bslot-disc: .52rem` with the old chip anchor (`top: -.04rem; right: .02rem`) — the report's layout is back; the band is unchanged either way.
- Normative lines rewritten with it: §19.8 (the strip is part of the top band the prep camera reserves), `docs/PLAYING.md` (the strip's counts).
- Tests: `test/ui/playtest5-ui.test.js` (the pinned CSS shape: the strip's slot, `--bslot-disc`, the chip's anchor, and `HUD_REM.bondStripBottom` against the box the CSS draws), `test/ui/playtest5-ui.e2e.test.js` (every existing viewport keeps the bench, the temp row and the back row clear, and 1920×1080 keeps the official 122 px per bench tile). [ASSUMED]: the exact rem sizes and the 14-slot width (the 1 % overlap figure is Chrome's).

### 21.37 A bounty enemy's content-spawned child carries no bounty in 联防 (player report after 0.1.1) — `match/unite.js planUnite`

> **v0.2.0 status**: **superseded** — upstream's §23.25 (`docs/history/0.1.3.md`, part of the v0.1.4 base) fixed the same two files (`content/enemies.js spawnChildren`, `match/unite.js planUnite`). Keep upstream's implementation; the `[ASSUMED]` note below is still the fork's.

- **Reported** (a player after 0.1.1): "赏金阶段可选择的部分敌人存在死亡后会生成新敌人的机制，期望上这些新敌人不应有赏金，实际在联防阶段击杀后有赏金".
- **Reproduced** on the real sim (`test/match/feedback1-bounty.test.js`): a 悬赏 card's enemy (磨砻, 术师快艇, 枯朽萃聚使徒 …) dies and its content spawn (木制瑞印 / 控潮术师 / 枯朽之种 …) walks on and leaks; the child inherits the parent's mods — `enemies.js spawnChildren` passes `mods: opts.mods ?? parent.mods` — and `planUnite` read `mods.bountyId`, so the 联防 paid the card's coins again for every leaked child (a real 联防 field paid 3 coins per child, tested through `Battle.addCoins` → the unite result → the killer's pending funds). In the player's own battle the child never paid: `Battle` sets `e.bounty` from the SpawnSpec only, and a content spawn gets none.
- **Official**: the card's text adds **one** enemy and pays whoever knocks **it** down ("为自身下场作战添加1只…，将其击倒者获得 N 资金"; choices.json cards.bounty `payout: 'kill'`). A unit the enemy leaves behind is another enemy. A multi-form target keeps its `defId` (the in-place `reborn` / `husk` helpers), so its real death still pays — the first knock-out is hidden from bounty by design (§21.4).
- **Fix (as merged with upstream §23.25)**: the rule is enforced twice now — `enemies.js spawnChildren` clears the kill-bounty mods when it makes a child (`modsWithoutBounty(opts.mods ?? parent.mods)`: no `bountyId`, no `bountyCoins`; the round's other multipliers still travel, so `fields.js`'s validation against the parent's schedule entry keeps working), and `planUnite` pays only when the leak's `enemyKey === card.enemyKey` (`let bounty = card && card.payout !== 'perfect' && Number(card.coin) > 0 && l.enemyKey === card.enemyKey`, the card record carrying the key from `Match.addBounty`) — the local fork had reached the same rule from the planner side alone (GitHub #67 / #89-2 and the player report are the same mechanic; the child re-enters 联防, is billed to its leaker, and the enemy itself keeps paying). A content bounty with no card (a band replacing a unit: `mods.bountyCoins`) has no key to test against and keeps paying for any leak that carries it [ASSUMED].
- One-line flip: drop `l.enemyKey === card.enemyKey` from `planUnite` **and** the `modsWithoutBounty` call in `spawnChildren` (every leak that carries the id pays again).
- Normative lines rewritten with it: `server/match/unite.js`'s header, `server/match/fields.js`'s leak-mods note, `docs/META.md` (the 悬赏 / `mods.bountyId` rows), `docs/PLAYING.md` (悬赏).
- Tests: `test/match/feedback1-bounty.test.js` (three tests: the three reported families through the planner; the real 磨砻 dying on a real stage with its two 木制瑞印 leaking — the merged tree asserts the children carry **no** bounty mods while the round's own mods and source survive, and that the planner pays nothing for them; and a real 联防 field whose helper kills everything, where the enemy alone pays and its spawn collects nothing), plus the existing 悬赏 suites and upstream's `test/match/feedback3-*.test.js`.

### 21.38 准备就绪 asks twice (player report after 0.1.1) — `screens/game.js` (`READY_CONFIRM_MS`, the arm state, the key handler), `ui/hud.js ReadyToggle / TopBar`, `css/screens/game.css .readybtn.is-armed`

- **Reported** (a player after 0.1.1): "开始游戏后右上角的准备就绪易误触，请添加确认机制（即第一次点击后需再点击一次确认）".
- **Where it sits**: `.gtop__right` — the countdown, the overtime warning and then the button, in the corner the pointer crosses when a modal or the settings gear closes. The same action is bound to `Space` (`shortcutFor`), so a stray key press readied a player too.
- **Fix**: the first press (or `Space`) only **arms** the button: it turns amber, shows the warning glyph and the label 再点一次确认, and `data-armed="1"`; the second press within `READY_CONFIRM_MS` (4 s) sends `g.ready`. 取消准备 is one press, `priv.ready` arriving from the server disarms, and a phase or round change disarms, so the button never stays primed for a much later press. The state lives in `screens/game.js` (a ref for the key handler, which is registered once) and only the look lives in `ReadyToggle`; the server's protocol is untouched, so every `g.ready` rule (temp row, phase, 托管) behaves exactly as before.
- One-line flip: `if (r === true && !readyArmedRef.current)` → drop it (one press readies again; the CSS still marks `is-armed`, which then never shows).
- Normative lines rewritten with it: §19.1 (the HUD's buttons), `docs/PLAYING.md` (the ready button and the shortcut table).
- Tests: `test/ui/mock.e2e.test.js` (Space and a click: the first only arms — the label, `is-armed`, no `g.ready` —, the second confirms, 取消准备 is immediate, and the arm lapses after 4 s), `test/e2e/client.mjs` (`Client.ready()` presses until the toggle is on, used by the opt-in suites), `test/ui/real.e2e.test.js` (its own `ready()`), `test/docs-consistency.test.js`.

### 21.39 The bond strip's discs grow again and the count badge leaves them (player follow-up after 0.1.1) — `css/screens/game.css` (`.bslot`, `.bslot .bond__name`, `.bslot__count`), `css/devices.css` (the short-phone block), `ui/fieldHost.js HUD_REM.bondStripBottom`

- **Reported** (the same player, after §21.36 shipped): "继续调大盟约图标，现在图标仍被激活人数挡住" — the .60rem disc with the chip in the slot's corner still put the number on the icon.
- **Reproduced** in the mock harness: the chip's box covered **8.0 %** of the disc's face, **10.2 %** of the tier ring and **2.65 %** of the glyph at 1rem = 40 px (the phones; 1.3 % / 3.3 % / 0 % at 1rem = 100 px) — the corner of the slot is inside the disc there, because the disc fills the slot's width. The measurement became the test (`test/ui/playtest5-ui.e2e.test.js`, sampling the chip's box against the disc's face, the glyph's circle and the ring's circle).
- **Fix**: the discs grow to `--bslot-disc: .68rem` (from .60rem, .52rem two reports ago; +13 %) in a .86rem slot, `.62rem` in a .78rem slot on short phones (+15 %), and the count badge leaves the disc entirely: it is anchored **above** the tier ring — `bottom: calc(100% + var(--bslot-disc) * .12)`, while the ring's outer edge is at .082 of the disc above the disc's top (`.bond__ring` r = 46 of a 100-unit viewBox scaled to 120 % of the disc, css/components.css) — so it covers neither the face, nor the glyph, nor the ring, at any disc size, count width or slot width. Its right edge sits on the disc's right edge (`right: calc((100% - var(--bslot-disc)) / 2)` = the slot's own margin), so the badge reads as belonging to the disc under it. The name stays one line (`.15rem` / 1.1). The badge is a `.12rem` / 1.2 chip again (it is off the icon now, so the numbers can be as large as §21.36's) and the badge itself is absolute: it costs no height.
- **The band stays where it was on the desktop, and the phones pay**: the strip's own box grew with the discs — `--bslot-disc + .02 + .15 × 1.1` = **.865rem** (`.68 + .02 + .165`) where §21.36 had kept it at the original `.52rem` disc's `.78rem` — so `.gm__bonds` starts **.09rem higher (1.27rem)**, and the top band `hudBands` measures is the 2.14rem it was (measured in the mock at 1920×1080: strip bottom 214 px before and after; `.bonds` offsetTop 136 → 127 + offsetHeight 78 → 87). Every desktop prep camera is therefore unchanged (`test/render/projection.test.js` compares the parameters exactly), and 1920×1080's official 122 px per bench tile is untouched.
- **On short phones the strip starts at 1.30rem** (was 1.1rem), because the badge must clear the top bar's painted boxes and the fill camera must still leave the bench free — the two pull in opposite directions and 1.30rem is the measured window: the badge's top lands at 41.3 px (the `.gtop__center` panel's bottom is 40 px = 1.0rem at 1rem = 40 px, the difficulty tag in the strip's own column 37 px), and the bench pads stay 100 % free at 924×424, 932×430, 915×412, 844×390 and 756×366 — at 1.34rem the fill camera leaves 924×424's bench pad 7 four percent under the shop bar (the fill's 1 px `HUD_GAP` is what the pad's top-face edge needs; the old 1.1rem band only cleared it because the band had slack to centre in). The phone top band is 1.30 + .62 + .12 × 1.1 = **2.05rem** (was 1.77rem), i.e. the phone board pays ~4 % of its height for readable icons. `HUD_REM.bondStripBottom` stays 2.16rem, the conservative fallback for a page without the strip (the desktop measures 2.14rem, the phones 2.05rem).
- §21.62 (2026-10-30) changed what the ring *reads* — one member-progress arc instead of the tier segments; its geometry, which this section's badge placement is measured against, is unchanged.
- One-line flip: `--bslot-disc: .60rem` with the old corner chip (`top: -.06rem; right: -.03rem`, §21.36) and `.gm__bonds { top: 1.36rem }` (1.1rem on short phones).
- Normative lines rewritten with it: §19.8 (the strip is part of the top band the prep camera reserves), `docs/PLAYING.md` (the strip's two numbers), `ui/fieldHost.js`'s HUD geometry note.
- Tests: `test/ui/playtest5-ui.test.js` (the pinned CSS shape and `HUD_REM.bondStripBottom`), `test/ui/playtest5-ui.e2e.test.js` ("the count badge leaves the disc, the glyph and the tier ring alone": the sampled coverage is 0 at 844×390, 756×366, 915×412, 1920×1080 and 1440×900, the badge overlaps nothing in the top bar, the strip's box is .865rem ± a pixel, and the 16-viewport bench / temp / back-row sweep is unchanged), `test/docs-consistency.test.js`, `test/ui/hud-bands.test.js` (the fallback band). [ASSUMED]: the exact rem sizes, and that a badge floating just above the ring is the right reading of "挡住" (a phone layout with no vertical room for it would have to give the badge its own line under the name).

### 21.40 A 本局禁用 disc keeps the layers it holds (community report after 0.1.1, 2026-10-06) — `ui/bondStrip.js` (BondStrip's `b.off` branch), `test/ui/feedback1b-bonds.test.js`, `test/match/layer-sources.test.js`

- **Reported** (relayed to the owner): "盟约『谢拉格』在搭配盟约『灵巧』叠加层数时好像有问题，实际叠加层数相比期望过少" — a player pairing 谢拉格 with 灵巧 read the pair as holding fewer layers than the operators' own texts promise.
- **Reproduced**: 标准模拟 (FUNNY) puts 灵巧 on the mode's official inactive list — the same list §23.30 and GitHub issue #92 are about (拉特兰 阿戈尔 卡西米尔 灵巧 奥术 奇迹 投资人 突袭 独行 绝技) — so 灵巧 **never activates** there. Its layers still arrive: 灵知 (谢拉格 + 灵巧, garrison_111 「<获得时>自身所属盟约层数+5（无需激活盟约）」) feeds **both** bonds, 锏 (谢拉格 + 卡西米尔 + 迅捷, garrison_65) +8 each, 随身身份牌 (`chess_item_1_04_e`, 「装备时销毁，并使携带者所属盟约层数+3/+6（无需激活盟约）」) +3/+6 to every bond of its carrier, 银灰的盟誓 (`allybuff_select_2_4`) +8 to 谢拉格 / 投资人 / 迅捷. The server sends them (`offBondCounts` → `{ count, layers }`, `bondList` `off: true`) and the **popup** shows them (「层数 N」), but the strip's grey disc drew 本局禁用 with **no number** — so the layers just earned read as lost. (The sources themselves were audited against their data texts and are correct; `test/match/layer-sources.test.js` pins 灵知 +5/+5, 锏 +8 × 3, 溯光星源's garrison_121 +2 per 3 funds **while 灵巧/奥术 are active**, and 随身身份牌 +3 to every bond, an inactive bond and a 变形同构体-granted one included.)
- **Fix**: the off disc carries the layer badge when it holds layers (`layers=${layers}` on `BondDisc`, `noStack` bonds still hide theirs) while the *member count* stays off it — the misleading `N/threshold` of a bond that can never activate is exactly what the 0.1.3 change (§23.30) took away — and its tooltip reads `… · N 名成员 · M 层`.
- Tests: `test/ui/feedback1b-bonds.test.js` (the badge, the 本局禁用 label, the absent member count, `noStack`), `test/match/layer-sources.test.js` (the five sources above), `test/match/feedback3-off-bonds.test.js` (the view still sends `off.layers`), `test/docs-consistency.test.js`.
- [ASSUMED]: that showing the number beats hiding it — the layers are permanent, the server keeps them, and the disc keeps its 本局禁用 label, so it cannot be mistaken for an active bond.

### 21.41 The rotate hint follows the primary pointer, and the stacked corner is judged as a row (browser review, 2026-10-06) — `ui/device.js` (`detectFeatures.pointerCoarse`, `featureClasses`), `test/ui/devices.e2e.test.js`, `test/ui/devices.test.js`

- **Reported** (the e2e review): the multi-device suite had two failures on this machine — `phone-min: .gm__gear hit box 38×38` and `portrait phone: the rotate hint covers the page ... desktop keeps the game`.
- **Reproduced**: this machine is a **touch-screen laptop** (`navigator.maxTouchPoints` 10, `any-pointer: coarse` true, `pointer: coarse` false because the mouse is the primary pointer). `detectFeatures()` built `sp-rotatable` from `coarse` (any pointer) + `screenLandscape !== true`, so a plain 900×1000 desktop window got the 请旋转设备 overlay. For the gear: `.gm__corner` stacks ⚙ / 📖 / ⛶ / 交流 into two rows with `gap: .1rem` (≈4 px on a 640×360 phone) while the touch rule of `devices.css` gives every control a centred `--tap-min: 44px` `::before`; 34 px controls 4 px apart therefore share the pixels between them and the later sibling wins the hit test, so the gear measured 34 + 4 = 38 px.
- **Fix**: `pointerCoarse` = `(pointer: coarse)` or (any coarse **and** no fine pointer at all) drives `sp-rotatable`, so a touch laptop with a mouse keeps the game while a phone/tablet still gets the hint. For the corner, widening the gap was tried first and **rejected**: it grows the corner by ~24 px, moves the HUD band and failed the playtest #5 checks (bench / back row free of the HUD) — so the official layout stays and the *test* judges the stacked controls as a row instead: `max(w, h) ≥ 40` for the free-standing controls, `w, h ≥ 34` for the stacked corner, where the column is the target (a tap anywhere on it hits a control and every control's own 34 px box is fully its own).
- Tests: `test/ui/devices.test.js` (the touch-laptop and touch-first cases next to the split-view iPad / desktop ones), `test/ui/devices.e2e.test.js` (phone-min hit boxes, the 900×1000 desktop window keeps the game), plus the untouched `test/ui/playtest5-ui.e2e.test.js` (the corner's height and the bench it must leave free).

### 21.42 突袭 counts a passive skill as 「技能就绪」 (GitHub issue #49, the maintainer's 0.2.0 plan, 2026-10-06) — `sim/content/bonds/addon/battle.js` (`raidPoll` and the header), `test/sim/issue49-raid-passive.test.js`

> **v0.2.0 status**: **superseded by upstream** — GitHub #49 is fixed in 0.2.0 (`docs/history/0.2.0.md` §25.6.7, `content/bonds/addon/battle.js raidPoll`; `CHANGELOG.md`). Keep upstream's implementation.

- **Reported** (GitHub #49, open, **confirmed by the maintainer and scheduled for 0.2.0**): "突袭盟约:携带被动技能的干员不会在首只地面敌人出现时前压(官方会),「技能就绪」未包含被动" — a 突袭 member whose skill is a passive (缄默德克萨斯 S1–S3, 野鬃 S1, 伊内丝 S3, 耀骑士临光 S2 …) waited out the 10-second idle timer instead of advancing the moment the first ground enemy it can reach stood on the field. The reporter supplied a recording of the official client; the owner's ruling is "被动技能生效中也算技能就绪", the 突袭 check only.
- **Cause**: `raidPoll` gated the jump on `u.skill.ready`, and `SkillRuntime.get ready()` is `!noSkill && kind !== 'passive' && charges >= 1` (`sim/skills.js`) — a passive never charges SP, so it was never ready. `kind === 'passive'` alone does not fix it either: `content/generic.js:150-154` re-types a passive that carries a duration ("N秒内") to `duration` + `activateOnDeploy` (`spCost: 0`, `trigger: 'NEVER'`), and that is the form **every** real member's passive takes — 缄默德克萨斯 S1–S3, 宴 S2, 斯卡蒂 S2, 耀骑士临光 S2 (a first patch that only knew `kind === 'passive'` left all of them at 10 s). The member's only trigger left was the idle path (`no_attack_duration`, 10 s).
- **Now**: `inEffect = sk.active && (sk.kind === 'passive' || sk.spec.activateOnDeploy)`, and the jump fires on `inEffect || (sk.ready && !(sk.active && sk.isTimed))` — a passive counts for as long as it is in effect (the deploy-activated `duration` form included, which is what the parser hands over), while a *running* timed skill someone cast does not (史尔特尔 S3, a toggle she opens herself, is neither). Everything else is unchanged: the member must have nothing in range, and `raidTile` still only offers a landing tile whose range covers the target (§22.2 = issue #51), so a passive member advances onto the enemy once and does not churn afterwards — it has a target in range from then on. Measured on real content at three seeds over 30 s of continuous spawns: one jump per engagement (two when the first target dies), identical to the "one chance per deployment" reading.
- [ASSUMED]: the "always ready" reading of the owner's wording; the issue's own suggestion was "被动视为就绪但只在开启那一刻判定一次" (one chance per deployment). A per-deployment single chance is the fallback if a future report shows a passive member chasing an enemy across the map.
- Tests: `test/sim/issue49-raid-passive.test.js` (both forms — a synthetic `kind: 'passive'` kit and a synthetic `duration` + `activateOnDeploy` kit, each beside a skill-less control on the shore-tile stage of `test/sim/raid-terrain.test.js`: it reaches the tile that covers the enemy inside 0.6 s — long before the idle window — with exactly one non-initial `deploy`, the control stays home, no second jump in the following 4 s, and with no landing tile that covers the enemy it stays deployed **plus** a real-content case over the five ON_DEPLOY passives of the bond, asserting the parser's form, `activateOnDeploy` and the early jump), `test/sim/raid-terrain.test.js` (both triggers, unchanged), `test/content/bonds_addon.test.js` unchanged and passing.

### 21.43 "【X】干员 / 【X】势力的干员" is the 盟约's membership, not the character's nation (deep audit of 谢拉格 / 灵巧 and 变形同构体, 2026-10-06) — `sim/content/kits/tier4.js` (`inFaction` / `isLaterano` / `isKazimierz` / `isKjerag` and their four call sites), `test/content/morph-talents.test.js`

- **Reported** (the owner's follow-up to the 谢拉格 × 灵巧 layer report, §21.40): "深度检查谢拉格和灵巧相关干员以及变形同构体是否有效果生效有误" — check the operators and the items of both 盟约, and the 变形同构体 grant, for effects that never fire.
- **Audited clean** (no change): every layer source of the two bonds reaches the real acquisition / equip / prep-end path — 灵知 and 雪猎 `garrison_111` (+5 / +10 to 谢拉格 **and** 灵巧, 无需激活), 锏 `garrison_65` (+8 / +16 获得时) and `garrison_155` (部署时 +8 / +16, cap 24 / 48), 角峰 +2, 崖心 +3, 蒂比 `garrison_80` (进入休整期时, 已激活), 断崖 `garrison_47` (自身 + 身后一格, `dir: behind`) and 空弦 `garrison_150` (身前一格), 溯光星源 `garrison_121` (休整期结束, 每 3 资金 +2 灵巧 / 奥术, 仅已激活) and 随身身份牌 (+3 / +6, 无需激活) — all reading `unitBonds` / `metaBonds` / `pieceBonds`, which carry the 变形同构体 grant. The bond effects read live layers (谢拉格 ×1.25 and the cold / frozen ×(1.35 + 0.01·L) hit bonus in `installKjerag`, the 6-member cold wind, 灵巧's 10 + L aura with its 40-layer 8-tile milestone), the item gates use `memberOf` (耶拉冈德之泪 requires 谢拉格, 谢拉格不融冰 is ungated as its text says), 凛御银灰's 雪境先驱 and the two tactic cards (银灰的盟誓 +8 team-wide, 谢拉格驰援) are right, and the "谢拉格 层数偏少" community report is the display issue of §21.40, not a lost layer. (`garrison_29_b`, the elite 凛御银灰 hands out, carries no `max_add_count_per_battle` in the data while `_a` caps at 200 — the data is followed as-is and the cap is read per record, so nothing is invented; noted here, not changed.)
- **Cause of the one real defect** (the last four sites of §21.31's rule): `kits/tier4.js` tested the *nation* — `nationOf(a) === 'laterano' / 'kazimierz' / 'kjerag'` — for talents whose text names the 盟约, so every member whose `nationId` differs was skipped: **哈洛德** (kjeragShip, victoria) never received 灵知's 殊途同归 抵抗; **锏** (kazimierzShip, kjerag) never received 焰尾's 红松骑士团团长 22 % physical dodge; **能天使 / 新约能天使** (lateranoShip, lungmen) were never reloaded by 信仰搅拌机's 退休前布道 / 铳骑主考官 — and no 变形同构体 wearer counted for any of the three, although the bond itself, its effects and the item gates all treat the converted operator as a member (§21.31).
- **Now**: one helper per faction on the §21.31 rule — `inFaction(u, bond, nations) = unitBonds(u).includes(bond) || nations.includes(nationOf(u))`, with `isLaterano` / `isKazimierz` / `isKjerag` (the same shape as `kits/tier5.js`'s helpers) at the four sites. The nationId stays a fallback, so the operators a nation test already covered keep their effect; the union only adds members (`unitBonds` carries the chess's own bonds plus the 变形同构体 grant, support/index.js). Mentioning a bond is not membership: the item gates keep `memberOf`, which reads the bonds alone.
- **Not changed**: 玛恩纳's 无动于衷 and 焰尾's own S3 dodge already used the tier5 helpers; `kits/tier1.js`, `kits/tier5.js`, `kits/tier6.js` and `tokens.js` (§21.31) were already right. `match/bot.js`'s equip targeting for a `requiresBondId` item still reads the chess record's bonds, so the AI never hands 耶拉冈德之泪 to a converted operator — an AI-only approximation (the item itself works in a player's hands, `memberOf`), left as-is so no seeded bot decision shifts.
- Tests: `test/content/morph-talents.test.js` — three tests, each with a real member whose nation differs, a converted synthetic wearer and the plain control: 灵知 殊途同归 (角峰 as the case that always worked, 哈洛德, a 变形同构体 + 谢拉格不融冰 wearer, and a plain operator without 抵抗), 焰尾 (锏, a 变形同构体 + 卡西米尔竞技旗 wearer, no aura without the pair) and 信仰搅拌机 S3 (隐现 as the nation case, 新约能天使, a 变形同构体 + 拉特兰桥夹 wearer, no reload without the pair) — every converted case first asserts `unitBonds(...).includes(bond)`, so a regression to a record-bonds read fails on the membership line. `test/docs-consistency.test.js` pins the helper and the four call sites.

### 21.44 缇缇's 封护 stacks on every 沉睡 application, not only on a new entry (GitHub issue #162, P1, 2026-10-06) — `sim/content/garrisons/battle.js` (`act2autochess_gar_event_allyenemy_sleepstun_inrange`), `test/content/garrisons_battle.test.js`

> **v0.2.0 status**: **superseded** — upstream's §24.8 (`docs/history/0.1.4.md`, part of the v0.1.4 base) is the same fix and 0.2.0's `CHANGELOG.md` repeats it (缇缇 二技能每次让周围敌人陷入沉睡都算一次进入沉睡). Keep upstream's implementation.

- **Superseded by §24.8 after the v0.1.4 merge (2026-10-06)**: upstream fixed the same GitHub #162 in its own way — 缇缇's S2 marks every 封护 pulse as a *new* entry (`Battle.applyStatus`'s `reenter`), and the garrison installer keeps reading `entered` (the same rule as the freeze installer next to it). The behaviour is the one described below (every pulse counts, cap 24 / 48) and the local test still pins it, but the mechanism in the tree is upstream's, so the change to the installer described here is no longer present.

- **Reported** (GitHub #162, open, one line of body and no comments): 「缇缇特性叠层有误」 — 缇缇's trait `garrison_125` 「范围内敌人或干员进入沉睡/晕眩时，已激活【萨尔贡】【精准】层数+1（每场至多24/48）」 never reached its cap; with four enemies standing in her S2 封护 ward it sat at 4 for a whole fight.
- **Measured**: 13.6 s of S2 produced 181 sleep applications and 5 `entered` ones, layers stuck at 4 of 24; 26 s: the same. The cap was unreachable by construction.
- **Cause**: the installer skipped any application whose target already carried the status (`ctx.entered`, `Battle.applyStatus`'s "the target did not carry it before"). Her S2 re-applies sleep to the ward's surroundings every `AURA_IV` = 0.25 s and never removes it, so exactly one application per enemy ever counted.
- **Official**: the trait's own text is 「进入沉睡/晕眩时」 with a per-battle cap of 24 (48 elite); a cap the fastest possible play cannot reach is no cap, and the S2 refresh is where the stacks come from. The freeze installer next to it (`act1autochess_gar_event_enemy_abflag_inrange`, 「进入冻结时」) keeps `entered` — for a freeze the refresh is not an entry.
- **Now**: every successful application counts, refreshes included; `max_add_count_per_battle` bounds it (24 / 48). Measured: 4 enemies in the ward push the pair of bonds to the cap in ~3 s and stop there.
- Tests: `test/content/garrisons_battle.test.js` (`allyenemy_sleepstun_inrange`): an operator asleep in range counts once, an out-of-range stun counts nothing, a *refresh* counts too (the assertion that used to read "a stun refresh is not a new entry"), and 40 refreshes alone reach the cap.

### 21.45 琳琅诗怀雅 S2's 香槟炸弹 goes into the placement cross, enemy tile first, and needs no target (GitHub issue #116 item 2, P1, 2026-10-06) — `sim/content/kits/tier3.js` (`SWIRE2_BOMB_GRID`, the S2 `install`), `test/content/kits_t3.test.js`

> **v0.2.0 status**: **superseded by upstream** — GitHub #116 item 2 is fixed in 0.2.0 (`docs/history/0.2.0.md` §25.6.1, `kits/ops/chess_char_3_04-swire2.js installS2`). Keep upstream's implementation.

- **Reported** (GitHub #116 item 2, open, with the PRTS link and its 「※香槟炸弹放置范围」 diagram): 「二技能的香槟炸弹放置范围有问题，只会在攻击范围里放置」. Owner's 0.2.0 note: "按技能范围 x-6，有敌人时丢在敌人所在格，没有敌人也会丢".
- **Cause**: the placement loop walked `gridKeys(skillGrid ?? unit.rangeGrid)` — S2's *attack* range, range id `1-1` = the single tile ahead — and the whole handler hung off the `attack` event, so with nothing to attack she never threw one at all.
- **Now**: the candidates are the 5-tile cross around her (`SWIRE2_BOMB_GRID`, the official `x-6`; this snapshot's generated data carries no `x-6` row, so the grid is written out from the PRTS diagram) minus the tiles `freeTile` / `groundTile` refuse (the caster's own tile and a 倒地干员's are among them); a ground enemy standing on one of them is preferred — the bomb bursts on contact, which is the point of the skill — otherwise any free tile of the cross. The trigger is her attack cycle: on the attack as before, and — like S1's coin heal (§23.8) — on her own timer (her attack interval) when the last attempt found no target, which is the "没有敌人也会丢" half.
- [ASSUMED]: the cross shape (the owner's `x-6` is not in this tree's data) and the cadence of the no-target path (one bomb per attack interval).
- Tests: `test/content/kits_t3.test.js` (the first bomb is placed with nothing in range, paid by 大买家's coin, on a tile of the cross; the armed-bomb double hit now runs on a deterministic cross tile — the only cross tile off the walker's route is taken by another operator — with her purse emptied so the hits belong to that bomb; the 倒地干员's tile still takes none while the other cross tiles do), `test/sim/loadout-summons.test.js`, `test/content/tokens_devices.test.js`, `test/content/kits_alt_t3.test.js` and `test/data.test.js` unchanged and passing.

### 21.46 秘术师 charges on its own clock, not after the attack cooldown (GitHub issue #181, P1, 2026-10-06) — `sim/professions.js` (`installMystic`), `test/sim/issue181-mystic-store.test.js`

> **v0.2.0 status**: **superseded by upstream** — GitHub #181 is fixed in 0.2.0 (`docs/history/0.2.0.md` §25.7.1, `professions.js installMystic`). Keep upstream's implementation: it stores at the **attack check** (a unit with nothing to engage stores on its first check, then one energy per attack interval), while the fork's own clock waited one interval for the first charge. The fork's `test/sim/issue181-mystic-store.test.js` went with it — upstream's `test/sim/feedback5-mystic-store.test.js` pins the official rule (and 0.2.1's full-potential values).

- **Reported** (GitHub #181, open, with the reporter's own `battleHarness` breakpoint notes): 深靛's 特性 (秘术师 「找不到攻击目标时，储存攻击能量，最多3个…下次攻击时消耗所有储存的能量」) 蓄力 during 束缚 is zero and the first charge costs two attack intervals.
- **Measured**: a 4 s 束缚 that starts inside the cooldown of the last attack produced no charge at all (the accumulator only ran once `atkCd` had reached 0), and with the field cleared the first orb came at 2 × interval.
- **Cause**: the tick gate `unit.atkCd <= 0 && !unit.trait.hadTarget` couples the charge clock to the attack cooldown — `atkCd` runs out a full interval after the attack, so the clock started late or never — and `trait.hadTarget` is refreshed by `ai.js updateAlly` only on a tick that finds `atkCd === 0`, i.e. it is stale for exactly the window the clock is about.
- **Now**: the clock asks the engine's own gate, `profile.canAttack(battle, unit)` (the same probe `ai.js:80` uses, which for 深靛 already means "nothing in range, or only 束缚 enemies"), every tick, independent of `atkCd`; engaging something resets the accumulator, since an attack spends everything stored. Measured: the first charge with an empty field comes one interval in (was two), a 束缚 that begins inside a cooldown charges for its whole length (stored 1 after 3 s), and her attack interval while bound is unchanged.
- Tests: `test/sim/issue181-mystic-store.test.js` (the first charge inside one interval with nothing on the field; a 束缚 inside an attack cooldown charges — the assertion the old gate failed — and she holds fire on the bound enemy, then attacks when it ends and the projectile spends the charge; the first charge after the field clears comes one interval after the last enemy died), `test/content/kits_t1t2.test.js`, `test/content/kits_alt_t1.test.js` and `test/sim/professions.test.js` unchanged and passing.

### 21.47 引星棘刺 S1 is an AUTO skill and fires the moment its SP fills (GitHub issue #124, P1, 2026-10-06) — `sim/content/kits/tier5.js` (`skchr_thorn2_1`), `test/content/kits_alt_t5.test.js`

> **v0.2.0 status**: **superseded by upstream** — GitHub #124 is fixed in 0.2.0 (`CHANGELOG.md`, `docs/history/0.2.0.md` §25.7; only-caster AUTO skills fire when SP fills). Keep upstream's implementation.

- **Reported** (GitHub #124, open; the maintainer's comment agrees): 「一技能不会在满技力时自动释放」 — 度算浪波 (`skillType: AUTO`) stayed at 7/7 SP with nothing on the field and only cast once an enemy stood in range.
- **Cause**: this tree's convention is that an AUTO skill carries no 技能策略 and the kit writes `trigger: 'SP_FULL'` itself (`kits/tier1.js` 雷蛇, `kits/tier3.js`, `kits/tier4.js` 琳琅诗怀雅, `kits/tier5.js` — six sites); 引星棘刺's S1 was missing the line, so it fell back to the data's `DEFAULT` row (an enemy in the initial range). Measured: 0 activations in 12 s with an empty field, 1 with an enemy; the same spec with `trigger: 'SP_FULL'` casts twice in 12 s.
- **Now**: `trigger: 'SP_FULL'` on the S1 spec. Nothing else changes — `instantKind`, the 法阵's `onStart` and its `projectile_delay_time` are untouched.
- Tests: `test/content/kits_alt_t5.test.js` (a new case: with an empty field and no enemies at all, `rule === 'SP_FULL'`, `manual === false`, SP filled to `spCost`, an activation inside 3 s and the 法阵 on the lowest-HP ally; the pre-existing S1 case keeps covering the effect itself).

### 21.48 不屈 banks a refused landing instead of spending the roll (GitHub issue #108, P0, 2026-10-06) — `sim/content/bonds/addon/battle.js` (不屈), `sim/Battle.js` (`_checkRedeploys`, `_deploy`), `test/content/feedback3-indom-exits.test.js`

- **Reported** (GitHub #108, open, P0): 「史尔特尔被禁疗死亡以后，无法吃到不屈效果立即复活」 at 200 layers. The owner's reply: 余烬 blocks the lethal blow and the retreat ~8 s later does roll 不屈 and redeploys her; "没复活通常是原格被占".
- **Complementary upstream fix (v0.1.4, kept)**: upstream's own 0.1.4 entry for GitHub #108 is a different half of the report — 盟约详情 shows the layer-grown probabilities (不屈 / 迅捷 / 奇迹) capped at 100 %, matching what the effect can actually pay out (§24). Both are in the tree; neither replaces the other.
- **Measured**: the reported case does **not** reproduce — with the rest tile free, 200 layers (p = 0.98) and 240 (p = 1) both show the 余烬 retreat at 8.03 s and an immediate redeploy, ten seeds. What does reproduce, for 史尔特尔 and for a plain knock-out alike, is the occupied case: the death handler rolls (`u.mem[ID.indomShip]` is set), `Battle.redeploy` refuses (a living unit or another 倒地干员 on the rest tile), and the handler then does **nothing** — no revive, no bank, the full 70 s timer, and the automatic redeploy later charges DP as usual. The roll is silently eaten.
- **Cause**: 立即重新部署 was implemented as a one-shot `Battle.redeploy()` call; the other half of PRTS's own note — 「令受益者**下次部署**的再部署时间和费用归零」 — was never implemented (the 傀儡师 branch of the same handler already banks a zeroed deployment in `mem.indomFreeDeploy`).
- **Now**: when the immediate redeploy is refused, the deployment is banked on the unit instead: `u.respawnAt = battle.time` (no timer left) and `u.freeRedeploy = true`. `Battle._checkRedeploys` reads that flag — the automatic redeploy that follows the moment the tile frees costs 0 DP (its `cost` is 0, so it no longer waits for the purse either) — and any deployment clears it (`_deploy`), so the bank cannot leak onto a later one. Measured: down at 240 layers with the tile taken, the roll is visible, nothing is spent, and she is back on the same tick the tile frees with the player's DP untouched.
- [ASSUMED]: which states can take the landing at the moment of the roll. Within the engine's own rules the rest tile is chosen to be free (`_layBody` only moves a body home when home is unreserved, and every public move refuses a 倒地干员's tile), so the refusal is a defensive branch; 联合作战's shared board, a device and a future content path are the plausible ways in.
- Tests: `test/content/feedback3-indom-exits.test.js` (a new case: the landing is taken — written straight into the occupancy map, since every public move refuses that tile — the roll fires, `freeRedeploy` is set and `respawnAt` zeroed, she stays down while the tile is occupied, and the moment it frees she is back with no DP spent; the existing §23.3 cases — 撤退 / merchant / 替身, the 突袭 and 联防 exemptions, a missed roll — are unchanged and passing).

### 21.49 麻痹, 诱导 and 暴露 have status icons (GitHub issue #171, P1, 2026-10-06) — `render/style.js` (`STATUS_ICON`, `STATUS_GUESS`), `render/textures.js` (`STATUS_KEYS`, `drawStatusIcon`), `test/render/tiles.test.js`

- **Reported** (GitHub #171, open, one line): 「优等生神经损伤不生效」 — 麻痹 (the 神经损伤 burst's 3 stacks, one normal attack each) did not seem to do anything.
- **Measured**: the sim side is complete — the gauge fills, `applyStatus('palsy', { value: 3 })` lands, the three stacks each cancel one normal attack (a 深池伙友卫队's attacks at 20.2 / 24.2 / 28.2 s vanish and it resumes at 32.3 s), and the server really sends `['status', id, 'palsy', 1]`. The client had no `palsy` mapping: `statusIconKey` answered null, `render/units.js` drops a null icon, and nothing was ever drawn above the enemy — the effect was invisible.
- **Cause**: the status key was never added to `STATUS_ICON` / `STATUS_GUESS` / `STATUS_KEYS`. The same silence covered `attract` (诱导) and `reveal` (暴露 / 照明); `unblockable` is deliberately left without a badge (a unit property, shown in the info panel).
- **Now**: `palsy → palsy`, `attract → attract`, `reveal → reveal` with their own atlas glyphs (a bolt, a bent arrow, an eye) and keyword fallbacks for namespaced keys (`ab:palsy`, `skill:attract_point`). Measured: every key of the sim's `STATUS` catalogue now resolves to a frame the atlas draws, `unblockable` excepted.
- Tests: `test/render/tiles.test.js` (`every status the sim can apply has an icon, and 麻痹 is one of them` — reconciles the sim's whole catalogue against the client's map, which is the check that was missing; the pre-existing "every `STATUS_ICON` value is drawn in the atlas" loop covers the new frames).

### 21.50 The newer snapshot owns "is this unit on the field" (GitHub issue #100, P2, 2026-10-06) — `render/app.js` (`syncBattle`), `render/units.js` (`syncView`, after the v0.2.5 merge), `test/render/downelem.browser.test.js`

- **Reported** (GitHub #100, open): 「重锤击晕泡泡后会出现倒地和起身循环的抽搐动画」. The maintainer could not reproduce it and asked for a recording.
- **Cause**: `syncBattle` drives a view from two sources that disagree for one snapshot interval: `interp.sample` interpolates the **previous** snapshot, `interp.downAt` returns the **newest** one's 倒地 list, and the two blocks run in that order. A unit knocked out while stunned is the case that shows it — its last living frame has `hp > 0` with the STUN anim, so the sample keeps satisfying `s.anim !== ANIM.DIE && s.hp > 0` and the view is revived; `setDown` (which runs later in the same frame) then calls `die()` again and clears `dying`, re-arming the revive for the next render frame. At 16 ms frames against ~100 ms snapshots that is six stand-up / lie-down cycles per snapshot.
- **Now**: the down list is read before the sample loop and the revive yields to it — a unit the newest snapshot lists as 倒地 is not stood up by a stale sample; the next frame, whose sample carries the redeploy, brings it back as before. No other path changes: `setDown` still owns the pose and the ring, and a redeploy seen only in a snapshot still revives (the sample reaches it a frame later). Upstream v0.2.5 hoisted this per-view step into `render/units.js syncView(v, s, t)`, so the revive the fork guards now lives there: the id set travels as a fourth argument, `syncView(v, s, renderT, downIds)`, and `syncView` skips the revive for a view on that list.
- Tests: `test/render/downelem.browser.test.js` (the knocked-down countdown / DP / redeploy phase, unchanged and passing with `RENDER_E2E=1`).
- [ASSUMED]: the twitch itself. No recording of the report exists, and the fix is an ordering change — "the newest snapshot decides who is on the field" — that is right by construction rather than by observation; the browser test still passes, and no new assertion pins the loop because the harness cannot see a `die()` that is immediately undone.

### 21.51 导出 says so when the browser refuses the download (GitHub issue #173 item 3, P1, 2026-10-06) — `screens/loadout.js` (`downloadText`, `ioDownload`)

- **Reported** (GitHub #173, open): the local V1.03 build showed no operators / bonds / maps / enemies and 导出失败. Measured here: the manifests and the files on disk are complete (5699 `/assets` paths and 1481 `/assets` local ones, none missing or mis-cased; `test/assets.test.js` 46/46), and the distribution root cause is that `.gitignore` never carries `public/assets` / `public/fonts` / `data/local-assets.json` — a source ZIP or `git clone` without `npm run setup` has no art at all, while a static server rooted anywhere but `/` also breaks (`public/index.html` and `data.js` use root-absolute paths). Neither is a code defect; what *was* one is the export: `downloadText` swallowed every failure, so 导出 could do nothing at all without a word.
- **Now**: `downloadText` returns whether the browser took the download and `ioDownload` toasts `浏览器拒绝了下载，请改用「复制」` when it did not — 复制 (the clipboard path) was already the documented alternative.
- Tests: `test/ui/loadout.e2e.test.js` (the 导出 / 导入 dialog, unchanged); the failure branch needs a browser that refuses the download, so it is not covered by an automated case.

### 21.52 首启下载素材：a slim APK without `public/assets` (the owner's request, 2026-10-13) — `android/scripts/assemble-nodejs.mjs` (`--slim`), `android/scripts/art-set.mjs`, `android/scripts/pack-art.mjs`, `android/scripts/build-apk.ps1` (`-NoArt`), `android/scripts/nodejs-template/{index.js,assets.mjs,art-container.mjs,art-id.mjs,community.mjs,asset-pack.json}`, `android/web/{index.html,launcher.js,launcher.css}`, and on the server side `http/config.js` (`serveDirs`), `http/static.js` (`assetsDir`), `http/media.js`, `http/files.js` (the `assets` mount keeps the long cache policy), `index.js`, `tools/fetch-assets.mjs` (`SP_ASSETS_DIR`, exported `main(argv)`); documented for players in `android/README.md` the pointer file `pack.json` at the repository root, and for installs in `docs/DEPLOY.md` §4.1 / `docs/ARCHITECTURE.md`

- **Why**: the shipped APK was 561.6 MB, of which `public/assets` was **520.8 MB** (12 634 files, 659.6 MB raw; audio 192.3 / spine 108.8 / local 84.7 / char 70.0 / ui 39.2, the rest ≤ 11 MB each). Everything else — the embedded Node 24 runtime (27.6 MB packed), the client, the server, the data, the fonts — is **37.9 MB**. So every release meant downloading all 561 MB again, and an install cost 561 MB of APK *plus* a 695 MB unpacked tree (~1.26 GB). The fork publishes a second, **slim** APK — measured **40.6 MB (42 545 725 B, `sha256:e0cc0bfb…9d22`)** — that downloads the art on first launch: updates then cost ~40 MB and an install ~0.75 GB. The full APK keeps shipping unchanged as the default; both carry the same application id, so a phone has one of them installed, not both.
- **How the art gets there** (`android/scripts/nodejs-template/assets.mjs`): the maintainer packs `public/assets` into **11 part files** (64 MiB of raw payload each, measured **526 937 196 B / 502.5 MB**; `pack-art.mjs`) plus a per-file index (1 487 866 B) and a manifest (`SPART1` container, gzip record stream; `art-container.mjs`). On the phone the staged entry point starts the server first — so the room is joinable immediately and `server-ready` is never delayed by a download — and then fetches the manifest, the index and each part into `<files>/nodejs/art`, resuming with an HTTP `Range` request, verifying every part against the manifest and every unpacked file against the index (written as `*.part-tmp`, then renamed), and writing a state file that makes the next launch a no-op. Progress, errors, retry and cancel go to the launcher page over the plugin's bridge (`art-progress` / `art-done` / `art-error` / `art-skipped`; `retry-art` / `skip-art` back, because the plugin can only start the engine once per app launch). Sources are tried in this order: an explicit `SP_PACK_BASE`, then the **pointer** `pack.json` on the `android` branch (two mirrors of a ~200-byte file; it names the manifest and the bases, so moving 502 MB to another host or another release is a commit instead of a new APK), then the addresses baked into the APK (`asset-pack.json`) — the `gh-proxy.com` mirror first, then GitHub itself, because a direct `github.com` from a phone network tends to hang rather than refuse (a pointer gives up after 10 s, the manifest and the index after 30 s, a part after 60 s). The parts live in a release of their own (`assets-0.2.5`), so the App release carries only the two APKs.
- **The pack is identified by its art, not by the app version** (`art-id.mjs`, shared by the packer and the app): `artId` is the first 12 hex of a sha1 over the canonical JSON of `data/assets.json`'s `hash` plus `data/local-assets.json`'s `count`/`groups`. A release that only changed code computes the same id, so the pack on the phone stays valid and nobody re-downloads 502 MB; a real art change computes a new id and the pack is refused (a pack without an id, built before 0.2.6, still falls back to comparing app versions). A completed tree is a **fast path with no network at all** — no manifest, no 1.5 MB index — unless `SP_ART_VERIFY=1` asks for a full re-hash.
- **Where the art lives, and why not in `public/assets`**: `@jadejr/capacitor-nodejs` copies the whole unpacked project out of the APK and **deletes it whenever the APK version changes** (`copyNodeProjectFromAPK`: `isAppUpdated()` → `DeleteDir`), so art downloaded into `public/assets` would be re-downloaded after every app update. It therefore lives in `<files>/nodejs/art` — the example of the new server option: `SP_ASSETS_DIR` (or the `assetsDir` option of `startServer`) makes `serveDirs` and the static handler serve `/assets/…` and `/media/…` from there first and fall back to the bundled `public/assets`; unset, the feature is off and the server behaves exactly as before. `tools/fetch-assets.mjs` reads the same variable, and its `main(argv)` is exported so a program without a second Node binary can run a fetch in-process (the app has no `node` executable to spawn).
- **Fallback** (`community.mjs`, `SP_ASSET_SOURCE=pack|community|auto`, default `auto`): when the parts cannot be reached at all, the app runs the repository's own `tools/fetch-assets.mjs` — staged into the slim APK together with the research tables its plan reads and the dependency closure of the Spine parser (43 packages / 9.5 MiB of JavaScript, ~3 MB in the APK) — as `--add-only --asset-source=mirror` against the community dumps a PC install uses. Known limit: those dumps carry no `assets/local/**` (the 3D battlefield scenes, mesh materials and the local-client enemy/token models come from an installed Arknights client, 84.7 MB packed), so a community-only phone keeps the placeholder board and the next launch retries the pack for the rest. The launcher says so instead of pretending the art is complete.
- **Trade-offs** (documented for the player in `android/README.md`): the slim install needs a network for its first launch and ~700 MB of free space, a 502.5 MB download (the same bytes as before, later), and the download runs only while the app is in the foreground (an interrupted part is resumed, not restarted). In exchange the APK is 14× smaller, updates are ~40 MB instead of 561 MB, and the APK's own bytes are not stored twice.
- **0.3.0 additions** (the v0.3.0 merge notes above have the merge side): the same "outside the wiped tree" rule now covers **plugins** — `nodejs-template/index.js` passes `pluginsDir` = `<files>/nodejs/plugins` to `startServer` (the `pluginsDir` option of `serveDirs`) while the templates, guides and schemas ship *inside* the tree (`assemble-nodejs.mjs` mirrors `plugins/` and `schemas/`, exactly as the Docker image splits them with `SP_PLUGIN_RESOURCES`); and the **content-hash index** now reads the external art directory (`rootDirs: { assets: assetsDir }`, server/index.js), so a phone that keeps its art outside the install gets the same `/assets/~<hash>/…` URLs, year-long cache and `immutable` answers as a bundled `public/assets` — measured on the tree extracted from the 0.3.0 APK: `[assets] content hashes: 30 965 files … 5.7 s`, `/data/assets.json` served with all 17 379 URLs hashed, `/media/~<hash>/bgm/…` and the hashed `.mp3` both 200 with `immutable`. The measured sizes of this release (816.8 MB full / 42.0 MB slim / a 725 MB art pack in 17 parts) are in `android/README.md`.
- **Verified** on this machine end to end (`.scratch/test-slim-e2e.mjs`, `.scratch/test-art-negatives.mjs`, `.scratch/test-slim-apk.mjs`, `.scratch/test-real-urls.mjs` — never shipped): the real 502.5 MB pack downloaded from a local server with the first base deliberately dead (base rotation), 12 634 files / 659.6 MB unpacked in 34–38 s, every file byte-identical to the repository's `public/assets`, the packed set exactly the repository's art minus the 35 pruned `local/scene/**/*.png` sources (26.4 MB), a second run a no-op, a 3 MB partial part resumed and completed, and a game server with `SP_ASSETS_DIR` serving the downloaded bytes, the bundled client, `/media/…` audio and 404s unchanged. The **slim APK itself** was unpacked and its entry point run the way the plugin does (cwd `…/nodejs/public`): the server listens first, the art arrives afterwards, and a second launch logs `art complete … 0.0 s` without fetching a part. Then the **published addresses** were used for real (mirror first): 12 634 files / 502.5 MB in 281.7 s (1.78 MB/s), every file verified against the index. Failure modes: a Range-ignoring server still ends with a correct part, a truncated part and a file that contradicts the index are `E_CORRUPT` after the retry budget, a pack for another app version is refused, dead sources are `E_NETWORK`, damage is noticed by the verification pass, and the community fallback loads and honours its argv in-process. The pointer path was checked against the live files: both `pack.json` mirrors resolve, a dead pointer falls back to the baked list, and the moved release's manifest, index (hash checked against the manifest) and first 61 MB part are intact. `android/test/art-download.test.js` (10 cases, in the repository, `npm test` in `android/`) pins all of this down without a network: pointer hit / miss / fallback, art-id hit and mismatch, the no-request fast path, resume against a Range-ignoring server, truncated part, tampered index, a file that contradicts the index, dead source and missing configuration. Not verified: the actual download on a phone (no arm64 device here), and Android killing the app in the background.

### 21.53 战斗中观战队友 (the owner's request, 2026-10-17) — `server/match/match/watch.js` (`_watchClient`), `public/js/battle/observe.js` (`observeTarget`), `public/js/ui/combatHud.js` (the observing pill, `ownRunning`), `public/js/screens/game.js` (`watchPlayer` toast, the `client.ownRunning` prop), `public/css/screens/game.css` (`.chud__ownrun`)

- **Requested**: 「添加战斗中也可以观战其他人的功能」. Until now `g.watch` refused a living player's watch of another
  normal field while its own normal battle ran (`WRONG_PHASE 'own battle running'`) and the client mirrored the refusal
  (`observeTarget` → 「作战中无法查看队友，作战结束后可前往查看」). The official game behaves the same way (research 09
  §3.1: 「Normal combat, own battle running: team avatars are not watchable」), so this is a **deliberate fork deviation**.
- **Why it is safe**: the page's runner already steps an authoritative battle it is not displaying (`running()` in
  `public/js/battle/runner.js` keeps `e.authoritative && !e.resultSent` going while `cur` is another field), and its
  progress / leak / result reporting ran on the same path — measured by the new case in `test/match/runner.test.js`
  (「watching a teammate while the own battle runs: the own battle keeps ticking and reports」): with the teammate's
  replica on screen the own field still sends `b.progress` and its `b.result` still lands. The watched field is a
  display replica (`b.start watch: true`), exactly like a watch after one's own battle.
- **Now**: `Match._watchClient` only refuses the other pair's boss field (`BAD_TARGET 'other group hidden'`); the client's
  `observeTarget` answers `{ fieldId, live }` (`live`: the viewer's own battle is still running) and the game screen
  toasts 「已切到 {name} 的战场；你自己的作战仍在进行，随时可以返回战场」 once. The observing pill carries
  「你的作战仍在进行」 next to 返回战场 while that holds. The own battle's leaks / LP keep moving on the top bar (the
  runner publishes `state().leaks` for every local normal field, not only the one on screen).
- **Kept**: 联防 / 最终攻势 rules (the ‹ › halves, the hidden other pair, the eliminated / spectator freedom) and the
  server-run combat mode (which never refused it).
- Tests: `test/match/observe.test.js` (the new `{ fieldId, live }` answers), `test/match/clientCombat.test.js` (a
  fighting player's `g.watch` now answers ok and the replica is `watch: true`), `test/match/watch-bonds.test.js` (a
  fighter may watch a teammate's field while its own runs, and the own `b.start` still exists), `test/match/
  runner.test.js` (the test above).

### 21.54 作战统计升为实时排名 (the owner's request, 2026-10-17) — `public/js/ui/combatMetrics.js`, `public/css/screens/game.css` (`.combat-metrics__sorts` / `__sortbtn` / `__owner` / `__live`), `public/js/screens/game.js` (the panel's `watching` / `names` props), `public/js/ui/settings.js` (the hint)

- **Requested**: 「增加一个能实时查看干员伤害，dps 或者治疗量，hps 排名的功能」. Upstream's panel (PR #618) already listed
  the viewer's own operators sorted by damage with DPS / HPS next to them; it could not re-sort, and it always filtered
  on the viewer (`combatMetrics({ ownerId: myId })`), so a watched teammate's numbers never showed.
- **Now**: the four metrics are the sort switch — 伤害 / DPS / 治疗 / HPS, descending, rank numbers recomputed
  (`rankRows`, pure and tested) — and the rows are read **without** an owner filter, so 当前战斗 is the battle on screen
  (the own one, or the teammate's field while 观战) with each row's owner chip (the teammate's name; `ownerLabelOf`), and
  本局累计 adds every battle this page simulated in the match — including the fields it watched. A 「实时排名」 tag sits in
  the title, the totals line says 「含观战：{name}」 while watching one, and the note states what is counted (this device
  only; effective HP loss / effective healing; same-name operators merged, summons counted for their owner; reset on
  reload). Nothing is sent to the server.
- Tests: `test/ui/combat-metrics-rank.test.js` (`rankRows`, `ownerLabelOf`), `test/match/runner.test.js` (the existing
  metric suites; the match view is no longer owner-filtered, so the row sets now come from the local battles only) and
  `test/ui/gameLogic.test.js` (the 作战统计 settings row / hint text).

### 21.55 本局地图 (the owner's request, 2026-10-17) — `public/js/ui/stageMap.js`, `public/js/screens/briefing.js` (`StageMapCard`), `public/js/ui/matchInfo.js` (the strategy draft's 本局信息 dialog), `public/js/ui/enemyDrawer.js` (the in-match 本局信息 tab), `public/css/screens/briefing.css` (`.stagemap*`, `.brief-stage--map`)

- **Requested**: 「添加在准备阶段查看地图的功能」 — the phase the owner named is the briefing (「查看禁用盟约和最终 boss 的阶段」,
  INFO_CHECK 「1/2 确认本局信息」, and the strategy draft's 本局信息 dialog that repeats it). Until now that screen listed the
  stage only by name (「战场#03」) and the pool note; the map itself appeared at the first 休整期, and a boss field never
  before its round.
- **Now**: `stageMapModel(stage, { field })` turns a `data/stages.json` record into a grid of display kinds
  (`tileKind`: ground / high / wall / fence / water / hazard / spawn / goal / entry / exit / void, from the tile's own
  `tileKey` / `height` / `buildable` / `special` — display only, placement still comes from `placementContext` and the
  server) for one of two fields: `normal` = board rows 9–12, both halves, with the own deployable region (`GEO.FIELD`)
  outlined, and `boss` = rows 0–5 (最终攻势 / 隐秘核心). `StageMap` draws it as an SVG (no art needed), `StageMapCard` is
  the briefing's BATTLEFIELD line with a 查看地图 button that opens `StageMapDialog` (battlefield + boss field + legend +
  「只显示地形…」 note), the 本局信息 dialog shows the same large map inline, and the in-match 本局信息 tab shows the
  compact card. Nothing of the enemy line-up or the players' boards is revealed: only the terrain both sides see.
- Tests: `test/ui/stage-map.test.js` (`tileKind` per tile kind, the two fields' bounds, the deploy rect, the boss-field
  detection for every stage in `data/stages.json`).
- [ASSUMED] the colour per kind (a UI choice, not official art); the boss field's rows are the same stage record's top
  rows (server/match/board.js `BOSS_RECT`).

### 21.56 语音语言可试听 (the owner's request, 2026-10-17) — `public/js/ui/settings.js` (`VoicePreview`), `public/css/screens/game.css` (`.set-preview`)

- **Requested**: 「添加一个设置，能够调整音量，配置语言语音等」 — the settings modal has had 背景音乐 / 干员语音 / 音效 / 静音,
  语言 and (since 0.2.6) 语音语言 + 本土语言; what it lacked was any way to hear the chosen dub without leaving it.
- **Now**: 试听 beside 语音语言 plays one line of an operator this server has the chosen tree for (`audio.previewVoice`,
  the first operator of `data/assets.json audio` whose Chinese tree and the chosen tree both exist; 本土语言 previews
  that tree). Silent while the voice volume is 0 or muted; nothing is stored; a server without any dub says
  「没有可试听的语音（先下载素材）」.
- Tests: none (it needs an `AudioContext`); the hint and the button are covered by the e2e settings pass, and the pure
  part is the manifest lookup.

### 21.57 层数奖励（维多利亚每 25 层的进度）(the owner's report, 2026-10-17) — `public/js/ui/bondMilestones.js`, `public/js/ui/bondStrip.js` (BondPopup), `public/css/screens/game-panels.css` (`.bpop__ms*`)

- **Reported**: 「有人反映盟约『维多利亚』『每 25 层给予一个随机效果的装备』生效有问题」. The rule's implementation was audited end
  to end and is correct (docs/ISSUES-FIXLOG.md §11 has the evidence: payout while active / inactive then activated /
  in-battle layers at settle / 50 and 100 layers at once / withdraw-and-replace / the pool / elite 维娜's +6 per distinct
  tier — and the four hammers' battle effects, the 加速 one pinned by `test/content/hammer-aspd.test.js`). What a player
  could not see was **where they stand**: the popup showed layers and thresholds but not the 25-layer milestones, and an
  inactive bond pays nothing until it lights up — the shape of the reports from the older builds.
- **Follow-up (same day, the test phone)**: the full APK's first launch unpacks 1.05 GB out of the APK and took
  150–180 s on a Galaxy C7 2016, so `android/web/launcher.js`'s 180 s wait (120 s host + 60 s ready) expired just before
  the server bound its port; it is 300 s now (the slim pack's 54 MB tree is unaffected). `android/README.md` step 3 and
  the release notes carry the measured numbers.
- **Now**: the bond popup gained 层数奖励 — one line per `bonds.json layerMilestones` entry (每 N 层 / 首次达到 N 层 / 达到 N 层),
  the payouts already reached, the next one's layer and how many layers are missing, and, while the bond is inactive,
  「盟约未激活：这些层数已经累计，激活时立即补发（每档只发一次）」. Pure `milestoneModel` (tested by
  `test/ui/bond-milestones.test.js` against 维多利亚 / 远见 / 奇迹 / 迅捷, and against every other bond showing nothing) — the
  payout stays the server's one implementation (`server/sim/content/bonds/core.js` payHammers).

### 21.58 对局记录与回放 (the owner's request, 2026-10-21) — `server/history/store.js`, `server/lobby.js` (`onMatchEnd`), `server/http/websocket.js` (`history`), `server/index.js` (`historyFromEnv`), `.gitignore` (`data/history/`)

- **Requested**: 「服务器记录已结束的对局，同时实现结束对局的回放功能」.
- **Why not upstream**: the lobby already keeps the last match's frames for a reconnecting client
  (`Lobby.buildReplay`: the encoded `m.public` / `m.result` of the match that just ended, in memory, dropped with the
  room). Nothing survives a restart, nothing lists the matches of last week, and the frames replay only the last screen.
- **Record** (`server/history/store.js`, DESIGN-cited as §21.58 because this file is the fork's design): one JSON per
  finished match under `SP_HISTORY_DIR` (default `data/history/`, ignored by git) plus `index.json` (newest first, at most
  `limit` = 100 entries; older files are deleted). A record carries the meta (id `<endedAtMs>-<roomCode>`, room, mode,
  difficulty, rounds, result, seed, app version), the seats (playerId, name, isBot, seat, LP) and **`battles[]`** — each
  field's `spec` (the deterministic input a client re-simulates, docs/SIM.md) plus its result. No frames and no private
  state: a `b.start` spec is enough to replay a battle byte for byte on the same build. A record over `maxBytes`
  (4 MiB) keeps its meta and drops the specs (`truncated: true`, `replayable: false`).
- **Hook**: `Lobby.onMatchEnd` builds and stores the record before the match reference is dropped; a store failure is
  logged and never fails the match. `SP_HISTORY=off` disables recording (`opts.history` wins in tests), `SP_HISTORY_DIR`
  moves the files. The server's `startServer` result carries the store (`history`). Under `node --test`
  (`NODE_TEST_CONTEXT` is set in every test file's process) the store stays off unless a test passes one, so a suite that
  starts a hundred servers leaves no records in the checkout.
- **API** (`server/http/routes.js`): `GET /api/history[?limit=N]` → `{ v: 1, matches: [...] }` (list entries only, newest
  first, `limit` capped at 500); `GET /api/history/<id>` → one record including the `spec`s; an unknown id or a deeper path
  is a JSON 404 (never the HTML error page). Both are `no-store`. With `SP_HISTORY=off` the route is absent and the path
  falls through to the static files, which the client reads as 「这台服务器没有开启对局记录」.
- **Client** (`public/js/ui/historyClient.js`, `ui/serverHistory.js`, `ui/battleReplay.js`, `screens/stats.js`): a fifth tab
  「服务器记录」 in 统计数据 — the server's list, a row opens its battles (round / kind / kills) and 「回放」 opens the player.
  The player re-simulates the spec in the page (`InPageSimHost` from `battle/simHost.js`, the same engine the game screen
  runs), feeds `view.pushSnapshot` / `pushEvents` at 30 Hz × the chosen speed (1× / 2× / 4×, pause, restart) and frames the
  field the way the game does (`view.enterBattle` + `view.setCamera`). No video, no server round-trip; the page loads the
  sim data files once (the same ones a match loads), which is why the first 回放 shows a spinner for a few seconds.
  A record from another build (`record.app !== APP_VERSION`) warns that the picture may differ.
- Tests: `test/match/history.test.js` — `buildMatchRecord` (spec from `f.spec` or `Battle.opts`, result of a server-run
  field, a match without battles not replayable), the store (index round-trip across a reopen, prune deleting the file,
  the size cap, the id guard, an unreadable record) and a real `startServer` + `room.start` + `finish` writing one record;
  `test/match/history-api.test.js` — the list, `?limit`, one record, the 404s and a server without a store;
  `test/ui/history-client.test.js` — the page's reading of the wire (404 = off, a body without battles refused, the list
  cached for 5 s, a failed fetch retried, a record fetched once).

---

### 21.59 联机人数上限可提到 8 人 (the owner's request, 2026-10-23) — `shared/constants.js` (`MAX_SEATS` 8 / `DEFAULT_SEATS` 4 / `MIN_SEATS` 2), `shared/protocol.js` (`room.create.capacity` / `room.setCapacity`), `server/lobby.js` (`Room.capacity`, `setCapacity`), `server/match/gamedata.js` (`bossPoolShareOf`), `public/js/ui/settings.js` (`RoomSeats` — 设置 → 人数上限), `public/js/screens/room.js` (seat cards), `public/js/screens/settle.js` (card strip), `public/css/screens/{room,settle}.css`, `public/css/screens/game.css` (`.set-seg.set-seats`), `docs/META.md` (§1)

- **Requested**: 「增加房主可选项，让联机人数上限可提高到 8」; then 「将调整人数的功能放在设置内」 (2026-10-23) — the control lives in the settings dialog, not in the create panel or the room header.
- **Default stays official**: a co-op room is still 4 seats unless its host explicitly chooses another capacity — `DEFAULT_SEATS` (4) is what a room without `capacity` gets, so the official 1–4-player room is unchanged for every host who does not touch it. The floor is `MIN_SEATS` = 2 (a 2-seat room trims nothing from the official room), the cap `MAX_SEATS` = 8; a solo room is always 1 seat and refuses a capacity (`BAD_MSG`; `room.setCapacity` there is `BAD_TARGET`).
- **Server** (`server/lobby.js`): `Room.capacity` is the length of `seats` (never compacted) and rides `room.state.capacity`; `room.create { capacity }` and the host-only `room.setCapacity { capacity }` (before the match; like a difficulty change it un-readies the other humans) validate 2–8 and refuse to drop a seated player (`BAD_TARGET` — the highest occupied seat index counts, since indexes never compact). The match needs no further protocol change: the round loop, 联防's ≤ 2 helpers and the boss pairing's `ceil(alive / 2)` groups all follow the alive list (docs/META.md §1).
- **Client**: the host changes the cap in **设置 → 人数上限** (`ui/settings.js` `RoomSeats`, `data-testid="room-capacity"`: seven numbers 2–8 in one row, the rows below a seated player disabled, the change sent as `room.setCapacity`); the row only exists for a co-op room's host before the match. The create screen and the room bar carry no picker any more. The room screen draws `capacity` seat cards (5–8 wrap to two rows), the settlement's card strip scales for 5–8, and the team panel scrolls past the viewport.
- Tests: `test/lobby.test.js` (create/set-capacity bounds, a drop below a seated player, host-only, un-ready), `test/ui/settings-room-seats.test.js` (the dialog owns the control, neither screen keeps one, the seven segments stay in one row) and the room/settlement UI tests.

### 21.60 休整期观战看队友的商店 (the owner's request, 2026-10-23) — `server/match/player/views.js` (`scoutShopView`), `server/match/match/views.js` (`prepFieldMeta` `shop`), `server/match/match/watch.js` (`_sendField` / `_notifyPrepScouts`), `public/js/screens/game.js` (`scoutShop` / `ShopBar` locked), `public/css/screens/game-shop.css` (`.gm__scoutshop-tag`), `docs/META.md` §5

- **Requested**: 「休整期查看其他人时增加对方的商店 UI」.
- **Wire**: the scouted player's read-only shop travels **inside the existing prep-scout `m.field`** (`g.watch 'n:<pid>'`, re-sent when that player's `markPrivate` changes the view) — `{ level, maxLevel, upgradePrice, refreshPrice, freeRefreshes, frozen, slots:[{kind,id,price,basePrice,sold,frozen}|null], funds, deployCap, deployCount, ready, loadout }`; absent outside PREP, never in `m.public` / `m.private`, never the reward offer.
- **Who may see it**: only a player scouting a teammate. A **spectator seat** still gets the board-only meta (`prepFieldMeta(ps, { shop })` is opt-in and watch.js passes it per recipient), so the seat's "never a private view" invariant (test/match/spectator.test.js) holds.
- **Client**: the normal `ShopBar` renders it with `editable: false` under a 「正在查看 {name} 的调度中心（只读）」 badge; cards open their detail but no purchase, refresh, level-up or freeze is ever sent (the state is not in `m.private`, so a locked bar is the only possible rendering).
- Tests: `test/match/spectator.test.js` (the seat still gets nothing private), the room/prep watch tests and the UI suite.

### 21.61 大厅顶栏显示服务器在线人数 (the owner's request, 2026-10-25) — `server/lobby.js` (`onlineCount` / `presenceFrame` / `broadcastPresence`, `welcomeInfo().presence`), `shared/protocol.js` (S2C `presence`), `public/js/main.js`, `public/js/store.js` (`presence` slice), `public/js/ui/components.js` (`PresencePill`), `public/js/screens/lobby.js`, `public/css/components.css` (`.presence`), `docs/design/network.md` (§8), `docs/ARCHITECTURE.md`

- **Requested**: 「添加一个能实时查看服务器在线人数的功能」.
- **What counts**: `onlineCount()` is the sessions in the registry with a live socket (`session.connected`) — a page that is seated, spectating or still in the lobby. A session that keeps its seat through the reconnect window is not online; a bot seat is not a human; a socket replaced by the same token in another tab is the same human.
- **Push, not polling**: `broadcastPresence()` computes the count and sends only when it changed — after a socket attaches (`onHello`: a new or resumed session) and after one closes (`onDisconnect`; `net.js` clears `connected` first). The frame is encoded once and written to every connected session: `{ t: 'presence', online }`. Every `welcome` also carries `presence: { online }` (`welcomeInfo`), so a joining page has the number before the next change.
- **Client**: the store slice `presence { online }` is fed by `main.js` (`net.on('presence')` and `welcome.presence`); the lobby header renders `ui/components.js PresencePill` right after the ping pill — person glyph + number, tooltip 「服务器当前在线人数」, nothing while the count is unknown. The number is server-wide and includes this page; no other screen shows it.
- Tests: `test/presence.test.js` (welcome carries the count; connect/disconnect pushes; a resumed session counts again; a repeat hello and a replaced socket send nothing), `test/ui/presence-pill.test.js` (the server methods and their call sites, the store wiring, the lobby placement, the styles, the two msgids in all four packs).

### 21.62 同盟局内表情点了没反应；盟约条去掉滚动、外圈改看在场人数 (the owner's report, 2026-10-30) — `public/js/ui/emotes.js` (`emoteAt` / `endDrag`), `public/js/ui/gameActions.js` (`quiet: 'cooldown'`), `public/js/ui/components.js` (`BondDisc` `members` / `goal`), `public/js/ui/bondStrip.js` (the cap and the `+N` chip), `public/css/components.css` (`.bond__ring--members`), `public/css/screens/game.css` (`.gm__bonds .bstrip`), `test/ui/bond-strip-cap.e2e.test.js`

- **Reported**: 「同盟模拟时发送局内表情包失败」 — 点表情没有任何反应，气泡也不出现.
- **Cause**: the wheel's cells are sent by their `click`. Once the finger drifts past `DRAG_SLOP_PX` (8 px) the viewport treats the press as a page swipe, and on touch Chrome fires **no click at all** for that gesture — `endDrag` swallowed it and only paged when the travel reached `SWIPE_PX` (40 px), so a 12 px tap did nothing. A mouse click never drifts that far, which is why only touch players saw it. (The server was never the problem: `g.emote` on a coop match — and on a version-hosted one — answers `ok` and broadcasts `m.emote`; checked against a running server.)
- **Fix**: `endDrag` now sends the emote under the pointer when the gesture did not turn a page (`emoteAt(x, y)` → the `.ewheel__item`'s `data-emote`), so a drifted tap is a tap; a real swipe still pages and still swallows the click. The emote's errors are no longer fully silent: `act('g.emote', …, { quiet: 'cooldown' })` hides a **RATE** refusal only (the 1 s chatCD, expected when tapping twice) and toasts anything else, so a future failure cannot look like a dead tap.
- **盟约条**: upstream 0.3.3 replaced the row with a horizontal scroller and ‹ › arrows; the owner asked for both to go and for the disc's outer ring to show **在场人数** instead of the activation tiers (「类似第一级激活和第二级激活」). The strip is the fork's capped row again — at most `max` (14) discs, the rest counted by a `+N` chip (`ui/bondStrip.js`); `BondDisc` gains `members` / `goal`, and with a finite `goal` (the bond's last 满档 threshold) it draws one progress arc `members / goal` (`.bond__ring--members`) instead of the tier segments. The briefing's 本局信息 row keeps the segmented ring (it answers "which bonds does the mode have", not "how many members").
- Tests: `test/ui/bond-strip-cap.e2e.test.js` (headless Chrome: 14 discs + `+N`, no arrows or scroller, the member arc's `data-members` / `data-goal`, the popup still opens; desktop and a 844 × 390 phone), `test/ui/playtest5-ui.test.js` (the band constants the removed arrows used), `test/ui/emotes.test.js` (the pager helpers the fix keeps), `test/docs-consistency.test.js` (§21.40's off-disc props).

---

## Appendix A — this fork's edits inside upstream's own sections

Upstream v0.2.0 rewrote these sections into `docs/design/*` and `docs/history/*`, so the fork's wording
below is not in the upstream files. Each block is the verbatim unified diff of that hunk
(`-` = upstream v0.1.4 / the base, `+` = this fork), with the section it sits in and its line number in the
pre-merge `docs/DESIGN.md`. Nothing else in those lines changed. Where the added text only carries a
cross-reference, the rule it points at is the §21.3x entry of this file.

#### 6.3 Bonds & layers (bondsMeta.js) — old `docs/DESIGN.md` line 381

```diff
-- 变形同构体: an operator wearing it together with an item that has a `giveBondId` is a member of that bond — counted like any member (BOARD: on the board only; once per operator), in the battle, and in the client's member list (tagged 同构) and bond chips (§21.11).
+- 变形同构体: an operator wearing it together with an item that has a `giveBondId` is a member of that bond — counted like any member (BOARD: on the board only; once per operator), in the battle, in the operator talents / tokens that test "【X】干员" (§21.31), and in the client's member list (tagged 同构) and bond chips (§21.11).
```

#### 8.2 Match — old `docs/DESIGN.md` line 428

```diff
-C→S (all carry `rid`): `g.infoReady` · `g.band {bandId}` · `g.bandSkip` · `g.bandFocus {bandId?}` (the strategy highlighted in the draft screen — what a timed-out turn takes; absent / null clears it; `WRONG_PHASE` outside BAND_DRAFT, `ALREADY` after the pick, `BAD_TARGET` for a band not allowed; §18.2) · `g.buy {slot}` · `g.refresh` · `g.freeze` · `g.levelUp` · `g.sell {uid}` · `g.move {uid, to:{area:'board', row, col}|{area:'hand', idx}, dir?}` · `g.equip {itemUid, targetUid, replaceUid?}` (`replaceUid`: which equipped item a third one replaces, §6.2) · `g.art {itemUid, row, col, dir?}` (`dir` ∈ UP|RIGHT|DOWN|LEFT from the deploy wheel, §3; absent ⇒ `to.dir`, then RIGHT; `g.move` onto the piece's own tile re-orients it; board pieces in `m.private` / `m.field {prep:true}` carry `dir`) · `g.destroy {uid}` (hand / temp items only; equipped items are locked, §6.2) · `g.reward {idx}` · `g.choice {idx}` · `g.ready {ready}` · `g.emote {id}` · `g.watch {fieldId}` · `g.autoplay {on}` · `g.pause {on}` (solo battles only, §14 Solo pause) · `g.unitStats {seq?}` (ROUND_START / SP_DRAFT / PREP, else `WRONG_PHASE`; eliminated: `ELIMINATED`) → push `m.unitStats` (§18.5) · `g.leave`
+C→S (all carry `rid`): `g.infoReady` · `g.band {bandId}` · `g.bandSkip` · `g.bandFocus {bandId?}` (the strategy highlighted in the draft screen — what a timed-out turn takes; absent / null clears it; `WRONG_PHASE` outside BAND_DRAFT, `ALREADY` after the pick, `BAD_TARGET` for a band not allowed; §18.2) · `g.buy {slot}` · `g.refresh` · `g.freeze` · `g.levelUp` · `g.sell {uid}` · `g.move {uid, to:{area:'board', row, col}|{area:'hand', idx}, dir?}` · `g.equip {itemUid, targetUid, replaceUid?}` (`replaceUid`: which equipped item a third one replaces, §6.2) · `g.art {itemUid, row, col, dir?}` (`dir` ∈ UP|RIGHT|DOWN|LEFT from the deploy wheel, §3; absent ⇒ `to.dir`, then RIGHT; `g.move` onto the piece's own tile re-orients it; board pieces in `m.private` / `m.field {prep:true}` carry `dir`) · `g.destroy {uid}` (hand / temp items only; equipped items are locked, §6.2) · `g.reward {idx}` · `g.choice {idx}` · `g.ready {ready}` · `g.emote {id}` · `g.watch {fieldId}` · `g.autoplay {on}` · `g.pause {on}` (solo battles only, §14 Solo pause) · `g.unitStats {seq?}` (ROUND_START / SP_DRAFT / PREP, else `WRONG_PHASE`; eliminated: `ELIMINATED`) → push `m.unitStats` (§18.5) · `g.leave` · **the debug console (§21.34, test tool)**: `g.dbgChess {chessId}` · `g.dbgItem {itemId}` · `g.dbgFunds {funds}` · `g.dbgLayers {bondId, layers}` · `g.dbgLevel {level}` — accepted only for a seat the lobby granted the console (`NO_CONSOLE` otherwise)
```

#### 8.3 Exact view shapes (normative for match ⇄ UI) — old `docs/DESIGN.md` line 455

```diff
+  console: false,   // §21.34: may this player use the debug console? (the seat flag the lobby set from his connection)
```

#### 19.8 Settings gear; the shop bar over the bench on phones (#8, #9) — `ui/gameComponents.js`, `render/projectio … — old `docs/DESIGN.md` line 825

```diff
-- **Now**: the view receives the HUD bands, `hudBands(kind, size)` (top = the HUD layer's safe-area top + 2.16rem, the bond strip; bottom = 2.64rem + 3 px, the shop bar; the rem values copy the CSS, which a test checks), and `presetCamera('prep' | 'bossPrep', …, { hud })` runs `clearHud` on the band from the bench's near edge to the back row: the official camera when it fits (0.5 px tolerance), else the smallest pan, else a zoom-out about the centre — a 2D pan / zoom of the image, so picking, the three.js camera and flights stay consistent. Every desktop prep camera is unchanged; the bar stays on the bottom edge (§18.1); the collapsed shop kept the camera — **superseded by §21.27** (public issue #5): folding the shop moves the own prep board to the official shop-collapsed camera (`left_prepare_camera_param`, `presetCamera` `shop: false`) clear of the folded shop's band (`hudBands(kind, size, { shop: false })`: the tab and the corner buttons' hit areas), and unfolding back to the shop camera. Accepted: an armed shop card rises 4 px above the bar on a phone and covers ≈ 3 px of the pads' near corners (≈ 11 px under the official camera at 1920×1080). [ASSUMED] the bond strip's bottom (2.16rem, measured 2.14–2.15rem); the zoom anchor.
-- Tests: `test/render/projection.test.js` (HUD clearance suite), `test/ui/playtest5-ui.test.js`; browser (opt-in, `SP_E2E=1`) `test/ui/playtest5-ui.e2e.test.js` (per-tile coverage at 16 viewports, the armed card, the gear).
+- **Now**: the view receives the HUD bands, `hudBands(kind, size)` (top = the HUD layer's safe-area top + 2.16rem, the bond strip — the constant is the no-DOM fallback: the page measures 2.14rem on the desktop and 2.09rem on short phones since the discs grew, §21.39; bottom = 2.64rem + 3 px, the shop bar; the rem values copy the CSS, which a test checks), and `presetCamera('prep' | 'bossPrep', …, { hud })` runs `clearHud` on the band from the bench's near edge to the back row: the official camera when it fits (0.5 px tolerance), else the smallest pan, else a zoom-out about the centre — a 2D pan / zoom of the image, so picking, the three.js camera and flights stay consistent. Every desktop prep camera is unchanged; the bar stays on the bottom edge (§18.1). The bar's bottom band is one constant row in every state it can show — the cards (`--shopbar-row`, css/screens/game-shop.css) and the 晋升奖励 banner alike, §21.33 — so a prep is framed once, and a HUD box that changes anyway (a font that lands late, a banner that grows) re-fits the camera in use (`screens/game.js` observes the bar and the bond strip → the view's `resize()` re-measures the band; §21.33); the collapsed shop kept the camera — **superseded by §21.27** (public issue #5): folding the shop moves the own prep board to the official shop-collapsed camera (`left_prepare_camera_param`, `presetCamera` `shop: false`) clear of the folded shop's band (`hudBands(kind, size, { shop: false })`: the tab and the corner buttons' hit areas), and unfolding back to the shop camera. Accepted: an armed shop card rises 4 px above the bar on a phone and covers ≈ 3 px of the pads' near corners (≈ 11 px under the official camera at 1920×1080). [ASSUMED] the bond strip's bottom (2.16rem, the conservative fallback for the measured 2.14rem, §21.39); the zoom anchor.
+- Tests: `test/render/projection.test.js` (HUD clearance suite), `test/ui/playtest5-ui.test.js`; browser (opt-in, `SP_E2E=1`) `test/ui/playtest5-ui.e2e.test.js` (per-tile coverage at 16 viewports, the armed card, the gear, §21.33's mid-prep offer and the fold).
```

#### 21. Player feedback after 0.1.0 (v0.1.1) — old `docs/DESIGN.md` line 1140

```diff
-Eighteen workstreams (WA–WR, each on its own branch from master 7f13473) were merged into `feedback1` in the order WB, WA, WE, WD, WC, WI, WM, WN, WO, WL, WG, WH, WJ, WK, WP, WR, WQ, WF, then WB's follow-up from 66 screenshots of 22 matches (bounty lists, the 机密商店 and 战术决策 with repeats) after QA, then batch 6's four in the order WS, WU, WT (on WI's branch), WV (on WC's), then the four closing branches (the gaps, the 突变细胞 bench rule, the issue #5 / #8 client fixes, the draft's match info — each adding its own subsection, numbered §21.26–§21.28 in that merge order) and GitHub's master (PR #10, PR #12); data/*.json was rebuilt by `tools/build-data.mjs --offline` after every builder merge, never hand-merged. The integration fixed a bug already in 0.1.0 (a 联防 battle timed out during 隐德来希 S3 reported its 心烛 as leaks, so the server refused an honest client result — candles carry `mem.noLeak`), the last review of the transform workstream (form fx were still dropped by the render engine), every cross-workstream note worth doing with a primary source, and reconciled the bot with the merged rules — §21.19. §21.20 lists the settled decisions and what stays [ASSUMED]; batch 6 and the pull-request fixes follow it (§21.21–§21.25), then the closing additions (§21.26–§21.29), with what QA of that integration found and the integration fixed: a lent 坚固维式重锤 and in-place revives against the once-per-deployment lock (§21.21), 卢西恩 / 锏 casting for an airborne 蒂比 alone (§21.22), rule 3 for a summon that is gone (§21.24) and when the dispatcher takes its item snapshot (§21.25). Normative lines rewritten with it: §2 (`grid.js`), §3 (the effective `buildable`, the 深水区, range-bound summons, 攻击距离 vs skill ranges), §5.2 (`liveRangeGrid`, `form`), §5.3 (stealth vs area damage, the 奥术 refresh), §5.4 (`kill` / `death`, `foesInRadius`, `loseHp` vs damage, 静态刚体), §5.5 (healers that block, `rangeAoe`, armed enemies, results), §5.6 (TAKE_DAMAGE, `noRangeExtend` / `showOwnRange`, the profession splash radii), §6.2 (rewardOffer, piece `meta.round`, summons in range, returned equipment), §6.3 (变形同构体), §6.6 (the bot), §7 (bounty drafts, 鸭爵, knock-out forms), §8.2 / §8.3 (fx `form`, `m.ticker`, `range`, UnitInfo `items` / `form`, the stealth bit, rewardOffer), §9 (forms, alias tint), §10 (offers, ticker, 本局禁用), §13 (`spine/enemy`), §14 (ground pathing, boss tickers, the runner's form fx), §16, §17.3, §18.5, §18.6 #10, §19.1, §19.7, §20.1, §20.3, §20.6, §20.9; with batch 6: §3 (fenced tiles), §5.3 (`liftoff`), §5.4 (`fatal`, `ignoreSelect`, `redeploy`), §5.5 (bodies and redeploys, blocking, enemy AI), §6.4 (`onBuy`, the item snapshot), §8.2 (`down` row, col), §18.3, §19.7; with the closing additions: §5.6 (TAKE_DAMAGE), §6.2 (the 突变细胞 gain), §6.3 (`harmony`), §6.6 (the band pick, the gained operator), §8.2 / §8.3 (`harmony?`), §9 (`setCamera` `shop`, the model fallback), §10 (the draft's match info), §11 (the boss-field speed bar), §14 / §20.12 (the layer bound), §17.1, §19.2, §19.8, §20.2, §20.9, §20.11.
+Eighteen workstreams (WA–WR, each on its own branch from master 7f13473) were merged into `feedback1` in the order WB, WA, WE, WD, WC, WI, WM, WN, WO, WL, WG, WH, WJ, WK, WP, WR, WQ, WF, then WB's follow-up from 66 screenshots of 22 matches (bounty lists, the 机密商店 and 战术决策 with repeats) after QA, then batch 6's four in the order WS, WU, WT (on WI's branch), WV (on WC's), then the four closing branches (the gaps, the 突变细胞 bench rule, the issue #5 / #8 client fixes, the draft's match info — each adding its own subsection, numbered §21.26–§21.28 in that merge order) and GitHub's master (PR #10, PR #12); data/*.json was rebuilt by `tools/build-data.mjs --offline` after every builder merge, never hand-merged. The integration fixed a bug already in 0.1.0 (a 联防 battle timed out during 隐德来希 S3 reported its 心烛 as leaks, so the server refused an honest client result — candles carry `mem.noLeak`), the last review of the transform workstream (form fx were still dropped by the render engine), every cross-workstream note worth doing with a primary source, and reconciled the bot with the merged rules — §21.19. §21.20 lists the settled decisions and what stays [ASSUMED]; batch 6 and the pull-request fixes follow it (§21.21–§21.25), then the closing additions (§21.26–§21.28), the deliberate trigger deviation for six 重装 skills (§21.29) and the player reports that arrived after that merge (变形同构体的 talents, §21.31; 拉普兰德's refresh timing, §21.32; the shop bar's row and its fold, §21.33), then the user's own test tool, the debug console (§21.34), and the four reports of the round after that (§21.35–§21.38: 拉普兰德's promotion, the bond strip's discs, a bounty enemy's spawns, 准备就绪 asking twice) together with the player's follow-up to the discs (§21.39: the count badge still covered the icon), with what QA of that integration found and the integration fixed: a lent 坚固维式重锤 and in-place revives against the once-per-deployment lock (§21.21), 卢西恩 / 锏 casting for an airborne 蒂比 alone (§21.22), rule 3 for a summon that is gone (§21.24) and when the dispatcher takes its item snapshot (§21.25). Normative lines rewritten with it: §2 (`grid.js`), §3 (the effective `buildable`, the 深水区, range-bound summons, 攻击距离 vs skill ranges), §5.2 (`liveRangeGrid`, `form`), §5.3 (stealth vs area damage, the 奥术 refresh), §5.4 (`kill` / `death`, `foesInRadius`, `loseHp` vs damage, 静态刚体), §5.5 (healers that block, `rangeAoe`, armed enemies, results), §5.6 (TAKE_DAMAGE, `noRangeExtend` / `showOwnRange`, the profession splash radii), §6.2 (rewardOffer, piece `meta.round`, summons in range, returned equipment), §6.3 (变形同构体), §6.6 (the bot), §7 (bounty drafts, 鸭爵, knock-out forms), §8.2 / §8.3 (fx `form`, `m.ticker`, `range`, UnitInfo `items` / `form`, the stealth bit, rewardOffer), §9 (forms, alias tint), §10 (offers, ticker, 本局禁用), §13 (`spine/enemy`), §14 (ground pathing, boss tickers, the runner's form fx), §16, §17.3, §18.5, §18.6 #10, §19.1, §19.7, §20.1, §20.3, §20.6, §20.9; with batch 6: §3 (fenced tiles), §5.3 (`liftoff`), §5.4 (`fatal`, `ignoreSelect`, `redeploy`), §5.5 (bodies and redeploys, blocking, enemy AI), §6.4 (`onBuy`, the item snapshot), §8.2 (`down` row, col), §18.3, §19.7; with the closing additions: §5.6 (TAKE_DAMAGE), §6.2 (the 突变细胞 gain), §6.3 (`harmony`), §6.6 (the band pick, the gained operator), §8.2 / §8.3 (`harmony?`), §9 (`setCamera` `shop`, the model fallback), §10 (the draft's match info), §11 (the boss-field speed bar), §14 / §20.12 (the layer bound), §17.1, §19.2, §19.8, §20.2, §20.9, §20.11.
+
+**The local fork's sections (this tree).** This repository is a fork of the upstream project: it carries the Android build
+(`android/`), the debug console and a handful of player-reported fixes on top of upstream's 0.1.1. Upstream's own
+sections after 0.1.1 — §21.30 (干员战斗语音), §22 (GitHub issues after 0.1.1, v0.1.2), §23 (community reports after
+0.1.2, v0.1.3) and §24 (after 0.1.3) — are merged in unchanged; the fork's reports keep chapter 21, sit immediately
+after upstream's §21.30, and are numbered **§21.31–§21.51** so that both sets of cross-references stay valid. Where both
+sides fixed the same thing (a bounty enemy's spawned child: §21.37 here vs upstream's §23.25) the merged section records
+which implementation the merge keeps.
```

#### 21.1 拉普兰德's first refresh; 突变细胞 is not consumed and its new operator joins the bench (#1, #4) — `sim/content/g … — old `docs/DESIGN.md` line 1154

```diff
-- **#1 now**: each copy counts the manual refreshes it sees this round, on the board or in the hand (`piece.meta.round`, module-prefixed key `garrison:SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT:refreshes`), and fires on the `refresh_cnt`-th. A new piece starts at 0; a move or an in-place promotion keeps the count; a re-triggered trait neither fires nor counts; temp pieces do not count.
+- **#1 now**: each copy counts the manual refreshes it sees this round, on the board or in the hand (`piece.meta.round`, module-prefixed key `garrison:SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT:refreshes`), and fires on the `refresh_cnt`-th. Every newly GAINED piece starts at 0 — a bought or granted copy, a transformed operator, and the elite a merge sends (it is gained, "发送1名【精锐】状态的该干员至手牌区", so a promoted 拉普兰德 fires again; §21.35, players' report after 0.1.1); a move or an in-place promotion (升华) keeps the count; a re-triggered trait neither fires nor counts; temp pieces do not count. A refresh the effect cannot pay out — the bond not active yet, so there is nothing to raise — does not count either: it is not her first refresh (§21.32, players' report after 0.1.1).
```

#### 21.1 拉普兰德's first refresh; 突变细胞 is not consumed and its new operator joins the bench (#1, #4) — `sim/content/g … — old `docs/DESIGN.md` line 1159

```diff
-- [ASSUMED]: an elite merged this round keeps its copies' highest count (no second firing that round); a copy re-bought after a sale fires on its own first refresh ("获得该干员后"; each extra +4 costs 3 + 1 − 1 = 3 funds); a bench carrier (hand or temp) transforms too (the footage shows deployed carriers); a 6阶 carrier becomes another 6阶; with the hand and temp both full the gained operator and an item without a slot follow the rules of every gain (no source shows that case).
+- [ASSUMED]: a copy re-bought after a sale fires on its own first refresh ("获得该干员后"; each extra +4 costs 3 + 1 − 1 = 3 funds; the elite a merge sends is such a gain too, §21.35); a bench carrier (hand or temp) transforms too (the footage shows deployed carriers); a 6阶 carrier becomes another 6阶; with the hand and temp both full the gained operator and an item without a slot follow the rules of every gain (no source shows that case).
```

#### 21.11 变形同构体 wearers in the member list and on the card (C2) — `ui/gameLogic.js grantedBonds / pieceBondIds / b … — old `docs/DESIGN.md` line 1262

```diff
-- [ASSUMED], unchanged: operator talents that test "【拉特兰】/【卡西米尔】/【叙拉古】… 干员" read the record's bonds (kits tier1 内线 ammo pick, tier5 inFaction, tier6 hasBond, tokens.js 卡西米尔 sword) — no source says whether a converted operator counts for them; 调和's +1 raises 在场 for core bonds without a member row (explained since §21.26: 含调和 +1 and a 调和 row).
+- **Resolved after 0.1.1 (§21.31, the owner, 2026-10-04)**: operator talents and tokens that test "【拉特兰】/【卡西米尔】/【叙拉古】… 干员" now read the operator's bonds **incl. 变形同构体 grants** (kits tier1 内线's ammo-ally pick, tier5 inFaction, tier6 hasBond, tokens.js 卡西米尔 sword). No primary source states whether a converted operator counts there; the owner read the item's "视为特定盟约成员" as covering it, like the bond counts and the item gates already did. 调和's +1 raises 在场 for core bonds without a member row (explained since §21.26: 含调和 +1 and a 调和 row).
```

#### 21.20 Settled decisions and what stays [ASSUMED] — old `docs/DESIGN.md` line 1375

```diff
-- §21.1: an elite merged this round keeps its copies' refresh count; a 拉普兰德 re-bought after a sale fires again; a bench 突变细胞 carrier transforms too; a 6阶 carrier becomes another 6阶; with the hand and temp both full the gained operator and an item without a slot follow the rules of every gain.
+- §21.1: a 拉普兰德 re-bought after a sale fires again, and so does the elite a merge sends (both "获得该干员后", §21.35); a refresh the 999-layer cap turns into a no-op still counts (§21.32); a bench 突变细胞 carrier transforms too; a 6阶 carrier becomes another 6阶; with the hand and temp both full the gained operator and an item without a slot follow the rules of every gain.
```

#### 21.20 Settled decisions and what stays [ASSUMED] — old `docs/DESIGN.md` line 1385

```diff
-- §21.11: operator talents reading the record's bonds for "【X】干员" (a 变形同构体 wearer does not count there).
+- §21.11: operator talents / tokens reading the record's bonds for "【X】干员" — **resolved by the owner after 0.1.1 (§21.31)**: they count a 变形同构体 wearer.
```

#### 21.20 Settled decisions and what stays [ASSUMED] — old `docs/DESIGN.md` line 1396

```diff
+- §21.36: the discs' exact sizes and the strip's 14-slot width (the measurements are Chrome's; the band they reserve is the point).
+- §21.37: a content bounty with no card (a band replacing a unit, `mods.bountyCoins`) has no key to test against and keeps paying for any leak that carries it — upstream's §23.25 keeps the same rule (only the child's own mods are cleared).
```

#### 22.6 钩索师 and 推击手 on 高台 (#32 item 4) — `tools/build-data.mjs PLACE_ON_RANGED_RE / branchTraitText / validateAll … — old `docs/DESIGN.md` line 1774

```diff
-Withdrawn in 0.1.3 (§23.35): only elite 歌蕾蒂娅 carrying HOK-Y may use a 高台. The paragraphs below are what 0.1.2 did.
+Withdrawn in 0.1.3 (§23.35): only elite 歌蕾蒂娅 carrying HOK-Y may use a 高台 — the trait reading is back in 0.1.4 (§24.2). The paragraphs below are what 0.1.2 did.
```

Everything the fork wrote in the pre-merge `docs/DESIGN.md` is therefore accounted for: the
§21.30–§21.51 block above (verbatim, status noted) plus these in-place edits. The rest of the old file is
upstream's own text, which 0.2.0 carries in `docs/design/*` and `docs/history/*`.

---

## Appendix B — the upstream side of the table (v0.2.0 coverage, for triage)

Cited so a reviewer can check a "superseded" line without searching: upstream tag `v0.2.0`, files under `docs/`.

| fork entry | upstream now says | where |
|---|---|---|
| §21.35 (a promoted 拉普兰德 fires again) | "0 in a new round and for a new piece — bought, granted, transformed, or an elite merged this round (GitHub #169, the owner's decision of 2026-10-06)"; "An elite merged in a round is a new piece: its per-piece round counters start at 0 … so an elite 拉普兰德 fires +8 on its own first manual refresh of the round even when its copies already fired" | `docs/META.md` (`pieceCounter` / the assumptions list), `docs/history/0.2.0.md`; upstream's garrison header: "an elite merged this round is a new 拉普兰德 and fires +8 on its own first one (GitHub #169)" (`server/sim/content/garrisons/meta.js`) |
| §21.37 (a content-spawned child carries no bounty) | "A split or summoned child does not carry the kill bounty (GitHub #67, #89 item 2) — `content/enemies.js spawnChildren`, `match/unite.js planUnite`" — the same two files as the fork's entry | `docs/history/0.1.3.md` §23.25 (part of the v0.1.4 base already) |
| §21.42 (#49 突袭 passive) | "突袭: a passive skill that is on counts as 技能就绪 (GitHub #49) — `content/bonds/addon/battle.js raidPoll`"; CHANGELOG: "突袭：开着的被动技能（缄默德克萨斯、宴、斯卡蒂二技能等）算作「技能就绪」…"; also "a 突袭 member counts that running window as 技能就绪 (`raidPoll`, GitHub #49 / #109)" | `docs/history/0.2.0.md` §25.6.7 (and §25.9.x), `CHANGELOG.md` |
| §21.44 (#162 缇缇) | "缇缇 S2 封护: every sleep pulse of the ward is a new 沉睡 entry for her trait (GitHub #162; the owner's decision of 2026-10-06)"; CHANGELOG: "缇缇二技能每次让周围敌人陷入沉睡都算一次进入沉睡，特质很快叠到每场上限（24 层，精锐 48 层）" | `docs/history/0.1.4.md` §24.8 (in the v0.1.4 base), `CHANGELOG.md` |
| §21.45 (#116 item 2 香槟炸弹) | "琳琅诗怀雅 S2 「见面礼」 throws onto an enemy's tile on x-6, with no enemy needed (GitHub #116 item 2) — `kits/ops/chess_char_3_04-swire2.js` (`installS2`)" | `docs/history/0.2.0.md` §25.6.1 |
| §21.46 (#181 秘术师) | "秘术师 store energy at the attack check, not one interval later (GitHub #181, reported by Paper-Yuan) — `professions.js installMystic` (`storeEnergy` / `releaseEnergy` / `hitsFn`), `ai.js updateAlly / performAttack`" | `docs/history/0.2.0.md` §25.7.1 |
| §21.47 (#124 引星棘刺 S1) | "引星棘刺一技能「度算浪波」是自动触发技能，技力满了就向友军投掷炼金单元，不再等到有敌人才放 (GitHub #124)"; "the 0.2.0 audit after GitHub #124 found 35 AUTO skills among the 112 …" | `CHANGELOG.md`, `docs/history/0.2.0.md` §25.7 |

**Also checked, and *not* superseded** (the fork's behaviour is absent from 0.2.0 — the entry stays a deviation):

| fork entry | how it was checked against the v0.2.0 tree |
|---|---|
| §21.31 / §21.43 (变形同构体 for talents / tokens) | `server/sim/content/kits/shared/tier5.js` still defines `inFaction = (u, bond, nations) => … (u.def.bonds \|\| []).includes(bond) …` — the raw record, not `support/index.js unitBonds` (which does include the grants); `kits/ops/chess_char_5_14-svash2.js` (`isKjerag`), `chess_char_5_01-excu2.js` (`isLaterano`), `chess_char_5_19-mlynar.js` (`isKazimierz`) all go through it |
| §21.32 (拉普兰德's first refresh must be able to pay out) | `server/sim/content/garrisons/meta.js`, `SERVER_GAIN_BOND_LAYER_BY_REFRESH_CNT.onRefresh`: `if (ctx.incPieceCounter(…) !== num(bb.refresh_cnt, 1)) return;` runs **before** `addAll(…, requireActiveOf(garrison))`, so a refresh the effect cannot pay out still spends the counter — **withdrawn** (the fork's gate is gone; upstream tests this behaviour) |
| §21.33 (`--shopbar-row`, `C`) | upstream 0.2.0 has the fold and `prepCameraFor` / `foldCamera` (public issue #5) but `grep --shopbar-row public/css` is empty; the `C` key is the fork's |
| §21.38 (准备就绪 twice) | `READY_CONFIRM` / `is-armed` appear nowhere in upstream's `public/js/screens/game.js`, `ui/gameActions.js`, `ui/hud.js` |
| §21.40 (a 本局禁用 disc keeps its layers) | upstream's `public/js/ui/bondStrip.js`: "a bond the mode never activates, with members: the briefing's grey ✕ disc, **no stack count**, 本局禁用 under it" |
| §21.41 (rotate hint / primary pointer) | upstream's `public/js/ui/device.js` has no `pointerCoarse` / primary-pointer handling |
| §21.48 (不屈 banks a refused landing) | upstream's `content/bonds/addon/battle.js` (不屈) sets `u.mem[ID.indom] = battle.time` and then calls `battle.redeploy(u, { free: true })`; a `false` return does nothing — `u.mem.indomFreeDeploy` is banked only by the 傀儡师 `dollSwap` branch |
| §21.49 (麻痹 / 诱导 / 暴露 icons) | upstream's `render/style.js STATUS_ICON` and `render/textures.js STATUS_KEYS` (23 keys) have no `palsy` / `attract` / `reveal`; the keyword fallback does not cover them either |
| §21.50 (the newer snapshot owns the field) | upstream's per-view step `public/js/render/units.js syncView(v, s, t)` revives on `s.anim !== ANIM.DIE && s.hp > 0` with no down-list argument (v0.2.2+ hoisted it out of `app.js syncBattle`, which reads `interp.downAt(renderT)` for its own `setDown` pass); the fork passes `downIds` as a 4th parameter |
| §21.51 (导出 tells the player) | upstream's `public/js/screens/loadout.js`: "Save `text` as a download. **Silent no-op** when the browser refuses downloads — 复制 stays available" — upstream's GitHub #173 fix (§25.22.3) addresses a different item of the issue (a 干员调配 tab without game data) |

**Known duplicates inside this fork's own block** (they were written in a chapter 21 that still had room, and some
upstream releases had already fixed the same thing — nothing to port, keep upstream's):

* §21.37 ↔ upstream §23.25 (above).
* §21.44 ↔ upstream §24.8 (above).
* §21.35 ↔ upstream's GitHub #169 decision (above). Note that the fork's pre-merge `docs/META.md` and
  `docs/PLAYING.md` also described this rule in their own words; the merge keeps **upstream's** wording there.
* §21.32's "a refresh that cannot pay out does not count" clause was withdrawn in the same merge (see its entry above):
  upstream 0.2.0 pins the official reading in `test/match/feedback5-bench-traits.test.js`.
* §21.31 and §21.43 are two entries for one code change (four talent / token sites); port them together.
