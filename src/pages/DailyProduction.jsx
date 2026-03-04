import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Calendar, TrendingUp, Edit } from 'lucide-react';
import { useData } from '../context/DataContext';

const DailyProduction = () => {
    const { workOrders, equipments, products, materials, employees, updateWorkOrder, addNotification, addProductionLog, productionLogs } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [dailyQuantity, setDailyQuantity] = useState(0);
    const [editQuantity, setEditQuantity] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    // 날짜 필터 상태
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [showAllOrders, setShowAllOrders] = useState(false);

    // UTC → 로컬 날짜 변환 (KST 기준)
    const toLocalDate = (dateValue) => {
        const d = new Date(dateValue);
        return d.toLocaleDateString('sv-SE'); // yyyy-MM-dd 형식 (로컬 타임존)
    };

    // 진행중인 작업지시만 필터
    const activeOrders = workOrders.filter(wo => wo.status === '진행중');

    // 날짜 필터가 있는지 여부
    const isDateFiltered = filterStartDate || filterEndDate;

    // 날짜 필터 시: production_logs에서 해당 날짜의 일일 기록을 조회
    const filteredLogs = isDateFiltered ? (productionLogs || []).filter(log => {
        const logDate = log.production_date;
        if (filterStartDate && logDate < filterStartDate) return false;
        if (filterEndDate && logDate > filterEndDate) return false;
        return true;
    }) : [];

    // 날짜 필터 없을 때: 진행중 작업지시 표시 (기존 방식)
    const filteredOrders = (showAllOrders ? workOrders : activeOrders);

    const columns = [
        {
            header: '설비명',
            accessor: 'equipment_name',
            render: (row) => {
                const equipment = equipments.find(eq => eq.id === row.equipment_id);
                const isTodayMissing = !isUpdatedToday(row);
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{equipment?.name || '-'}</span>
                        {isTodayMissing && (
                            <span className="missing-badge">
                                금일수량기입누락
                            </span>
                        )}
                    </div>
                );
            }
        },
        {
            header: '제품명',
            accessor: 'product_name',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                return product?.name || '-';
            }
        },
        {
            header: '원재료명',
            accessor: 'material_name',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                const material = product?.material_id ? materials.find(m => m.id === product.material_id) : null;
                return material ? (
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{material.name}</span>
                ) : <span style={{ color: '#94a3b8' }}>-</span>;
            }
        },
        {
            header: '진행률',
            accessor: 'progress',
            render: (row) => {
                const progress = row.target_quantity > 0
                    ? Math.round((row.produced_quantity / row.target_quantity) * 100)
                    : 0;
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{
                            width: '100px',
                            height: '8px',
                            background: '#e5e7eb',
                            borderRadius: '4px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: progress >= 100 ? '#10b981' : '#4f46e5',
                                transition: 'width 0.3s'
                            }} />
                        </div>
                        <span style={{ fontWeight: 600, color: progress >= 100 ? '#10b981' : '#4f46e5' }}>
                            {progress}%
                        </span>
                    </div>
                );
            }
        },
        {
            header: '생산수량/목표',
            accessor: 'quantities',
            render: (row) => `${row.produced_quantity} / ${row.target_quantity}`
        },
        {
            header: '원재료 소모량',
            accessor: 'material_consumption',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                if (!product) return '-';

                const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                const totalWeightG = shotWeight * (row.produced_quantity || 0);
                const totalWeightKg = totalWeightG / 1000;

                if (totalWeightKg === 0) return '-';

                return (
                    <span style={{
                        fontWeight: 600,
                        color: totalWeightKg >= 1 ? '#059669' : '#64748b'
                    }} title={`제품: ${product.product_weight || 0}g, 런너: ${product.runner_weight || 0}g, 생산: ${row.produced_quantity}개`}>
                        {totalWeightKg.toFixed(2)} kg
                    </span>
                );
            }
        },
        { header: '지시일', accessor: 'order_date' }

    ];

    // 오늘 업데이트 확인 함수
    const isUpdatedToday = (order) => {
        const updateDate = order.last_production_date || order.updated_at;

        if (updateDate) {
            const today = toLocalDate(new Date());
            const lastUpdate = toLocalDate(updateDate);
            return lastUpdate === today;
        }

        return false;
    };

    const handleOpenModal = (order) => {
        setSelectedOrder(order);
        setDailyQuantity(0);
        setIsModalOpen(true);
    };

    const handleAddDailyProduction = async () => {
        if (!selectedOrder || dailyQuantity <= 0) {
            return alert('수량을 입력해주세요.');
        }

        const newProducedQuantity = selectedOrder.produced_quantity + dailyQuantity;

        await updateWorkOrder(selectedOrder.id, {
            produced_quantity: newProducedQuantity,
            daily_quantity: dailyQuantity,
            last_production_date: new Date().toISOString()
        });

        // 일일 생산 로그 저장 (이력 조회용)
        await addProductionLog({
            work_order_id: selectedOrder.id,
            product_id: selectedOrder.product_id,
            equipment_id: selectedOrder.equipment_id,
            daily_quantity: dailyQuantity,
            production_date: new Date().toISOString().split('T')[0]
        });

        // 관리자에게 알림 전송
        const managers = employees.filter(emp => emp.position === '관리자' || emp.position === '대표');
        for (const manager of managers) {
            await addNotification(
                manager.id,
                '일일 작업수량 기록',
                `${getEquipmentName(selectedOrder.equipment_id)}에서 ${getProductName(selectedOrder.product_id)} ${dailyQuantity.toLocaleString()}개 생산 기록`,
                'production',
                selectedOrder.id
            );
        }

        // 100% 도달 시 완료 알림
        if (newProducedQuantity >= selectedOrder.target_quantity) {
            for (const manager of managers) {
                await addNotification(
                    manager.id,
                    '작업지시 완료',
                    `${getEquipmentName(selectedOrder.equipment_id)} - ${getProductName(selectedOrder.product_id)} 작업 완료 (${newProducedQuantity.toLocaleString()}/${selectedOrder.target_quantity.toLocaleString()})`,
                    'completion',
                    selectedOrder.id
                );
            }
            alert(`🎉 작업지시가 완료되었습니다!\n설비: ${getEquipmentName(selectedOrder.equipment_id)}\n제품: ${getProductName(selectedOrder.product_id)}`);
        }

        setIsModalOpen(false);
        setSelectedOrder(null);
        setDailyQuantity(0);
    };

    const handleOpenEditModal = (order) => {
        setSelectedOrder(order);
        setEditQuantity(order.produced_quantity);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedOrder || editQuantity < 0) {
            return alert('올바른 수량을 입력해주세요.');
        }

        await updateWorkOrder(selectedOrder.id, {
            produced_quantity: editQuantity
        });

        // 100% 도달 시 자동 완료 알림
        if (editQuantity >= selectedOrder.target_quantity) {
            alert(`🎉 작업지시가 완료되었습니다!\n설비: ${getEquipmentName(selectedOrder.equipment_id)}\n제품: ${getProductName(selectedOrder.product_id)}`);
        }

        setIsEditModalOpen(false);
        setSelectedOrder(null);
        setEditQuantity(0);
    };

    const getEquipmentName = (equipmentId) => {
        const equipment = equipments.find(eq => eq.id === equipmentId);
        return equipment?.name || '-';
    };

    const getProductName = (productId) => {
        const product = products.find(p => p.id === productId);
        return product?.name || '-';
    };

    // 테이블 데이터 준비
    const tableData = activeOrders.map(order => ({
        ...order,
        equipment_name: getEquipmentName(order.equipment_id),
        product_name: getProductName(order.product_id)
    }));

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">일일 작업현황</h2>
                    <p className="page-description">날짜별 생산 수량을 기록하고 작업 진행률을 관리합니다.</p>
                </div>
            </div>

            {/* 날짜 필터 */}
            <div className="filter-row">
                <div className="filter-group">
                    <label className="filter-label">시작일</label>
                    <input
                        type="date"
                        className="filter-date"
                        value={filterStartDate}
                        onChange={(e) => setFilterStartDate(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label className="filter-label">종료일</label>
                    <input
                        type="date"
                        className="filter-date"
                        value={filterEndDate}
                        onChange={(e) => setFilterEndDate(e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label className="filter-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <input
                            type="checkbox"
                            checked={showAllOrders}
                            onChange={(e) => setShowAllOrders(e.target.checked)}
                            style={{ width: 'auto', margin: 0 }}
                        />
                        완료된 작업 포함
                    </label>
                </div>
                {(filterStartDate || filterEndDate) && (
                    <button
                        className="btn-cancel"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        onClick={() => {
                            setFilterStartDate('');
                            setFilterEndDate('');
                        }}
                    >
                        날짜 초기화
                    </button>
                )}
            </div>

            {isDateFiltered ? (
                /* ===== 날짜 필터 활성 → 일일 생산 기록(production_logs) 표시 ===== */
                <>
                    <div className="stats-row">
                        <div className="glass-panel simple-stat">
                            <span className="label">📋 일일 기록 건수</span>
                            <span className="value">{filteredLogs.length}건</span>
                        </div>
                        <div className="glass-panel simple-stat">
                            <span className="label">�icing 총 생산수량</span>
                            <span className="value" style={{ color: '#059669' }}>
                                {filteredLogs.reduce((sum, log) => sum + (log.daily_quantity || 0), 0).toLocaleString()}개
                            </span>
                        </div>
                        <div className="glass-panel simple-stat">
                            <span className="label">📅 조회 기간</span>
                            <span className="value" style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>
                                {filterStartDate}{filterEndDate && filterEndDate !== filterStartDate ? ` ~ ${filterEndDate}` : ''}
                            </span>
                        </div>
                    </div>

                    {filteredLogs.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                            <div style={{ fontSize: '1rem' }}>해당 날짜에 기록된 생산 내역이 없습니다.</div>
                            <div style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: '#94a3b8' }}>
                                일일작업현황에서 "수량 기록" 버튼으로 생산수량을 먼저 입력해주세요.
                            </div>
                        </div>
                    ) : (
                        <div className="glass-panel" style={{ overflow: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>생산일</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>설비명</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>제품명</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>원재료명</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>당일 생산수량</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: '#475569', textTransform: 'uppercase', background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}>원재료 소모량</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log, idx) => {
                                        const equipment = equipments.find(eq => eq.id === log.equipment_id);
                                        const product = products.find(p => p.id === log.product_id);
                                        const material = product?.material_id ? materials.find(m => m.id === product.material_id) : null;
                                        const shotWeight = product ? (product.product_weight || 0) + (product.runner_weight || 0) : 0;
                                        const consumptionKg = (shotWeight * (log.daily_quantity || 0)) / 1000;
                                        return (
                                            <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background 0.15s' }}
                                                onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                                onMouseLeave={(e) => e.currentTarget.style.background = ''}
                                            >
                                                <td style={{ padding: '0.75rem', fontWeight: 500 }}>{log.production_date}</td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{equipment?.name || '-'}</td>
                                                <td style={{ padding: '0.75rem' }}>{product?.name || '-'}</td>
                                                <td style={{ padding: '0.75rem', color: '#0369a1', fontWeight: 600 }}>{material?.name || '-'}</td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#4f46e5', fontSize: '1.05rem' }}>
                                                    {(log.daily_quantity || 0).toLocaleString()}개
                                                </td>
                                                <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: consumptionKg >= 1 ? '#059669' : '#64748b' }}>
                                                    {consumptionKg > 0 ? `${consumptionKg.toFixed(2)} kg` : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ borderTop: '2px solid #e2e8f0', background: '#f8fafc' }}>
                                        <td colSpan={4} style={{ padding: '0.75rem', fontWeight: 700, textAlign: 'right' }}>합계</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 800, color: '#4f46e5', fontSize: '1.1rem' }}>
                                            {filteredLogs.reduce((sum, log) => sum + (log.daily_quantity || 0), 0).toLocaleString()}개
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                            {(() => {
                                                const totalKg = filteredLogs.reduce((sum, log) => {
                                                    const product = products.find(p => p.id === log.product_id);
                                                    const shotWeight = product ? (product.product_weight || 0) + (product.runner_weight || 0) : 0;
                                                    return sum + (shotWeight * (log.daily_quantity || 0)) / 1000;
                                                }, 0);
                                                return totalKg > 0 ? `${totalKg.toFixed(2)} kg` : '-';
                                            })()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </>
            ) : (
                /* ===== 날짜 필터 없음 → 기존 작업지시 목록 표시 ===== */
                <>
                    <div className="stats-row">
                        <div className="glass-panel simple-stat">
                            <span className="label">{showAllOrders ? '전체 작업' : '진행중 작업'}</span>
                            <span className="value">{filteredOrders.length}건</span>
                        </div>
                        <div className="glass-panel simple-stat">
                            <span className="label">완료 임박</span>
                            <span className="value" style={{ color: 'var(--warning)' }}>
                                {activeOrders.filter(wo => {
                                    const progress = wo.target_quantity > 0
                                        ? (wo.produced_quantity / wo.target_quantity) * 100
                                        : 0;
                                    return progress >= 90 && progress < 100;
                                }).length}건
                            </span>
                        </div>
                        <div className="glass-panel simple-stat">
                            <span className="label">오늘 날짜</span>
                            <span className="value" style={{ fontSize: '1rem', color: 'var(--text-main)' }}>
                                {new Date().toLocaleDateString('ko-KR')}
                            </span>
                        </div>
                    </div>

                    <Table
                        columns={columns}
                        data={filteredOrders.map(order => ({
                            ...order,
                            equipment_name: getEquipmentName(order.equipment_id),
                            product_name: getProductName(order.product_id)
                        }))}
                        actions={(row) => (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="icon-btn"
                                    onClick={() => handleOpenEditModal(row)}
                                    title="생산량 수정"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    className="btn-action"
                                    onClick={() => handleOpenModal(row)}
                                    title="수량 추가"
                                >
                                    <Plus size={16} />
                                    수량 기록
                                </button>
                            </div>
                        )}
                    />
                </>
            )}

            {/* 일일 생산 수량 입력 모달 */}
            <Modal
                title="일일 생산 수량 기록"
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            >
                {selectedOrder && (
                    <>
                        <div className="form-group">
                            <label className="form-label">설비</label>
                            <input
                                className="form-input"
                                value={getEquipmentName(selectedOrder.equipment_id)}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">제품</label>
                            <input
                                className="form-input"
                                value={getProductName(selectedOrder.product_id)}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">현재 생산량</label>
                            <input
                                className="form-input"
                                value={`${selectedOrder.produced_quantity} / ${selectedOrder.target_quantity}`}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">날짜</label>
                            <input
                                type="date"
                                className="form-input"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">금일 생산 수량 *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={dailyQuantity}
                                onChange={(e) => setDailyQuantity(parseInt(e.target.value) || 0)}
                                placeholder="오늘 생산한 수량 입력"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">예상 누적 생산량</label>
                            <input
                                className="form-input"
                                value={selectedOrder.produced_quantity + dailyQuantity}
                                disabled
                                style={{
                                    fontWeight: 600,
                                    color: (selectedOrder.produced_quantity + dailyQuantity) >= selectedOrder.target_quantity
                                        ? '#10b981'
                                        : '#4f46e5'
                                }}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={handleAddDailyProduction}>
                                기록
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            {/* 생산량 수정 모달 */}
            <Modal
                title="생산량 수정"
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
            >
                {selectedOrder && (
                    <>
                        <div className="form-group">
                            <label className="form-label">설비</label>
                            <input
                                className="form-input"
                                value={getEquipmentName(selectedOrder.equipment_id)}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">제품</label>
                            <input
                                className="form-input"
                                value={getProductName(selectedOrder.product_id)}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">목표 수량</label>
                            <input
                                className="form-input"
                                value={selectedOrder.target_quantity}
                                disabled
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">현재 생산량 *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={editQuantity}
                                onChange={(e) => setEditQuantity(parseInt(e.target.value) || 0)}
                                placeholder="정확한 생산량 입력"
                                autoFocus
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">진행률</label>
                            <input
                                className="form-input"
                                value={`${selectedOrder.target_quantity > 0 ? Math.round((editQuantity / selectedOrder.target_quantity) * 100) : 0}%`}
                                disabled
                                style={{
                                    fontWeight: 600,
                                    color: editQuantity >= selectedOrder.target_quantity
                                        ? '#10b981'
                                        : '#4f46e5'
                                }}
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsEditModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={handleSaveEdit}>
                                저장
                            </button>
                        </div>
                    </>
                )}
            </Modal>

            <style>{`
                .missing-badge {
                    background: #fee2e2;
                    color: #991b1b;
                    padding: 0.25rem 0.5rem;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    animation: blink-warning 1.5s infinite;
                    white-space: nowrap;
                }

                @keyframes blink-warning {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .filter-row {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    align-items: flex-end;
                    flex-wrap: wrap;
                }
                
                .filter-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                
                .filter-label {
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-secondary);
                }
                
                .filter-date {
                    padding: 0.6rem 1rem;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    background: white;
                    font-size: 0.95rem;
                    min-width: 160px;
                    cursor: pointer;
                }
                
                .filter-date:focus {
                    outline: none;
                    border-color: var(--primary);
                }
            `}</style>
        </div>
    );
};

export default DailyProduction;
