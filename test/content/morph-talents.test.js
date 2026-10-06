// 变形同构体 in operator talents and tokens (player report after 0.1.1: "变形同构体的效果有问题").
// The item makes its wearer "视为特定盟约成员" (band 变形者集群; PRTS talent trap_1073_acarm073), so the wearer must count for
// "【X】干员" checks exactly like a real member — the rule the bond counts, the bond effects and the item gates already use
// (match/bondsMeta.js pieceBonds, support/index.js unitBonds → isMember, items/battle.js memberOf). Four places read the
// chess record's `bonds` directly instead and ignored the grant; each test pins one of them, with a real operator as the
// source of the check and a synthetic ally that carries 变形同构体 + a bond item:
//   kits/tier1.js   隐现 火力支援 — the 【拉特兰】 ammo ally it picks (elite, `ally_ammo` > 0)
//   kits/tier5.js   inFaction (isLaterano / isKazimierz / isKjerag / isSargonMinos) — 缇缇's 勇气的报偿 here
//   kits/tier6.js   hasBond — 新约能天使's 铳弹协约 here (also 蕾缪安, 耀骑士临光, 荒芜拉普兰德)
//   tokens.js       “耀阳” — "上一名部署干员势力为【卡西米尔】" (2 bursts instead of 1)
// The same defect sat in kits/tier4.js, where four "【X】干员 / 势力" checks read the NATION only (`nationOf(a) === 'kjerag'`
// …): they missed every member of the bond whose nationId differs — 哈洛德 (谢拉格, victoria), 锏 (卡西米尔, kjerag),
// 能天使 / 新约能天使 (拉特兰, lungmen) — and every 变形同构体 wearer (DESIGN §21.43). Each of the three tests below pins a
// real member with the "wrong" nation next to a converted one, plus the control that is neither.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, chessRec, enemyRec } from '../helpers/battleHarness.js';
import { getDefaultSource } from '../../server/sim/simdata.js';
import { unitBonds } from '../../server/sim/content/support/index.js';

const DS = getDefaultSource();
const interval = (id, i) => DS.getChess(id).talents[i].bb.interval;

const ISO = 'chess_item_6_09_e_a';        // 变形同构体 (canGiveBond)
const LAT_CLIP = 'chess_item_4_08_e_a';   // 拉特兰桥夹 → lateranoShip
const KAZ_FLAG = 'chess_item_4_07_e_a';   // 卡西米尔竞技旗 → kazimierzShip
const KJ_ICE = 'chess_item_5_02_e_a';     // 谢拉格不融冰 → kjeragShip
const SARGON_TEA = 'chess_item_2_04_e_a'; // 萨尔贡浓茶 → sargonShip

const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-9, `${msg}: expected ${b}, got ${a}`);
const dummy = () => enemyRec({ key: 'enemy_dummy', hp: 1e7, speed: 0 });
/** A synthetic ally with an ammo skill (never started: spCost 999) and no bonds of its own. */
const ammoAlly = (bonds = []) => chessRec({
  id: 'ally_ammo', profession: 'SNIPER', bonds, skill: null,
  stats: { maxHp: 4000, atk: 100, def: 0 }, rangeGrid: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
});
const AMMO_KIT = () => ({ skill: { kind: 'ammo', ammo: 6, spCost: 999 }, talents: [] });

test('新约能天使 铳弹协约 (kits/tier6.js hasBond): a 变形同构体 wearer counts as 【拉特兰】', () => {
  const run = (items, bonds) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly(bonds) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_6_13_a', row: 10, col: 3 }, { chessId: 'ally_ammo', row: 11, col: 3, items }],
      enemies: [{ key: 'enemy_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30,
    });
    assert.ok(h.runUntil(() => !!h.unit('ally_ammo').buffs.find((b) => b.key === 'angel2:covenant'), 5), 'the 铳弹协约 aura reaches the ammo ally');
    return h.unit('ally_ammo').buffs.find((b) => b.key === 'angel2:covenant').mods.atkPct;
  };
  close(run([], ['lateranoShip']), 0.09 * 2, 'a real 【拉特兰】 ammo operator: atk 0.09 × mult 2');
  close(run([ISO, LAT_CLIP], []), 0.09 * 2, 'a 变形同构体 + 拉特兰桥夹 wearer counts as a member');
  close(run([], []), 0.09, 'without the pair the plain ally keeps 0.09 (the grant is what changed)');
});

