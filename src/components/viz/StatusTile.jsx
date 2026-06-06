import React from 'react';

// 공용 상태 타일 — 색상으로 상태를 즉시 인지시키는 카드.
// 전 페이지 재사용 (설비/작업/금형/발주 상태 등).
//
// props:
//  tone: 'success' | 'neutral' | 'warning' | 'danger' | 'info'  (상태색)
//  title: 굵은 제목 (예: 설비명)
//  sub: 보조 텍스트 (예: 제품명/상태)
//  badge: 우측 강조값 (예: '83%')
//  onClick: 있으면 클릭 가능
const TONES = {
  success: { bd: '#16a34a', bg: 'rgba(22,163,74,0.06)', dot: '#16a34a' },
  neutral: { bd: '#cbd5e1', bg: 'var(--bg-subtle)', dot: '#94a3b8' },
  warning: { bd: '#f59e0b', bg: 'rgba(245,158,11,0.06)', dot: '#f59e0b' },
  danger: { bd: '#ef4444', bg: 'rgba(239,68,68,0.06)', dot: '#ef4444' },
  info: { bd: '#3b82f6', bg: 'rgba(59,130,246,0.06)', dot: '#3b82f6' },
};

const ell = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 };

const StatusTile = ({ tone = 'neutral', title, sub, badge, onClick }) => {
  const t = TONES[tone] || TONES.neutral;
  return (
    <div
      onClick={onClick}
      style={{
        borderLeft: `3px solid ${t.bd}`, background: t.bg, border: '1px solid var(--border)',
        borderRadius: 8, padding: '8px 10px', cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.12s, box-shadow 0.12s', minWidth: 0,
      }}
      onMouseEnter={onClick ? (e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; } : undefined}
      onMouseLeave={onClick ? (e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-main)', ...ell }}>{title}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dot, flexShrink: 0 }} />
      </div>
      {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, ...ell }}>{sub}</div>}
      {badge != null && <div style={{ fontSize: '0.72rem', fontWeight: 800, color: t.bd, marginTop: 2 }}>{badge}</div>}
    </div>
  );
};

export default StatusTile;
