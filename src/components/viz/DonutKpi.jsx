import React from 'react';

// 공용 도넛 KPI — segments(값+색)로 비율 도넛, 가운데 라벨 표시.
// 전 페이지 재사용 (가동률, OK/NG, 미수/미지급 비중 등).
//
// props:
//  segments: [{ value, color }]  — 비율 계산
//  centerValue: 가운데 큰 글자 (예: '83%')
//  centerLabel: 가운데 작은 글자 (예: '가동률')
//  size: 지름(px), hole: 가운데 구멍 비율(0~1)
const DonutKpi = ({ segments = [], centerValue, centerLabel, size = 100, hole = 0.66 }) => {
  const total = segments.reduce((s, x) => s + (Number(x.value) || 0), 0);
  let acc = 0;
  const stops = total > 0
    ? segments.map((seg) => {
        const start = (acc / total) * 360;
        acc += Number(seg.value) || 0;
        const end = (acc / total) * 360;
        return `${seg.color} ${start}deg ${end}deg`;
      }).join(', ')
    : null;
  const background = stops ? `conic-gradient(${stops})` : '#e2e8f0';
  const holeSize = Math.round(size * hole);

  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <div style={{ width: holeSize, height: holeSize, borderRadius: '50%', background: 'var(--bg-card, #fff)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <b style={{ fontSize: `${size * 0.012 + 0.4}rem`, fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>{centerValue}</b>
        {centerLabel && <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 3 }}>{centerLabel}</span>}
      </div>
    </div>
  );
};

export default DonutKpi;
