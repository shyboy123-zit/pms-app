import React, { useMemo, useState } from 'react';

// 공장 호기 배치도 (모식도)
// 실제 공장 레이아웃대로 호기를 사출성형기 모양으로 배치하고,
// 각 호기 안에 작업 진척 게이지(생산/목표)를 표시한다.
//
// row/col 은 CSS Grid 좌표(1-based). 좌측 세로 벽(col 1) + 하단 가로 벽(row 10).
const LAYOUT = [
  { code: '150-1', row: 1, col: 1 },
  { code: '100-3', row: 2, col: 1 },
  { code: '100-2', row: 3, col: 1 },
  { code: '100-1', row: 4, col: 1 },
  { code: '90-4', row: 5, col: 1 },
  { code: '90-3', row: 6, col: 1 },
  { code: '90-2', row: 7, col: 1 },
  { code: '90-1', row: 8, col: 1 },
  { code: '25-3', row: 9, col: 1 },
  { code: '25-2', row: 10, col: 1 },
  { code: '25-1', row: 10, col: 2 },
  { code: '70-3', row: 10, col: 3 },
  { code: '70-2', row: 10, col: 4 },
  { code: '70-1', row: 10, col: 5 },
];

// 설비명을 배치도 코드와 비교하기 위해 정규화 — 공백/'호'/'호기'/톤수 'T' 제거
// 예: "150T-1호" → "150-1", "100-2" → "100-2"
const normalize = (s) => String(s || '').toUpperCase().replace(/\s|호기|호/g, '').replace(/T(?=-)/g, '').replace(/T$/g, '');

function findEquipment(equipments, code) {
  const nc = normalize(code);
  return (
    equipments.find((e) => normalize(e.name) === nc) ||
    equipments.find((e) => normalize(e.eq_code) === nc) ||
    equipments.find((e) => normalize(e.name).includes(nc) && nc.length >= 3) ||
    null
  );
}

// 소진 예상 시간(시간 단위)을 사람이 읽기 좋은 문구로
const fmtDuration = (h) => {
  if (!isFinite(h)) return '충분';
  if (h < 1) return `${Math.round(h * 60)}분 후`;
  if (h < 24) return `${h.toFixed(1)}시간 후`;
  return `${Math.floor(h / 24)}일 후`;
};

// 큰 수를 짧게 (20000 → '2만', 11180 → '1.1만') — 호기 카드 게이지 글자 잘림 방지
const compactNum = (n) => {
  const v = Number(n) || 0;
  if (v >= 10000) {
    const man = v / 10000;
    return (man >= 10 ? Math.round(man) : Math.round(man * 10) / 10) + '만';
  }
  return v.toLocaleString();
};

