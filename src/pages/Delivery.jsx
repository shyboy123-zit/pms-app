import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Truck, CheckCircle } from 'lucide-react';

const Delivery = () => {
    const [deliveries, setDeliveries] = useState([
        { id: 'DEL-001', client: '현대자동차', product: 'Bumper Case A', quantity: 500, date: '2023-11-01', status: '배송중' },
        { id: 'DEL-002', client: 'LG전자', product: 'Cover Back', quantity: 1200, date: '2023-11-02', status: '준비중' },
        { id: 'DEL-003', client: '삼성전자', product: 'Frame Metal', quantity: 300, date: '2023-10-28', status: '완료' },
    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newItem, setNewItem] = useState({ client: '', product: '', quantity: 0, date: '', status: '준비중' });

    const columns = [
        { header: '배송ID', accessor: 'id' },
        { header: '고객사', accessor: 'client' },
        { header: '품목', accessor: 'product' },
        { header: '수량', accessor: 'quantity', render: (row) => row.quantity.toLocaleString() },
        { header: '납품일자', accessor: 'date' },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '완료' ? 'status-active' :
                        row.status === '배송중' ? 'status-warning' : 'status-danger'
                    }`} style={{ background: row.status === '준비중' ? '#e2e8f0' : undefined, color: row.status === '준비중' ? '#475569' : undefined }}>
                    {row.status}
                </span>
            )
        },
    ];

    const handleSave = () => {
        if (!newItem.client || !newItem.product) return alert('필수 항목을 입력하세요.');

        const newId = `DEL-00${deliveries.length + 10}`;
        const itemToAdd = {
            id: newId,
            ...newItem
        };

        setDeliveries([...deliveries, itemToAdd]);
        setIsModalOpen(false);
        setNewItem({ client: '', product: '', quantity: 0, date: '', status: '준비중' });
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">납품 관리</h2>
                    <p className="page-description">고객사 납품 일정 및 배송 현황을 모니터링합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Truck size={18} /> 배송 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={deliveries}
                actions={(row) => (
                    row.status !== '완료' && (
                        <button className="icon-btn" title="배송 완료 처리">
                            <CheckCircle size={16} />
                        </button>
                    )
                )}
            />

            <Modal title="신규 배송 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">고객사</label>
                    <input className="form-input" value={newItem.client} onChange={(e) => setNewItem({ ...newItem, client: e.target.value })} placeholder="고객사명" />
                </div>
                <div className="form-group">
                    <label className="form-label">품목</label>
                    <input className="form-input" value={newItem.product} onChange={(e) => setNewItem({ ...newItem, product: e.target.value })} placeholder="배송 품목" />
                </div>
                <div className="form-group">
                    <label className="form-label">수량</label>
                    <input type="number" className="form-input" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                    <label className="form-label">납품 예정일</label>
                    <input type="date" className="form-input" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">상태</label>
                    <select className="form-input" value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
                        <option value="준비중">준비중</option>
                        <option value="배송중">배송중</option>
                        <option value="완료">완료</option>
                    </select>
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>저장</button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--success); }
            `}</style>
        </div>
    );
};

export default Delivery;
