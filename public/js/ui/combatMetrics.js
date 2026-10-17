// 作战统计 — the real-time operator ranking (settings `combatMetrics`, default off; the panel of PR #618, extended by
// the owner's request of 2026-10-17: 「能实时查看干员伤害、dps 或者治疗量、hps 排名」):
//   * every row is one of the player's operators (same-name copies merged, summons counted for their owner) with its
//     damage, DPS, healing and HPS — battle/metrics.js counts effective HP loss and effective healing only;
//   * the four metrics are sortable: tapping 伤害 / DPS / 治疗 / HPS ranks the rows by it (descending) and the rank
//     numbers follow, so the same panel answers "who dealt most" and "who healed most"; the active metric is highlighted
//     in every row and the bar under the name always splits the damage by type;
//   * 当前战斗 is the battle on screen (the own one, or the teammate's field being 观战 — that battle's operators, with
//     their owner's name), 本局累计 adds every battle this page simulated in the match (its own battle and every field
//     it watched), so a 观战 trip contributes its numbers too. Nothing leaves this page: the server never sees it, and a
//     gameplay-plugin battle runs in a Worker with no meter (the settings hint says so).
// Mounted only while open; a modeless panel so the battlefield stays visible and keeps playing. Refreshed at 4 Hz.

import { useEffect, useLayoutEffect, useRef, useState } from '../../vendor/hooks.module.js';
import { html, Icon, useTicker } from './components.js';
import { UnitThumb } from './gameComponents.js';
import { battleRunner } from '../battle/runner.js';
import { t, N_ } from '../../../shared/i18n.js';
import { combatMetricsLayout } from './combatMetricsLayout.js';

const TYPES = Object.freeze([
  { id: 'phys', label: N_('物理') }, { id: 'arts', label: N_('法术') },
  { id: 'true', label: N_('真实') }, { id: 'elemental', label: N_('元素') },
]);
/**
 * The sortable metrics, in the order the switch shows them. `rate` says the value is a per-second figure (DPS / HPS)
 * and is printed with one decimal; `tone` names the row style the active value takes.
 */
const METRICS = Object.freeze([
  { id: 'damage', label: N_('伤害'), micro: 'DAMAGE', key: 'damage', tone: 'dmg' },
  { id: 'dps', label: N_('DPS'), micro: 'DPS', key: 'dps', rate: true, tone: 'dps' },
  { id: 'healing', label: N_('治疗'), micro: 'HEALING', key: 'healing', tone: 'heal' },
  { id: 'hps', label: N_('HPS'), micro: 'HPS', key: 'hps', rate: true, tone: 'hps' },
]);
const METRIC = new Map(METRICS.map((m) => [m.id, m]));
const number = (n) => Math.round(n || 0).toLocaleString('zh-CN');
const rate = (n) => (n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });

/**
 * Rank the rows by `metric` (descending; ties by damage, healing, then key) — pure, tested by
 * test/ui/combat-metrics-rank.test.js. Rows keep every value, so switching the metric only reorders them.
 * @param {Array<{ damage: number, dps: number, healing: number, hps: number, key: string }>} rows
 * @param {'damage'|'dps'|'healing'|'hps'} metric
 */
export function rankRows(rows, metric = 'damage') {
  const m = METRIC.get(metric) || METRIC.get('damage');
  const list = Array.isArray(rows) ? rows.slice() : [];
  list.sort((a, b) => (Number(b?.[m.key]) || 0) - (Number(a?.[m.key]) || 0)
    || (b.damage || 0) - (a.damage || 0) || (b.healing || 0) - (a.healing || 0)
    || String(a.key || '').localeCompare(String(b.key || '')));
  return list;
}

/**
 * The owner's display name of a row, or null for the viewer's own rows (no chip).
 * @param {string} ownerId @param {string|null} myId @param {Map<string,string>|Record<string,string>|null} names
 */
export function ownerLabelOf(ownerId, myId, names) {
  if (!ownerId || ownerId === myId) return null;
  const name = names instanceof Map ? names.get(ownerId) : names && typeof names === 'object' ? names[ownerId] : null;
  return name || t('队友');
}

