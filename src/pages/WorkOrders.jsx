import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import { Plus, Play, CheckCircle, XCircle, Edit, FileText, Wrench, PenTool, Truck, ClipboardList } from 'lucide-react';
import { useData } from '../context/DataContext';

const WorkOrders = () => {
    const {
        workOrders, products, equipments, molds,
        repairHistory, eqHistory, moldMovement,
        addWorkOrder, updateWorkOrder, startWork, completeWork
    } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentOrder, setCurrentOrder] = useState(null);
    const [filterStatus, setFilterStatus] = useState('전체');

    const [formData, setFormData] = useState({
        product_id: '',
        equipment_id: '',
        target_quantity: 100,
        order_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [updateData, setUpdateData] = useState({
        produced_quantity: 0
    });

    const filteredOrders = filterStatus === '전체'
        ? workOrders.filter(wo => wo.status !== '완료' && wo.status !== '취소')
        : workOrders.filter(wo => wo.status === filterStatus);

    const getProductName = (productId) => {
        const product = products.find(p => p.id === productId);
        return product ? product.name : '-';
    };

    const getEquipmentName = (equipmentId) => {
        const equipment = equipments.find(eq => eq.id === equipmentId);
        return equipment ? equipment.name : '-';
    };

    const columns = [
        { header: '작업지시번호', accessor: 'order_code' },
        { header: '제품', render: (row) => getProductName(row.product_id) },
        { header: '설비', render: (row) => getEquipmentName(row.equipment_id) },
        {
            header: '진행률',
            render: (row) => {
                const progress = row.target_quantity > 0
                    ? ((row.produced_quantity / row.target_quantity) * 100).toFixed(0)
                    : 0;
                return (
                    <div>
                        <span style={{ fontWeight: 'bold' }}>{row.produced_quantity}</span> / {row.target_quantity}
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                            ({progress}%)
                        </span>
                    </div>
                );
            }
        },
        { header: '지시일', accessor: 'order_date' },
        {
            header: '상태',
            accessor: 'status',
            render: (row) => (
                <span className={`status-badge ${row.status === '진행중' ? 'status-active' :
                    row.status === '완료' ? 'status-success' :
                        row.status === '취소' ? 'status-danger' : 'status-warning'
                    }`}>
                    {row.status}
                </span>
            )
        },
    ];

    const handleSubmit = async () => {
        if (!formData.product_id || !formData.equipment_id) {
            return alert('제품과 설비를 선택해주세요.');
        }
        if (formData.target_quantity <= 0) {
            return alert('목표 수량을 입력해주세요.');
        }

        await addWorkOrder(formData);
        resetForm();
    };

    const handleStart = async (order) => {
        if (!confirm(`${getProductName(order.product_id)} 작업을 시작하시겠습니까?`)) return;
        await startWork(order.id);
    };

    const handleComplete = async (order) => {
        if (!confirm(`작업을 완료 처리하시겠습니까?`)) return;
        await completeWork(order.id);
    };

    const handleCancel = async (order) => {
        if (!confirm('작업을 취소하시겠습니까?')) return;
        await updateWorkOrder(order.id, { status: '취소' });
    };

    const openUpdateModal = (order) => {
        setCurrentOrder(order);
        setUpdateData({ produced_quantity: order.produced_quantity });
        setIsUpdateModalOpen(true);
    };

    const handleUpdateQuantity = async () => {
        if (!currentOrder) return;
        await updateWorkOrder(currentOrder.id, { produced_quantity: updateData.produced_quantity });
        setIsUpdateModalOpen(false);
        setCurrentOrder(null);
    };

    const handleEdit = (order) => {
        setIsEditing(true);
        setCurrentOrder(order);
        setFormData({
            product_id: order.product_id,
            equipment_id: order.equipment_id,
            target_quantity: order.target_quantity,
            order_date: order.order_date,
            notes: order.notes || ''
        });
        setIsModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!currentOrder) return;
        if (!formData.product_id || !formData.equipment_id) {
            return alert('제품과 설비를 선택해주세요.');
        }
        if (formData.target_quantity <= 0) {
            return alert('목표 수량을 입력해주세요.');
        }

        await updateWorkOrder(currentOrder.id, formData);
        resetForm();
    };

    const resetForm = () => {
        setFormData({
            product_id: '',
            equipment_id: '',
            target_quantity: 100,
            order_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setIsModalOpen(false);
        setIsEditing(false);
        setCurrentOrder(null);
    };

    // === 이력 조회 기능 ===
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [historyOrder, setHistoryOrder] = useState(null);
    const [historyTab, setHistoryTab] = useState('equipment');

    const openHistory = (order) => {
        setHistoryOrder(order);
        setHistoryTab('equipment');
        setIsHistoryOpen(true);
    };

    // 이력 데이터 계산
    const historyData = useMemo(() => {
        if (!historyOrder) return null;

        const productName = getProductName(historyOrder.product_id);
        const equipmentName = getEquipmentName(historyOrder.equipment_id);

        // 금형 자동 매칭 (제품명과 일치하는 금형 찾기)
        const matchedMold = molds.find(m => m.name === productName || m.name?.includes(productName) || productName?.includes(m.name));

        // 설비 점검/수리 이력
        const equipHistory = (eqHistory || [])
            .filter(h => h.equipment_id === historyOrder.equipment_id)
            .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
            .slice(0, 10);

        // 금형 수리 이력
        const moldRepairHist = matchedMold
            ? (repairHistory || [])
                .filter(h => h.mold_id === matchedMold.id)
                .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
                .slice(0, 10)
            : [];

        // 금형 출입고 이력
        const moldMoveHist = matchedMold
            ? (moldMovement || [])
                .filter(m => m.mold_id === matchedMold.id)
                .sort((a, b) => new Date(b.outgoing_date || b.created_at) - new Date(a.outgoing_date || a.created_at))
                .slice(0, 10)
            : [];

        // 과거 작업지시 이력 (같은 설비)
        const pastOrders = workOrders
            .filter(wo => wo.id !== historyOrder.id && wo.equipment_id === historyOrder.equipment_id && (wo.status === '완료' || wo.status === '진행중'))
            .sort((a, b) => new Date(b.order_date) - new Date(a.order_date))
            .slice(0, 10);

        return { productName, equipmentName, matchedMold, equipHistory, moldRepairHist, moldMoveHist, pastOrders };
    }, [historyOrder, molds, eqHistory, repairHistory, moldMovement, workOrders]);

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">작업지시 관리</h2>
                    <p className="page-description">설비별 생산 작업지시를 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={workOrders || []}
                        columns={[
                            { key: 'order_code', label: '지시번호' },
                            { key: 'product_id', label: '제품ID' },
                            { key: 'equipment_id', label: '설비ID' },
                            { key: 'target_quantity', label: '목표수량', format: (v) => parseFloat(v || 0) },
                            { key: 'produced_quantity', label: '생산수량', format: (v) => parseFloat(v || 0) },
                            { key: 'status', label: '상태' },
                            { key: 'order_date', label: '지시일' },
                            { key: 'start_time', label: '시작' },
                            { key: 'end_time', label: '완료' },
                            { key: 'notes', label: '비고' }
                        ]}
                        fileName="작업지시내역"
                    />
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} /> 작업지시 생성
                    </button>
                </div>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">전체 지시</span>
                    <span className="value">{workOrders.length}건</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">진행중</span>
                    <span className="value" style={{ color: 'var(--success)' }}>
                        {workOrders.filter(wo => wo.status === '진행중').length}건
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">대기</span>
                    <span className="value" style={{ color: 'var(--warning)' }}>
                        {workOrders.filter(wo => wo.status === '대기').length}건
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">완료</span>
                    <span className="value" style={{ color: 'var(--text-muted)' }}>
                        {workOrders.filter(wo => wo.status === '완료').length}건
                    </span>
                </div>
            </div>

            <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                {['전체', '대기', '진행중', '완료', '취소'].map(status => (
                    <button
                        key={status}
                        className={`filter-btn ${filterStatus === status ? 'active' : ''}`}
                        onClick={() => setFilterStatus(status)}
                    >
                        {status}
                    </button>
                ))}
            </div>

            <Table
                columns={columns}
                data={filteredOrders || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {/* 이력 조회 */}
                        <button className="icon-btn" onClick={() => openHistory(row)} title="금형/설비 이력 조회"
                            style={{ color: '#6366f1' }}>
                            <FileText size={16} />
                        </button>

                        {/* Edit 버튼 (완료/취소 아닌 경우) */}
                        {row.status !== '완료' && row.status !== '취소' && (
                            <button className="icon-btn" onClick={() => handleEdit(row)} title="작업지시 수정">
                                <Edit size={16} />
                            </button>
                        )}

                        {row.status === '대기' && (
                            <button className="icon-btn" onClick={() => handleStart(row)} title="작업 시작">
                                <Play size={16} />
                            </button>
                        )}
                        {row.status === '진행중' && (
                            <>
                                <button
                                    className="icon-btn"
                                    onClick={() => openUpdateModal(row)}
                                    title="생산 수량 업데이트"
                                    style={{ color: 'var(--primary)' }}
                                >
                                    {row.produced_quantity}/{row.target_quantity}
                                </button>
                                <button className="icon-btn" onClick={() => handleComplete(row)} title="작업 완료">
                                    <CheckCircle size={16} />
                                </button>
                            </>
                        )}
                        {(row.status === '대기' || row.status === '진행중') && (
                            <button className="icon-btn delete-btn" onClick={() => handleCancel(row)} title="취소">
                                <XCircle size={16} />
                            </button>
                        )}
                    </div>
                )}
            />

            {/* Add/Edit Work Order Modal */}
            <Modal
                title={isEditing ? "작업지시 수정" : "작업지시 생성"}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                <div className="form-group">
                    <label className="form-label">제품 *</label>
                    <select
                        className="form-input"
                        value={formData.product_id}
                        onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                    >
                        <option value="">제품 선택</option>
                        {products.filter(p => p.status === '생산중').map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">설비 *</label>
                    <select
                        className="form-input"
                        value={formData.equipment_id}
                        onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                    >
                        <option value="">설비 선택</option>
                        {equipments.filter(eq => eq.status === '대기').map(eq => (
                            <option key={eq.id} value={eq.id}>{eq.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">목표 수량</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.target_quantity}
                        onChange={(e) => setFormData({ ...formData, target_quantity: parseInt(e.target.value) || 0 })}
                        min="1"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">지시일</label>
                    <input
                        type="date"
                        className="form-input"
                        value={formData.order_date}
                        onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    />
                </div>
                {formData.product_id && formData.target_quantity > 0 && (() => {
                    const product = products.find(p => p.id === formData.product_id);
                    if (!product || (!product.product_weight && !product.runner_weight)) return null;

                    const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                    const totalMaterial = (shotWeight * formData.target_quantity) / 1000; // g to kg

                    return (
                        <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #86efac' }}>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                필요 원재료
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>1 Shot:</span>{' '}
                                    <strong>{shotWeight.toFixed(1)}g</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)' }}>총 소요:</span>{' '}
                                    <strong style={{ color: '#16a34a', fontSize: '1rem' }}>{totalMaterial.toFixed(2)}kg</strong>
                                </div>
                            </div>
                        </div>
                    );
                })()}
                <div className="form-group">
                    <label className="form-label">비고</label>
                    <textarea
                        className="form-input"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="3"
                        placeholder="특이사항 입력"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button
                        className="btn-submit"
                        onClick={isEditing ? handleSaveEdit : handleSubmit}
                    >
                        {isEditing ? '수정' : '생성'}
                    </button>
                </div>
            </Modal>

            {/* Update Quantity Modal */}
            <Modal title="생산 수량 업데이트" isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)}>
                {currentOrder && (
                    <>
                        <div style={{ marginBottom: '1rem', padding: '1rem', background: '#eff6ff', borderRadius: '8px' }}>
                            <div style={{ marginBottom: '0.5rem' }}>
                                <strong>제품:</strong> {getProductName(currentOrder.product_id)}
                            </div>
                            <div>
                                <strong>목표:</strong> {currentOrder.target_quantity}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">현재 생산 수량</label>
                            <input
                                type="number"
                                className="form-input"
                                value={updateData.produced_quantity}
                                onChange={(e) => setUpdateData({ produced_quantity: parseInt(e.target.value) || 0 })}
                                min="0"
                                max={currentOrder.target_quantity}
                            />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsUpdateModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={handleUpdateQuantity}>업데이트</button>
                        </div>
                    </>
                )}
            </Modal>

            {/* 이력 조회 Modal */}
            <Modal
                title={historyData ? `📋 이력 조회 - ${historyData.productName}` : '이력 조회'}
                isOpen={isHistoryOpen}
                onClose={() => { setIsHistoryOpen(false); setHistoryOrder(null); }}
            >
                {historyData && (
                    <div>
                        {/* 요약 헤더 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '1rem' }}>
                            <div style={{ padding: '10px 14px', background: '#eff6ff', borderRadius: '8px', fontSize: '0.85rem' }}>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '2px' }}>설비</div>
                                <div style={{ fontWeight: 700, color: '#1e40af' }}>{historyData.equipmentName}</div>
                            </div>
                            <div style={{ padding: '10px 14px', background: '#faf5ff', borderRadius: '8px', fontSize: '0.85rem' }}>
                                <div style={{ color: '#64748b', fontSize: '0.75rem', marginBottom: '2px' }}>금형</div>
                                <div style={{ fontWeight: 700, color: '#7c3aed' }}>
                                    {historyData.matchedMold ? `${historyData.matchedMold.name} (${historyData.matchedMold.cycle_count?.toLocaleString() || 0}타)` : '매칭 금형 없음'}
                                </div>
                            </div>
                        </div>

                        {/* 탭 */}
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {[
                                { key: 'equipment', label: '설비 이력', icon: <Wrench size={13} />, count: historyData.equipHistory.length },
                                { key: 'mold', label: '금형 이력', icon: <PenTool size={13} />, count: historyData.moldRepairHist.length },
                                { key: 'movement', label: '출입고', icon: <Truck size={13} />, count: historyData.moldMoveHist.length },
                                { key: 'orders', label: '과거 작업', icon: <ClipboardList size={13} />, count: historyData.pastOrders.length },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setHistoryTab(tab.key)}
                                    style={{
                                        padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                                        display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer',
                                        background: historyTab === tab.key ? '#4f46e5' : '#f1f5f9',
                                        color: historyTab === tab.key ? 'white' : '#64748b',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {tab.icon} {tab.label} ({tab.count})
                                </button>
                            ))}
                        </div>

                        {/* 설비 이력 탭 */}
                        {historyTab === 'equipment' && (
                            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                {historyData.equipHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>설비 이력이 없습니다.</div>
                                ) : historyData.equipHistory.map((h, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: i % 2 === 0 ? '#f8fafc' : 'white', borderRadius: '8px', marginBottom: '4px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                                background: h.type === '정기점검' ? '#dbeafe' : h.type === '고장수리' ? '#fee2e2' : '#e0e7ff',
                                                color: h.type === '정기점검' ? '#1d4ed8' : h.type === '고장수리' ? '#dc2626' : '#4338ca'
                                            }}>{h.type}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{h.date || h.created_at?.split('T')[0]}</span>
                                        </div>
                                        <div style={{ color: '#334155' }}>{h.note || h.notes || '-'}</div>
                                        {h.worker && <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>작업자: {h.worker}</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 금형 이력 탭 */}
                        {historyTab === 'mold' && (
                            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                {!historyData.matchedMold ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>매칭되는 금형이 없습니다.</div>
                                ) : historyData.moldRepairHist.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>금형 수리/점검 이력이 없습니다.</div>
                                ) : historyData.moldRepairHist.map((h, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: i % 2 === 0 ? '#faf5ff' : 'white', borderRadius: '8px', marginBottom: '4px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                                background: h.type === '정기점검' ? '#dbeafe' : '#fce7f3',
                                                color: h.type === '정기점검' ? '#1d4ed8' : '#be185d'
                                            }}>{h.type}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{h.date || h.created_at?.split('T')[0]}</span>
                                        </div>
                                        <div style={{ color: '#334155' }}>{h.note || '-'}</div>
                                        {h.cost > 0 && <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>비용: {Number(h.cost).toLocaleString()}원</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 금형 출입고 탭 */}
                        {historyTab === 'movement' && (
                            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                {!historyData.matchedMold ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>매칭되는 금형이 없습니다.</div>
                                ) : historyData.moldMoveHist.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>출입고 이력이 없습니다.</div>
                                ) : historyData.moldMoveHist.map((m, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: i % 2 === 0 ? '#fffbeb' : 'white', borderRadius: '8px', marginBottom: '4px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                                background: m.status === '출고중' ? '#fef3c7' : '#d1fae5',
                                                color: m.status === '출고중' ? '#b45309' : '#047857'
                                            }}>{m.status || '출고'}</span>
                                            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                                                {m.outgoing_date} {m.incoming_date ? `→ ${m.incoming_date}` : ''}
                                            </span>
                                        </div>
                                        <div style={{ color: '#334155' }}>
                                            {m.destination && <span>행선지: {m.destination}</span>}
                                            {m.repair_vendor && <span> | 업체: {m.repair_vendor}</span>}
                                        </div>
                                        {m.outgoing_reason && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>사유: {m.outgoing_reason}</div>}
                                        {m.repair_result && <div style={{ fontSize: '0.78rem', color: '#059669', fontWeight: 600, marginTop: '2px' }}>수리결과: {m.repair_result}</div>}
                                        {m.actual_cost > 0 && <div style={{ fontSize: '0.78rem', color: '#059669', marginTop: '2px' }}>비용: {Number(m.actual_cost).toLocaleString()}원</div>}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 과거 작업 탭 */}
                        {historyTab === 'orders' && (
                            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                                {historyData.pastOrders.length === 0 ? (
                                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem', fontSize: '0.9rem' }}>과거 작업 이력이 없습니다.</div>
                                ) : historyData.pastOrders.map((wo, i) => (
                                    <div key={i} style={{ padding: '10px 14px', background: i % 2 === 0 ? '#f0fdf4' : 'white', borderRadius: '8px', marginBottom: '4px', fontSize: '0.85rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: 700, color: '#1e293b' }}>{getProductName(wo.product_id)}</span>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700,
                                                background: wo.status === '완료' ? '#dcfce7' : '#dbeafe',
                                                color: wo.status === '완료' ? '#166534' : '#1d4ed8'
                                            }}>{wo.status}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                                            <span>수량: {wo.produced_quantity}/{wo.target_quantity}
                                                ({wo.target_quantity > 0 ? Math.round((wo.produced_quantity / wo.target_quantity) * 100) : 0}%)
                                            </span>
                                            <span>{wo.order_date}</span>
                                        </div>
                                        {wo.notes && <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{wo.notes}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .stats-row { display: flex; gap: 1rem; margin-bottom: 2rem; }
                .simple-stat { padding: 1rem 1.5rem; display: flex; flex-direction: column; flex: 1; }
                .simple-stat .label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
                .simple-stat .value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                .delete-btn:hover { color: var(--danger); }
                .filter-btn { padding: 0.5rem 1rem; border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); transition: all 0.2s; border: 1px solid var(--border); }
                .filter-btn:hover { background: var(--bg-main); }
                .filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }
                .status-success { background: #dcfce7; color: #166534; }
            `}</style>
        </div>
    );
};

export default WorkOrders;
