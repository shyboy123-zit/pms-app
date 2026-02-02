import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Package, TrendingUp, TrendingDown } from 'lucide-react';
import { useData } from '../context/DataContext';

const Delivery = () => {
    const {
        inventoryTransactions,
        products,
        addInventoryTransaction,
        addSalesRecord
    } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [transactionType, setTransactionType] = useState('출고'); // '입고' or '출고'
    const [formData, setFormData] = useState({
        product_id: '',
        client_name: '',
        quantity: 0,
        unit_price: 0,
        transaction_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const columns = [
        {
            header: '유형',
            accessor: 'type',
            render: (row) => (
                <span className={`type-badge ${row.type === '입고' ? 'type-in' : 'type-out'}`}>
                    {row.type === '입고' ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
                    {row.type}
                </span>
            )
        },
        { header: '거래일', accessor: 'transaction_date' },
        {
            header: '품목',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                return product ? product.name : row.item_name || '-';
            }
        },
        { header: '거래처', accessor: 'client_name' },
        {
            header: '수량',
            accessor: 'quantity',
            render: (row) => `${row.quantity.toLocaleString()}개`
        },
        {
            header: '단가',
            accessor: 'unit_price',
            render: (row) => row.unit_price ? `₩${row.unit_price.toLocaleString()}` : '-'
        },
        {
            header: '합계',
            render: (row) => {
                const total = (row.quantity || 0) * (row.unit_price || 0);
                return total > 0 ? `₩${total.toLocaleString()}` : '-';
            }
        },
    ];

    const handleSubmit = async () => {
        if (!formData.product_id && transactionType === '출고') {
            return alert('제품을 선택해주세요.');
        }
        if (!formData.client_name) {
            return alert('거래처를 입력해주세요.');
        }
        if (!formData.quantity || formData.quantity <= 0) {
            return alert('수량을 입력해주세요.');
        }

        const product = products.find(p => p.id === formData.product_id);

        const transaction = {
            type: transactionType,
            product_id: transactionType === '출고' ? formData.product_id : null,
            item_name: transactionType === '입고' ? formData.client_name + ' 입고' : (product ? product.name : ''),
            client_name: formData.client_name,
            quantity: formData.quantity,
            unit_price: formData.unit_price || 0,
            transaction_date: formData.transaction_date,
            notes: formData.notes
        };

        await addInventoryTransaction(transaction);

        // 출고인 경우 매출 자동 등록
        if (transactionType === '출고') {
            const salesRecord = {
                date: formData.transaction_date,
                client: formData.client_name,
                item: product ? product.name : '',
                amount: formData.quantity * (formData.unit_price || 0),
                type: '매출',
                notes: `[자동] ${product ? product.name : ''} ${formData.quantity}개 출고`
            };
            await addSalesRecord(salesRecord);
        }

        resetForm();
    };

    const resetForm = () => {
        setFormData({
            product_id: '',
            client_name: '',
            quantity: 0,
            unit_price: 0,
            transaction_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setIsModalOpen(false);
    };

    const openModal = (type) => {
        setTransactionType(type);
        setIsModalOpen(true);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">입출고 관리</h2>
                    <p className="page-description">제품 입고 및 납품 출고를 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn-in" onClick={() => openModal('입고')}>
                        <TrendingDown size={18} /> 입고 등록
                    </button>
                    <button className="btn-out" onClick={() => openModal('출고')}>
                        <TrendingUp size={18} /> 출고 등록
                    </button>
                </div>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">총 거래</span>
                    <span className="value">{inventoryTransactions.length}건</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">입고</span>
                    <span className="value" style={{ color: '#3b82f6' }}>
                        {inventoryTransactions.filter(t => t.type === '입고').length}건
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">출고</span>
                    <span className="value" style={{ color: '#10b981' }}>
                        {inventoryTransactions.filter(t => t.type === '출고').length}건
                    </span>
                </div>
            </div>

            <Table
                columns={columns}
                data={inventoryTransactions || []}
            />

            <Modal
                title={transactionType === '입고' ? '입고 등록' : '출고 등록'}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                {transactionType === '출고' && (
                    <div className="form-group">
                        <label className="form-label">제품 선택 *</label>
                        <select
                            className="form-input"
                            value={formData.product_id}
                            onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                        >
                            <option value="">제품 선택</option>
                            {products.filter(p => p.status === '생산중').map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.name} ({p.model || '규격 없음'})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">거래처 *</label>
                    <input
                        className="form-input"
                        value={formData.client_name}
                        onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                        placeholder="거래처명 입력"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">수량 *</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 0 })}
                        min="1"
                        placeholder="수량"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">단가 (원)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.unit_price}
                        onChange={(e) => setFormData({ ...formData, unit_price: parseInt(e.target.value) || 0 })}
                        min="0"
                        placeholder="단가"
                    />
                </div>

                {formData.quantity > 0 && formData.unit_price > 0 && (
                    <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #86efac' }}>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>총 금액</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#16a34a' }}>
                            ₩{(formData.quantity * formData.unit_price).toLocaleString()}
                        </div>
                    </div>
                )}

                <div className="form-group">
                    <label className="form-label">거래일</label>
                    <input
                        type="date"
                        className="form-input"
                        value={formData.transaction_date}
                        onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">비고</label>
                    <textarea
                        className="form-input"
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="2"
                        placeholder="특이사항 입력"
                    />
                </div>

                {transactionType === '출고' && (
                    <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: '#1e40af', fontWeight: '600' }}>
                            💡 출고 등록 시 매출에 자동으로 등록됩니다.
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSubmit}>등록</button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1.5rem; max-width: 1600px; margin: 0 auto; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
                .page-subtitle { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .page-description { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; }
                .btn-in { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 0.65rem 1.3rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.2); transition: all 0.2s; }
                .btn-in:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.3); }
                .btn-out { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 0.65rem 1.3rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.2); transition: all 0.2s; }
                .btn-out:hover { transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); }
                .stats-row { display: flex; gap: 1rem; margin-bottom: 2rem; }
                .simple-stat { padding: 1rem 1.5rem; display: flex; flex-direction: column; flex: 1; }
                .simple-stat .label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
                .simple-stat .value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
                .type-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.8125rem; font-weight: 600; }
                .type-in { background: #dbeafe; color: #1e40af; }
                .type-out { background: #d1fae5; color: #065f46; }
            `}</style>
        </div>
    );
};

export default Delivery;
