// public/js/ui/serverHistory.js — 对局记录 on the server (DESIGN §21.58): list + one record's battles + 回放.
//
// The local 对局记录 (ui/stats.js, localStorage) stays what it was: this page's own matches, re-viewable as their
// settlement. This list is the server's: every match it recorded, also the ones played from another device, with the
// battle specs that make a real replay possible. Both lists exist side by side in 统计数据 (the tabs 对局记录 /
// 服务器记录) because they answer different questions.
import { useEffect, useState } from '../../vendor/hooks.module.js';
import { html, Button, Icon, Spinner } from './components.js';
import { loadServerHistory, loadServerRecord } from './historyClient.js';
import { t, N_ } from '../../../shared/i18n.js';

/** 2026-10-21 12:34 — the same shape the local list uses, in the viewer's own time zone. */
function dateTime(tms) {
  const d = new Date(Number(tms) || 0);
  if (!Number.isFinite(d.getTime()) || d.getTime() <= 0) return '—';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// the 战场 names the list shows (msgids, translated at render time)
const KIND_LABEL = { normal: N_('作战'), unite: N_('联防'), boss: N_('最终攻势'), hidden: N_('隐秘核心') };

function kindOf(k) { return KIND_LABEL[k] ? t(KIND_LABEL[k]) : t('作战'); }

/**
 * The server's finished matches.
 * @param {{ onReplay: (x: { record: object, battle: object }) => void, only?: boolean }} props
 *   `only`: only the list (a caller that renders its own heading)
 */
export function ServerHistory({ onReplay }) {
  const [state, setState] = useState({ status: 'loading', matches: [], error: null });
  const [openId, setOpenId] = useState(null);
  const [record, setRecord] = useState(null);
  const [recError, setRecError] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, status: 'loading' }));
    loadServerHistory({ fresh: true }).then((r) => { if (alive) setState(r); });
    return () => { alive = false; };
  }, [reload]);

  useEffect(() => {
    let alive = true;
    setRecord(null); setRecError(null);
    if (!openId) return undefined;
    loadServerRecord(openId).then((r) => {
      if (!alive) return;
      if (r.ok) setRecord(r.record); else setRecError(r.error);
    });
    return () => { alive = false; };
  }, [openId]);

  if (state.status === 'loading') return html`<div class="st-loading"><${Spinner} size="md" /></div>`;
  if (state.status === 'off') {
    return html`<p class="st-empty">${t('这台服务器没有开启对局记录（服主可用 SP_HISTORY=off 关闭）。')}</p>`;
  }
  if (state.status === 'error') {
    return html`<div class="st-empty">
      <p>${t('读取服务器对局记录失败：{msg}', { msg: state.error || '?' })}</p>
      <${Button} size="sm" variant="secondary" onClick=${() => setReload((n) => n + 1)}>${t('重试')}<//>
    </div>`;
  }
  if (!state.matches.length) {
    return html`<p class="st-empty">${t('服务器还没有记录到对局 —— 打完一局后这里就会有。')}</p>`;
  }

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  return html`<div class="st-srv">
    <p class="st-hint">${t('服务器记录：这台服务器上打完的每一局（也包括别的设备打的），点开一局可以回放其中的每场战斗。')}</p>
    <div class="st-tablewrap"><table class="st-table st-table--server">
      <thead><tr>
        <th>${t('时间')}</th><th>${t('难度')}</th><th>${t('模式')}</th><th>${t('结果')}</th>
        <th class="num">${t('回合')}</th><th>${t('玩家')}</th><th class="num">${t('战斗')}</th><th aria-hidden="true"></th>
      </tr></thead>
      <tbody>
        ${state.matches.map((m) => {
          const open = openId === m.id;
          return html`<${Fragment} key=${m.id}>
            <tr class=${open ? 'is-open' : ''} tabIndex="0" role="button"
              onClick=${() => toggle(m.id)}
              onKeyDown=${(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(m.id); } }}>
              <td class="st-t">${dateTime(m.at)}</td>
              <td>${m.difficulty ? t(String(m.difficulty)) : '—'}</td>
              <td>${m.mode === 'solo' ? t('单人') : m.mode === 'coop' ? t('同盟') : '—'}</td>
              <td class="st-res">${m.result?.victory ? html`<span class="t-win">${t('胜')}</span>` : html`<span class="t-lose">${t('负')}</span>`}
                ${m.result?.reason ? html`<em class="st-chip">${reasonText(m.result.reason)}</em>` : null}</td>
              <td class="num">${m.rounds != null ? m.rounds : '—'}</td>
              <td class="st-srv__names">${(m.players || []).map((p) => p.name).filter(Boolean).join(' · ') || '—'}</td>
              <td class="num">${m.battles ?? 0}</td>
              <td class="st-go" aria-hidden="true"><${Icon} name=${open ? 'chevronDown' : 'chevronRight'} /></td>
            </tr>
            ${open ? html`<tr class="st-srv__detail"><td colSpan="8">
              ${recError ? html`<p class="st-empty">${t('读取失败：{msg}', { msg: recError })}</p>`
                : !record ? html`<div class="st-loading"><${Spinner} size="sm" /></div>`
                  : html`<div class="st-srv__battles">
                    <div class="st-srv__meta">${t('房间 {room}', { room: record.room || '—' })} · ${t('版本 {v}', { v: record.app || '—' })}${record.replayable ? '' : ` · ${t('这场对局没有可回放的战斗')}`}</div>
                    ${(record.battles || []).map((b, i) => html`<div class="st-srv__battle" key=${b.battleId || i}>
                      <span class="st-srv__bround">${b.round != null ? t('第 {n} 回合', { n: b.round }) : t('回合 —')}</span>
                      <span class="st-srv__bkind">${kindOf(b.kind)}</span>
                      ${b.result ? html`<span class="st-srv__bstat num">${t('击杀 {k}/{n}', { k: Number(b.result.killed) || 0, n: Number(b.result.total) || 0 })}</span>` : null}
                      <${Button} size="sm" variant="secondary" disabled=${!b.spec}
                        onClick=${() => onReplay({ record, battle: b })}>${t('回放')}<//>
                    </div>`)}
                  </div>`}
            </td></tr>` : null}
          <//>`;
        })}
      </tbody>
    </table></div>
  </div>`;
}

/** The public result reason → a short 界面词 (msgids, translated at render time). */
const REASON_LABEL = {
  cleared: N_('通关'), victory: N_('通关'), eliminated: N_('全员淘汰'),
  defeat: N_('失败'), timeout: N_('超时'), left: N_('离开'), abandoned: N_('放弃'),
};
function reasonText(reason) {
  return REASON_LABEL[reason] ? t(REASON_LABEL[reason]) : String(reason);
}

/** A zero-width wrapper so a <tbody> can hold a row pair (a row + its detail row). */
function Fragment({ children }) { return children; }
