import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import Modal from '../components/Modal';
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
    const { equipments, materials, inspections, products, workOrders, molds, moldMovement, injectionConditions, productionLogs, employees } = useData();

    // 뉴스 속보 상태
    const [newsItems, setNewsItems] = useState([]);
    const [newsLoading, setNewsLoading] = useState(false);
    const newsTickerRef = useRef(null);

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

    // 사출조건 모달 상태
    const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState(null);

    // 불량 사진 뷰어 상태
    const [viewerImages, setViewerImages] = useState([]);
    const [isViewerOpen, setIsViewerOpen] = useState(false);

    // 원재료 소모 날짜 선택
    const [mcDate, setMcDate] = useState(new Date().toISOString().split('T')[0]);

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

        const filteredLogs = productionLogs.filter(log => log.production_date === mcDate);

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
                        <span style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>🔴</span> 속보
                    </div>
                    <div style={{
                        flex: 1, overflow: 'hidden', position: 'relative', height: '100%',
                        display: 'flex', alignItems: 'center',
                        maskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 3%, black 97%, transparent 100%)'
                    }}>
                        <div ref={newsTickerRef} style={{
                            display: 'flex', gap: '50px', whiteSpace: 'nowrap',
                            animation: `tickerScroll ${Math.max(newsItems.length * 8, 30)}s linear infinite`,
                            WebkitAnimation: `tickerScroll ${Math.max(newsItems.length * 8, 30)}s linear infinite`,
                            willChange: 'transform',
                            WebkitTransform: 'translateZ(0)',
                            paddingLeft: '20px'
                        }}>
                            {[...newsItems, ...newsItems].map((item, i) => (
                                <a key={i} href={item.link} target="_blank" rel="noopener noreferrer"
                                    style={{
                                        color: '#e2e8f0', textDecoration: 'none', fontSize: '0.82rem',
                                        fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '8px',
                                        transition: 'color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.color = '#60a5fa'}
                                    onMouseOut={(e) => e.currentTarget.style.color = '#e2e8f0'}
                                >
                                    <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>▸</span>
                                    {item.title}
                                    {item.pubDate && (
                                        <span style={{ color: '#64748b', fontSize: '0.68rem', fontWeight: 400 }}>
                                            {new Date(item.pubDate).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    )}
                                </a>
                            ))}
                        </div>
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
                <div className="stat-card running">
                    <div className="stat-icon">
                        <Activity />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">가동중인 설비</p>
                        <h3 className="stat-value">{runningEquipments.length}대</h3>
                        <p className="stat-desc">전체 {equipments.length}대</p>
                    </div>
                </div>

                <div className={`stat-card stock ${lowStockMaterials.length > 0 ? 'alert' : ''}`}>
                    <div className="stat-icon">
                        <AlertTriangle />
                    </div>
                    <div className="stat-content">
                        <p className="stat-label">재고 부족</p>
                        <h3 className="stat-value">{lowStockMaterials.length}건</h3>
                        <p className="stat-desc">안전재고 미달</p>
                    </div>
                </div>

                <div className={`stat-card defect ${todayDefects.length > 0 ? 'warning' : 'good'}`}>
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
                        {runningEquipments.length > 0 ? (
                            <div className="equipment-list">
                                {runningEquipments.map(eq => {
                                    const workOrder = workOrders.find(wo => wo.id === eq.current_work_order_id);
                                    const product = workOrder ? products.find(p => p.id === workOrder.product_id) : null;
                                    const progress = workOrder && workOrder.target_quantity > 0
                                        ? Math.round((workOrder.produced_quantity / workOrder.target_quantity) * 100)
                                        : 0;

                                    return (
                                        <div
                                            key={eq.id}
                                            className="equipment-item clickable"
                                            onClick={() => {

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
                                            title="클릭하여 사출조건 보기"
                                        >
                                            <div className="eq-header">
                                                <div className="eq-name-section">
                                                    <div className="status-dot active"></div>
                                                    <div>
                                                        <span className="eq-name">{eq.name}</span>
                                                        {product?.cycle_time && (
                                                            <span className="eq-temp">{product.cycle_time}초/사이클</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <FileText size={18} color="#6366f1" style={{ opacity: 0.6 }} />
                                            </div>
                                            <div className="eq-product">
                                                <Package size={16} />
                                                <span className="product-name">{product?.name || '제품 정보 없음'}</span>
                                            </div>
                                            <div className="eq-progress">
                                                <div className="progress-bar">
                                                    <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                                                </div>
                                                <span className="progress-text">
                                                    {workOrder?.produced_quantity || 0} / {workOrder?.target_quantity || 0} ({progress}%)
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <Activity size={48} color="#cbd5e1" />
                                <p>현재 가동중인 설비가 없습니다</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. 안전재고 경고 */}
                <div className="widget glass-panel low-stock-alert">
                    <div className="widget-header">
                        <h3>
                            <AlertTriangle size={20} />
                            안전재고 경고
                        </h3>
                        {lowStockMaterials.length > 0 && (
                            <span className="badge-alert">{lowStockMaterials.length}건</span>
                        )}
                    </div>
                    <div className="widget-content">
                        {lowStockMaterials.length > 0 ? (
                            <div className="stock-alert-list">
                                {lowStockMaterials.map(material => {
                                    const shortage = material.min_stock - material.stock;
                                    const severity = material.stock === 0 ? 'critical' :
                                        material.stock < (material.min_stock * 0.3) ? 'high' : 'medium';

                                    return (
                                        <div key={material.id} className={`stock-alert-item ${severity}`}>
                                            <div className="alert-header">
                                                <span className="material-name">{material.name}</span>
                                                <span className={`severity-badge ${severity}`}>
                                                    {severity === 'critical' ? '재고 없음' : severity === 'high' ? '긴급' : '주의'}
                                                </span>
                                            </div>
                                            <div className="stock-info">
                                                <div className="stock-numbers">
                                                    <span className="current-stock">
                                                        현재: <strong>{material.stock.toLocaleString()}</strong> {material.unit}
                                                    </span>
                                                    <span className="min-stock">
                                                        안전: {material.min_stock.toLocaleString()} {material.unit}
                                                    </span>
                                                </div>
                                                <div className="shortage">
                                                    부족량: <strong className="shortage-value">▼ {shortage.toLocaleString()} {material.unit}</strong>
                                                </div>
                                            </div>
                                            <div className="stock-progress-bar">
                                                <div
                                                    className="stock-progress-fill"
                                                    style={{
                                                        width: `${Math.min((material.stock / material.min_stock) * 100, 100)}%`,
                                                        background: severity === 'critical' ? '#dc2626' :
                                                            severity === 'high' ? '#ea580c' : '#f59e0b'
                                                    }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="empty-state success">
                                <CheckCircle2 size={48} color="#10b981" />
                                <p>모든 원재료 재고가 안전 수준입니다</p>
                            </div>
                        )}
                    </div>
                </div>

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
                            원재료 소모 현황
                        </h3>
                        <div className="mc-date-picker">
                            <button className="mc-date-btn" onClick={() => {
                                const d = new Date(mcDate);
                                d.setDate(d.getDate() - 1);
                                setMcDate(d.toISOString().split('T')[0]);
                            }}>◀</button>
                            <input
                                type="date"
                                className="mc-date-input"
                                value={mcDate}
                                onChange={(e) => setMcDate(e.target.value)}
                            />
                            <button className="mc-date-btn" onClick={() => {
                                const d = new Date(mcDate);
                                d.setDate(d.getDate() + 1);
                                setMcDate(d.toISOString().split('T')[0]);
                            }}>▶</button>
                            <button className="mc-today-btn" onClick={() => setMcDate(today)}>Today</button>
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