const FactoryFloorMap = ({ equipments = [], workOrders = [], products = [], productionLogs = [], materials = [], onMachineClick }) => {
  // 폰에서 우측 패널을 버튼→팝업으로 띄울 때 선택된 패널
  const [mobilePanel, setMobilePanel] = useState(null);
  // 배치도 각 칸의 상태/작업 계산 + 배치된 설비 id 집합
  const { cells, extras } = useMemo(() => {
    const matchedIds = new Set();
    const cells = LAYOUT.map((slot) => {
      const eq = findEquipment(equipments, slot.code);
      if (eq) matchedIds.add(eq.id);
      const wo = eq ? workOrders.find((w) => w.id === eq.current_work_order_id) : null;
      const product = wo ? products.find((p) => p.id === wo.product_id) : null;
      const target = wo ? Number(wo.target_quantity) || 0 : 0;
      const produced = wo ? Number(wo.produced_quantity) || 0 : 0;
      const progress = target > 0 ? Math.min(Math.round((produced / target) * 100), 100) : 0;

      let state = 'missing';
      if (eq) {
        if (eq.status === '가동중') state = 'running';
        else if (eq.status === '대기') state = 'idle';
        else state = 'fault';
      }
      return { ...slot, eq, wo, product, target, produced, progress, state };
    });
    // 배치도에 없지만 가동 중인 설비 (숨기지 않고 별도 표시)
    const extras = equipments.filter((e) => e.status === '가동중' && !matchedIds.has(e.id));
    return { cells, extras };
  }, [equipments, workOrders, products]);

  // 우측 종합 현황 패널용 통계
  const stats = useMemo(() => {
    const total = equipments.length;
    const running = equipments.filter((e) => e.status === '가동중').length;
    const idle = equipments.filter((e) => e.status === '대기').length;
    const stopped = Math.max(total - running - idle, 0);
    const util = total > 0 ? Math.round((running / total) * 100) : 0;
    const t = total || 1;
    const runDeg = (running / t) * 360;
    const idleDeg = runDeg + (idle / t) * 360;

    const now = Date.now();

    // 가동 호기 예상 완료 (ETA)
    const eta = [];
    equipments.filter((e) => e.status === '가동중' && e.current_work_order_id).forEach((e) => {
      const wo = workOrders.find((w) => w.id === e.current_work_order_id);
      if (!wo) return;
      const product = products.find((p) => p.id === wo.product_id);
      const target = Number(wo.target_quantity) || 0;
      const produced = Number(wo.produced_quantity) || 0;
      const remaining = Math.max(target - produced, 0);
      const cavity = Number(product?.cavity_count) || 1;
      const cycleSec = Number(product?.standard_cycle_time) || Number(e.cycle_time) || 0;
      let etaText = '—', etaMs = Infinity;
      if (remaining <= 0) { etaText = '완료임박'; etaMs = now; }
      else if (cycleSec > 0) {
        const shots = Math.ceil(remaining / (cavity > 0 ? cavity : 1));
        etaMs = now + shots * cycleSec * 1000;
        const d = new Date(etaMs);
        const hhmm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        etaText = new Date(now).toDateString() === d.toDateString() ? hhmm : `내일 ${hhmm}`;
      }
      eta.push({ code: e.name, product: product?.name, remaining, etaText, etaMs });
    });
    eta.sort((a, b) => a.etaMs - b.etaMs);

    // 오늘/어제 생산 실적 (production_date 는 UTC 기준 저장과 동일하게 맞춤)
    const todayStr = new Date(now).toISOString().split('T')[0];
    const yStr = new Date(now - 86400000).toISOString().split('T')[0];
    const sumByDate = (ds) => (productionLogs || []).filter((l) => l.production_date === ds)
      .reduce((s, l) => s + (Number(l.daily_quantity) || 0), 0);
    const todayQty = sumByDate(todayStr);
    const yQty = sumByDate(yStr);
    const todayMax = Math.max(todayQty, yQty, 1);
    const trendPct = yQty > 0 ? Math.round(((todayQty - yQty) / yQty) * 100) : null;

    // 임박(진척 90%+) / 지연(7일+ 저진척) 작업
    const imminent = [], delayed = [];
    workOrders.filter((w) => w.status === '진행중').forEach((w) => {
      const target = Number(w.target_quantity) || 0;
      const made = Number(w.produced_quantity) || 0;
      const prog = target > 0 ? Math.round((made / target) * 100) : 0;
      const product = products.find((p) => p.id === w.product_id);
      const label = product?.name || w.order_code || '작업';
      if (prog >= 90 && prog < 100) imminent.push({ id: w.id, label, prog });
      if (w.start_time) {
        const days = Math.floor((now - new Date(w.start_time).getTime()) / 86400000);
        if (days >= 7 && prog < 100) delayed.push({ id: w.id, label, prog, days });
      }
    });

    // 가동중 원재료 소진 예상 — 같은 원재료를 쓰는 호기는 소비속도를 합산
    const matAgg = {};
    equipments.filter((e) => e.status === '가동중' && e.current_work_order_id).forEach((e) => {
      const wo = workOrders.find((w) => w.id === e.current_work_order_id);
      if (!wo) return;
      const product = products.find((p) => p.id === wo.product_id);
      if (!product || !product.material_id) return;
      const cavity = Number(product.cavity_count) || 1;
      const shotG = cavity * (Number(product.product_weight) || 0) + (Number(product.runner_weight) || 0);
      const cycleSec = Number(product.standard_cycle_time) || Number(e.cycle_time) || 0;
      if (shotG <= 0 || cycleSec <= 0) return;
      const gPerHr = (3600 / cycleSec) * shotG;
      if (!matAgg[product.material_id]) {
        const mat = materials.find((m) => m.id === product.material_id);
        matAgg[product.material_id] = {
          name: mat?.name || mat?.material_name || '원재료', unit: mat?.unit || 'kg',
          stockKg: Number(mat?.stock) || 0, gPerHr: 0, machines: [],
        };
      }
      matAgg[product.material_id].gPerHr += gPerHr;
      matAgg[product.material_id].machines.push(e.name);
    });
    const materialForecast = Object.values(matAgg).map((m) => {
      const kgPerHr = m.gPerHr / 1000;
      const hours = kgPerHr > 0 ? m.stockKg / kgPerHr : Infinity;
      const sev = hours < 4 ? 'critical' : hours < 12 ? 'warn' : 'ok';
      return { ...m, kgPerHr, hours, sev };
    }).sort((a, b) => a.hours - b.hours);

    return { total, running, idle, stopped, util, runDeg, idleDeg, eta, todayQty, yQty, todayMax, trendPct, imminent, delayed, materialForecast };
  }, [equipments, workOrders, products, productionLogs, materials]);

  const stateLabel = { running: '가동중', idle: '대기', fault: '점검/정지', missing: '미등록' };

  // ── 우측 종합 현황 패널 콘텐츠 (PC: 그리드 / 폰: 버튼→팝업 재사용) ──
  const utilContent = (
    <div className="ffm-util">
      <div className="ffm-donut" style={{ background: `conic-gradient(#16a34a 0 ${stats.runDeg}deg, #94a3b8 ${stats.runDeg}deg ${stats.idleDeg}deg, #ef4444 ${stats.idleDeg}deg 360deg)` }}>
        <div className="ffm-donut-hole"><b>{stats.util}%</b><span>가동률</span></div>
      </div>
      <div className="ffm-util-legend">
        <div><i style={{ background: '#16a34a' }} /> 가동 <b>{stats.running}</b></div>
        <div><i style={{ background: '#94a3b8' }} /> 대기 <b>{stats.idle}</b></div>
        <div><i style={{ background: '#ef4444' }} /> 정지 <b>{stats.stopped}</b></div>
        <div className="ffm-util-total">전체 {stats.total}대</div>
      </div>
    </div>
  );
  const etaContent = stats.eta.length > 0 ? (
    <ul className="ffm-eta">
      {stats.eta.slice(0, 6).map((e) => (
        <li key={e.code}>
          <span className="ffm-eta-code">{e.code}</span>
          <span className="ffm-eta-prod" title={e.product || ''}>{e.product || '-'}</span>
          <span className="ffm-eta-time">{e.etaText}</span>
        </li>
      ))}
    </ul>
  ) : <div className="ffm-empty-sm">가동 중인 호기가 없습니다</div>;
  const todayContent = (
    <>
      <div className="ffm-today-num">{stats.todayQty.toLocaleString()}<span> 개</span></div>
      <div className="ffm-today-cmp">
        어제 {stats.yQty.toLocaleString()}개
        {stats.trendPct !== null && (
          <span className={stats.trendPct >= 0 ? 'up' : 'down'}>
            {' '}· {stats.trendPct >= 0 ? '▲' : '▼'} {Math.abs(stats.trendPct)}%
          </span>
        )}
      </div>
      <div className="ffm-today-bars">
        <div className="ffm-today-bar"><span style={{ width: `${(stats.todayQty / stats.todayMax) * 100}%`, background: '#6366f1' }} /><em>오늘</em></div>
        <div className="ffm-today-bar"><span style={{ width: `${(stats.yQty / stats.todayMax) * 100}%`, background: '#cbd5e1' }} /><em>어제</em></div>
      </div>
    </>
  );
  const alertContent = (stats.imminent.length > 0 || stats.delayed.length > 0) ? (
    <div className="ffm-alert-list">
      {stats.imminent.map((w) => (
        <div key={`im-${w.id}`} className="ffm-alert-row">
          <span className="ffm-tag im">임박</span>
          <span className="ffm-alert-label" title={w.label}>{w.label}</span>
          <span className="ffm-alert-val">{w.prog}%</span>
        </div>
      ))}
      {stats.delayed.map((w) => (
        <div key={`dl-${w.id}`} className="ffm-alert-row">
          <span className="ffm-tag dl">지연</span>
          <span className="ffm-alert-label" title={w.label}>{w.label}</span>
          <span className="ffm-alert-val">{w.days}일·{w.prog}%</span>
        </div>
      ))}
    </div>
  ) : <div className="ffm-empty-sm">특이사항 없음 ✓</div>;
  const materialContent = stats.materialForecast.length > 0 ? (
    <div className="ffm-mat-list">
      {stats.materialForecast.slice(0, 4).map((m, i) => (
        <div key={i} className={`ffm-mat-row ${m.sev}`}>
          <span className="ffm-mat-name" title={`사용 호기: ${m.machines.join(', ')}`}>{m.name}</span>
          <span className="ffm-mat-stock">재고 {m.stockKg.toLocaleString()}{m.unit}</span>
          <span className="ffm-mat-rate">{m.kgPerHr.toFixed(1)}{m.unit}/h</span>
          <span className={`ffm-mat-eta ${m.sev}`}>{fmtDuration(m.hours)}</span>
        </div>
      ))}
    </div>
  ) : <div className="ffm-empty-sm">가동중 호기의 원재료 정보가 없습니다 (중량·사이클 입력 필요)</div>;

  const PANELS = [
    { key: 'util', title: '🏭 가동 현황', short: '🏭 가동현황', node: utilContent, full: false },
    { key: 'eta', title: '⏱️ 예상 완료 (ETA)', short: '⏱️ ETA', node: etaContent, full: false },
    { key: 'today', title: '📈 오늘 생산', short: '📈 오늘생산', node: todayContent, full: false },
    { key: 'alert', title: '🚨 임박·지연 작업', short: '🚨 임박·지연', node: alertContent, full: false },
    { key: 'material', title: '🧱 가동중 원재료 소진 예상', short: '🧱 원재료소진', node: materialContent, full: true },
  ];

  return (
    <div className="ffm-wrap">
      <div className="ffm-grid">
        {cells.map((c) => (
          <div
            key={c.code}
            className={`ffm-machine ${c.state}`}
            style={{ gridRow: c.row, gridColumn: c.col }}
            onClick={() => c.eq && onMachineClick && onMachineClick(c.eq, c.wo)}
            title={c.state === 'running' ? '클릭하여 사출조건 보기' : c.code}
          >
            <div className="ffm-hopper" />
            <div className="ffm-body">
              <div className="ffm-top">
                <span className="ffm-code">{c.code}</span>
                <span className={`ffm-dot ${c.state}`} />
              </div>
              {c.state === 'running' ? (
                <>
                  <div className="ffm-product" title={c.product?.name || ''}>{c.product?.name || '제품 미지정'}</div>
                  <div className="ffm-gauge">
                    <div className="ffm-gauge-fill" style={{ width: `${c.progress}%` }} />
                    <span className="ffm-gauge-text">{compactNum(c.produced)}/{compactNum(c.target)} · {c.progress}%</span>
                  </div>
                </>
              ) : (
                <div className={`ffm-state ${c.state}`}>{stateLabel[c.state]}</div>
              )}
            </div>
          </div>
        ))}

        {/* 우측 종합 현황 패널 (PC 전용 — 배치도 빈 공간 활용) */}
        <div className="ffm-side" style={{ gridColumn: '2 / 6', gridRow: '1 / 10' }}>
          {PANELS.map((p) => (
            <div key={p.key} className="ffm-panel" style={p.full ? { gridColumn: '1 / -1' } : undefined}>
              <div className="ffm-panel-title">{p.title}</div>
              {p.node}
            </div>
          ))}
        </div>

        {/* 폰 전용 — 패널 버튼 (배치도 옆 빈 공간에 배치) */}
        <div className="ffm-mobile-tabs" style={{ gridColumn: '2 / 6', gridRow: '1 / 10' }}>
          {PANELS.map((p) => (
            <button key={p.key} className="ffm-mtab" onClick={() => setMobilePanel(p)}>{p.short}</button>
          ))}
        </div>
      </div>

      {/* 폰 패널 팝업 — 콘텐츠 크기에 맞춤, 바깥 터치 시 닫힘 */}
      {mobilePanel && (
        <div className="ffm-pop-overlay" onClick={(e) => { if (e.target === e.currentTarget) setMobilePanel(null); }}>
          <div className="ffm-pop">
            <div className="ffm-pop-head">
              <span>{mobilePanel.title}</span>
              <button className="ffm-pop-x" onClick={() => setMobilePanel(null)} aria-label="닫기">✕</button>
            </div>
            <div className="ffm-pop-body">{mobilePanel.node}</div>
          </div>
        </div>
      )}

      {/* 범례 */}
      <div className="ffm-legend">
        <span><i className="ffm-dot running" /> 가동중</span>
        <span><i className="ffm-dot idle" /> 대기</span>
        <span><i className="ffm-dot fault" /> 점검/정지</span>
        <span><i className="ffm-dot missing" /> 미등록</span>
      </div>

      {extras.length > 0 && (
        <div className="ffm-extras">
          ⚠️ 배치도 외 가동 호기: {extras.map((e) => e.name).join(', ')}
        </div>
      )}

      <style>{`
        .ffm-wrap { width: 100%; }
        .ffm-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          grid-auto-rows: 62px;
          gap: 10px;
          padding: 16px;
          border-radius: 14px;
          background:
            linear-gradient(var(--bg-subtle), var(--bg-subtle)) padding-box,
            repeating-linear-gradient(45deg, rgba(148,163,184,0.06) 0 10px, transparent 10px 20px);
          border: 1px solid var(--border);
          /* 좌측·하단 공장 벽 느낌 */
          box-shadow: inset 4px 0 0 rgba(99,102,241,0.12), inset 0 -4px 0 rgba(99,102,241,0.12);
        }

        .ffm-machine {
          position: relative;
          display: flex;
          align-items: stretch;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border);
          border-radius: 8px;
          padding: 6px 8px;
          cursor: default;
          transition: transform 0.12s, box-shadow 0.12s;
          min-width: 0;
        }
        .ffm-machine.running { cursor: pointer; border-color: #16a34a; box-shadow: 0 0 0 1px rgba(22,163,74,0.25); }
        .ffm-machine.running:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(22,163,74,0.25); }
        .ffm-machine.idle { opacity: 0.92; }
        .ffm-machine.fault { border-color: #ef4444; }
        .ffm-machine.missing { border-style: dashed; opacity: 0.55; }

        /* 사출기 호퍼(상단 돌출부) */
        .ffm-hopper {
          position: absolute;
          top: -7px; left: 12px;
          width: 16px; height: 8px;
          background: var(--bg-card, #fff);
          border: 1.5px solid var(--border);
          border-bottom: none;
          border-radius: 3px 3px 0 0;
        }
        .ffm-machine.running .ffm-hopper { border-color: #16a34a; }
        .ffm-machine.fault .ffm-hopper { border-color: #ef4444; }

        .ffm-body { display: flex; flex-direction: column; justify-content: center; gap: 3px; width: 100%; min-width: 0; }
        .ffm-top { display: flex; align-items: center; justify-content: space-between; }
        .ffm-code { font-size: 0.82rem; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em; }

        .ffm-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block; }
        .ffm-dot.running { background: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.18); animation: ffmPulse 1.6s infinite; }
        .ffm-dot.idle { background: #94a3b8; }
        .ffm-dot.fault { background: #ef4444; }
        .ffm-dot.missing { background: #cbd5e1; }
        @keyframes ffmPulse { 0%,100% { box-shadow: 0 0 0 2px rgba(22,163,74,0.25); } 50% { box-shadow: 0 0 0 5px rgba(22,163,74,0.05); } }

        .ffm-product {
          font-size: 0.68rem; color: var(--text-muted); font-weight: 600;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .ffm-state { font-size: 0.7rem; font-weight: 700; }
        .ffm-state.idle { color: #64748b; }
        .ffm-state.fault { color: #ef4444; }
        .ffm-state.missing { color: #94a3b8; }

        .ffm-gauge {
          position: relative; height: 14px; border-radius: 7px;
          background: var(--bg-subtle); overflow: hidden; border: 1px solid var(--border);
        }
        .ffm-gauge-fill {
          position: absolute; inset: 0; right: auto;
          background: linear-gradient(90deg, #22c55e, #16a34a);
          border-radius: 7px; transition: width 0.4s;
        }
        .ffm-gauge-text {
          position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
          font-size: 0.6rem; font-weight: 700; color: #0f172a; white-space: nowrap;
          text-shadow: 0 0 2px rgba(255,255,255,0.7);
        }

        .ffm-legend { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 12px; padding: 0 4px; font-size: 0.76rem; color: var(--text-muted); }
        .ffm-legend span { display: inline-flex; align-items: center; gap: 5px; }
        .ffm-legend i { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

        .ffm-extras { margin-top: 10px; font-size: 0.78rem; color: #b45309; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 8px; padding: 8px 12px; }

        /* === 우측 종합 현황 패널 === */
        .ffm-side { display: grid; grid-template-columns: 1fr 1fr; grid-auto-rows: minmax(0, 1fr); gap: 12px; min-height: 0; }
        .ffm-panel {
          background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 12px;
          padding: 12px 14px; display: flex; flex-direction: column; min-width: 0; overflow: hidden;
        }
        .ffm-panel-title { font-size: 0.82rem; font-weight: 800; color: var(--text-main); margin-bottom: 10px; letter-spacing: -0.01em; }

        /* 가동률 도넛 */
        .ffm-util { display: flex; align-items: center; gap: 16px; flex: 1; }
        .ffm-donut { width: 92px; height: 92px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .ffm-donut-hole { width: 64px; height: 64px; border-radius: 50%; background: var(--bg-card, #fff); display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .ffm-donut-hole b { font-size: 1.15rem; font-weight: 800; color: var(--text-main); line-height: 1; }
        .ffm-donut-hole span { font-size: 0.62rem; color: var(--text-muted); margin-top: 2px; }
        .ffm-util-legend { display: flex; flex-direction: column; gap: 6px; font-size: 0.82rem; color: var(--text-muted); }
        .ffm-util-legend > div { display: flex; align-items: center; gap: 6px; }
        .ffm-util-legend i { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
        .ffm-util-legend b { color: var(--text-main); font-weight: 800; }
        .ffm-util-total { margin-top: 2px; font-size: 0.72rem; opacity: 0.75; }

        /* ETA 리스트 */
        .ffm-eta { display: flex; flex-direction: column; gap: 5px; overflow-y: auto; }
        .ffm-eta li { display: flex; align-items: center; gap: 8px; font-size: 0.76rem; }
        .ffm-eta-code { font-weight: 800; color: var(--text-main); min-width: 44px; }
        .ffm-eta-prod { flex: 1; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ffm-eta-time { font-weight: 700; color: #16a34a; white-space: nowrap; }

        /* 오늘 생산 */
        .ffm-today-num { font-size: 1.6rem; font-weight: 800; color: var(--text-main); line-height: 1.1; }
        .ffm-today-num span { font-size: 0.8rem; font-weight: 600; color: var(--text-muted); }
        .ffm-today-cmp { font-size: 0.76rem; color: var(--text-muted); margin: 4px 0 10px; }
        .ffm-today-cmp .up { color: #16a34a; font-weight: 700; }
        .ffm-today-cmp .down { color: #ef4444; font-weight: 700; }
        .ffm-today-bars { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
        .ffm-today-bar { position: relative; height: 16px; background: var(--bg-subtle); border-radius: 8px; overflow: hidden; }
        .ffm-today-bar span { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 8px; min-width: 2px; transition: width 0.4s; }
        .ffm-today-bar em { position: absolute; left: 8px; top: 0; bottom: 0; display: flex; align-items: center; font-style: normal; font-size: 0.62rem; font-weight: 700; color: #475569; }

        /* 임박·지연 */
        .ffm-alert-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; }
        .ffm-alert-row { display: flex; align-items: center; gap: 7px; font-size: 0.76rem; }
        .ffm-tag { font-size: 0.64rem; font-weight: 800; padding: 2px 6px; border-radius: 6px; flex-shrink: 0; }
        .ffm-tag.im { background: #dcfce7; color: #15803d; }
        .ffm-tag.dl { background: #fee2e2; color: #b91c1c; }
        .ffm-alert-label { flex: 1; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ffm-alert-val { font-weight: 700; color: var(--text-muted); white-space: nowrap; }

        /* 원재료 소진 예상 */
        .ffm-mat-list { display: flex; flex-direction: column; gap: 6px; }
        .ffm-mat-row { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; padding: 5px 8px; border-radius: 7px; background: var(--bg-subtle); border-left: 3px solid var(--border); }
        .ffm-mat-row.critical { border-left-color: #ef4444; background: rgba(239,68,68,0.06); }
        .ffm-mat-row.warn { border-left-color: #f59e0b; background: rgba(245,158,11,0.06); }
        .ffm-mat-row.ok { border-left-color: #16a34a; }
        .ffm-mat-name { font-weight: 700; color: var(--text-main); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ffm-mat-stock { color: var(--text-muted); white-space: nowrap; }
        .ffm-mat-rate { color: var(--text-muted); white-space: nowrap; opacity: 0.85; }
        .ffm-mat-eta { font-weight: 800; white-space: nowrap; min-width: 64px; text-align: right; }
        .ffm-mat-eta.critical { color: #ef4444; }
        .ffm-mat-eta.warn { color: #d97706; }
        .ffm-mat-eta.ok { color: #16a34a; }

        .ffm-empty-sm { font-size: 0.78rem; color: var(--text-muted); margin: auto; padding: 12px 0; text-align: center; }

        /* 폰 전용 버튼 (PC 숨김) */
        .ffm-mobile-tabs { display: none; }

        /* 폰 패널 팝업 (콘텐츠 크기에 맞춤) */
        .ffm-pop-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1100; padding: 24px; animation: ffmPopFade 0.15s ease-out; }
        @keyframes ffmPopFade { from { opacity: 0; } to { opacity: 1; } }
        .ffm-pop { background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 16px; width: 100%; max-width: 420px; max-height: 80vh; display: flex; flex-direction: column; box-shadow: var(--shadow-xl); overflow: hidden; }
        .ffm-pop-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--border); }
        .ffm-pop-head span { font-size: 1rem; font-weight: 800; color: var(--text-main); }
        .ffm-pop-x { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-subtle); color: var(--text-muted); font-size: 1rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1; }
        .ffm-pop-x:active { background: var(--border); color: var(--text-main); }
        .ffm-pop-body { padding: 14px 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }

        @media (max-width: 768px) {
          .ffm-grid { grid-auto-rows: 58px; gap: 7px; padding: 10px; }
          .ffm-code { font-size: 0.74rem; }
          .ffm-product { font-size: 0.6rem; }
          .ffm-gauge-text { font-size: 0.52rem; }
          .ffm-machine { padding: 5px 6px; }
          /* 폰: 우측 패널 숨기고, 배치도 옆 빈 공간에 버튼 세로 배치 */
          .ffm-side { display: none !important; }
          .ffm-mobile-tabs { display: flex; flex-direction: column; gap: 8px; padding: 2px 2px 2px 4px; align-content: start; }
          .ffm-mtab {
            padding: 11px 10px; border-radius: 10px; border: 1px solid var(--border);
            background: var(--bg-card, #fff); color: var(--text-main);
            font-size: 0.84rem; font-weight: 700; cursor: pointer;
            box-shadow: var(--shadow-xs); text-align: center; width: 100%;
          }
          .ffm-mtab:active { background: var(--primary-soft); border-color: var(--primary); }
        }
      `}</style>
    </div>
  );
};

export default FactoryFloorMap;
