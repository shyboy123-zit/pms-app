import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Check, X, Clock, ShoppingBag, Truck, AlertTriangle } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const Purchase = () => {
    const { purchaseRequests, addPurchaseRequest, updatePurchaseRequest, deletePurchaseRequest, suppliers } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({
        item_name: '',
        quantity: 0,
        unit: 'kg',
        reason: '',
        required_date: '',
        priority: '일반',
        supplier_id: '',
        notes: ''
    });

    // Helper to get supplier name
    const getSupplierName = (id) => suppliers.find(s => s.id === id)?.name || '-';

    const renderStatus = (status) => {
        switch (status) {
            case '대기': return <span className="status-badge status-pending"><Clock size={12} /> 승인대기</span>;
            case '승인됨': return <span className="status-badge status-approved"><Check size={12} /> 승인완료</span>;
            case '발주완료': return <span className="status-badge status-ordered"><ShoppingBag size={12} /> 발주완료</span>;
            case '입고완료': return <span className="status-badge status-received"><Truck size={12} /> 입고완료</span>;
            case '반려': return <span className="status-badge status-rejected"><X size={12} /> 반려</span>;
            default: return status;
        }
    };

    const columns = [
        { header: '요청일자', accessor: 'created_at', render: (row) => row.created_at?.split('T')[0] },
        {
            header: '품목명', accessor: 'item_name', render: (row) => (
                <div>
                    <div style={{ fontWeight: 600 }}>{row.item_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{getSupplierName(row.supplier_id)}</div>
                </div>
            )
        },
        { header: '수량', accessor: 'quantity', render: (row) => `${parseFloat(row.quantity).toLocaleString()} ${row.unit}` },
        {
            header: '우선순위', accessor: 'priority', render: (row) => (
                <span style={{ color: row.priority === '긴급' ? 'var(--danger)' : 'inherit', fontWeight: row.priority === '긴급' ? 700 : 400 }}>
                    {row.priority === '긴급' && <AlertTriangle size={14} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />}
                    {row.priority}
                </span>
            )
        },
        { header: '상태', accessor: 'status', render: (row) => renderStatus(row.status) },
        { header: '납기요청일', accessor: 'required_date' },
    ];

    const { logout, user } = useAuth(); // Get current user for requester_id

    const handleSubmit = async () => {
        if (!newItem.item_name || newItem.quantity <= 0) return alert('품목명과 수량을 정확히 입력해주세요.');

        const requestData = {
            ...newItem,
            requester_id: user?.id || null,
            supplier_id: newItem.supplier_id || null, // Convert "" to null for UUID field
            status: '대기',
            created_at: new Date().toISOString()
        };

        const { error } = await addPurchaseRequest(requestData);

        if (error) {
            console.error('Purchase request error:', error);
            alert('등록 실패: ' + (error.message || '데이터베이스 오류가 발생했습니다.'));
        } else {
            alert('구매 요청이 등록되었습니다.');
            resetForm();
        }
    };

    const resetForm = () => {
        setIsModalOpen(false);
        setNewItem({
            item_name: '',
            quantity: 0,
            unit: 'kg',
            reason: '',
            required_date: '',
            priority: '일반',
            supplier_id: '',
            notes: ''
        });
    };

    // Manager Actions
    const handleStatusChange = async (id, newStatus) => {
        if (window.confirm(`상태를 '${newStatus}'(으)로 변경하시겠습니까?`)) {
            await updatePurchaseRequest(id, { status: newStatus });
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('이 구매 요청을 삭제하시겠습니까?')) {
            await deletePurchaseRequest(id);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">구매 관리</h2>
                    <p className="page-description">자재 및 소모품 구매 요청과 발주 현황을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 구매 요청
                </button>
            </div>

            <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
                <div className="summary-card">
                    <div className="summary-title">승인 대기</div>
                    <div className="summary-value warning">{purchaseRequests.filter(r => r.status === '대기').length}건</div>
                </div>
                <div className="summary-card">
                    <div className="summary-title">발주 진행중</div>
                    <div className="summary-value primary">{purchaseRequests.filter(r => r.status === '승인됨' || r.status === '발주완료').length}건</div>
                </div>
                <div className="summary-card">
                    <div className="summary-title">금월 입고</div>
                    <div className="summary-value success">{purchaseRequests.filter(r => r.status === '입고완료').length}건</div>
                </div>
            </div>

            <Table
                columns={columns}
                data={purchaseRequests || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {row.status === '대기' && (
                            <>
                                <button className="action-btn btn-approve" onClick={() => handleStatusChange(row.id, '승인됨')} title="승인">
                                    승인
                                </button>
                                <button className="action-btn btn-reject" onClick={() => handleStatusChange(row.id, '반려')} title="반려">
                                    반려
                                </button>
                            </>
                        )}
                        {row.status === '승인됨' && (
                            <button className="action-btn btn-order" onClick={() => handleStatusChange(row.id, '발주완료')} title="발주처리">
                                발주
                            </button>
                        )}
                        {row.status === '발주완료' && (
                            <button className="action-btn btn-receive" onClick={() => handleStatusChange(row.id, '입고완료')} title="입고처리">
                                입고
                            </button>
                        )}
                        <button className="icon-btn" onClick={() => handleDelete(row.id)} title="삭제" style={{ color: 'var(--text-muted)' }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            />

            <Modal
                title="신규 구매 요청"
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                <div className="form-group">
                    <label className="form-label">품목명 <span style={{ color: 'red' }}>*</span></label>
                    <input
                        className="form-input"
                        value={newItem.item_name}
                        onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
                        placeholder="필요한 품목 이름"
                    />
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">수량 <span style={{ color: 'red' }}>*</span></label>
                        <input
                            type="number"
                            className="form-input"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="form-group" style={{ width: '100px' }}>
                        <label className="form-label">단위</label>
                        <select className="form-input" value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                            <option value="kg">kg</option>
                            <option value="EA">EA</option>
                            <option value="L">L</option>
                            <option value="set">set</option>
                            <option value="box">box</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">희망 거래처 (선택)</label>
                    <select className="form-input" value={newItem.supplier_id} onChange={(e) => setNewItem({ ...newItem, supplier_id: e.target.value })}>
                        <option value="">-- 선택 안함 --</option>
                        {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">납기 요청일</label>
                        <input
                            type="date"
                            className="form-input"
                            value={newItem.required_date}
                            onChange={(e) => setNewItem({ ...newItem, required_date: e.target.value })}
                        />
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label className="form-label">우선순위</label>
                        <select className="form-input" value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })}>
                            <option value="일반">일반</option>
                            <option value="긴급">🚨 긴급</option>
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">요청 사유 / 메모</label>
                    <textarea
                        className="form-input"
                        value={newItem.reason}
                        onChange={(e) => setNewItem({ ...newItem, reason: e.target.value })}
                        placeholder="구매가 필요한 이유 또는 상세 스펙"
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSubmit}>
                        요청 등록
                    </button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1.5rem; max-width: 1600px; margin: 0 auto; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
                .page-subtitle { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; color: var(--text-main); }
                .page-description { color: var(--text-muted); font-size: 0.875rem; }

                .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
                .summary-card { background: white; padding: 1.25rem; border-radius: 12px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .summary-title { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
                .summary-value { font-size: 1.5rem; font-weight: 700; }
                .warning { color: var(--warning); }
                .primary { color: var(--text-main); }
                .success { color: var(--success); }

                .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
                .status-pending { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
                .status-approved { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
                .status-ordered { background: #f3e8ff; color: #9333ea; border: 1px solid #d8b4fe; }
                .status-received { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
                .status-rejected { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }

                .action-btn { padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.2s; }
                .btn-approve { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
                .btn-approve:hover { background: #dbeafe; }
                .btn-reject { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
                .btn-reject:hover { background: #fee2e2; }
                .btn-order { background: #f3e8ff; color: #9333ea; border: 1px solid #d8b4fe; }
                .btn-order:hover { background: #e9d5ff; }
                .btn-receive { background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; }
                .btn-receive:hover { background: #d1fae5; }
            `}</style>
        </div>
    );
};

export default Purchase;
