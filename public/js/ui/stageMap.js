// 本局地图 (the owner's request, 2026-10-17): the battlefield a match is fought on, drawn read-only from the stage
// record (data/stages.json — the same `rows` + `tiles` legend the 3D board is built from, render/tiles.js parseStage).
// Until now the briefing only named the stage ("战场#03") and the strategy draft's 本局信息 listed the drawn bonds and
// the banned operators; a player could not see the map itself until the first 休整期, and the boss field of 最终攻势 /
// 隐秘核心 never before its round.
//
// stageMapModel (pure, unit-tested by test/ui/stage-map.test.js) turns a stage into a grid of cells with a display kind
// and whether an operator may stand there; the components draw it as an SVG (`image-rendering` free: plain rects):
//   * StageMap        one field on its own — the briefing's card (compact) and the dialog (large);
//   * StageMapCard    the briefing's BATTLEFIELD line: stage name, the mode's pool note, the compact map and 查看地图;
//   * StageMapDialog  the enlarged map with its legend: the battlefield (rows 9–12) and, when the stage has one, the
//                     boss field (rows 0–5) 最终攻势 / 隐秘核心 is fought on.
// Only terrain is shown — no enemy, no operator, nothing a player could not see on their own board. The two separator
// walls (rows 6 / 13) and the tiles outside the field are drawn as the void they are.
//
// Fields: 'normal' = the battlefield, board rows 9–12 (both halves; the own deployable region GEO.FIELD highlighted);
// 'boss' = the boss field, board rows 0–5, framed by 最终攻势 / 隐秘核心.

import { useState } from '../../vendor/hooks.module.js';
import { html, Button, Icon, MicroLabel, Modal } from './components.js';
import { GEO } from '../../../shared/constants.js';
import { t, N_ } from '../../../shared/i18n.js';

const cx = (...p) => p.flat().filter(Boolean).join(' ');

/**
 * Board rows of each field kind (the separator walls at 6 / 13 and the bench rows 7–8 excluded): the battlefield rows
 * 9–12 — both halves, col 0–20, the left one the own deployable half (GEO.NORMAL_RECT) — and the boss field rows 0–5
 * behind the row-6 wall (GEO.BOSS_RECT).
 */
export const FIELD_ROWS = Object.freeze({ normal: Object.freeze([9, 12]), boss: Object.freeze([0, 5]) });

/** The tile kinds a map cell can be, in legend order (a standable kind may also be drawn as a landmark). */
export const TILE_KINDS = Object.freeze(['void', 'wall', 'ground', 'high', 'fence', 'water', 'hazard', 'spawn', 'goal', 'entry', 'exit']);

/**
 * What a stage tile glyph is drawn as. `tile` is one entry of the stage's `tiles` legend (a `stages.json` record:
 * tileKey / height / buildable / passable / special); a missing entry (an unknown glyph) is the void outside the field.
 * [ASSUMED] the kinds are display only — they do not decide placement (gameLogic placementContext / the server do).
 * @param {{ tileKey?: string, height?: string, buildable?: string, passable?: string, special?: string|null }|null} tile
 * @returns {'void'|'wall'|'ground'|'high'|'fence'|'water'|'hazard'|'spawn'|'goal'|'entry'|'exit'}
 */
export function tileKind(tile) {
  if (!tile) return 'void';
  const key = String(tile.tileKey || '');
  const special = typeof tile.special === 'string' ? tile.special : null;
  if (key === 'tile_start') return 'spawn';
  if (key === 'tile_end') return 'goal';
  if (key === 'tile_telin') return 'entry';
  if (key === 'tile_telout') return 'exit';
  if (special === 'deepsea') return 'water';
  if (special && special !== 'deepsea') return 'hazard';
  if (key === 'tile_fence_bound') return 'fence';
  // 'X' (the separator) is forbidden with passable NONE: nothing of the field; '#' is the fly-only margin around it
  if (key === 'tile_forbidden') return tile.passable === 'NONE' || tile.height !== 'HIGH' ? 'void' : 'wall';
  if (tile.height === 'HIGH') return tile.buildable === 'NONE' ? 'wall' : 'high';
  return 'ground';
}

/** May an operator stand on a tile of this kind? (a display hint: high ground takes ranged, ground takes melee) */
export const standable = (kind) => kind === 'ground' || kind === 'high';

/**
 * Display model of one field of a stage.
 * @param {any} stage data/stages.json record (rows, tiles, name)
 * @param {{ field?: 'normal'|'boss', deployRect?: { r0: number, r1: number, c0: number, c1: number }|null }} [opts]
 *   deployRect: the own deployable region to outline (default GEO.FIELD on the battlefield, none on the boss field)
 * @returns {{ id: string, name: string, field: 'normal'|'boss', r0: number, r1: number, cols: number,
 *   cells: Array<Array<{ r: number, c: number, ch: string, kind: string, standable: boolean }>>,
 *   deploy: { r0: number, r1: number, c0: number, c1: number }|null, counts: Record<string, number> } | null}
 */
