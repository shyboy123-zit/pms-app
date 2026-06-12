import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import AnalyticsSection from '../components/AnalyticsSection';
import FactoryFloorMap from '../components/FactoryFloorMap';
import WorkStandardSheet from '../components/WorkStandardSheet';
import {
    Activity,
    AlertTriangle,
    Package,
    TrendingUp,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Droplets,
    FileText,
    Image as ImageIcon,
    Calendar,
    Users
} from 'lucide-react';

const Dashboard = () => {
    const { equipments, materials, inspections, products, workOrders, molds, moldMovement, injectionConditions, productionLogs, employees, inventoryTransactions } = useData();
    const { user } = useAuth();
    const isAdmin = user?.position === '관리자';

    // 상단 KPI 카드 클릭 시 상세 내역 모달 ('running' | 'lowstock' | 'defect')
    const [cardModal, setCardModal] = useState(null);

    // 입출고 데이터로 제품 재고 계산
    const getProductStock = (product) => {
        const key = product.product_code || product.name;
        let stock = 0;
        (inventoryTransactions || []).forEach(t => {
            const tKey = t.item_code || t.item_name;
            if (tKey === key) {
                if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') {
                    stock += parseFloat(t.quantity);
                } else if (t.transaction_type === 'OUT') {
                    stock -= parseFloat(t.quantity);
                }
            }
        });
        return stock;
    };

    // 뉴스 속보 상태
    const [newsItems, setNewsItems] = useState([]);
    const [newsLoading, setNewsLoading] = useState(false);
    const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
    const [newsFade, setNewsFade] = useState(true);

    useEffect(() => {
        const fetchNews = async () => {
            setNewsLoading(true);
            try {
                const res = await fetch('/api/news?category=economy');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.items?.length > 0) {
                        setNewsItems(data.items);
                    }
                }
            } catch (e) {
                console.warn('뉴스 로드 실패:', e);
            } finally {
                setNewsLoading(false);
            }
        };
        fetchNews();
        const interval = setInterval(fetchNews, 10 * 60 * 1000); // 10분마다 갱신
        return () => clearInterval(interval);
    }, []);

    // 뉴스 자동 전환 (4초 간격)
    useEffect(() => {
        if (newsItems.length <= 1) return;
        const timer = setInterval(() => {
            setNewsFade(false);
            setTimeout(() => {
                setCurrentNewsIndex(prev => (prev + 1) % newsItems.length);
                setNewsFade(true);
            }, 400);
        }, 4000);
        return () => clearInterval(timer);
    }, [newsItems]);

    // 사출조건 모달 상태
    const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState(null);

    // 불량 사진 뷰어 상태
    const [viewerImages, setViewerImages] = useState([]);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // 원재료 소모 날짜 선택 + 일/월 모드
    const [mcDate, setMcDate] = useState(new Date().toISOString().split('T')[0]);
    const [mcMode, setMcMode] = useState('day'); // 'day' | 'month'

    // image_url 파싱 (단일 URL 또는 JSON 배열 호환)
    const parseImageUrls = (imageUrl) => {
        if (!imageUrl) return [];
        try {
            const parsed = JSON.parse(imageUrl);
            if (Array.isArray(parsed)) return parsed;
            return [imageUrl];
        } catch {
            return [imageUrl];
        }
    };

    // 오늘 날짜
    const today = new Date().toISOString().split('T')[0];

    // 1. 호기별 작업 현황
    const runningEquipments = equipments.filter(e => e.status === '가동중' && e.current_work_order_id);

    // 2. 안전재고 미달 원재료
    const lowStockMaterials = materials.filter(m => m.stock < m.min_stock);

    // 2-1. 안전재고 미달 완제품 (단종 제품은 재고부족 경고에서 제외)
    const lowStockProducts = products.filter(p => p.status !== '단종' && p.min_stock > 0 && getProductStock(p) < p.min_stock);

    // 2-2. 초과재고 완제품 (현재고 > 초과재고 상한선, 단종 제외)
    const overStockProducts = products.filter(p => p.status !== '단종' && p.max_stock > 0 && getProductStock(p) > p.max_stock);

    // 3. 일일 불량 현황
    const todayInspections = inspections.filter(i => i.date === today);
    const todayDefects = todayInspections.filter(i => i.result === 'NG');
    const defectRate = todayInspections.length > 0
        ? ((todayDefects.length / todayInspections.length) * 100).toFixed(1)
        : 0;

    // 4. 출고 중인 금형
    const outgoingMolds = moldMovement.filter(m => m.status === '출고중');

    // 5. 원재료 소모 현황 (선택 날짜의 production_logs 기준)
    const materialConsumption = (() => {
        const consumptionMap = {};

        const monthKey = mcDate.slice(0, 7);
        const filteredLogs = productionLogs.filter(log =>
            mcMode === 'month' ? (log.production_date || '').startsWith(monthKey) : log.production_date === mcDate
        );

        filteredLogs.forEach(log => {
            const dailyQty = log.daily_quantity || 0;
            if (dailyQty <= 0) return;

            const product = products.find(p => p.id === log.product_id);
            if (!product || !product.material_id) return;

            const material = materials.find(m => m.id === product.material_id);
            if (!material) return;

            const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
            const consumedKg = (shotWeight * dailyQty) / 1000;

            if (!consumptionMap[material.id]) {
                consumptionMap[material.id] = {
                    id: material.id,
                    name: material.name,
                    stock: material.stock || 0,
                    unit: material.unit || 'kg',
                    totalConsumedKg: 0,
                    totalQty: 0,
                    productNames: []
                };
            }

            consumptionMap[material.id].totalConsumedKg += consumedKg;
            consumptionMap[material.id].totalQty += dailyQty;
            const pName = product.name;
            if (!consumptionMap[material.id].productNames.includes(pName)) {
                consumptionMap[material.id].productNames.push(pName);
            }
        });

        return Object.values(consumptionMap).sort((a, b) => b.totalConsumedKg - a.totalConsumedKg);
    })();

    // 진행중 작업지시 남은수량 기준 필요 원재료
    // 모델: 런너 100% 재사용 → 신재=제품중량분, 분쇄=런너발생분. 신재만 제품은 전량 신재.
    const materialRequirement = (() => {
        const byMaterial = {};
        const rows = [];
        (workOrders || []).filter(w => w.status === '진행중').forEach(wo => {
            const product = products.find(p => p.id === wo.product_id);
            if (!product) return;
            const remaining = Math.max(0, (wo.target_quantity || 0) - (wo.produced_quantity || 0));
            if (remaining <= 0) return;
            const pw = product.product_weight || 0;
            const rw = product.runner_weight || 0;
            const cv = product.cavity_count || 1;
            const shots = remaining / cv;
            const virginOnly = (product.virgin_ratio ?? 50) >= 100;
            let virginKg, regrindKg;
            if (virginOnly) {
                virginKg = (pw * cv + rw) * shots / 1000; // 전량 신재 (런너도 신재로)
                regrindKg = 0;
            } else {
                virginKg = pw * remaining / 1000;          // 제품 출하분만 신재 보충
                regrindKg = rw * shots / 1000;             // 런너 발생분 = 자체 분쇄
            }
            const neededKg = virginKg + regrindKg;
            if (neededKg <= 0) return;
            const shot = pw * cv + rw;
            const regPct = shot > 0 ? Math.round(rw / shot * 100) : 0;
            const material = materials.find(m => m.id === product.material_id);
            const matName = material?.name || '(원재료 미지정)';
            rows.push({ product: product.name, material: matName, remaining, neededKg, virginKg, regrindKg, virginOnly, regPct });
            if (!byMaterial[matName]) byMaterial[matName] = { material: matName, needed: 0, virgin: 0, regrind: 0, stock: material ? parseFloat(material.stock) || 0 : null };
            byMaterial[matName].needed += neededKg;
            byMaterial[matName].virgin += virginKg;
            byMaterial[matName].regrind += regrindKg;
        });
        const mats = Object.values(byMaterial).sort((a, b) => b.needed - a.needed);
        const totalVirgin = mats.reduce((s, m) => s + m.virgin, 0);
        const totalRegrind = mats.reduce((s, m) => s + m.regrind, 0);
        return { rows: rows.sort((a, b) => b.neededKg - a.neededKg), mats, totalVirgin, totalRegrind, totalNeeded: totalVirgin + totalRegrind };
    })();

    return (
        <div className="dashboard-container">
            {/* 실시간 뉴스 속보 티커 */}
            {newsItems.length > 0 && (
                <div style={{
                    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                    borderRadius: '12px', padding: '0', marginBottom: '1rem',
                    overflow: 'hidden', position: 'relative', height: '42px',
                    display: 'flex', alignItems: 'center',
                    border: '1px solid #334155'
                }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                        padding: '0 14px', height: '100%',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        fontWeight: 800, fontSize: '0.78rem', color: 'white',
                        whiteSpace: 'nowrap', zIndex: 2, flexShrink: 0,
                        boxShadow: '4px 0 8px rgba(0,0,0,0.3)'
                    }}>
                        <span style={{ animation: 'pulse 1.5s ease-in-out infinite', WebkitAnimation: 'pulse 1.5s ease-in-out infinite' }}>🔴</span> 속보
                    </div>
                    <div style={{
                        flex: 1, overflow: 'hidden', position: 'relative', height: '100%',
                        display: 'flex', alignItems: 'center', padding: '0 14px'
                    }}>
                        {newsItems[currentNewsIndex] && (
                            <a href={newsItems[currentNewsIndex].link} target="_blank" rel="noopener noreferrer"
                                style={{
                                    color: '#e2e8f0', textDecoration: 'none', fontSize: '0.8rem',
                                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px',
                                    transition: 'opacity 0.4s ease, color 0.2s',
                                    opacity: newsFade ? 1 : 0,
                                    width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}
                            >
                                <span style={{ color: '#94a3b8', fontSize: '0.7rem', flexShrink: 0 }}>▸</span>
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {newsItems[currentNewsIndex].title}
                                </span>
                                {newsItems[currentNewsIndex].pubDate && (
                                    <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 400, flexShrink: 0 }}>
                                        {new Date(newsItems[currentNewsIndex].pubDate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                )}
                            </a>
                        )}
                    </div>
                    <div style={{
                        padding: '0 10px', fontSize: '0.65rem', color: '#64748b',
                        whiteSpace: 'nowrap', flexShrink: 0
                    }}>
                        {currentNewsIndex + 1}/{newsItems.length}
                    </div>
                </div>
            )}

            <div className="dashboard-header">
                <div>
                    <h2 className="page-title">생산 관리 대시보드</h2>
                    <p className="page-date">
                        {new Date().toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                        })}
                    </p>
                </div>
            </div>

            {/* 핵심 통계 카드 */}
            <div className="stats-grid">
                <div className="stat-card running" style={{ cursor: 'pointer' }} onClick={() => setCardModal('running')}>
                    <div className="stat-icon">
                        <Activity />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">가동중인 설비</p>
                        <h3 className="stat-value">{runningEquipments.length}대</h3>
                        <p className="stat-desc">전체 {equipments.length}대</p>
                    </div>
                </div>

                <div className={`stat-card stock ${(lowStockMaterials.length + lowStockProducts.length) > 0 ? 'alert' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setCardModal('lowstock')}>
                    <div className="stat-icon">
                        <AlertTriangle />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">재고 부족</p>
                        <h3 className="stat-value">{lowStockMaterials.length + lowStockProducts.length}건</h3>
                        <p className="stat-desc">안전재고 미달 (원재료 {lowStockMaterials.length} / 제품 {lowStockProducts.length})</p>
                    </div>
                </div>

                <div className={`stat-card overstock ${overStockProducts.length > 0 ? 'warning' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setCardModal('overstock')}>
                    <div className="stat-icon">
                        <Package />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">초과재고</p>
                        <h3 className="stat-value">{overStockProducts.length}건</h3>
                        <p className="stat-desc">초과재고 상한선 초과</p>
                    </div>
                </div>

                <div className={`stat-card defect ${todayDefects.length > 0 ? 'warning' : 'good'}`} style={{ cursor: 'pointer' }} onClick={() => setCardModal('defect')}>
                    <div className="stat-icon">
                        <AlertCircle />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">금일 불량률</p>
                        <h3 className="stat-value">{defectRate}%</h3>
                        <p className="stat-desc">{todayDefects.length}/{todayInspections.length} 불량</p>
                    </div>
                </div>
            </div>

            {/* 상단 카드 클릭 → 상세 내역 모달 */}
            <Modal
                title={cardModal === 'running' ? '🟢 가동중인 설비' : cardModal === 'lowstock' ? '⚠️ 재고 부족 항목' : cardModal === 'overstock' ? '📦 초과재고 항목' : '🔴 금일 불량 내역'}
                isOpen={!!cardModal}
                onClose={() => setCardModal(null)}
            >
                <div className="card-detail-list">
                    {cardModal === 'running' && (
                        runningEquipments.length > 0 ? runningEquipments.map(eq => {
                            const wo = workOrders.find(w => w.id === eq.current_work_order_id);
                            const product = wo ? products.find(p => p.id === wo.product_id) : null;
                            const prog = wo && wo.target_quantity > 0 ? Math.round((wo.produced_quantity / wo.target_quantity) * 100) : 0;
                            return (
                                <div key={eq.id} className="cd-row">
                                    <span className="cd-name">{eq.name}</span>
                                    <span className="cd-mid">{product?.name || '제품 미지정'}</span>
                                    <span className="cd-val">{wo ? `${(wo.produced_quantity || 0).toLocaleString()}/${(wo.target_quantity || 0).toLocaleString()} (${prog}%)` : '-'}</span>
                                </div>
                            );
                        }) : <div className="cd-empty">현재 가동중인 설비가 없습니다.</div>
                    )}
                    {cardModal === 'lowstock' && (
                        (lowStockMaterials.length + lowStockProducts.length) > 0 ? (
                            <>
                                {lowStockMaterials.map(m => (
                                    <div key={'m' + m.id} className="cd-row">
                                        <span className="cd-tag mat">원재료</span>
                                        <span className="cd-name">{m.name}</span>
                                        <span className="cd-val danger">{(m.stock || 0).toLocaleString()} / {(m.min_stock || 0).toLocaleString()} {m.unit || ''}</span>
                                    </div>
                                ))}
                                {lowStockProducts.map(p => {
                                    const cur = getProductStock(p);
                                    return (
                                        <div key={'p' + p.id} className="cd-row">
                                            <span className="cd-tag prod">제품</span>
                                            <span className="cd-name">{p.name}</span>
                                            <span className="cd-val danger">{cur.toLocaleString()} / {(p.min_stock || 0).toLocaleString()} {p.unit || ''}</span>
                                        </div>
                                    );
                                })}
                            </>
                        ) : <div className="cd-empty">안전재고 미달 항목이 없습니다. ✓</div>
                    )}
                    {cardModal === 'overstock' && (
                        overStockProducts.length > 0 ? (
                            overStockProducts.map(p => {
                                const cur = getProductStock(p);
                                return (
                                    <div key={'os' + p.id} className="cd-row">
                                        <span className="cd-tag prod">제품</span>
                                        <span className="cd-name">{p.name}</span>
                                        <span className="cd-val warn">{cur.toLocaleString()} / 상한 {(p.max_stock || 0).toLocaleString()} {p.unit || ''}</span>
                                    </div>
                                );
                            })
                        ) : <div className="cd-empty">초과재고 항목이 없습니다. ✓</div>
                    )}
                    {cardModal === 'defect' && (
                        todayDefects.length > 0 ? todayDefects.map(i => (
                            <div key={i.id} className="cd-row">
                                <span className="cd-name">{i.product || '-'}</span>
                                <span className="cd-mid">{i.check_item || ''}</span>
                                <span className="cd-val danger">{i.ng_type || '불량'}</span>
                            </div>
                        )) : <div className="cd-empty">금일 불량 내역이 없습니다. ✓</div>
                    )}
                </div>
                <style>{`
                    .card-detail-list { display: flex; flex-direction: column; gap: 6px; max-height: 60vh; overflow-y: auto; }
                    .cd-row { display: flex; align-items: center; gap: 10px; padding: 9px 12px; background: var(--bg-subtle); border-radius: 8px; font-size: 0.88rem; }
                    .cd-name { font-weight: 700; color: var(--text-main); flex: 1; min-width: 0; }
                    .cd-mid { color: var(--text-muted); font-size: 0.82rem; white-space: nowrap; }
                    .cd-val { font-weight: 700; color: var(--text-main); white-space: nowrap; }
                    .cd-val.danger { color: var(--danger); }
                    .cd-val.warn { color: #d97706; }
                    .cd-tag { font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 6px; flex-shrink: 0; }
                    .cd-tag.mat { background: #fef3c7; color: #b45309; }
                    .cd-tag.prod { background: #dbeafe; color: #1d4ed8; }
                    .cd-empty { padding: 2rem; text-align: center; color: var(--text-muted); }
                `}</style>
            </Modal>

            {/* 연차사용촉진 알림 */}
            {(() => {
                const now = new Date();
                const activeEmployees = (employees || []).filter(e => e.status === '재직' && e.join_date);

                const leaveAlerts = activeEmployees.map(emp => {
                    const joinDate = new Date(emp.join_date);
                    const totalLeave = emp.total_leave || 15;
                    const usedLeave = emp.used_leave || 0;
                    const remainingLeave = totalLeave - usedLeave;

                    if (remainingLeave <= 0) return null;

                    // 입사 기념일 계산 (올해 or 내년)
                    const thisYearAnniv = new Date(now.getFullYear(), joinDate.getMonth(), joinDate.getDate());
                    const nextAnniv = thisYearAnniv > now ? thisYearAnniv : new Date(now.getFullYear() + 1, joinDate.getMonth(), joinDate.getDate());

                    const daysToAnniv = Math.floor((nextAnniv - now) / (1000 * 60 * 60 * 24));

                    // 근무 기간 1년 미만이면 제외
                    const serviceYears = Math.floor((now - joinDate) / (1000 * 60 * 60 * 24 * 365));
                    if (serviceYears < 1) return null;

                    // 근로기준법 제61조:
                    // 1차 촉진: 기념일 6개월 전 (잔여일수 통보)
                    // 2차 촉진: 기념일 2개월 전 (사용시기 지정)
                    let level = null;
                    if (daysToAnniv <= 60) {
                        level = 'urgent'; // 2개월 이내 - 긴급
                    } else if (daysToAnniv <= 180) {
                        level = 'warning'; // 6개월 이내 - 주의
                    }

                    if (!level) return null;

                    return {
                        ...emp,
                        remainingLeave,
                        daysToAnniv,
                        level,
                        anniversaryDate: nextAnniv
                    };
                }).filter(Boolean).sort((a, b) => a.daysToAnniv - b.daysToAnniv);

                if (leaveAlerts.length === 0) return null;

                const urgentCount = leaveAlerts.filter(a => a.level === 'urgent').length;
                const warningCount = leaveAlerts.filter(a => a.level === 'warning').length;

                return (
                    <div style={{
                        background: urgentCount > 0 ? 'linear-gradient(135deg, #fef2f2, #fff7ed)' : 'linear-gradient(135deg, #fffbeb, #fef3c7)',
                        border: `1px solid ${urgentCount > 0 ? '#fecaca' : '#fde68a'}`,
                        borderRadius: '16px', padding: '18px 22px', marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} style={{ color: urgentCount > 0 ? '#dc2626' : '#d97706' }} />
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: urgentCount > 0 ? '#dc2626' : '#92400e' }}>
                                    연차사용촉진 대상자
                                </span>
                                <span style={{
                                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 700,
                                    background: urgentCount > 0 ? '#fee2e2' : '#fef3c7',
                                    color: urgentCount > 0 ? '#dc2626' : '#d97706'
                                }}>
                                    {leaveAlerts.length}명
                                </span>
                            </div>
                            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>근로기준법 제61조</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {leaveAlerts.map(emp => (
                                <div key={emp.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 14px', borderRadius: '10px',
                                    background: emp.level === 'urgent' ? '#fff1f2' : '#fffbeb',
                                    border: `1px solid ${emp.level === 'urgent' ? '#fecdd3' : '#fde68a'}`,
                                    flexWrap: 'wrap'
                                }}>
                                    <span style={{
                                        padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 700,
                                        background: emp.level === 'urgent' ? '#dc2626' : '#f59e0b',
                                        color: 'white', whiteSpace: 'nowrap'
                                    }}>
                                        {emp.level === 'urgent' ? '🚨 긴급' : '⚠️ 주의'}
                                    </span>
                                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                                        {emp.name}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                        {emp.department} · {emp.position}
                                    </span>
                                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#dc2626' }}>
                                        잔여 {emp.remainingLeave}일
                                    </span>
                                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', marginLeft: 'auto' }}>
                                        기념일까지 {emp.daysToAnniv}일
                                        {emp.level === 'urgent' ? ' (2차 촉진 기한)' : ' (1차 촉진 기한)'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* ===== 의무교육 관리 카드 ===== */}
            {(() => {
                const TRAININGS = [
                    { code: 'safety', name: '산업안전보건교육', period: 'quarterly', hours: '사무직 3h / 생산직 6h', law: '산업안전보건법 제29조', icon: '🦺' },
                    { code: 'harassment', name: '성희롱 예방교육', period: 'yearly', hours: '1시간 이상', law: '남녀고용평등법 제13조', icon: '🛡️' },
                    { code: 'privacy', name: '개인정보보호 교육', period: 'yearly', hours: '1시간 이상', law: '개인정보보호법 제28조', icon: '🔒' },
                    { code: 'bullying', name: '직장 내 괴롭힘 예방교육', period: 'yearly', hours: '1시간 이상', law: '근로기준법 제76조의2', icon: '🤝' },
                    { code: 'fire', name: '소방안전교육', period: 'yearly', hours: '2시간 이상', law: '화재예방법 제17조', icon: '🧯' },
                    { code: 'disability', name: '장애인 인식개선 교육', period: 'yearly', hours: '1시간 이상', law: '장애인고용촉진법 제5조의3', icon: '♿' }
                ];

                let records = {};
                try { records = JSON.parse(localStorage.getItem('trainingRecords') || '{}'); } catch (e) { /* ignore */ }

                const now = new Date();
                const thisYear = now.getFullYear();

                const trainingStatus = TRAININGS.map(t => {
                    const rec = records[t.code];
                    const lastDate = rec?.lastDate ? new Date(rec.lastDate) : null;

                    let nextDate;
                    if (t.period === 'quarterly') {
                        // 분기별: 마지막 실시일 + 3개월, 없으면 현재 분기 말
                        if (lastDate) {
                            nextDate = new Date(lastDate);
                            nextDate.setMonth(nextDate.getMonth() + 3);
                        } else {
                            const qEnd = Math.ceil((now.getMonth() + 1) / 3) * 3;
                            nextDate = new Date(thisYear, qEnd, 0); // 현재 분기 말일
                        }
                    } else {
                        // 연 1회: 올해 12/31까지, 이미 올해 실시했으면 내년 12/31
                        if (lastDate && lastDate.getFullYear() === thisYear) {
                            nextDate = new Date(thisYear + 1, 11, 31);
                        } else {
                            nextDate = new Date(thisYear, 11, 31);
                        }
                    }

                    const dday = Math.ceil((nextDate - now) / (1000 * 60 * 60 * 24));
                    const isCompleted = lastDate && (
                        t.period === 'quarterly'
                            ? (now - lastDate) < (90 * 24 * 60 * 60 * 1000) // 분기 내 실시
                            : lastDate.getFullYear() === thisYear // 올해 실시
                    );

                    let urgency = 'normal';
                    if (isCompleted) urgency = 'done';
                    else if (dday < 0) urgency = 'overdue';
                    else if (dday <= 14) urgency = 'urgent';
                    else if (dday <= 30) urgency = 'warning';

                    return { ...t, lastDate, nextDate, dday, isCompleted, urgency };
                });

                const overdueCount = trainingStatus.filter(t => t.urgency === 'overdue').length;
                const urgentCount2 = trainingStatus.filter(t => t.urgency === 'urgent').length;
                const doneCount = trainingStatus.filter(t => t.urgency === 'done').length;

                const urgencyColors = {
                    overdue: { bg: '#fef2f2', border: '#fecaca', badge: '#dc2626', text: '#991b1b' },
                    urgent: { bg: '#fff7ed', border: '#fed7aa', badge: '#ea580c', text: '#9a3412' },
                    warning: { bg: '#fffbeb', border: '#fde68a', badge: '#d97706', text: '#92400e' },
                    normal: { bg: 'var(--card)', border: 'var(--border)', badge: '#6366f1', text: 'var(--text)' },
                    done: { bg: '#f0fdf4', border: '#bbf7d0', badge: '#16a34a', text: '#166534' }
                };

                return (
                    <div style={{
                        background: overdueCount > 0 ? 'linear-gradient(135deg, #fef2f2, #fff1f2)' :
                            urgentCount2 > 0 ? 'linear-gradient(135deg, #fff7ed, #fffbeb)' :
                                'linear-gradient(135deg, #f0f9ff, #f0fdf4)',
                        border: `1px solid ${overdueCount > 0 ? '#fecaca' : urgentCount2 > 0 ? '#fed7aa' : '#bae6fd'}`,
                        borderRadius: '16px', padding: '18px 22px', marginBottom: '1.5rem'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '1.1rem' }}>📚</span>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: overdueCount > 0 ? '#dc2626' : '#1e293b' }}>
                                    의무교육 관리
                                </span>
                                <span style={{
                                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                                    background: doneCount === TRAININGS.length ? '#dcfce7' : overdueCount > 0 ? '#fee2e2' : '#dbeafe',
                                    color: doneCount === TRAININGS.length ? '#16a34a' : overdueCount > 0 ? '#dc2626' : '#2563eb'
                                }}>
                                    {doneCount}/{TRAININGS.length} 완료
                                </span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>제조업 법정 필수교육</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {trainingStatus.sort((a, b) => {
                                const order = { overdue: 0, urgent: 1, warning: 2, normal: 3, done: 4 };
                                return order[a.urgency] - order[b.urgency];
                            }).map(t => {
                                const c = urgencyColors[t.urgency];
                                return (
                                    <div key={t.code} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        padding: '10px 14px', borderRadius: '10px',
                                        background: c.bg, border: `1px solid ${c.border}`,
                                        flexWrap: 'wrap'
                                    }}>
                                        <span style={{ fontSize: '1rem' }}>{t.icon}</span>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', minWidth: '140px' }}>
                                            {t.name}
                                        </span>
                                        <span style={{
                                            padding: '2px 8px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700,
                                            background: c.badge, color: 'white', whiteSpace: 'nowrap'
                                        }}>
                                            {t.urgency === 'done' ? '✅ 완료' :
                                                t.urgency === 'overdue' ? '🚨 기한초과' :
                                                    t.urgency === 'urgent' ? `⚠️ D-${t.dday}` :
                                                        t.period === 'quarterly' ? '분기별' : '연 1회'}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                            {t.hours} · {t.law}
                                        </span>
                                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                                            {t.lastDate ? `최근: ${t.lastDate.toLocaleDateString('ko-KR')}` : '미실시'}
                                            {!t.isCompleted && ` · 기한: ${t.nextDate.toLocaleDateString('ko-KR')}`}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })()}

            {/* 메인 위젯 그리드 */}
            <div className="widgets-grid">
                {/* 1. 호기별 작업 현황 */}
                <div className="widget glass-panel production-status">
                    <div className="widget-header">
                        <h3>
                            <Activity size={20} />
                            호기별 작업 현황
                        </h3>
                        <span className="badge-live">LIVE</span>
                    </div>
                    <div className="widget-content">
                        <FactoryFloorMap
                            equipments={equipments}
                            workOrders={workOrders}
                            products={products}
                            productionLogs={productionLogs}
                            materials={materials}
                            onMachineClick={(eq, workOrder) => {
                                if (!workOrder) return;
                                const condition = injectionConditions.find(
                                    c => c.product_id === workOrder.product_id && c.equipment_id === eq.id
                                );
                                if (condition) {
                                    setSelectedCondition(condition);
                                    setIsConditionModalOpen(true);
                                } else {
                                    alert('해당 제품-호기 조합의 사출조건이 등록되지 않았습니다.');
                                }
                            }}
                        />
                    </div>
                </div>

                {/* 안전재고 경고 위젯 제거됨 — 상단 "재고 부족" 카드 클릭 시 모달로 확인 */}

                {/* 3. 일일 불량 현황 */}
                <div className="widget glass-panel daily-defects">
                    <div className="widget-header">
                        <h3>
                            <XCircle size={20} />
                            금일 불량 현황
                        </h3>
                        <span className="defect-rate-badge">
                            {defectRate}%
                        </span>
                    </div>
                    <div className="widget-content">
                        <div className="defect-summary">
                            <div className="defect-stat">
                                <span className="defect-label">총 검사</span>
                                <span className="defect-value">{todayInspections.length}건</span>
                            </div>
                            <div className="defect-stat danger">
                                <span className="defect-label">불량</span>
                                <span className="defect-value">{todayDefects.length}건</span>
                            </div>
                            <div className="defect-stat success">
                                <span className="defect-label">합격</span>
                                <span className="defect-value">{todayInspections.length - todayDefects.length}건</span>
                            </div>
                        </div>

                        {todayDefects.length > 0 && (
                            <div className="defect-list">
                                <div className="defect-list-header">불량 상세</div>
                                {todayDefects.map(defect => {
                                    const photos = parseImageUrls(defect.image_url);
                                    return (
                                        <div key={defect.id} className="defect-item">
                                            <div className="defect-info">
                                                <span className="defect-product">{defect.product}</span>
                                                <span className="defect-type">{defect.ng_type || defect.ngType}</span>
                                            </div>
                                            {photos.length > 0 && (
                                                <div className="defect-photos" onClick={() => { setViewerImages(photos); setIsViewerOpen(true); }}>
                                                    {photos.slice(0, 3).map((url, i) => (
                                                        <img key={i} src={url} alt={`불량${i + 1}`} className="defect-thumb" />
                                                    ))}
                                                    {photos.length > 3 && <span className="defect-photo-more">+{photos.length - 3}</span>}
                                                </div>
                                            )}
                                            <div className="defect-action">
                                                {defect.action && defect.action !== '-' ? (
                                                    <span className="action-done">✓ 조치완료</span>
                                                ) : (
                                                    <span className="action-pending">조치 필요</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {todayDefects.length === 0 && todayInspections.length > 0 && (
                            <div className="empty-state success">
                                <CheckCircle2 size={48} color="#10b981" />
                                <p>오늘은 불량이 발생하지 않았습니다!</p>
                            </div>
                        )}

                        {todayInspections.length === 0 && (
                            <div className="empty-state">
                                <XCircle size={48} color="#cbd5e1" />
                                <p>오늘 검사 기록이 없습니다</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. 출고 중인 금형 */}
                <div className="widget glass-panel outgoing-molds">
                    <div className="widget-header">
                        <h3>
                            <Package size={20} />
                            출고 중인 금형
                        </h3>
                        {outgoingMolds.length > 0 && (
                            <span className="badge-alert">{outgoingMolds.length}개</span>
                        )}
                    </div>
                    <div className="widget-content">
                        {outgoingMolds.length > 0 ? (
                            <div className="outgoing-list">
                                {outgoingMolds.map(movement => {
                                    const mold = molds.find(m => m.id === movement.mold_id);
                                    const daysOut = Math.floor((new Date() - new Date(movement.outgoing_date)) / (1000 * 60 * 60 * 24));
                                    const expectedReturn = movement.expected_return_date ? new Date(movement.expected_return_date) : null;
                                    const isOverdue = expectedReturn && new Date() > expectedReturn;

                                    return (
                                        <div key={movement.id} className={`outgoing-item ${isOverdue ? 'overdue' : ''}`}>
                                            <div className="outgoing-header">
                                                <div className="mold-name-section">
                                                    <span className="mold-name">{mold?.name || '알 수 없는 금형'}</span>
                                                    <span className="mold-code">{mold?.code}</span>
                                                </div>
                                                {isOverdue && (
                                                    <span className="overdue-badge">⚠️ 지연</span>
                                                )}
                                            </div>
                                            <div className="outgoing-details">
                                                <div className="detail-row">
                                                    <span className="detail-label">목적지:</span>
                                                    <span className="detail-value">{movement.destination || movement.repair_vendor || '-'}</span>
                                                </div>
                                                <div className="detail-row">
                                                    <span className="detail-label">출고일:</span>
                                                    <span className="detail-value">{movement.outgoing_date} ({daysOut}일 경과)</span>
                                                </div>
                                                {movement.expected_return_date && (
                                                    <div className="detail-row">
                                                        <span className="detail-label">예상 반입:</span>
                                                        <span className={`detail-value ${isOverdue ? 'text-danger' : ''}`}>
                                                            {movement.expected_return_date}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state success">
                                <CheckCircle2 size={48} color="#10b981" />
                                <p>모든 금형이 정상 보관 중입니다</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 5. 원재료 소모 현황 */}
                <div className="widget glass-panel material-consumption">
                    <div className="widget-header">
                        <h3>
                            <Droplets size={20} />
                            원재료 소모 현황 <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)' }}>({mcMode === 'month' ? '월별' : '일별'})</span>
                        </h3>
                        <div className="mc-date-picker">
                            <div style={{ display: 'inline-flex', gap: 2, background: 'var(--bg-subtle)', borderRadius: 8, padding: 2, marginRight: 6 }}>
                                <button onClick={() => setMcMode('day')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.76rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: mcMode === 'day' ? 'var(--bg-card, #fff)' : 'transparent', color: mcMode === 'day' ? 'var(--primary)' : 'var(--text-muted)' }}>일별</button>
                                <button onClick={() => setMcMode('month')} style={{ padding: '4px 10px', borderRadius: 6, fontSize: '0.76rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: mcMode === 'month' ? 'var(--bg-card, #fff)' : 'transparent', color: mcMode === 'month' ? 'var(--primary)' : 'var(--text-muted)' }}>월별</button>
                            </div>
                            <button className="mc-date-btn" onClick={() => {
                                const d = new Date(mcDate);
                                if (mcMode === 'month') d.setMonth(d.getMonth() - 1); else d.setDate(d.getDate() - 1);
                                setMcDate(d.toISOString().split('T')[0]);
                            }}>◀</button>
                            {mcMode === 'month' ? (
                                <input type="month" className="mc-date-input" value={mcDate.slice(0, 7)}
                                    onChange={(e) => setMcDate(e.target.value + '-01')} />
                            ) : (
                                <input type="date" className="mc-date-input" value={mcDate}
                                    onChange={(e) => setMcDate(e.target.value)} />
                            )}
                            <button className="mc-date-btn" onClick={() => {
                                const d = new Date(mcDate);
                                if (mcMode === 'month') d.setMonth(d.getMonth() + 1); else d.setDate(d.getDate() + 1);
                                setMcDate(d.toISOString().split('T')[0]);
                            }}>▶</button>
                            <button className="mc-today-btn" onClick={() => setMcDate(today)}>{mcMode === 'month' ? '이번달' : 'Today'}</button>
                        </div>
                    </div>
                    <div className="widget-content">
                        {materialConsumption.length > 0 ? (
                            <div className="mc-list">
                                {materialConsumption.map(mc => {
                                    const usageRate = mc.stock > 0 ? (mc.totalConsumedKg / mc.stock) * 100 : 0;
                                    const severity = usageRate >= 50 ? 'critical' : usageRate >= 20 ? 'warning' : 'safe';
                                    const remainKg = Math.max(0, mc.stock - mc.totalConsumedKg);
                                    return (
                                        <div key={mc.id} className={`mc-item ${severity}`}>
                                            <div className="mc-header">
                                                <span className="mc-name">{mc.name}</span>
                                                <span className={`mc-severity-badge ${severity}`}>
                                                    {severity === 'critical' ? '⚠️ 주의' : severity === 'warning' ? '🟡 관심' : '🟢 양호'}
                                                </span>
                                            </div>
                                            <div className="mc-bar-wrapper">
                                                <div className="mc-bar">
                                                    <div className={`mc-bar-fill ${severity}`} style={{ width: `${Math.min(usageRate, 100)}%` }}></div>
                                                </div>
                                                <span className="mc-rate">{usageRate.toFixed(1)}%</span>
                                            </div>
                                            <div className="mc-details">
                                                <div className="mc-detail">
                                                    <span className="mc-detail-label">소모량</span>
                                                    <span className="mc-detail-value consumed">{mc.totalConsumedKg.toFixed(1)} kg</span>
                                                </div>
                                                <div className="mc-detail">
                                                    <span className="mc-detail-label">생산수량</span>
                                                    <span className="mc-detail-value">{mc.totalQty.toLocaleString()} 개</span>
                                                </div>
                                                <div className="mc-detail">
                                                    <span className="mc-detail-label">현재 재고</span>
                                                    <span className="mc-detail-value">{mc.stock.toLocaleString()} {mc.unit}</span>
                                                </div>
                                            </div>
                                            <div className="mc-products">
                                                {mc.productNames.map((pn, i) => (
                                                    <span key={i} className="mc-product-tag">{pn}</span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <Droplets size={48} color="#cbd5e1" />
                                <p>원재료 소모 데이터가 없습니다</p>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>제품에 원재료를 연결하면 자동 표시됩니다</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 사출조건 모달 */}
            <Modal
                title="사출조건 정보"
                isOpen={isConditionModalOpen}
                onClose={() => setIsConditionModalOpen(false)}
            >
                {selectedCondition && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* 온도 설정 */}
                        <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, color: '#1e293b' }}>🌡️ 온도 설정</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                                {selectedCondition.hopper_temp && <div><span style={{ color: '#64748b' }}>호퍼:</span> <strong>{selectedCondition.hopper_temp}°C</strong></div>}
                                {selectedCondition.cylinder_temp_zone1 && <div><span style={{ color: '#64748b' }}>실린더1:</span> <strong>{selectedCondition.cylinder_temp_zone1}°C</strong></div>}
                                {selectedCondition.cylinder_temp_zone2 && <div><span style={{ color: '#64748b' }}>실린더2:</span> <strong>{selectedCondition.cylinder_temp_zone2}°C</strong></div>}
                                {selectedCondition.cylinder_temp_zone3 && <div><span style={{ color: '#64748b' }}>실린더3:</span> <strong>{selectedCondition.cylinder_temp_zone3}°C</strong></div>}
                                {selectedCondition.cylinder_temp_zone4 && <div><span style={{ color: '#64748b' }}>실린더4:</span> <strong>{selectedCondition.cylinder_temp_zone4}°C</strong></div>}
                                {selectedCondition.nozzle_temp && <div><span style={{ color: '#64748b' }}>노즐:</span> <strong>{selectedCondition.nozzle_temp}°C</strong></div>}
                                {selectedCondition.mold_temp_fixed && <div><span style={{ color: '#64748b' }}>금형(고정):</span> <strong>{selectedCondition.mold_temp_fixed}°C</strong></div>}
                                {selectedCondition.mold_temp_moving && <div><span style={{ color: '#64748b' }}>금형(가동):</span> <strong>{selectedCondition.mold_temp_moving}°C</strong></div>}
                            </div>
                        </div>

                        {/* 사출 조건 */}
                        <div style={{ background: '#f0fdf4', padding: '1rem', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, color: '#166534' }}>💉 사출 조건</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                                {selectedCondition.injection_pressure && <div><span style={{ color: '#64748b' }}>사출압력:</span> <strong>{selectedCondition.injection_pressure} kgf/cm²</strong></div>}
                                {selectedCondition.injection_speed && <div><span style={{ color: '#64748b' }}>사출속도:</span> <strong>{selectedCondition.injection_speed} mm/s</strong></div>}
                                {selectedCondition.injection_time && <div><span style={{ color: '#64748b' }}>사출시간:</span> <strong>{selectedCondition.injection_time}초</strong></div>}
                                {selectedCondition.dosing_position_1 && <div><span style={{ color: '#64748b' }}>계량위치1:</span> <strong>{selectedCondition.dosing_position_1}mm</strong></div>}
                                {selectedCondition.injection_pressure_2 && <div><span style={{ color: '#64748b' }}>사출압력2:</span> <strong>{selectedCondition.injection_pressure_2} kgf/cm²</strong></div>}
                                {selectedCondition.injection_speed_2 && <div><span style={{ color: '#64748b' }}>사출속도2:</span> <strong>{selectedCondition.injection_speed_2} mm/s</strong></div>}
                                {selectedCondition.injection_time_2 && <div><span style={{ color: '#64748b' }}>사출시간2:</span> <strong>{selectedCondition.injection_time_2}초</strong></div>}
                                {selectedCondition.dosing_position_2 && <div><span style={{ color: '#64748b' }}>계량위치2:</span> <strong>{selectedCondition.dosing_position_2}mm</strong></div>}
                            </div>
                        </div>

                        {/* 보압 및 기타 */}
                        <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px' }}>
                            <h4 style={{ marginBottom: '0.75rem', fontWeight: 700, color: '#1e40af' }}>⚙️ 보압 및 기타</h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.9rem' }}>
                                {selectedCondition.holding_pressure && <div><span style={{ color: '#64748b' }}>보압:</span> <strong>{selectedCondition.holding_pressure} kgf/cm²</strong></div>}
                                {selectedCondition.holding_speed && <div><span style={{ color: '#64748b' }}>보압속도:</span> <strong>{selectedCondition.holding_speed} mm/s</strong></div>}
                                {selectedCondition.holding_time && <div><span style={{ color: '#64748b' }}>보압시간:</span> <strong>{selectedCondition.holding_time}초</strong></div>}
                                {selectedCondition.back_pressure && <div><span style={{ color: '#64748b' }}>배압:</span> <strong>{selectedCondition.back_pressure} kgf/cm²</strong></div>}
                                {selectedCondition.cooling_time && <div><span style={{ color: '#64748b' }}>냉각시간:</span> <strong>{selectedCondition.cooling_time}초</strong></div>}
                                {selectedCondition.cycle_time && <div><span style={{ color: '#64748b' }}>사이클타임:</span> <strong>{selectedCondition.cycle_time}초</strong></div>}
                                {selectedCondition.shot_size && <div><span style={{ color: '#64748b' }}>샷크기:</span> <strong>{selectedCondition.shot_size}mm</strong></div>}
                                {selectedCondition.screw_rpm && <div><span style={{ color: '#64748b' }}>스크류RPM:</span> <strong>{selectedCondition.screw_rpm}</strong></div>}
                                {selectedCondition.cushion && <div><span style={{ color: '#64748b' }}>쿠션:</span> <strong>{selectedCondition.cushion}mm</strong></div>}
                            </div>
                        </div>

                        {/* 비고 */}
                        {selectedCondition.notes && (
                            <div style={{ padding: '1rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                                <h4 style={{ marginBottom: '0.5rem', fontWeight: 700 }}>📝 비고</h4>
                                <p style={{ fontSize: '0.95rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selectedCondition.notes}</p>
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            <style>{`
                .dashboard-container {
                    padding: 0 1.5rem;
                    max-width: 1800px;
                    margin: 0 auto;
                }

                .dashboard-header {
                    margin-bottom: 2rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid var(--border);
                }

                .page-title {
                    font-size: 2rem;
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                    background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                .page-date {
                    color: var(--text-muted);
                    font-size: 0.9rem;
                    font-weight: 500;
                }

                /* 통계 카드 */
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    padding: 1.75rem;
                    border-radius: 12px;
                    background: white;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
                    border: 1px solid var(--border);
                    transition: all 0.2s;
                }

                .stat-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
                }

                .stat-card.running .stat-icon {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    color: #1e40af;
                }

                .stat-card.stock .stat-icon {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    color: #92400e;
                }

                .stat-card.stock.alert .stat-icon {
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    color: #991b1b;
                }

                .stat-card.overstock .stat-icon {
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    color: #1e40af;
                }

                .stat-card.overstock.warning .stat-icon {
                    background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                    color: #92400e;
                }

                .stat-card.defect .stat-icon {
                    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
                    color: #3730a3;
                }

                .stat-card.defect.warning .stat-icon {
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    color: #991b1b;
                }

                .stat-card.defect.good .stat-icon {
                    background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%);
                    color: #065f46;
                }

                .stat-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .stat-content {
                    flex: 1;
                }

                .stat-label {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                    font-weight: 600;
                }

                .stat-value {
                    font-size: 2rem;
                    font-weight: 800;
                    color: var(--text-main);
                    line-height: 1;
                    margin-bottom: 0.25rem;
                }

                .stat-desc {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }

                /* 위젯 그리드 */
                .widgets-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                /* 호기 배치도 위젯은 전체 폭 사용 */
                .widgets-grid .production-status {
                    grid-column: 1 / -1;
                }

                .widget {
                    padding: 1.75rem;
                    border-radius: 12px;
                }

                .widget-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid var(--border);
                }

                .widget-header h3 {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--text-main);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .badge-live {
                    background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
                    color: white;
                    font-size: 0.7rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }

                .badge-alert {
                    background: #dc2626;
                    color: white;
                    font-size: 0.75rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-weight: 700;
                }

                .defect-rate-badge {
                    background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%);
                    color: #3730a3;
                    font-size: 1rem;
                    padding: 0.5rem 1rem;
                    border-radius: 12px;
                    font-weight: 800;
                }

                /* 호기별 작업 현황 */
                .equipment-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .equipment-item {
                    background: #f8fafc;
                    padding: 1.25rem;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s;
                }

                .equipment-item:hover {
                    background: white;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transform: translateX(4px);
                }

                .eq-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .eq-name-section {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }

                .status-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    background: #cbd5e1;
                }

                .status-dot.active {
                    background: #10b981;
                    box-shadow: 0 0 10px #10b981;
                    animation: pulse-green 2s infinite;
                }

                @keyframes pulse-green {
                    0%, 100% { box-shadow: 0 0 10px #10b981; }
                    50% { box-shadow: 0 0 20px #10b981; }
                }

                .eq-name {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-main);
                    display: block;
                }

                .eq-temp {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    display: block;
                }

                .eq-product {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                    padding: 0.5rem;
                    background: white;
                    border-radius: 6px;
                }

                .product-name {
                    font-weight: 600;
                    color: var(--primary);
                    font-size: 0.9rem;
                }

                .eq-progress {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .progress-bar {
                    height: 8px;
                    background: #e2e8f0;
                    border-radius: 4px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
                    transition: width 0.3s;
                }

                .progress-text {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    text-align: right;
                    font-weight: 600;
                }

                /* 안전재고 경고 */
                .stock-alert-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .stock-alert-item {
                    background: white;
                    padding: 1rem;
                    border-radius: 10px;
                    border-left: 4px solid #f59e0b;
                }

                .stock-alert-item.high {
                    border-left-color: #ea580c;
                    background: #fff7ed;
                }

                .stock-alert-item.critical {
                    border-left-color: #dc2626;
                    background: #fef2f2;
                }

                .alert-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .material-name {
                    font-weight: 700;
                    font-size: 1rem;
                    color: var(--text-main);
                }

                .severity-badge {
                    font-size: 0.7rem;
                    padding: 0.25rem 0.75rem;
                    border-radius: 10px;
                    font-weight: 700;
                }

                .severity-badge.medium {
                    background: #fef3c7;
                    color: #92400e;
                }

                .severity-badge.high {
                    background: #fed7aa;
                    color: #7c2d12;
                }

                .severity-badge.critical {
                    background: #fee2e2;
                    color: #991b1b;
                }

                .stock-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    margin-bottom: 0.75rem;
                }

                .stock-numbers {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.85rem;
                }

                .current-stock {
                    color: var(--text-muted);
                }

                .current-stock strong {
                    color: var(--danger);
                    font-size: 1rem;
                }

                .min-stock {
                    color: var(--text-muted);
                }

                .shortage {
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    text-align: right;
                }

                .shortage-value {
                    color: #dc2626;
                    font-weight: 700;
                }

                .stock-progress-bar {
                    height: 6px;
                    background: #e2e8f0;
                    border-radius: 3px;
                    overflow: hidden;
                }

                .stock-progress-fill {
                    height: 100%;
                    transition: width 0.3s;
                }

                /* 일일 불량 현황 */
                .defect-summary {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .defect-stat {
                    background: #f8fafc;
                    padding: 1rem;
                    border-radius: 8px;
                    text-align: center;
                    border: 2px solid #e2e8f0;
                }

                .defect-stat.danger {
                    background: #fef2f2;
                    border-color: #fecaca;
                }

                .defect-stat.success {
                    background: #f0fdf4;
                    border-color: #bbf7d0;
                }

                .defect-label {
                    display: block;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    margin-bottom: 0.25rem;
                    font-weight: 600;
                }

                .defect-value {
                    display: block;
                    font-size: 1.75rem;
                    font-weight: 800;
                    color: var(--text-main);
                }

                .defect-stat.danger .defect-value {
                    color: #dc2626;
                }

                .defect-stat.success .defect-value {
                    color: #16a34a;
                }

                .defect-list-header {
                    font-size: 0.875rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    margin-bottom: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .defect-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .defect-item {
                    background: white;
                    padding: 0.875rem;
                    border-radius: 8px;
                    border: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .defect-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .defect-product {
                    font-weight: 600;
                    font-size: 0.95rem;
                    color: var(--text-main);
                }

                .defect-type {
                    font-size: 0.8rem;
                    color: #dc2626;
                    font-weight: 600;
                }

                .action-done {
                    background: #d1fae5;
                    color: #065f46;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .action-pending {
                    background: #fee2e2;
                    color: #991b1b;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    animation: blink 1.5s infinite;
                }

                @keyframes blink {
                    50% { opacity: 0.5; }
                }

                /* Empty State */
                .empty-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 3rem 1rem;
                    color: var(--text-muted);
                    gap: 1rem;
                }

                .empty-state p {
                    font-size: 0.95rem;
                    font-weight: 500;
                }

                .empty-state.success {
                    color: #16a34a;
                }

                /* 출고 금형 위젯 */
                .outgoing-list {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .outgoing-item {
                    background: white;
                    padding: 1.25rem;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s;
                }

                .outgoing-item:hover {
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    transform: translateX(2px);
                }

                .outgoing-item.overdue {
                    border-left: 4px solid #dc2626;
                    background: #fef2f2;
                }

                .outgoing-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.75rem;
                }

                .mold-name-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .mold-name {
                    font-weight: 700;
                    font-size: 1.05rem;
                    color: var(--text-main);
                }

                .mold-code {
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    font-weight: 600;
                }

                .overdue-badge {
                    background: #fee2e2;
                    color: #991b1b;
                    padding: 0.25rem 0.75rem;
                    border-radius: 12px;
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .outgoing-details {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .detail-row {
                    display: flex;
                    justify-content: space-between;
                    font-size: 0.9rem;
                }

                .detail-label {
                    color: var(--text-muted);
                    font-weight: 500;
                }

                .detail-value {
                    color: var(--text-main);
                    font-weight: 600;
                }

                .detail-value.text-danger {
                    color: #dc2626;
                    font-weight: 700;
                }

                /* 원재료 소모 위젯 */
                .mc-list { display: flex; flex-direction: column; gap: 1rem; }

                .mc-item {
                    background: white;
                    padding: 1rem;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    transition: all 0.2s;
                }
                .mc-item:hover { box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); }
                .mc-item.critical { border-left: 4px solid #dc2626; background: #fef8f8; }
                .mc-item.warning { border-left: 4px solid #f59e0b; background: #fffdf5; }
                .mc-item.safe { border-left: 4px solid #10b981; }

                .mc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
                .mc-name { font-weight: 700; font-size: 1rem; color: #1e293b; }
                .mc-severity-badge { font-size: 0.72rem; font-weight: 600; padding: 2px 8px; border-radius: 12px; }
                .mc-severity-badge.critical { background: #fee2e2; color: #991b1b; }
                .mc-severity-badge.warning { background: #fef3c7; color: #92400e; }
                .mc-severity-badge.safe { background: #d1fae5; color: #065f46; }

                .mc-bar-wrapper { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
                .mc-bar { flex: 1; height: 10px; background: #e5e7eb; border-radius: 5px; overflow: hidden; }
                .mc-bar-fill { height: 100%; border-radius: 5px; transition: width 0.5s ease; }
                .mc-bar-fill.safe { background: linear-gradient(90deg, #10b981, #34d399); }
                .mc-bar-fill.warning { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
                .mc-bar-fill.critical { background: linear-gradient(90deg, #dc2626, #ef4444); }
                .mc-rate { font-size: 0.85rem; font-weight: 800; min-width: 48px; text-align: right; }

                .mc-details { display: flex; gap: 1rem; margin-bottom: 0.5rem; flex-wrap: wrap; }
                .mc-detail { display: flex; flex-direction: column; }
                .mc-detail-label { font-size: 0.7rem; color: #94a3b8; font-weight: 500; }
                .mc-detail-value { font-size: 0.9rem; font-weight: 700; color: #1e293b; }
                .mc-detail-value.consumed { color: #dc2626; }

                .mc-products { display: flex; gap: 4px; flex-wrap: wrap; }
                .mc-product-tag {
                    font-size: 0.7rem;
                    padding: 2px 8px;
                    background: #eff6ff;
                    color: #1d4ed8;
                    border-radius: 10px;
                    font-weight: 600;
                }

                .mc-date-picker {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .mc-date-input {
                    padding: 4px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    color: #1e293b;
                    background: #f8fafc;
                    cursor: pointer;
                }
                .mc-date-btn {
                    padding: 4px 8px;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    background: #f8fafc;
                    cursor: pointer;
                    font-size: 0.75rem;
                    transition: all 0.15s;
                }
                .mc-date-btn:hover { background: #e2e8f0; }
                .mc-today-btn {
                    padding: 4px 10px;
                    border: none;
                    border-radius: 6px;
                    background: linear-gradient(135deg, #4f46e5, #6366f1);
                    color: white;
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .mc-today-btn:hover { opacity: 0.85; }
                /* 불량 사진 썸네일 */
                .defect-photos {
                    display: flex;
                    gap: 4px;
                    align-items: center;
                    cursor: pointer;
                    padding: 4px 0;
                }

                .defect-thumb {
                    width: 40px;
                    height: 40px;
                    border-radius: 6px;
                    object-fit: cover;
                    border: 2px solid #fee2e2;
                    transition: all 0.2s;
                }

                .defect-thumb:hover {
                    border-color: #f87171;
                    transform: scale(1.15);
                    z-index: 1;
                }

                .defect-photo-more {
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #94a3b8;
                    padding: 0 4px;
                }
            `}</style>

            {/* ──────────────── 작업 필요 원재료 (신재/분쇄 비율) ──────────────── */}
            <div className="widgets-grid" style={{ marginTop: '1.5rem' }}>
                <div className="widget glass-panel" style={{ gridColumn: '1 / -1' }}>
                    <div className="widget-header">
                        <h3><Droplets size={20} /> 작업 필요 원재료 (신재/분쇄)</h3>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>진행중 작업지시 남은수량 기준</span>
                    </div>
                    <div className="widget-content">
                        {materialRequirement.rows.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.9rem' }}>
                                진행중인 작업지시가 없습니다.
                            </div>
                        ) : (
                            <>
                                {/* 원재료별 합계 카드 */}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                    {materialRequirement.mats.map(m => {
                                        const short = m.stock != null && m.virgin > m.stock; // 신재 부족 여부
                                        return (
                                            <div key={m.material} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 0.9rem', background: 'var(--bg-card)' }}>
                                                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{m.material}</span>
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>총 {m.needed.toFixed(1)}kg</span>
                                                </div>
                                                <div style={{ display: 'flex', gap: 8, fontSize: '0.85rem' }}>
                                                    <span style={{ flex: 1, background: '#dbeafe', color: '#1e40af', borderRadius: 6, padding: '4px 8px', fontWeight: 700 }}>
                                                        신재 {m.virgin.toFixed(1)}kg
                                                    </span>
                                                    <span style={{ flex: 1, background: '#dcfce7', color: '#166534', borderRadius: 6, padding: '4px 8px', fontWeight: 700 }}>
                                                        분쇄 {m.regrind.toFixed(1)}kg
                                                    </span>
                                                </div>
                                                {m.stock != null && (
                                                    <div style={{ marginTop: 6, fontSize: '0.76rem', color: short ? '#dc2626' : '#94a3b8', fontWeight: short ? 700 : 400 }}>
                                                        신재 재고 {m.stock.toLocaleString()}kg {short ? `→ ${(m.virgin - m.stock).toFixed(1)}kg 부족 ⚠️` : '✓'}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 제품별 상세 표 */}
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '2px solid var(--border)' }}>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>제품</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'left' }}>원재료</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>남은수량</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'center' }}>신재:분쇄</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>필요(kg)</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#1e40af' }}>신재(kg)</th>
                                                <th style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#166534' }}>분쇄(kg)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {materialRequirement.rows.map((r, i) => (
                                                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                                                    <td style={{ padding: '0.5rem 0.6rem', fontWeight: 600 }}>{r.product}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', color: 'var(--text-muted)' }}>{r.material}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right' }}>{r.remaining.toLocaleString()}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'center', color: 'var(--text-muted)' }}>{r.virginOnly ? '신재100%' : `${100 - r.regPct}:${r.regPct}`}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: 600 }}>{r.neededKg.toFixed(1)}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>{r.virginKg.toFixed(1)}</td>
                                                    <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', color: '#166534', fontWeight: 700 }}>{r.regrindKg.toFixed(1)}</td>
                                                </tr>
                                            ))}
                                            <tr style={{ borderTop: '2px solid #94a3b8', fontWeight: 800, background: 'var(--bg-subtle)' }}>
                                                <td style={{ padding: '0.6rem' }} colSpan={4}>합계</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'right' }}>{materialRequirement.totalNeeded.toFixed(1)}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'right', color: '#1e40af' }}>{materialRequirement.totalVirgin.toFixed(1)}</td>
                                                <td style={{ padding: '0.6rem', textAlign: 'right', color: '#166534' }}>{materialRequirement.totalRegrind.toFixed(1)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#94a3b8' }}>
                                    💡 분쇄는 자체 재생분이라 신재만 구매하면 됩니다. "신재(kg)" 합계만큼만 발주하세요.
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ──────────────── 작업표준서 다운로드 (사출조건 + 불량이력 연동) ──────────────── */}
            <div className="widgets-grid" style={{ marginTop: '1.5rem' }}>
                <WorkStandardSheet />
            </div>

            {/* ──────────────── 30일 분석 섹션 (Phase 3a) — 관리자 전용 ──────────────── */}
            {isAdmin && <AnalyticsSection />}

            {/* 불량 사진 뷰어 모달 */}
            <Modal title="불량 사진 보기" isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {viewerImages.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                            <img src={url} alt={`불량 사진 ${i + 1}`} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        </a>
                    ))}
                </div>
            </Modal>
        </div>
    );
};

export default Dashboard;
