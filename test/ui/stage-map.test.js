// 本局地图 (ui/stageMap.js, the owner's request of 2026-10-17): the display model of a battlefield — the tile kinds the
// briefing's card, the enlarged dialog and the in-match 本局信息 tab draw — and its two fields (the battlefield rows 9–12
// and the boss field rows 0–5). The drawing itself needs a DOM; this suite pins what the drawing says.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tileKind, stageMapModel, hasBossField, standable, FIELD_ROWS, TILE_KINDS, LEGEND_KINDS } from '../../public/js/ui/stageMap.js';
import { DATA } from '../match/harness.js';
import { GEO } from '../../shared/constants.js';

const stage = (id) => DATA.stages[id];

test('tileKind: every tile kind data/stages.json uses maps to a display kind', () => {
  assert.equal(tileKind({ tileKey: 'tile_road', height: 'LOW', buildable: 'ALL', passable: 'ALL' }), 'ground');
  assert.equal(tileKind({ tileKey: 'tile_floor', height: 'LOW', buildable: 'NONE', passable: 'ALL' }), 'ground');
  assert.equal(tileKind({ tileKey: 'tile_achand', height: 'HIGH', buildable: 'ALL', passable: 'FLY_ONLY' }), 'high');
  assert.equal(tileKind({ tileKey: 'tile_wall', height: 'HIGH', buildable: 'RANGED', passable: 'FLY_ONLY' }), 'high');
  assert.equal(tileKind({ tileKey: 'tile_forbidden', height: 'HIGH', buildable: 'NONE', passable: 'FLY_ONLY' }), 'wall');
  assert.equal(tileKind({ tileKey: 'tile_forbidden', height: 'HIGH', buildable: 'NONE', passable: 'NONE' }), 'void');
  assert.equal(tileKind({ tileKey: 'tile_fence_bound', height: 'LOW', buildable: 'ALL', passable: 'FLY_ONLY' }), 'fence');
  assert.equal(tileKind({ tileKey: 'tile_deepsea', height: 'LOW', buildable: 'NONE', passable: 'ALL', special: 'deepsea' }), 'water');
  assert.equal(tileKind({ tileKey: 'tile_mire', height: 'LOW', buildable: 'ALL', passable: 'ALL', special: 'mire' }), 'hazard');
  assert.equal(tileKind({ tileKey: 'tile_start', height: 'LOW', buildable: 'NONE', passable: 'ALL' }), 'spawn');
  assert.equal(tileKind({ tileKey: 'tile_end', height: 'LOW', buildable: 'NONE', passable: 'ALL' }), 'goal');
  assert.equal(tileKind({ tileKey: 'tile_telin', height: 'LOW', buildable: 'NONE', passable: 'ALL' }), 'entry');
  assert.equal(tileKind({ tileKey: 'tile_telout', height: 'LOW', buildable: 'NONE', passable: 'ALL' }), 'exit');
  assert.equal(tileKind(null), 'void');
  assert.equal(tileKind({}), 'ground', 'an unknown glyph with no kind reads as floor, never as a hole');
  for (const kind of TILE_KINDS) assert.equal(typeof kind, 'string');
  assert.ok(TILE_KINDS.includes('spawn') && TILE_KINDS.includes('goal'));
  assert.ok(LEGEND_KINDS.every((k) => TILE_KINDS.includes(k)));
  assert.deepEqual(['ground', 'high'].map(standable), [true, true]);
  assert.deepEqual(['wall', 'void', 'water', 'fence'].map(standable), [false, false, false, false]);
});

test('stageMapModel: the battlefield is board rows 9–12 × 21 columns, with the own deploy zone outlined', () => {
  const m = stageMapModel(stage('act1autochess_m01'), { field: 'normal' });
  assert.deepEqual([m.r0, m.r1], FIELD_ROWS.normal);
  assert.deepEqual([m.r0, m.r1], [GEO.NORMAL_RECT.r0, GEO.NORMAL_RECT.r1]);
  assert.equal(m.cols, 21);
  assert.equal(m.cells.length, 4);
  assert.ok(m.cells.every((row) => row.length === 21));
  assert.deepEqual(m.deploy, { ...GEO.FIELD }, 'the own deployable region is GEO.FIELD');
  assert.ok(m.counts.spawn > 0 && m.counts.goal > 0, 'the map shows where enemies come from and what they walk to');
  const kinds = new Set(m.cells.flat().map((c) => c.kind));
  for (const k of kinds) assert.ok(TILE_KINDS.includes(k), `unknown kind ${k}`);
  // the cells keep their board coordinates (the SVG draws row − r0)
  assert.deepEqual([m.cells[0][0].r, m.cells[0][0].c], [9, 0]);
});

test('stageMapModel: the boss field is board rows 0–5, no deploy zone; every shipped stage has a map', () => {
  const b = stageMapModel(stage('act1autochess_m01'), { field: 'boss', deployRect: null });
  assert.deepEqual([b.r0, b.r1], FIELD_ROWS.boss);
  assert.equal(b.deploy, null);
  assert.ok(b.counts.goal > 0, 'the boss field has its goals on rows 0–5 (its spawns come from the wave, not from stage tiles)');
  for (const [id, rec] of Object.entries(DATA.stages)) {
    const n = stageMapModel(rec, { field: 'normal' });
    assert.ok(n && n.cells.length === 4, `${id}: battlefield model`);
    assert.ok(n.cells.flat().every((c) => TILE_KINDS.includes(c.kind)), `${id}: kinds`);
    const boss = stageMapModel(rec, { field: 'boss', deployRect: null });
    assert.ok(boss && boss.cells.length === 6, `${id}: boss-field model`);
    assert.equal(typeof hasBossField(rec), 'boolean', `${id}: boss-field detection`);
  }
  assert.equal(stageMapModel(null), null);
  assert.equal(stageMapModel({ rows: [] }), null);
});

test('hasBossField: every battlefield a match can draw (weight > 0) has one — the final assault is fought there', () => {
  const drawn = Object.values(DATA.stages).filter((rec) => Number(rec.weight) > 0);
  assert.ok(drawn.length >= 8, `${drawn.length} drawable battlefields`);
  for (const rec of drawn) assert.equal(hasBossField(rec), true, `${rec.id} (${rec.name})`);
  // the 联防阵地 stages are not drawn as a match's stage (weight 0): their rows 0–5 belong to no boss round
  const escaped = Object.values(DATA.stages).filter((rec) => !(Number(rec.weight) > 0));
  assert.ok(escaped.length >= 2);
});
