// 层数奖励 (the owner's report of 2026-10-17: 「有人反映盟约『维多利亚』『每 25 层给予一个随机效果的装备』生效有问题」):
// the bond popup shows where a player stands on a bond's `<每叠加 N 层>` milestones — how many were reached, how many
// layers the next one needs, and that an inactive bond pays nothing until it lights up (the official tip
// 「叠加的盟约…只有在盟约被激活时才会发挥作用」, the rule server/sim/content/bonds/core.js payHammers follows).
// The payout itself is the server's (one implementation, bonds/core.js); this file is read-only UI: milestoneModel is
// pure (tested by test/ui/bond-milestones.test.js) and MILESTONE_LABELS only names an effect key the data carries.
//
// The data's `bonds.json layerMilestones`: [{ layer, mode: 'every'|'first'|'reach', effect }] — 维多利亚 (25, every,
// bond_layer_added_reward_equip), 远见 (10 every / 80 first / 150 first), 奇迹 (100 every), 迅捷 / 灵巧 / 突袭 (reach),
// 投资人 (reach). A `count` of items per milestone lives in the effect's own buff, so the label stays generic.

import { html, MicroLabel } from './components.js';
import { t, N_ } from '../../../shared/i18n.js';

/** How a milestone pays out, by the effect key data/bonds.json carries (an unknown key is shown as it is). */
const MILESTONE_LABELS = {
  bond_layer_added_reward_equip: N_('随机特殊效果的装备'),
  bond_layer_gain_coin: N_('资金'),
  bond_layer_char_goods_price_bond_discount: N_('干员购买价格永久 -1'),
  bond_layer_char_garrison_bonus: N_('「获得时」特质额外触发一次'),
  env_gbuff_new: N_('效果强化'),
};

/** The label of a milestone's effect key (translated when shown). */
export function milestoneLabel(effect) {
  const key = String(effect || '');
  return MILESTONE_LABELS[key] ? t(MILESTONE_LABELS[key]) : key;
}

/**
 * Where a player stands on a bond's layer milestones — pure.
 * @param {{ layerMilestones?: Array<{ layer?: number, mode?: string, effect?: string }> }} bond data/bonds.json record
 * @param {number} layers the bond's layers right now
 * @param {boolean} [active] the bond is active (its payouts only happen then)
 * @returns {Array<{ mode: 'every'|'first'|'reach', step: number, effect: string, label: string,
 *   paid: number, next: number, left: number, pending: boolean }>}
 *   paid: how many payouts the layers reached (an `every` milestone: floor(layers / step)); next: the layer the next one
 *   needs; left: layers still missing; pending: reached while the bond is inactive (owed, paid when it lights up)
 */
export function milestoneModel(bond, layers, active = true) {
  const L = Number.isFinite(layers) && layers > 0 ? Math.floor(layers) : 0;
  const out = [];
  for (const m of Array.isArray(bond?.layerMilestones) ? bond.layerMilestones : []) {
    const step = Math.floor(Number(m?.layer) || 0);
    if (!(step > 0)) continue;
    const mode = m.mode === 'first' ? 'first' : m.mode === 'reach' ? 'reach' : 'every';
    const paid = mode === 'every' ? Math.floor(L / step) : L >= step ? 1 : 0;
    const next = mode === 'every' ? (paid + 1) * step : step;
    out.push({
      mode, step, effect: String(m.effect || ''), label: milestoneLabel(m.effect),
      paid, next, left: Math.max(0, next - L), pending: !active && paid > 0,
    });
  }
  return out.sort((a, b) => a.step - b.step || a.mode.localeCompare(b.mode));
}

/**
 * 层数奖励 section of the bond popup (ui/bondStrip.js BondPopup): one line per milestone, plus the inactive note. Nothing
 * without a milestone (most bonds).
 * @param {{ bond: any, layers: number, active: boolean, class?: string }} props
 */
export function BondMilestones({ bond, layers, active = true, class: cls = '' }) {
  const list = milestoneModel(bond, layers, active);
  if (!list.length) return null;
  return html`<section class=${`bpop__sec bpop__milestones ${cls}`} data-testid="bond-milestones">
    <h4>${t('层数奖励')} <${MicroLabel}>LAYER MILESTONES</${MicroLabel}></h4>
    <ul class="bpop__ms">
      ${list.map((m, i) => html`<li key=${i} class=${m.pending ? 'is-pending' : m.left === 0 ? 'is-done' : ''} data-step=${m.step} data-mode=${m.mode}>
        <span class="bpop__ms-what">${m.mode === 'every' ? t('每 {step} 层：{effect}', { step: m.step, effect: m.label })
          : m.mode === 'first' ? t('首次达到 {step} 层：{effect}', { step: m.step, effect: m.label })
            : t('达到 {step} 层：{effect}', { step: m.step, effect: m.label })}</span>
        <span class="bpop__ms-where">${m.mode === 'every'
          ? html`<b class="num">${m.paid}</b> ${t('次')} · ${m.left > 0 ? t('下一件在 {next} 层（还差 {left} 层）', { next: m.next, left: m.left }) : t('已达下一档 {next} 层', { next: m.next })}`
          : m.paid ? html`<b class="num">✓</b> ${t('已达成')}` : t('还差 {left} 层', { left: m.left })}</span>
      </li>`)}
    </ul>
    ${list.some((m) => m.pending) ? html`<p class="bpop__ms-note" role="note">${t('盟约未激活：这些层数已经累计，激活时立即补发（每档只发一次）')}</p>` : null}
  </section>`;
}
