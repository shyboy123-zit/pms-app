import React from 'react';

/**
 * 페이지 상단에 끼워넣는 미니 KPI 카드 그룹
 * Props:
 *   cards: [{ label, value, sub?, color?, icon? }]
 */
const MiniKpiCards = ({ cards }) => {
    if (!cards || cards.length === 0) return null;
    return (
        <div className="mini-kpi-row">
            {cards.map((c, i) => (
                <div key={i} className="mini-kpi-card" style={c.color ? { borderLeftColor: c.color } : {}}>
                    {c.icon && <div className="mini-kpi-icon" style={c.color ? { color: c.color } : {}}>{c.icon}</div>}
                    <div className="mini-kpi-body">
                        <div className="mini-kpi-label">{c.label}</div>
                        <div className="mini-kpi-value" style={c.color ? { color: c.color } : {}}>{c.value}</div>
                        {c.sub && <div className="mini-kpi-sub">{c.sub}</div>}
                    </div>
                </div>
            ))}
            <style>{`
                .mini-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
                .mini-kpi-card {
                    display: flex; gap: 0.75rem; align-items: center;
                    background: var(--bg-card); border: 1px solid var(--border);
                    border-left: 4px solid var(--primary);
                    border-radius: var(--radius-md); padding: 0.85rem 1rem;
                    box-shadow: var(--shadow-sm);
                    transition: all var(--transition-base);
                }
                .mini-kpi-card:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
                .mini-kpi-icon {
                    width: 36px; height: 36px; flex-shrink: 0;
                    display: flex; align-items: center; justify-content: center;
                    background: var(--bg-subtle); border-radius: var(--radius-sm);
                    color: var(--primary);
                }
                .mini-kpi-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
                .mini-kpi-label { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 2px; }
                .mini-kpi-value {
                    font-size: 1.2rem; font-weight: 700; color: var(--text-main);
                    letter-spacing: -0.01em; line-height: 1.2;
                }
                .mini-kpi-sub { font-size: 0.72rem; color: var(--text-subtle); margin-top: 2px; }
            `}</style>
        </div>
    );
};

export default MiniKpiCards;
