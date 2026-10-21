// public/js/ui/battleReplay.js — replay one recorded battle (DESIGN §21.58).
//
// A record stores each field's `spec` (the deterministic input of a battle, docs/SIM.md): replaying is re-simulating it
// in this page, not playing back frames. The player therefore needs three things the game screen already has — the
// browser sim (battle/simLoader.js), a paced stepping loop (the runner's pattern, simplified: one page battle, no net),
// and the field view (ui/fieldHost.js + render/app.js). It shows its own bar (播放 / 暂停 / 倍速 / 重播 / 关闭) because a
// replay has no server to ask for a rewind.
//
// Determinism: the spec carries the seed, the stage, the units and the spawns; the same build yields the same battle. A
// recording from another build may differ — the record names its `app` version and the view says so when it does not
// match (a warning line, the replay still runs).
import { useEffect, useMemo, useRef, useState } from '../../vendor/hooks.module.js';
import { html, Button, Icon, Spinner } from './components.js';
import { useFieldView } from './fieldHost.js';
import { InPageSimHost } from '../battle/simHost.js';
import { APP_VERSION } from '../../../shared/constants.js';
import { t } from '../../../shared/i18n.js';

const TICK = 1 / 30;
/** Ticks a frame may advance; a slow frame must not fast-forward the whole battle at once. */
const MAX_TICKS_PER_FRAME = 12;

/** Seconds → `m:ss` for the bar. */
const clock = (s) => {
  const n = Math.max(0, Math.floor(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/**
 * The replay player.
 * @param {{ battle: { fieldId?: string, kind?: string, round?: number, spec: object, result?: object },
 *           record?: { app?: string, room?: string, difficulty?: string }, onClose: () => void }} props
 */
export function BattleReplay({ battle, record = null, onClose }) {
  const hostRef = useRef(null);
  const { view, kind: viewKind } = useFieldView(hostRef);
  const [status, setStatus] = useState('loading');   // loading | ready | done | error
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(2);
  const [gt, setGt] = useState(0);
  const [killed, setKilled] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);             // 重播: a new host + battle, the same spec
  const host = useRef(null);
  const raf = useRef(0);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  playingRef.current = playing;
  speedRef.current = speed;
  const oldVersion = useMemo(() => !!record?.app && record.app !== APP_VERSION, [record?.app]);

  useEffect(() => {
    let alive = true;
    host.current?.stop?.();
    host.current = null;
    setStatus('loading'); setError(null); setGt(0); setKilled(0); setTotal(0);
    if (!view) return undefined;
    let h = null;
    (async () => {
      try {
        const h2 = new InPageSimHost();
        await h2.load();
        if (!alive) { h2.stop?.(); return; }
        h = h2;
        h.start(battle.spec, {});
        host.current = h;
        const u = (battle.spec && battle.spec.units) || [];
        const kind = battle.kind || battle.spec.kind || 'normal';
        view.enterBattle({ fieldId: battle.fieldId || battle.spec.fieldId, kind, stageId: battle.spec.stageId || null, rect: battle.spec.rect || null, units: u });
        // the same framing the game screen asks for when a battle starts (game.js: `setCam(kind, { rect, side })`)
        view.setCamera?.(kind === 'hidden' ? 'boss' : kind, { rect: battle.spec.rect || undefined, side: 'L', instant: true });
        view.pushSnapshot(h.step(0).snap);
        setStatus('ready');
      } catch (e) {
        if (!alive) return;
        setError(e && e.message ? e.message : String(e));
        setStatus('error');
      }
    })();
    return () => { alive = false; cancelAnimationFrame(raf.current); try { host.current?.stop?.(); } catch { /* ignore */ } host.current = null; };
  }, [view, battle.spec, nonce]);

  // the pacing loop: wall-clock × speed → whole ticks; the sim's own clock is authoritative for the bar
  useEffect(() => {
    if (status !== 'ready') return undefined;
    let last = performance.now();
    let acc = 0;
    const loop = (now) => {
      raf.current = requestAnimationFrame(loop);
      const dt = Math.min(0.25, (now - last) / 1000) * speedRef.current;
      last = now;
      const h = host.current;
      if (!h || !playingRef.current) return;
      acc += dt;
      let ticks = Math.floor(acc / TICK);
      if (ticks <= 0) return;
      acc -= ticks * TICK;
      ticks = Math.min(ticks, MAX_TICKS_PER_FRAME * Math.max(1, Math.ceil(speedRef.current / 2)));
      const out = h.step(ticks);
      if (!out.ticks) { setPlaying(false); setStatus('done'); return; }
      view?.pushEvents(out.ev);
      view?.pushSnapshot(out.snap);
      const snap = out.snap || {};
      setGt(Number(out.state?.time) || 0);
      setKilled(Number(snap.killed) || 0);
      setTotal(Number(snap.total) || 0);
      if (out.state?.finished) { setPlaying(false); setStatus('done'); }
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [status, view, nonce]);

  const restart = () => { setPlaying(true); setNonce((n) => n + 1); };
  const progress = total > 0 ? Math.min(1, killed / total) : 0;

  return html`<div class="brep" role="dialog" aria-label=${t('战斗回放')}>
    <div class="brep__host" ref=${hostRef}></div>
    ${viewKind === 'fallback' ? html`<div class="brep__fallback">${t('正在用简化画面回放（3D 素材未就绪）')}</div>` : null}
    <div class="brep__bar">
      <div class="brep__title">
        <b>${t('战斗回放')}</b>
        <span>${battle.round != null ? t('第 {n} 回合', { n: battle.round }) : ''}${battle.kind ? ` · ${kindLabel(battle.kind)}` : ''}${record?.room ? ` · ${record.room}` : ''}</span>
      </div>
      <div class="brep__stats num">
        <span>${clock(gt)}</span>
        <span>${t('击杀 {k}/{n}', { k: killed, n: total })}</span>
      </div>
      <div class="brep__track" aria-hidden="true"><i style=${{ width: `${Math.round(progress * 100)}%` }}></i></div>
      <div class="brep__ctl">
        ${status === 'loading' ? html`<${Spinner} size="sm" />` : null}
        <${Button} size="sm" variant="secondary" disabled=${status !== 'ready' && status !== 'done'}
          onClick=${() => setPlaying((p) => !p)}>
          <${Icon} name=${playing ? 'pause' : 'play'} />${playing ? t('暂停') : t('播放')}
        <//>
        ${[1, 2, 4].map((n) => html`<${Button} key=${n} size="sm" variant=${speed === n ? 'primary' : 'secondary'}
          onClick=${() => setSpeed(n)}>${n}×<//>`)}
        <${Button} size="sm" variant="secondary" onClick=${restart}>${t('重播')}<//>
        <${Button} size="sm" variant="secondary" onClick=${onClose}>${t('关闭')}<//>
      </div>
      ${status === 'done' ? html`<div class="brep__done">${t('回放结束')}</div>` : null}
      ${status === 'error' ? html`<div class="brep__err">${t('回放失败：{msg}', { msg: error || '?' })}</div>` : null}
      ${oldVersion ? html`<div class="brep__warn">${t('这条记录由 {v} 生成，与当前版本不同，画面可能与当时不一致。', { v: record.app })}</div>` : null}
    </div>
  </div>`;
}

/** 战场 kind → 界面词. */
function kindLabel(kind) {
  if (kind === 'unite') return t('联防');
  if (kind === 'boss') return t('最终攻势');
  if (kind === 'hidden') return t('隐秘核心');
  return t('作战');
}
