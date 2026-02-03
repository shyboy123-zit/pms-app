import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Play, CheckCircle, XCircle, Edit } from 'lucide-react';
import { useData } from '../context/DataContext';

const WorkOrders = () => {
    const {
        workOrders, products, equipments,
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

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">작업지시 관리</h2>
                    <p className="page-description">설비별 생산 작업지시를 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 작업지시 생성
                </button>
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
