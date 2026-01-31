import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, ShoppingCart, AlertCircle, PlayCircle } from 'lucide-react';
import { useData } from '../context/DataContext';

const Materials = () => {
    const { materials, addMaterial } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
    const [orderItem, setOrderItem] = useState(null);

    const columns = [
        { header: '자재명', accessor: 'name' },
        { header: '유형', accessor: 'type' },
        {
            header: '현재재고', accessor: 'stock', render: (row) => (
                <span style={{ fontWeight: 600, color: row.stock < row.min_stock ? 'var(--danger)' : 'inherit' }}>
                    {row.stock.toLocaleString()} {row.unit}
                </span>
            )
        },
        { header: '안전재고', accessor: 'min_stock', render: (row) => `${row.min_stock} ${row.unit}` }, // DB min_stock
        { header: '공급사', accessor: 'supplier' },
    ];

    const handleSave = () => {
        if (!newItem.name) return alert('자재명을 입력해주세요.');

        const itemToAdd = {
            name: newItem.name,
            type: newItem.type,
            stock: newItem.stock,
            unit: newItem.unit,
            min_stock: newItem.minStock,
            supplier: newItem.supplier
        };
        addMaterial(itemToAdd);
        setIsModalOpen(false);
        setNewItem({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
    };

    const handleProductionInstruction = (row) => {
        setOrderItem({
            ...row,
            orderQuantity: row.min_stock - row.stock + 100
        });
        setIsOrderModalOpen(true);
    };

    const confirmOrder = () => {
        if (!orderItem) return;
        alert(`[긴급] '${orderItem.name}'에 대한 생산(발주) 지시가 내려졌습니다.\n수량: ${orderItem.orderQuantity} ${orderItem.unit}\n공급사: ${orderItem.supplier}`);
        setIsOrderModalOpen(false);
        setOrderItem(null);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">원재료 관리</h2>
                    <p className="page-description">자재 재고를 확인하고 안전재고 미달 시 긴급 발주를 지시합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 자재 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={materials || []}
                actions={(row) => (
                    row.stock < row.min_stock && (
                        <button className="alert-btn" onClick={() => handleProductionInstruction(row)}>
                            <AlertCircle size={16} /> 긴급 생산지시(발주)
                        </button>
                    )
                )}
            />

            <Modal title="신규 자재 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">자재명</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="자재 이름" />
                </div>
                <div className="form-group">
                    <label className="form-label">유형</label>
                    <select className="form-input" value={newItem.type} onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}>
                        <option value="플라스틱">플라스틱</option>
                        <option value="금속">금속</option>
                        <option value="도료">도료</option>
                        <option value="부자재">부자재</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">현재 재고</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input type="number" className="form-input" value={newItem.stock} onChange={(e) => setNewItem({ ...newItem, stock: parseInt(e.target.value) || 0 })} />
                        <select className="form-input" style={{ width: '80px' }} value={newItem.unit} onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}>
                            <option value="kg">kg</option>
                            <option value="ton">ton</option>
                            <option value="L">L</option>
                            <option value="EA">EA</option>
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">안전 재고 (최소)</label>
                    <input type="number" className="form-input" value={newItem.minStock} onChange={(e) => setNewItem({ ...newItem, minStock: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                    <label className="form-label">공급사</label>
                    <input className="form-input" value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>등록</button>
                </div>
            </Modal>

            <Modal title="생산(발주) 지시" isOpen={isOrderModalOpen} onClose={() => setIsOrderModalOpen(false)}>
                {orderItem && (
                    <>
                        <div className="alert-box">
                            <AlertCircle size={20} />
                            <span>
                                현재 재고({orderItem.stock}{orderItem.unit})가 안전재고({orderItem.min_stock}{orderItem.unit})보다 부족합니다.
                            </span>
                        </div>

                        <div className="form-group">
                            <label className="form-label">품목명</label>
                            <input className="form-input" value={orderItem.name} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">공급사</label>
                            <input className="form-input" value={orderItem.supplier} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">지시 수량</label>
                            <input
                                type="number"
                                className="form-input"
                                value={orderItem.orderQuantity}
                                onChange={(e) => setOrderItem({ ...orderItem, orderQuantity: parseInt(e.target.value) || 0 })}
                            />
                            <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                                추천 수량: 최소 {orderItem.min_stock - orderItem.stock} {orderItem.unit} 이상 필요
                            </p>
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsOrderModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={confirmOrder} style={{ background: 'var(--danger)' }}>
                                <PlayCircle size={16} style={{ marginRight: '0.5rem' }} />
                                지시 내리기
                            </button>
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
                .alert-btn { background: #fee2e2; color: var(--danger); border: 1px solid #fecaca; padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s; }
                .alert-btn:hover { background: #fecaca; }
                .alert-box { background: #fff1f2; border: 1px solid #fda4af; color: #be123c; padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-weight: 500; }
            `}</style>
        </div>
    );
};

export default Materials;
