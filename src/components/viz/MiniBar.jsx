import React from 'react';

// 공용 가로 막대 목록 (파레토/비교용). 차트 라이브러리 없이 가벼운 CSS 막대.
// 전 페이지 재사용 (불량유형, 거래처 잔액, 부서 인건비 등).
//
// props: items: [{ label, value, color? }], unit?, barColor?, max?
const MiniBar = ({ items = [], unit = '', barColor = '#6366f1', max }) => {
  const mx = max || Math.max(...items.map((i) => Number(i.value) || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span title={it.label} style={{ fontSize: '0.78rem', color: 'var(--text-main)', flex: '0 0 38%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{it.label}</span>
          <div style={{ flex: 1, height: 14, background: 'var(--bg-subtle)', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <div style={{ width: `${((Number(it.value) || 0) / mx) * 100}%`, height: '100%', background: it.color || barColor, borderRadius: 7, minWidth: 2, transition: 'width 0.4s' }} />
          </div>
          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{(Number(it.value) || 0).toLocaleString()}{unit}</span>
        </div>
      ))}
    </div>
  );
};

export default MiniBar;