export function stageMapModel(stage, { field = 'normal', deployRect } = {}) {
  if (!stage || !Array.isArray(stage.rows) || !stage.rows.length) return null;
  const span = FIELD_ROWS[field] || FIELD_ROWS.normal;
  const [r0, r1] = span;
  const legend = stage.tiles && typeof stage.tiles === 'object' ? stage.tiles : {};
  const rows = [];
  const counts = {};
  const width = Math.max(...stage.rows.map((line) => String(line || '').length));
  for (let r = r0; r <= r1 && r < stage.rows.length; r++) {
    const line = String(stage.rows[r] || '');
    const out = [];
    for (let c = 0; c < width; c++) {
      const ch = line[c] || ' ';
      const kind = ch === ' ' ? 'void' : tileKind(legend[ch] || null);
      counts[kind] = (counts[kind] || 0) + 1;
      out.push({ r, c, ch, kind, standable: standable(kind) });
    }
    rows.push(out);
  }
  const own = deployRect === undefined ? (field === 'normal' ? { ...GEO.FIELD } : null) : deployRect;
  return {
    id: String(stage.id || ''),
    name: String(stage.name || stage.id || ''),
    field, r0, r1, cols: width, cells: rows,
    deploy: own && own.r0 >= r0 && own.r1 <= r1 ? { ...own } : null,
    counts,
  };
}

/** Does this stage have a boss field (最终攻势 / 隐秘核心 rows) with anything on it? */
export function hasBossField(stage) {
  const model = stageMapModel(stage, { field: 'boss', deployRect: null });
  if (!model) return false;
  return (model.counts.spawn || 0) + (model.counts.goal || 0) > 0;
}

const CELL = 10;
const GAP = 1;

/**
 * One field drawn as an SVG grid. `compact`: the briefing's card (no standable dots, smaller); otherwise the dialog's
 * large map with the deployable region outlined and a dot on every tile an operator may stand on.
 * @param {{ stage: any, field?: 'normal'|'boss', compact?: boolean, class?: string }} props
 */
export function StageMap({ stage, field = 'normal', compact = false, class: cls }) {
  const model = stageMapModel(stage, { field });
  if (!model) return null;
  const w = model.cols * CELL;
  const h = model.cells.length * CELL;
  const label = field === 'boss'
    ? t('{name}：最终攻势战场', { name: model.name })
    : t('{name}：战场地图', { name: model.name });
  return html`<svg class=${cx('stagemap', compact && 'stagemap--compact', cls)} viewBox=${`0 0 ${w} ${h}`}
      role="img" aria-label=${label} data-stage=${model.id} data-field=${field} preserveAspectRatio="xMidYMid meet">
    <title>${label}</title>
    ${model.cells.map((row) => row.map((cell) => html`<rect key=${`${cell.r},${cell.c}`} class=${`stagemap__c is-${cell.kind}`}
      x=${cell.c * CELL + GAP / 2} y=${(cell.r - model.r0) * CELL + GAP / 2} width=${CELL - GAP} height=${CELL - GAP} />`))}
    ${model.deploy ? html`<rect class="stagemap__deploy" x=${model.deploy.c0 * CELL + GAP / 2} y=${(model.deploy.r0 - model.r0) * CELL + GAP / 2}
      width=${(model.deploy.c1 - model.deploy.c0 + 1) * CELL - GAP} height=${(model.deploy.r1 - model.deploy.r0 + 1) * CELL - GAP} rx="2" />` : null}
    ${!compact ? model.cells.map((row) => row.filter((c) => c.standable).map((c) => html`<circle key=${`d${c.r},${c.c}`}
      class=${`stagemap__dot is-${c.kind}`} cx=${c.c * CELL + CELL / 2} cy=${(c.r - model.r0) * CELL + CELL / 2} r="1.2" />`)) : null}
  </svg>`;
}

/** Names of the kinds a legend shows, by kind (the label goes through t() at render). */
export const LEGEND_KINDS = Object.freeze(['ground', 'high', 'wall', 'fence', 'water', 'hazard', 'spawn', 'goal', 'entry', 'exit']);

const KIND_LABEL = {
  ground: N_('可部署地面'), high: N_('高台'), wall: N_('阻隔 / 墙体'), fence: N_('护栏'), water: N_('水面'),
  hazard: N_('特殊地形'), spawn: N_('敌人出生点'), goal: N_('防守目标点'), entry: N_('传送入口'),
  exit: N_('传送出口'), void: N_('战场外'),
};