/** A modeless panel: the battlefield stays visible and keeps playing. Mounted only while open. */
export function CombatMetricsPanel({ myId, onClose, runner = battleRunner, watching = null, names = null }) {
  const [scope, setScope] = useState('battle');
  const [metric, setMetric] = useState('damage');
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  useTicker(250);
  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal, .guide')) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, []);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const corner = panel?.parentElement;
    const viewport = window.visualViewport;
    const measure = () => {
      if (!panel || !corner) return;
      const rect = corner.getBoundingClientRect();
      const rootStyle = getComputedStyle(document.documentElement);
      const layout = combatMetricsLayout({
        cornerTop: rect.top, cornerBottom: rect.bottom,
        viewportHeight: viewport?.height || window.innerHeight,
        viewportTop: viewport?.offsetTop || 0,
        rem: parseFloat(rootStyle.fontSize) || 40,
        safeTop: parseFloat(rootStyle.getPropertyValue('--sa-t')) || 0,
        safeBottom: parseFloat(rootStyle.getPropertyValue('--sa-b')) || 0,
      });
      panel.style.setProperty('--combat-corner-height', `${rect.height || 44}px`);
      panel.style.setProperty('--combat-available-height', `${layout.availableHeight}px`);
      panel.style.setProperty('--combat-viewport-height', `${layout.viewportSpace}px`);
      panel.style.setProperty('--combat-viewport-top', `${layout.viewportPanelTop}px`);
      panel.dataset.viewportDocked = String(layout.viewportDocked);
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (corner) observer?.observe(corner);
    window.addEventListener('resize', measure);
    viewport?.addEventListener('resize', measure);
    viewport?.addEventListener('scroll', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      viewport?.removeEventListener('resize', measure);
      viewport?.removeEventListener('scroll', measure);
    };
  }, []);
  // no owner filter: the ranking covers every operator of the battles this page simulated — the own battle and the
  // teammate's field while 观战 — each row carrying its owner's name
  const result = runner?.combatMetrics({ scope }) || { rows: [], damage: 0, healing: 0 };
  const active = METRIC.get(metric) || METRIC.get('damage');
  const rows = rankRows(result.rows, metric);
  const maximum = Math.max(1, ...rows.map((r) => r.damage));
  const owners = new Set(rows.map((r) => r.ownerId).filter(Boolean));
  const multi = owners.size > 1;
  return html`<section ref=${panelRef} id="combat-metrics-panel" class="combat-metrics brackets" role="dialog" aria-label=${t('作战统计')}
      onKeyDown=${(e) => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}>
    <header class="combat-metrics__head">
      <div><span class="combat-metrics__micro">COMBAT ANALYSIS</span><h2>${t('作战统计')}<span class="combat-metrics__live">${t('实时排名')}</span></h2></div>
      <button ref=${closeRef} type="button" class="combat-metrics__close" aria-label=${t('关闭作战统计')} onClick=${onClose}><${Icon} name="close" /></button>
      <div class="combat-metrics__tools">
        <div class="combat-metrics__scopes" role="group" aria-label=${t('统计范围')}>
          ${[['battle', t('当前战斗')], ['match', t('本局累计')]].map(([id, label]) => html`<button type="button" key=${id}
            aria-pressed=${scope === id} onClick=${() => setScope(id)}>${label}</button>`)}
        </div>
      </div>
    </header>
    <div class="combat-metrics__body" tabindex="0">
    <div class="combat-metrics__totals">
      <span>${t('总伤害')} <b>${number(result.damage)}</b></span><span>${t('总治疗')} <b>${number(result.healing)}</b></span>
      ${watching ? html`<span class="combat-metrics__seen">${t('含观战：{name}', { name: watching.name || t('队友') })}</span>` : null}
    </div>
    <div class="combat-metrics__legend" aria-label=${t('伤害类型图例')}>
      ${TYPES.map((type) => html`<span key=${type.id} class=${`combat-metrics__type combat-metrics__type--${type.id}`}>${t(type.label)}</span>`)}
    </div>
    <div class="combat-metrics__sorts" role="group" aria-label=${t('排名依据')}>
      <span class="combat-metrics__sortby">${t('按')}</span>
      ${METRICS.map((m) => html`<button key=${m.id} type="button" class=${`combat-metrics__sortbtn${metric === m.id ? ' is-on' : ''}`}
        aria-pressed=${metric === m.id} title=${t('按{metric}排名', { metric: t(m.label) })} onClick=${() => setMetric(m.id)}>${t(m.label)}</button>`)}
      <span class="combat-metrics__sort">${t('降序')}</span>
    </div>
    <ol class="combat-metrics__list" tabindex="0" aria-label=${t('干员{metric}排行', { metric: t(active.label) })}>
      ${rows.length ? rows.map((r, i) => {
        const description = TYPES.map((type) => `${t(type.label)} ${number(r.types[type.id])}`).join('，');
        const owner = multi ? ownerLabelOf(r.ownerId, myId, names) : null;
        return html`<li key=${r.key} class=${`combat-metrics__row is-${active.tone}`}>
          <span class="combat-metrics__rank">${String(i + 1).padStart(2, '0')}</span>
          <${UnitThumb} kind=${r.kind === 'token' ? 'token' : 'chess'} id=${r.defId} showTier=${false} size="sm" />
          <div class="combat-metrics__unit">
            <div class="combat-metrics__name"><b title=${r.name}>${r.name || r.defId}</b>
              ${owner ? html`<span class="combat-metrics__owner" title=${t('{name} 的干员', { name: owner })}>${owner}</span>` : null}</div>
            <div class="combat-metrics__bar" role="img" aria-label=${description} title=${description}>
              ${TYPES.map((t) => html`<span key=${t.id} class=${`combat-metrics__segment combat-metrics__segment--${t.id}`}
                style=${{ width: `${r.types[t.id] / maximum * 100}%` }}></span>`)}
            </div>
            <div class="combat-metrics__values">
              <span class=${metric === 'damage' ? 'is-on' : ''}><small>${t('伤害')}</small><b>${number(r.damage)}</b></span>
              <span class=${metric === 'dps' ? 'is-on' : ''}><small>DPS</small><b>${rate(r.dps)}</b></span>
              <span class=${`combat-metrics__heal${metric === 'healing' ? ' is-on' : ''}`}><small>${t('治疗')}</small><b>${number(r.healing)}</b></span>
              <span class=${`combat-metrics__heal${metric === 'hps' ? ' is-on' : ''}`}><small>HPS</small><b>${rate(r.hps)}</b></span>
            </div>
          </div>
        </li>`;
      }) : html`<li class="combat-metrics__empty">${t('暂无本地战斗记录')}<br /><small>${t('开始战斗后实时显示干员数据')}</small></li>`}
    </ol>
    <p class="combat-metrics__note">${t('实时排名：点上方 伤害 / DPS / 治疗 / HPS 切换依据')}<br />${t('统计本机模拟过的战斗（自己的与观战过的），同名干员合并、召唤物计入所属干员；实际扣血 / 有效治疗，DPS / HPS 按自己的战斗秒数计算，刷新后重新累计。')}</p>
    </div>
  </section>`;
}
