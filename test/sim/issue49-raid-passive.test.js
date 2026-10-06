// GitHub issue #49: a 突袭 member whose skill is a passive never counted as 「技能就绪」, so it only advanced on the
// 10-second idle path. The owner's plan (0.2.0) is "被动技能生效中也算技能就绪", the 突袭 check only. A passive has TWO
// shapes in this tree, and the patch has to cover both:
//   * `kind: 'passive'`                              — no duration (琳琅诗怀雅 S1/S2);
//   * `duration` + `activateOnDeploy`                — content/generic.js:150-154 re-types a passive that carries a
//     duration ("N秒内"), which is what EVERY real 突袭 member's passive is: 缄默德克萨斯 S1–S3, 宴 S2, 斯卡蒂 S2,
//     耀骑士临光 S2. A patch that only knows `kind === 'passive'` leaves all of them waiting 10 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle, flatStage, chessRec, enemyRec, checkInvariants } from '../helpers/battleHarness.js';
import { inRange } from '../../server/sim/content/support/index.js';

const HOME = { member: [12, 3], control: [12, 4] };
const ENEMY = [10, 8];
const BONDS = { raidShip: { count: 2, active: true, tier: 1, layers: 0 } };
const RANGE = [[0, 0], [0, 1], [1, 0], [0, -1], [-1, 0]];

const FORMS = {
  'kind: passive': () => ({ skill: { kind: 'passive' }, talents: [] }),
  'deploy-activated duration': () => ({ skill: { kind: 'duration', activateOnDeploy: true, duration: 20, spCost: 0, spType: 'none', trigger: 'NEVER' }, talents: [] }),
};

/** One member of the given passive form and one skill-less control, both 突袭, on the shore-tile stage of raid-terrain. */
function scenario(kit, noLanding = false) {
  const stage = flatStage();
  const put = (r, c, glyph) => { stage.rows[r] = stage.rows[r].slice(0, c) + glyph + stage.rows[r].slice(c + 1); };
  for (let r = 9; r <= 12; r++) for (let c = 6; c <= 10; c++) put(r, c, 'h');
  put(...ENEMY, 'd');
  if (!noLanding) put(9, 8, 'r');
  const h = makeBattle({
    stage, bonds: BONDS,
    defs: {
      chess: {
        raider_passive: chessRec({ id: 'raider_passive', profession: 'WARRIOR', position: 'MELEE', bonds: ['raidShip'], rangeGrid: RANGE }),
        raider_plain: chessRec({ id: 'raider_plain', profession: 'WARRIOR', position: 'MELEE', bonds: ['raidShip'], rangeGrid: RANGE, skill: null }),
      },
      enemies: { enemy_wader: enemyRec({ key: 'enemy_wader', hp: 1e7, speed: 0 }) },
    },
    kits: { raider_passive: kit, raider_plain: () => ({ skill: null, talents: [] }) },
    units: [
      { chessId: 'raider_passive', uid: 1, row: HOME.member[0], col: HOME.member[1], dir: 'RIGHT' },
      { chessId: 'raider_plain', uid: 2, row: HOME.control[0], col: HOME.control[1], dir: 'RIGHT' },
    ],
    enemies: [{ key: 'enemy_wader', pos: ENEMY }],
  });
  h.step();
  const jumps = (u) => h.hooksOf('deploy').filter((c) => c.unit === u && !c.initial).length;
  return { h, jumps };
}