/**
 * The dialog's legend: one swatch + name per kind the field actually has.
 * @param {{ model: any }} props
 */
export function StageLegend({ model }) {
  if (!model) return null;
  const kinds = LEGEND_KINDS.filter((k) => (model.counts[k] || 0) > 0);
  return html`<ul class="stagemap-legend" aria-label=${t('地图图例')}>
    ${kinds.map((k) => html`<li key=${k} class="stagemap-legend__i"><i class=${`stagemap-legend__sw is-${k}`}></i>${t(KIND_LABEL[k])}</li>`)}
    ${model.deploy ? html`<li class="stagemap-legend__i"><i class="stagemap-legend__sw is-deploy"></i>${t('你的部署区')}</li>` : null}
  </ul>`;
}

/**
 * The enlarged map dialog: the battlefield and, when the stage has one, the boss field. Opened from the briefing's
 * BATTLEFIELD card (StageMapCard) and from the strategy draft's 本局信息 (ui/matchInfo.js).
 * @param {{ open: boolean, onClose: Function, stage: any, title?: string }} props
 */
export function StageMapDialog({ open, onClose, stage, title = null }) {
  // one field at a time with a switch: both maps stacked do not fit a phone's landscape height, and the switch keeps
  // the legend and the hint on screen (measured on the Android WebView, 640x360 CSS px)
  const [field, setField] = useState('normal');
  const boss = open && hasBossField(stage);
  const shown = field === 'boss' && boss ? 'boss' : 'normal';
  const model = open ? stageMapModel(stage, shown === 'boss' ? { field: 'boss', deployRect: null } : { field: 'normal' }) : null;
  return html`<${Modal} open=${open} onClose=${onClose} title=${title || t('本局地图')} micro="BATTLEFIELD // MAP" width="9rem"
    class="stagemap-dlg" actions=${html`<${Button} variant="secondary" icon="close" data-autofocus onClick=${onClose}>${t('关闭')}<//>`}>
    ${boss ? html`<div class="stagemap-dlg__tabs" role="group" aria-label=${t('查看哪个战场')}>
      ${[['normal', t('战场')], ['boss', t('最终攻势战场')]].map(([id, label]) => html`<button key=${id} type="button"
        class=${`stagemap-dlg__tab${shown === id ? ' is-on' : ''}`} aria-pressed=${shown === id} onClick=${() => setField(id)}>${label}</button>`)}
    </div>` : null}
    ${model ? html`<div class="stagemap-dlg__block" data-testid=${`stage-map-${shown}`}>
      <div class="stagemap-dlg__h"><span>${shown === 'boss' ? t('最终攻势战场') : model.name}</span>
        <${MicroLabel}>${shown === 'boss' ? 'FINAL ASSAULT' : 'BATTLEFIELD'}</${MicroLabel}></div>
      <div class="stagemap-dlg__canvas"><${StageMap} stage=${stage} field=${shown} /></div>
      <${StageLegend} model=${model} />
    </div>` : null}
    <p class="stagemap-dlg__hint">${t('只显示地形：红色是敌人出生点，蓝色是防守目标点，绿色框是你的部署区。敌人的具体阵容看敌方情报。')}</p>
  <//>`;
}

/**
 * The briefing's BATTLEFIELD line (screens/briefing.js): stage name, the mode's pool note, the compact map and the
 * button that opens the enlarged one (StageMapDialog). A stage the data does not have (an older server) shows the
 * name alone, as before.
 * @param {{ stage: any, pool?: string, onOpen?: Function }} props
 */
export function StageMapCard({ stage, pool = '', onOpen = null }) {
  const [open, setOpen] = useState(false);
  const model = stage ? stageMapModel(stage, { field: 'normal' }) : null;
  const showMap = onOpen || (() => setOpen(true));
  return html`<div class="brief-stage brief-stage--map" data-testid="stage-map-card">
    <span class="brief-stage__k"><${MicroLabel}>BATTLEFIELD</${MicroLabel}>${pool ? html`<span class="brief-stage__pool">${pool}</span>` : null}</span>
    <span class="brief-stage__name"><${Icon} name="rook" />${stage?.name || '—'}</span>
    ${model ? html`<button type="button" class="brief-stage__map" onClick=${showMap}
        title=${t('查看本局地图')} aria-label=${t('查看本局地图')} data-testid="stage-map-open">
      <${StageMap} stage=${stage} field="normal" compact=${true} />
      <span class="brief-stage__zoom"><${Icon} name="search" />${t('查看地图')}</span>
    </button>` : null}
    ${model ? html`<${StageMapDialog} open=${open} onClose=${() => setOpen(false)} stage=${stage} />` : null}
  </div>`;
}
