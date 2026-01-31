import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { DollarSign, Download, Upload } from 'lucide-react';

const Sales = () => {
    const [transactions, setTransactions] = useState([
        { id: 'TR-001', type: '매출', partner: '현대자동차', item: '납품 대금', amount: 45000000, date: '2023-11-01' },
        { id: 'TR-002', type: '매입', partner: 'LG화학', item: 'ABS Resin 500kg', amount: -2500000, date: '2023-11-02' },
        { id: 'TR-003', type: '매출', partner: '삼성전자', item: '납품 대금', amount: 12000000, date: '2023-10-28' },
        { id: 'TR-004', type: '지출', partner: '한전', item: '10월 전기세', amount: -850000, date: '2023-10-31' },
    ]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transType, setTransType] = useState('매출'); // '매출' or '매입'
    const [newItem, setNewItem] = useState({ partner: '', item: '', amount: 0, date: '' });

    const columns = [
        { header: '거래일자', accessor: 'date' },
        {
            header: '구분', accessor: 'type', render: (row) => (
                <span style={{
                    fontWeight: 600,
                    color: row.type === '매출' ? 'var(--primary)' : 'var(--danger)'
                }}>
                    {row.type}
                </span>
            )
        },
        { header: '거래처/대상', accessor: 'partner' },
        { header: '항목', accessor: 'item' },
        {
            header: '금액', accessor: 'amount', render: (row) => (
                <span style={{
                    fontWeight: 700,
                    color: row.amount > 0 ? 'var(--text-main)' : 'var(--danger)'
                }}>
                    {row.amount > 0 ? '+' : ''}{row.amount.toLocaleString()}원
                </span>
            )
        },
    ];

    const openModal = (type) => {
        setTransType(type);
        setNewItem({ partner: '', item: '', amount: 0, date: '' });
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!newItem.item || !newItem.amount) return alert('항목과 금액을 입력해주세요.');

        const finalAmount = transType === '매출'
            ? Math.abs(newItem.amount)
            : -Math.abs(newItem.amount);

        const newId = `TR-00${transactions.length + 5}`;
        const itemToAdd = {
            id: newId,
            type: transType === '매입' ? '매입' : '매출', // Simplified logic. Could be '지출' too. using '매입' for negative generic here or strictly from button.
            // Actually let's just stick to what the button implies. 
            // If user clicked Purchase/Expense -> Type is Purchase/Expense (Logic can be refined)
            // For now let's just use the 'transType' state which is '매출' or '매입/지출'
            ...newItem,
            amount: finalAmount
        };
        // Fix type label if needed
        itemToAdd.type = transType;

        setTransactions([itemToAdd, ...transactions]);
        setIsModalOpen(false);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">매입 매출 관리</h2>
                    <p className="page-description">회사의 자금 흐름과 거래 내역을 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-secondary" onClick={() => openModal('매입')}>
                        <Upload size={18} /> 매입/지출 등록
                    </button>
                    <button className="btn-primary" onClick={() => openModal('매출')}>
                        <Download size={18} /> 매출 등록
                    </button>
                </div>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">이번 달 총 매출</span>
                    <span className="value" style={{ color: 'var(--primary)' }}>+57,000,000원</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">이번 달 총 지출</span>
                    <span className="value" style={{ color: 'var(--danger)' }}>-3,350,000원</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">순수익</span>
                    <span className="value">+53,650,000원</span>
                </div>
            </div>

            <Table columns={columns} data={transactions} />

            <Modal title={transType === '매출' ? '매출 등록' : '매입/지출 등록'} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">거래 일자</label>
                    <input type="date" className="form-input" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">거래처 / 대상</label>
                    <input className="form-input" value={newItem.partner} onChange={(e) => setNewItem({ ...newItem, partner: e.target.value })} placeholder="거래처명" />
                </div>
                <div className="form-group">
                    <label className="form-label">거래 항목</label>
                    <input className="form-input" value={newItem.item} onChange={(e) => setNewItem({ ...newItem, item: e.target.value })} placeholder="품목 또는 내역" />
                </div>
                <div className="form-group">
                    <label className="form-label">금액 (원)</label>
                    <input type="number" className="form-input" value={newItem.amount} onChange={(e) => setNewItem({ ...newItem, amount: parseInt(e.target.value) || 0 })} placeholder="금액 입력" />
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
                .btn-secondary { background: white; color: var(--text-main); border: 1px solid var(--border); padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .btn-secondary:hover { background: var(--bg-main); }
                .stats-row { display: flex; gap: 1rem; margin-bottom: 2rem; }
                .simple-stat { padding: 1rem 1.5rem; display: flex; flex-direction: column; flex: 1; }
                .simple-stat .label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
                .simple-stat .value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
            `}</style>
        </div>
    );
};

export default Sales;
