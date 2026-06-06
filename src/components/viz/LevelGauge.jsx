import React from 'react';

// 공용 수평 채움 게이지 — value/max 비율을 막대로, 임계 색상 자동.
// 전 페이지 재사용 (진척률, 재고 수위, 수명 타수, 달성률 등).
//
// 색상 규칙(기본): 비율 >=1 초록 / >=0.6 인디고 / >=0.3 주황 / 그 외 빨강
//  - 진척(produced/target)·재고(current/min) 모두 "높을수록 좋음" 이라 동일 규칙 적용
//  - color 를 직접 넘기면 그 색으로 고정
//
// props: value, max, color?, height?, text?, showText?
const LevelGauge = ({ value = 0, max = 0, color, height = 10, text, showText = true }) => {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.min(Math.max(ratio, 0) * 100, 100);
  const auto = ratio >= 1 ? '#16a34a' : ratio >= 0.6 ? '#6366f1' : ratio >= 0.3 ? '#f59e0b' : '#ef4444';
  const fill = color || auto;
  const r = height / 2;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', height, background: 'var(--bg-subtle)', borderRadius: r, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: fill, borderRadius: r, transition: 'width 0.4s', minWidth: pct > 0 ? 2 : 0 }} />
      </div>
      {showText && text != null && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3, textAlign: 'right' }}>{text}</div>
      )}
    </div>
  );
};

export default LevelGauge;