for (const [form, kit] of Object.entries(FORMS)) {
  test(`突袭 + a passive skill (${form}): advances at the first reachable ground enemy, long before the idle timer`, () => {
    const { h, jumps } = scenario(kit);
    const member = h.unit('raider_passive');
    const plain = h.unit('raider_plain');
    assert.equal(member.skill.active, true, 'the skill is in effect from deployment');
    assert.equal(member.skill.ready, false, `this form is not \`ready\` in the engine sense (skills.js) — that was issue #49`);

    h.run(0.6); // the 技能就绪 case of raid-terrain: two polls, nowhere near no_attack_duration (10 s)
    assert.deepEqual([member.tileR, member.tileC], [9, 8], 'the member reached the tile that covers the enemy');
    assert.ok(member.alive && member.deployed && inRange(member, h.enemy('enemy_wader')));
    assert.equal(jumps(member), 1, 'one raid redeployment');
    assert.deepEqual([plain.tileR, plain.tileC], HOME.control, 'the skill-less control still waits out its idle timer');
    assert.equal(jumps(plain), 0);

    h.run(4); // the enemy is in range now: no churn, no second jump (the reviewer measured at most 2 in 30 s)
    assert.deepEqual([member.tileR, member.tileC], [9, 8]);
    assert.equal(jumps(member), 1, 'no repeated redeployment while it can attack');
    checkInvariants(h.b);
  });

  test(`突袭 + a passive skill (${form}): stays deployed when no landing tile can cover the enemy`, () => {
    const { h, jumps } = scenario(kit, true);
    const member = h.unit('raider_passive');
    h.run(1.2);
    assert.deepEqual([member.tileR, member.tileC], HOME.member, 'no withdrawal without a valid landing');
    assert.equal(jumps(member), 0);
    assert.equal(h.hooksOf('death').filter((c) => c.unit === member).length, 0);
    checkInvariants(h.b);
  });
}

/**
 * The real 突袭 members of the report, on real content (only the enemy is synthetic): each one's passive carries a
 * duration, so it is the `duration` + `activateOnDeploy` form above. She stands on [12,3] facing RIGHT with a one-tile
 * melee range and the enemy waits on the deep-water tile [12,6], so the only tile whose range covers it is [12,5] —
 * the enemy's own tile is water and cannot be landed on (as in raid-terrain's scenario).
 */
const REAL = [
  ['缄默德克萨斯', 'chess_char_4_16_a', [0, 1, 2]],
  ['宴', 'chess_char_1_18_a', [1]],
  ['斯卡蒂', 'chess_char_3_05_a', [1]],
  ['耀骑士临光', 'chess_char_6_17_a', [1]],
];

test('突袭 + the real ON_DEPLOY passives: the parser\'s form advances at the first ground enemy too (the form every report names)', () => {
  for (const [name, id, indexes] of REAL) {
    for (const skillIndex of indexes) {
      const stage = flatStage();
      stage.rows[12] = `${stage.rows[12].slice(0, 6)}d${stage.rows[12].slice(7)}`;
      const h = makeBattle({
        stage, bonds: BONDS,
        defs: { enemies: { enemy_wader: enemyRec({ key: 'enemy_wader', hp: 1e7, speed: 0 }) } },
        units: [{ chessId: id, uid: 1, skillIndex, row: HOME.member[0], col: HOME.member[1], dir: 'RIGHT' }],
        enemies: [{ key: 'enemy_wader', pos: [12, 6] }],
      });
      h.step();
      const u = h.unit(id);
      const label = `${name} S${skillIndex + 1}`;
      assert.equal(u.skill.kind, 'duration', `${label}: the parser re-types the passive (generic.js)`);
      assert.equal(u.skill.spec.activateOnDeploy, true, `${label}: …with activateOnDeploy`);
      assert.equal(u.skill.active, true, `${label}: in effect from deployment`);
      assert.equal(h.b.grid.canStand(12, 6), false, `${label}: the enemy's water tile is no landing tile`);
      h.run(0.6);
      assert.deepEqual([u.tileR, u.tileC], [12, 5], `${label}: advanced onto the enemy, not after the 10 s idle timer`);
      assert.ok(inRange(u, h.enemy('enemy_wader')), `${label}: the enemy is in range after the jump`);
      assert.equal(h.hooksOf('deploy').filter((c) => c.unit === u && !c.initial).length, 1, `${label}: one redeployment`);
    }
  }
});