test('缇缇 勇气的报偿 (kits/tier5.js inFaction): a 变形同构体 wearer counts as 【萨尔贡】', () => {
  const run = (items, bonds) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly(bonds) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_5_02_a', row: 10, col: 3 }, { chessId: 'ally_ammo', row: 11, col: 3, items }],
      enemies: [{ key: 'enemy_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 30,
    });
    const vigor = (u) => (u.buffs.find((b) => b.key === 'titi:vigor') || null);
    h.run(1);
    return vigor(h.unit('ally_ammo')) ? vigor(h.unit('ally_ammo')).mods.aspd : null;
  };
  assert.equal(run([ISO, SARGON_TEA], []), 20, 'a 变形同构体 + 萨尔贡浓茶 wearer gets 精力充沛');
  assert.equal(run([], ['sargonShip']), 20, 'a real 【萨尔贡】 operator: the same aura');
  assert.equal(run([], []), null, 'without the pair: no aura (the nation fallback does not cover it)');
});

test('“耀阳” (tokens.js): a converted previous deploy counts as 【卡西米尔】 (2 bursts)', () => {
  const run = (items) => {
    const h = makeBattle({
      defs: { chess: { test_guard: chessRec({ id: 'test_guard', profession: 'WARRIOR', skill: null, stats: { maxHp: 4000, atk: 100, blockCnt: 3 } }) }, enemies: { enemy_dummy: dummy() } },
      units: [
        { chessId: 'chess_char_6_17_a', row: 12, col: 2, uid: 9 },                // 耀骑士临光 (the token's owner)
        { chessId: 'test_guard', row: 9, col: 2, uid: 1, items },                 // the previous deploy (lowest row: deployed last)
      ],
      enemies: [{ key: 'enemy_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 20,
      hooks: ['damaged'], captureNoisy: true,
    });
    h.step(1);
    // the token is spawned mid-battle (its kit installs before the deploy: a board token of the spec deploys first)
    assert.ok(h.b.spawnToken(h.unit('chess_char_6_17_a'), 'token_10019_nearl2_sword', 10, 5, { anySource: true }), '耀阳 deploys');
    h.step(3);
    return h.hooksOf('damaged').filter((c) => c.dmg && Array.isArray(c.dmg.tags) && c.dmg.tags.includes('burst')).length;
  };
  assert.equal(run([ISO, KAZ_FLAG]), 2, 'a 变形同构体 + 卡西米尔竞技旗 wearer as the previous deploy: 2 hits');
  assert.equal(run([]), 1, 'a plain previous operator: 1 hit');
});

test('隐现 火力支援 (kits/tier1.js): the 【拉特兰】 ammo ally pick counts a 变形同构体 wearer', () => {
  const run = (items) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly([]) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_1_01_b', row: 10, col: 3 }, { chessId: 'ally_ammo', row: 11, col: 3, items }],
      enemies: [{ key: 'enemy_dummy', pos: [10, 6] }], autoFinish: false, timeLimit: 40,
    });
    h.run(21); // 火力支援: `duration` (20) s after the deploy
    const u = h.unit('ally_ammo');
    return u.mem.insiderAmmo ? u.mem.insiderAmmo.size : 0;
  };
  assert.equal(run([ISO, LAT_CLIP]), 1, 'the converted ally is in the 拉特兰 ammo pool');
  assert.equal(run([]), 0, 'without the pair nobody is picked');
});

