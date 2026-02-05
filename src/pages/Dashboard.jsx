import React, { useState } from 'react';
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
    FileText
} from 'lucide-react';

const Dashboard = () => {
    const { equipments, materials, inspections, products, workOrders, molds, moldMovement, injectionConditions } = useData();

    // 사출조건 모달 상태
    const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
    const [selectedCondition, setSelectedCondition] = useState(null);

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

    return (
        <div className="dashboard-container">
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
                                {todayDefects.map(defect => (
                                    <div key={defect.id} className="defect-item">
                                        <div className="defect-info">
                                            <span className="defect-product">{defect.product}</span>
                                            <span className="defect-type">{defect.ngType}</span>
                                        </div>
                                        <div className="defect-action">
                                            {defect.action && defect.action !== '-' ? (
                                                <span className="action-done">✓ 조치완료</span>
                                            ) : (
                                                <span className="action-pending">조치 필요</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
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
            `}</style>
        </div>
    );
};

export default Dashboard;
