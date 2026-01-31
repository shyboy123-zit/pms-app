import React from 'react';
import { useData } from '../context/DataContext'; // Import global data
import {
    LayoutDashboard,
    AlertTriangle,
    CheckCircle,
    Activity,
    ClipboardList,
} from 'lucide-react';

const Dashboard = () => {
    // Consume global data
    const { inspections, equipments, materials } = useData();

    // Logic: Quality Action Status
    const unresolvedissues = inspections.filter(i => i.result === 'NG' && (!i.action || i.action === '-'));
    const resolvedIssues = inspections.filter(i => i.result === 'NG' && i.action && i.action !== '-');

    // Logic: Equipment Status
    const activeEquipments = equipments.filter(e => e.status === '가동중').length;
    const alertEquipments = equipments.filter(e => e.status === '점검중' || e.status === '고장').length;

    // Logic: Low Stock
    const lowStockMaterials = materials.filter(m => m.stock < m.minStock).length;

    return (
        <div className="dashboard-container">
            <h2 className="page-title">대시보드</h2>
            <p className="page-date">{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>

            {/* Top Stat Cards */}
            <div className="stats-grid">
                <div className="stat-card glass-panel gradient-border">
                    <div className="stat-icon-wrapper" style={{ background: 'var(--primary-light)' }}>
                        <Activity size={24} color="var(--primary)" />
                    </div>
                    <div>
                        <p className="stat-label">설비 가동률</p>
                        <h3 className="stat-value">{((activeEquipments / equipments.length) * 100).toFixed(1)}%</h3>
                        <p className="stat-desc">총 {equipments.length}대 중 {activeEquipments}대 가동</p>
                    </div>
                </div>

                <div className="stat-card glass-panel" style={lowStockMaterials > 0 ? { border: '1px solid var(--danger)' } : {}}>
                    <div className="stat-icon-wrapper" style={{ background: lowStockMaterials > 0 ? '#fee2e2' : '#f1f5f9' }}>
                        <AlertTriangle size={24} color={lowStockMaterials > 0 ? 'var(--danger)' : 'var(--text-muted)'} />
                    </div>
                    <div>
                        <p className="stat-label">부족 자재</p>
                        <h3 className="stat-value" style={{ color: lowStockMaterials > 0 ? 'var(--danger)' : 'inherit' }}>{lowStockMaterials}건</h3>
                        <p className="stat-desc">안전재고 미달 품목 수</p>
                    </div>
                </div>

                <div className="stat-card glass-panel">
                    <div className="stat-icon-wrapper" style={{ background: '#dbeafe' }}>
                        <ClipboardList size={24} color="#2563eb" />
                    </div>
                    <div>
                        <p className="stat-label">금일 검사</p>
                        <h3 className="stat-value">{inspections.filter(i => i.date === new Date().toISOString().split('T')[0]).length}건</h3>
                        <p className="stat-desc">전일 대비 +12%</p>
                    </div>
                </div>
            </div>

            {/* Quality Action Section - Main Feature Requested */}
            <div className="dashboard-row">
                <div className="dashboard-col glass-panel" style={{ flex: 1.5 }}>
                    <div className="panel-header">
                        <h3>⚡ 품질 불량 조치 현황</h3>
                        <span className="badge-pill">Real-time</span>
                    </div>

                    <div className="quality-action-board">
                        {/* Urgent Action Required Column */}
                        <div className="qb-column urgent">
                            <div className="qb-header">
                                <AlertTriangle size={18} />
                                <span>긴급 조치 요망</span>
                                <span className="count-badge">{unresolvedissues.length}</span>
                            </div>
                            <div className="qb-list">
                                {unresolvedissues.length > 0 ? (
                                    unresolvedissues.map(item => (
                                        <div key={item.id} className="qb-card warning-card">
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                <span className="card-title">{item.product}</span>
                                                <span className="card-date">{item.date}</span>
                                            </div>
                                            <p className="card-reason">NG: {item.ngType}</p>
                                            <div className="card-footer">
                                                <span className="blink-text">조치 미완료</span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="empty-state">
                                        <CheckCircle size={32} color="var(--success)" style={{ opacity: 0.5 }} />
                                        <p>모든 불량 건이 조치되었습니다.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Action Completed Column */}
                        <div className="qb-column completed">
                            <div className="qb-header">
                                <CheckCircle size={18} />
                                <span>조치 완료 (양산 가능)</span>
                                <span className="count-badge success">{resolvedIssues.length}</span>
                            </div>
                            <div className="qb-list">
                                {resolvedIssues.slice(0, 5).map(item => (
                                    <div key={item.id} className="qb-card success-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span className="card-title">{item.product}</span>
                                            <span className="card-date">{item.date}</span>
                                        </div>
                                        <p className="card-reason">NG: {item.ngType}</p>
                                        <div className="card-footer">
                                            <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓ 조치: {item.action}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="dashboard-col glass-panel" style={{ flex: 1 }}>
                    <div className="panel-header">
                        <h3>설비 모니터링</h3>
                    </div>
                    <div className="equip-mini-list">
                        {equipments.slice(0, 6).map(eq => (
                            <div key={eq.id} className="mini-eq-item">
                                <div className={`status-dot ${eq.status === '가동중' ? 'active' : eq.status === '대기' ? 'warning' : 'danger'}`}></div>
                                <div className="eq-info">
                                    <span className="eq-name">{eq.name}</span>
                                    <span className="eq-status">{eq.status} {eq.status === '가동중' && `(${eq.temperature}℃)`}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <style>{`
                .dashboard-container { padding: 0 1rem; }
                .page-title { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.25rem; }
                .page-date { color: var(--text-muted); margin-bottom: 2rem; }
                
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
                .stat-card { padding: 1.5rem; display: flex; align-items: center; gap: 1.25rem; }
                .stat-icon-wrapper { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .stat-label { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.25rem; }
                .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); line-height: 1.2; }
                .stat-desc { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem; }
                
                .dashboard-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
                .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .panel-header h3 { font-size: 1.1rem; font-weight: 700; color: var(--text-main); }
                .badge-pill { background: #fee2e2; color: var(--danger); font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 20px; font-weight: 600; }
                
                .quality-action-board { display: flex; gap: 1.5rem; height: 400px; }
                .qb-column { flex: 1; display: flex; flex-direction: column; background: rgba(255,255,255,0.5); border-radius: 12px; padding: 1rem; }
                .qb-column.urgent { background: #fff5f5; border: 1px solid #fee2e2; }
                .qb-column.completed { background: #f0fdf4; border: 1px solid #dcfce7; }
                
                .qb-header { display: flex; align-items: center; gap: 0.5rem; font-weight: 700; margin-bottom: 1rem; color: var(--text-main); }
                .urgent .qb-header { color: var(--danger); }
                .completed .qb-header { color: var(--success); }
                .count-badge { background: white; padding: 2px 8px; border-radius: 10px; font-size: 0.8rem; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                
                .qb-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; }
                .qb-card { background: white; padding: 1rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); border-left: 4px solid transparent; }
                .warning-card { border-left-color: var(--danger); }
                .success-card { border-left-color: var(--success); }
                
                .card-title { font-weight: 600; font-size: 0.95rem; }
                .card-date { font-size: 0.8rem; color: var(--text-muted); }
                .card-reason { font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--text-main); }
                .card-footer { font-size: 0.85rem; text-align: right; }
                
                .blink-text { color: var(--danger); font-weight: 700; animation: blink 1.5s infinite; }
                @keyframes blink { 50% { opacity: 0.5; } }
                
                .empty-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); gap: 0.5rem; font-size: 0.9rem; }
                
                .equip-mini-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .mini-eq-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: white; border-radius: 8px; }
                .status-dot { width: 10px; height: 10px; border-radius: 50%; background: #e2e8f0; }
                .status-dot.active { background: var(--success); box-shadow: 0 0 8px #86efac; }
                .status-dot.warning { background: var(--warning); }
                .status-dot.danger { background: var(--danger); }
                .eq-info { display: flex; flex-direction: column; }
                .eq-name { font-weight: 600; font-size: 0.9rem; }
                .eq-status { font-size: 0.8rem; color: var(--text-muted); }
            `}</style>
        </div>
    );
};

export default Dashboard;