test('灵知 殊途同归 (kits/tier4.js isKjerag): 哈洛德 (a 谢拉格 member, nationId victoria) and a 变形同构体 wearer get 抵抗', () => {
  const run = (mate, items, bonds) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly(bonds) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_4_13_a', row: 10, col: 3 }, { chessId: mate, row: 12, col: 3, items }],
      timeLimit: 60, hooks: [],
    });
    if (items && items.length) {
      assert.ok(unitBonds(h.unit(mate)).includes('kjeragShip'), `${mate}: the converted wearer is a 谢拉格 member`);
    }
    h.run(interval('chess_char_4_13_a', 1) + 0.3); // 灵知 在场且部署后经过 10 s
    return !!h.unit(mate).findBuff('resist');
  };
  assert.equal(run('chess_char_1_02_a', null, []), true, '角峰: nationId kjerag (the case that always worked)');
  assert.equal(run('chess_char_2_05_a', null, []), true, '哈洛德: kjeragShip with nationId victoria');
  assert.equal(run('ally_ammo', [ISO, KJ_ICE], []), true, 'a 变形同构体 + 谢拉格不融冰 wearer');
  assert.equal(run('ally_ammo', [], []), false, 'a plain operator of another bond: no 抵抗');
});

test('焰尾 红松骑士团团长 (kits/tier4.js isKazimierz): 锏 (a 卡西米尔 member, nationId kjerag) and a 变形同构体 wearer dodge', () => {
  const run = (mate, items, bonds) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly(bonds) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_4_19_a', row: 10, col: 3 }, { chessId: mate, row: 12, col: 3, items }],
      timeLimit: 60, hooks: [],
    });
    if (items && items.length) {
      assert.ok(unitBonds(h.unit(mate)).includes('kazimierzShip'), `${mate}: the converted wearer is a 卡西米尔 member`);
    }
    h.run(0.5);
    return h.unit(mate).buffs.some((b) => b.key === 'flamtl:dodge');
  };
  assert.equal(run('chess_char_6_19_a', null, []), true, '锏: kazimierzShip with nationId kjerag');
  assert.equal(run('ally_ammo', [ISO, KAZ_FLAG], []), true, 'a 变形同构体 + 卡西米尔竞技旗 wearer');
  assert.equal(run('ally_ammo', [], []), false, 'a plain operator of another bond: no dodge aura');
});

test('信仰搅拌机 S3 退休前布道 (kits/tier4.js isLaterano): 能天使 / 新约能天使 and a 变形同构体 wearer are reloaded', () => {
  const run = (mate, items, bonds) => {
    const h = makeBattle({
      defs: { chess: { ally_ammo: ammoAlly(bonds) }, enemies: { enemy_dummy: dummy() } },
      kits: { ally_ammo: AMMO_KIT },
      units: [{ chessId: 'chess_char_4_01_a', row: 9, col: 5 }, { chessId: mate, row: 10, col: 4, items }],
      autoFinish: false, timeLimit: 30,
    });
    h.step();
    const ally = h.unit(mate), mix = h.unit('chess_char_4_01_a');
    if (items && items.length) {
      assert.ok(unitBonds(ally).includes('lateranoShip'), `${mate}: the converted wearer is a 拉特兰 member`);
    }
    assert.ok(ally.skill.activate('test', { free: true }));
    const before = ally.skill.ammoLeft;
    assert.ok(mix.skill.activate('test', { free: true }));
    return ally.skill.ammoLeft - before;
  };
  assert.ok(run('chess_char_1_01_a', null, []) > 0, '隐现: nationId laterano (the case that always worked)');
  assert.ok(run('chess_char_6_13_a', null, []) > 0, '新约能天使: lateranoShip with nationId lungmen');
  assert.ok(run('ally_ammo', [ISO, LAT_CLIP], []) > 0, 'a 变形同构体 + 拉特兰桥夹 wearer');
  assert.equal(run('ally_ammo', [], []), 0, 'a plain operator of another bond: no reload');
});
