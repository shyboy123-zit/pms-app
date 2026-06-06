import React from 'react';

// 공용 캘린더 히트맵 — 최근 N일을 요일 정렬 격자로, 값 크기에 따라 색농도.
// 전 페이지 재사용 (일일 생산량/불량/근태 등).
// 날짜 키는 UTC(YYYY-MM-DD) 기준 — production_logs 등 저장 컨벤션과 일치.
//
// props: valuesByDate: { 'YYYY-MM-DD': number }, days?, unit?, hue?(rgb 'r,g,b')
const WD = ['일', '월', '화', '수', '목', '금', '토'];

const HeatCalendar = ({ valuesByDate = {}, days = 35, unit = '', hue = '22,163,74' }) => {
  const dkey = (d) => d.toISOString().split('T')[0];
  const today = new Date();
  const start = new Date(today.getTime() - (days - 1) * 86400000);
  const lead = start.getUTCDay();

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let i = 0; i < days; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const key = dkey(d);
    cells.push({ key, value: Number(valuesByDate[key]) || 0, label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}` });
  }
  const max = Math.max(...cells.filter(Boolean).map((c) => c.value), 1);
  const color = (v) => (v <= 0 ? 'var(--bg-subtle)' : `rgba(${hue}, ${0.18 + (v / max) * 0.82})`);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, maxWidth: 360 }}>
        {WD.map((w) => (
          <div key={w} style={{ fontSize: '0.62rem', color: 'var(--text-muted)', textAlign: 'center' }}>{w}</div>
        ))}
        {cells.map((c, i) => c == null ? (
          <div key={`e${i}`} />
        ) : (
          <div key={c.key}
            title={`${c.label}: ${c.value.toLocaleString()}${unit}`}
            style={{
              aspectRatio: '1 / 1', borderRadius: 4, background: color(c.value),
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.55rem', color: c.value > max * 0.5 ? '#fff' : 'var(--text-muted)', fontWeight: 600,
            }}>
            {c.value > 0 ? c.label.split('/')[1] : ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        적음
        {[0.18, 0.45, 0.7, 1].map((a) => (
          <span key={a} style={{ width: 12, height: 12, borderRadius: 3, background: `rgba(${hue}, ${a})`, border: '1px solid var(--border)' }} />
        ))}
        많음
      </div>
    </div>
  );
};

export default HeatCalendar;
