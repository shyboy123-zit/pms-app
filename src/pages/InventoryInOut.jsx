import React, { useState, useEffect } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import DateRangePicker from '../components/DateRangePicker';
import { Package, TrendingUp, TrendingDown, Edit, Trash2, Plus } from 'lucide-react';
import { useData } from '../context/DataContext';

const InventoryInOut = () => {
    const {
        inventoryTransactions,
        products,
        addInventoryTransaction,
        updateInventoryTransaction,
        deleteInventoryTransaction,
        getTransactionsByDateRange,
        addSalesRecord
    } = useData();

    const [activeTab, setActiveTab] = useState('all'); // 'all', 'in', 'out', 'status'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filteredTransactions, setFilteredTransactions] = useState([]);

    const [newItem, setNewItem] = useState({
        transactionType: 'IN',
        productId: '',
        itemName: '',
        itemCode: '',
        quantity: 0,
        unit: 'EA',
        unitPrice: 0,
        transactionDate: new Date().toISOString().split('T')[0],
        client: '',
        notes: ''
    });

    // 제품 선택 시 정보 자동 적용
    const handleProductSelect = (productId) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setNewItem(prev => ({
                ...prev,
                productId: productId,
                itemName: product.name,
                itemCode: product.product_code || '',
                unitPrice: product.unit_price || 0,
                unit: product.unit || 'EA'
            }));
        } else {
            setNewItem(prev => ({
                ...prev,
                productId: '',
                itemName: '',
                itemCode: '',
                unitPrice: 0
            }));
        }
    };

    useEffect(() => {
        filterTransactions();
    }, [inventoryTransactions, activeTab, startDate, endDate]);

    const filterTransactions = () => {
        let filtered = inventoryTransactions || [];

        // Filter by tab
        if (activeTab === 'in') {
            filtered = filtered.filter(t => t.transaction_type === 'IN');
        } else if (activeTab === 'out') {
            filtered = filtered.filter(t => t.transaction_type === 'OUT');
        }

        // Filter by date range
        if (startDate) {
            filtered = filtered.filter(t => t.transaction_date >= startDate);
        }
        if (endDate) {
            filtered = filtered.filter(t => t.transaction_date <= endDate);
        }

        setFilteredTransactions(filtered);
    };

    const handleDateRangeApply = (start, end) => {
        setStartDate(start);
        setEndDate(end);
    };

    const columns = [
        { header: '일자', accessor: 'transaction_date', render: (row) => row.transaction_date },
        {
            header: '구분',
            accessor: 'transaction_type',
            render: (row) => (
                <span className={`type-badge ${row.transaction_type === 'IN' ? 'type-in' : 'type-out'}`}>
                    {row.transaction_type === 'IN' ? '입고' : '출고'}
                </span>
            )
        },
        { header: '품목코드', accessor: 'item_code', render: (row) => row.item_code || '-' },
        { header: '품목명', accessor: 'item_name' },
        {
            header: '수량',
            accessor: 'quantity',
            render: (row) => `${parseFloat(row.quantity).toLocaleString()} ${row.unit}`
        },
        {
            header: '단가',
            accessor: 'unit_price',
            render: (row) => `₩${parseFloat(row.unit_price).toLocaleString()}`
        },
        {
            header: '금액',
            accessor: 'total_amount',
            render: (row) => (
                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>
                    ₩{parseFloat(row.total_amount || 0).toLocaleString()}
                </span>
            )
        },
        { header: '거래처', accessor: 'client', render: (row) => row.client || '-' },
    ];

    const handleSave = async () => {
        if (!newItem.itemName || newItem.quantity <= 0) {
            return alert('품목명과 수량을 입력해주세요.');
        }

        const itemToSave = {
            transaction_type: newItem.transactionType,
            item_name: newItem.itemName,
            item_code: newItem.itemCode,
            quantity: parseFloat(newItem.quantity),
            unit: newItem.unit,
            unit_price: parseFloat(newItem.unitPrice),
            transaction_date: newItem.transactionDate,
            client: newItem.client,
            notes: newItem.notes
        };

        if (isEditMode && editingId) {
            await updateInventoryTransaction(editingId, itemToSave);
        } else {
            await addInventoryTransaction(itemToSave);

            // 매출/매입 기록 자동 등록
            if (addSalesRecord) {
                const salesRecord = {
                    date: newItem.transactionDate,
                    client: newItem.client,
                    item: newItem.itemName,
                    amount: parseFloat(newItem.quantity) * parseFloat(newItem.unitPrice),
                    type: newItem.transactionType === 'OUT' ? '매출' : '매입',
                    notes: `[자동] ${newItem.itemName} ${newItem.quantity}개 ${newItem.transactionType === 'OUT' ? '출고' : '입고'}`
                };
                await addSalesRecord(salesRecord);
            }
        }

        resetForm();
    };

    const handleEdit = (row) => {
        setNewItem({
            transactionType: row.transaction_type,
            itemName: row.item_name,
            itemCode: row.item_code || '',
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unit_price || 0,
            transactionDate: row.transaction_date,
            client: row.client || '',
            notes: row.notes || ''
        });
        setEditingId(row.id);
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (row) => {
        if (window.confirm(`'${row.item_name}' 거래 내역을 삭제하시겠습니까?`)) {
            await deleteInventoryTransaction(row.id);
        }
    };

    const resetForm = () => {
        setIsModalOpen(false);
        setIsEditMode(false);
        setEditingId(null);
        setNewItem({
            transactionType: 'IN',
            productId: '',
            itemName: '',
            itemCode: '',
            quantity: 0,
            unit: 'EA',
            unitPrice: 0,
            transactionDate: new Date().toISOString().split('T')[0],
            client: '',
            notes: ''
        });
    };

    // Calculate summary statistics
    const getTodayStats = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayTransactions = (inventoryTransactions || []).filter(
            t => t.transaction_date === today
        );

        const totalIn = todayTransactions
            .filter(t => t.transaction_type === 'IN')
            .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

        const totalOut = todayTransactions
            .filter(t => t.transaction_type === 'OUT')
            .reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);

        return { totalIn, totalOut, net: totalIn - totalOut };
    };

    const stats = getTodayStats();

    // 이번 달 매입/매출 합계
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthlyStats = (() => {
        const monthTxs = (inventoryTransactions || []).filter(t => (t.transaction_date || '').startsWith(currentMonth));
        const salesTotal = monthTxs.filter(t => t.transaction_type === 'OUT').reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
        const purchaseTotal = monthTxs.filter(t => t.transaction_type === 'IN').reduce((sum, t) => sum + parseFloat(t.total_amount || 0), 0);
        return { salesTotal, purchaseTotal };
    })();

    // Calculate current inventory status
    const getInventoryStatus = () => {
        const stockByItem = {};

        (inventoryTransactions || []).forEach(trans => {
            const key = trans.item_code || trans.item_name;
            if (!stockByItem[key]) {
                stockByItem[key] = {
                    itemName: trans.item_name,
                    itemCode: trans.item_code,
                    stock: 0,
                    unit: trans.unit,
                    lastPrice: trans.unit_price
                };
            }

            if (trans.transaction_type === 'IN') {
                stockByItem[key].stock += parseFloat(trans.quantity);
            } else {
                stockByItem[key].stock -= parseFloat(trans.quantity);
            }
            stockByItem[key].lastPrice = trans.unit_price;
        });

        return Object.values(stockByItem);
    };

    const inventoryStatus = getInventoryStatus();

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">입출고 관리</h2>
                    <p className="page-description">볼 조인트 베어링 제품의 입고/출고 현황을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 거래 등록
                </button>
            </div>

            {/* Summary Cards */}
            <div className="summary-cards">
                <div className="stat-card stat-in">
                    <div className="stat-icon">
                        <TrendingUp size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">금일 입고 금액</div>
                        <div className="stat-value">₩{stats.totalIn.toLocaleString()}</div>
                    </div>
                </div>
                <div className="stat-card stat-out">
                    <div className="stat-icon">
                        <TrendingDown size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">금일 출고 금액</div>
                        <div className="stat-value">₩{stats.totalOut.toLocaleString()}</div>
                    </div>
                </div>
                <div className="stat-card stat-net">
                    <div className="stat-icon">
                        <Package size={24} />
                    </div>
                    <div className="stat-content">
                        <div className="stat-label">금일 순변동</div>
                        <div className="stat-value" style={{ color: stats.net >= 0 ? '#059669' : '#dc2626' }}>
                            {stats.net >= 0 ? '+' : ''}₩{stats.net.toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>

            {/* 이번 달 매입/매출 합계 */}
            <div className="summary-cards" style={{ marginBottom: '0.5rem' }}>
                <div className="stat-card stat-in">
                    <div className="stat-icon"><TrendingUp size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-label">이번 달 총 매입 (입고)</div>
                        <div className="stat-value" style={{ color: '#2563eb' }}>₩{monthlyStats.purchaseTotal.toLocaleString()}</div>
                    </div>
                </div>
                <div className="stat-card stat-out">
                    <div className="stat-icon"><TrendingDown size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-label">이번 달 총 매출 (출고)</div>
                        <div className="stat-value" style={{ color: '#059669' }}>₩{monthlyStats.salesTotal.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="tabs">
                <button
                    className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                >
                    전체
                </button>
                <button
                    className={`tab ${activeTab === 'in' ? 'active' : ''}`}
                    onClick={() => setActiveTab('in')}
                >
                    입고
                </button>
                <button
                    className={`tab ${activeTab === 'out' ? 'active' : ''}`}
                    onClick={() => setActiveTab('out')}
                >
                    출고
                </button>
                <button
                    className={`tab ${activeTab === 'status' ? 'active' : ''}`}
                    onClick={() => setActiveTab('status')}
                >
                    재고현황
                </button>
            </div>

            {/* Date Range Filter */}
            {activeTab !== 'status' && (
                <DateRangePicker onApply={handleDateRangeApply} />
            )}

            {/* Transaction Table or Inventory Status */}
            {activeTab === 'status' ? (
                <div className="inventory-status-table">
                    <h3 className="section-title">현재 재고 현황</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>품목코드</th>
                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>품목명</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>재고수량</th>
                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>최근단가</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inventoryStatus.map((item, idx) => (
                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.75rem' }}>{item.itemCode || '-'}</td>
                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{item.itemName}</td>
                                    <td style={{
                                        padding: '0.75rem',
                                        textAlign: 'right',
                                        fontWeight: 600,
                                        color: item.stock > 0 ? '#059669' : item.stock < 0 ? '#dc2626' : '#64748b'
                                    }}>
                                        {parseFloat(item.stock).toLocaleString()} {item.unit}
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'right', color: '#64748b' }}>
                                        ₩{parseFloat(item.lastPrice || 0).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <Table
                    columns={columns}
                    data={filteredTransactions}
                    actions={(row) => (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="icon-btn" onClick={() => handleEdit(row)} title="수정">
                                <Edit size={16} />
                            </button>
                            <button className="icon-btn delete-btn" onClick={() => handleDelete(row)} title="삭제">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                />
            )}

            {/* Transaction Modal */}
            <Modal
                title={isEditMode ? '거래 수정' : '신규 거래 등록'}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                <div className="form-group">
                    <label className="form-label">거래 구분</label>
                    <select
                        className="form-input"
                        value={newItem.transactionType}
                        onChange={(e) => setNewItem({ ...newItem, transactionType: e.target.value })}
                    >
                        <option value="IN">입고</option>
                        <option value="OUT">출고</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">제품 선택 *</label>
                    <select
                        className="form-input"
                        value={newItem.productId}
                        onChange={(e) => handleProductSelect(e.target.value)}
                    >
                        <option value="">제품을 선택하세요</option>
                        {products.filter(p => p.status !== '단종').map(p => (
                            <option key={p.id} value={p.id}>
                                {p.product_code ? `[${p.product_code}] ` : ''}{p.name} ({p.model || '규격 없음'}) {p.unit_price ? `- ₩${Number(p.unit_price).toLocaleString()}` : ''}
                            </option>
                        ))}
                    </select>
                </div>
                {newItem.productId && (
                    <div style={{ padding: '0.6rem 0.75rem', background: '#f0f9ff', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bae6fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#0369a1', fontWeight: 600 }}>📦 {newItem.itemName}</span>
                        <span style={{ fontSize: '0.85rem', color: '#0ea5e9', fontWeight: 700 }}>단가: ₩{Number(newItem.unitPrice).toLocaleString()}</span>
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">수량 *</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })}
                        />
                        <select
                            className="form-input"
                            style={{ width: '100px' }}
                            value={newItem.unit}
                            onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                        >
                            <option value="EA">EA</option>
                            <option value="Box">Box</option>
                            <option value="Set">Set</option>
                            <option value="Pallet">Pallet</option>
                        </select>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">단가</label>
                    <input
                        type="number"
                        className="form-input"
                        value={newItem.unitPrice}
                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                        placeholder="0"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">총 금액</label>
                    <input
                        className="form-input"
                        value={`₩${(newItem.quantity * newItem.unitPrice).toLocaleString()}`}
                        disabled
                        style={{ background: '#f8fafc', fontWeight: 600 }}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">거래일자</label>
                    <input
                        type="date"
                        className="form-input"
                        value={newItem.transactionDate}
                        onChange={(e) => setNewItem({ ...newItem, transactionDate: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">거래처</label>
                    <input
                        className="form-input"
                        value={newItem.client}
                        onChange={(e) => setNewItem({ ...newItem, client: e.target.value })}
                        placeholder="공급사 또는 고객사"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">비고</label>
                    <textarea
                        className="form-input"
                        value={newItem.notes}
                        onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                        rows="2"
                        placeholder="메모사항"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>
                        {isEditMode ? '수정' : '등록'}
                    </button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; transition: all 0.2s; }
                .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }

                .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
                .stat-card { background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; gap: 1rem; align-items: center; }
                .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .stat-in .stat-icon { background: #dcfce7; color: #059669; }
                .stat-out .stat-icon { background: #fee2e2; color: #dc2626; }
                .stat-net .stat-icon { background: #dbeafe; color: #2563eb; }
                .stat-label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.25rem; }
                .stat-value { font-size: 1.5rem; font-weight: 700; }

                .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; background: white; padding: 0.5rem; border-radius: var(--radius-md); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .tab { padding: 0.75rem 1.5rem; border-radius: var(--radius-sm); font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
                .tab:hover { background: #f1f5f9; color: var(--text-main); }
                .tab.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3); }

                .type-badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
                .type-in { background: #dcfce7; color: #059669; }
                .type-out { background: #fee2e2; color: #dc2626; }

                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: #f1f5f9; color: var(--primary); }
                .delete-btn:hover { color: var(--danger); background: #fee2e2; }

                .inventory-status-table { background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .section-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
            `}</style>
        </div>
    );
};

export default InventoryInOut;
