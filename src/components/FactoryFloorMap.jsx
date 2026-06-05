import React, { useMemo } from 'react';

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

const FactoryFloorMap = ({ equipments = [], workOrders = [], products = [], onMachineClick }) => {
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

  const stateLabel = { running: '가동중', idle: '대기', fault: '점검/정지', missing: '미등록' };

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
                    <span className="ffm-gauge-text">{c.produced.toLocaleString()}/{c.target.toLocaleString()} · {c.progress}%</span>
                  </div>
                </>
              ) : (
                <div className={`ffm-state ${c.state}`}>{stateLabel[c.state]}</div>
              )}
            </div>
          </div>
        ))}
      </div>

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

        @media (max-width: 768px) {
          .ffm-grid { grid-auto-rows: 58px; gap: 7px; padding: 10px; }
          .ffm-code { font-size: 0.74rem; }
          .ffm-product { font-size: 0.62rem; }
        }
      `}</style>
    </div>
  );
};

export default FactoryFloorMap;
