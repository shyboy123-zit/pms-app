import React, { useState, useEffect } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import DateRangePicker from '../components/DateRangePicker';
import { Package, TrendingUp, TrendingDown, Edit, Trash2, Plus, RefreshCw, X } from 'lucide-react';
import { useData } from '../context/DataContext';

const InventoryInOut = () => {
    const {
        inventoryTransactions,
        products,
        addInventoryTransaction,
        updateInventoryTransaction,
        deleteInventoryTransaction,
        getTransactionsByDateRange,
        addVoucher
    } = useData();

    const [activeTab, setActiveTab] = useState('all'); // 'all', 'in', 'out', 'adjust', 'status'
    const [actualStock, setActualStock] = useState(0);
    const [systemStock, setSystemStock] = useState(0);
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

    // 다건 등록용 state
    const [batchCommon, setBatchCommon] = useState({
        transactionType: 'IN',
        transactionDate: new Date().toISOString().split('T')[0],
        client: '',
        notes: ''
    });
    const emptyBatchItem = { productId: '', itemName: '', itemCode: '', quantity: 0, unit: 'EA', unitPrice: 0 };
    const [batchItems, setBatchItems] = useState([{ ...emptyBatchItem }]);
    const [activeBatchDropdown, setActiveBatchDropdown] = useState(-1);

    const addBatchItemRow = () => setBatchItems(prev => [...prev, { ...emptyBatchItem }]);
    const removeBatchItemRow = (idx) => { if (batchItems.length > 1) setBatchItems(prev => prev.filter((_, i) => i !== idx)); };
    const updateBatchItem = (idx, field, value) => setBatchItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    const selectBatchProduct = (idx, product) => {
        setBatchItems(prev => prev.map((item, i) => i === idx ? {
            ...item,
            productId: product.id,
            itemName: product.name,
            itemCode: product.product_code || '',
            unitPrice: product.unit_price || 0,
            unit: product.unit || 'EA'
        } : item));
        setActiveBatchDropdown(-1);
    };

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
                unit: product.unit || 'EA',
                client: product.company_name || prev.client
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
        } else if (activeTab === 'adjust') {
            filtered = filtered.filter(t => t.transaction_type === 'ADJUST');
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

    // 시스템 재고 계산 함수
    const getSystemStock = (itemCode, itemName) => {
        const key = itemCode || itemName;
        let stock = 0;
        (inventoryTransactions || []).forEach(t => {
            const tKey = t.item_code || t.item_name;
            if (tKey === key) {
                if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') {
                    stock += parseFloat(t.quantity);
                } else if (t.transaction_type === 'OUT') {
                    stock -= parseFloat(t.quantity);
                }
            }
        });
        return stock;
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
                <span className={`type-badge ${row.transaction_type === 'IN' ? 'type-in' : row.transaction_type === 'ADJUST' ? 'type-adjust' : 'type-out'}`}>
                    {row.transaction_type === 'IN' ? '입고' : row.transaction_type === 'ADJUST' ? '재고조정' : '출고'}
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
        // ── 수정 모드 (단일) ──
        if (isEditMode && editingId) {
            if (newItem.transactionType === 'ADJUST') {
                if (!newItem.itemName) return alert('품목을 선택해주세요.');
                const diff = actualStock - systemStock;
                if (diff === 0) return alert('조정할 수량 차이가 없습니다.');
                await updateInventoryTransaction(editingId, {
                    transaction_type: 'ADJUST',
                    item_name: newItem.itemName,
                    item_code: newItem.itemCode,
                    quantity: diff,
                    unit: newItem.unit,
                    unit_price: parseFloat(newItem.unitPrice) || 0,
                    transaction_date: newItem.transactionDate,
                    client: '',
                    notes: `[재고조정] 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff})${newItem.notes ? ' / ' + newItem.notes : ''}`
                });
            } else {
                if (!newItem.itemName || newItem.quantity <= 0) return alert('품목명과 수량을 입력해주세요.');
                await updateInventoryTransaction(editingId, {
                    transaction_type: newItem.transactionType,
                    item_name: newItem.itemName,
                    item_code: newItem.itemCode,
                    quantity: parseFloat(newItem.quantity),
                    unit: newItem.unit,
                    unit_price: parseFloat(newItem.unitPrice),
                    transaction_date: newItem.transactionDate,
                    client: newItem.client,
                    notes: newItem.notes
                });
            }
            resetForm();
            return;
        }

        // ── 신규 등록 (다건 배치) ──
        if (batchCommon.transactionType === 'ADJUST') {
            // 재고조정은 단일만 지원
            if (!newItem.itemName) return alert('품목을 선택해주세요.');
            const diff = actualStock - systemStock;
            if (diff === 0) return alert('조정할 수량 차이가 없습니다.');
            await addInventoryTransaction({
                transaction_type: 'ADJUST',
                item_name: newItem.itemName,
                item_code: newItem.itemCode,
                quantity: diff,
                unit: newItem.unit,
                unit_price: parseFloat(newItem.unitPrice) || 0,
                transaction_date: batchCommon.transactionDate,
                client: '',
                notes: `[재고조정] 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff})${batchCommon.notes ? ' / ' + batchCommon.notes : ''}`
            });
            resetForm();
            return;
        }

        const validItems = batchItems.filter(item => item.itemName && item.quantity > 0);
        if (validItems.length === 0) return alert('최소 1개 이상의 품목을 입력해주세요.');

        for (const item of validItems) {
            await addInventoryTransaction({
                transaction_type: batchCommon.transactionType,
                item_name: item.itemName,
                item_code: item.itemCode,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unit_price: parseFloat(item.unitPrice),
                transaction_date: batchCommon.transactionDate,
                client: batchCommon.client,
                notes: batchCommon.notes
            });

            // 출고 → 매출 전표 자동 생성 (입고는 제품 입고이므로 매입 아님)
            if (addVoucher && batchCommon.transactionType === 'OUT') {
                await addVoucher({
                    voucher_date: batchCommon.transactionDate,
                    voucher_type: '매출',
                    item_name: item.itemName,
                    item_code: item.itemCode,
                    quantity: parseFloat(item.quantity),
                    unit: item.unit,
                    unit_price: parseFloat(item.unitPrice),
                    client: batchCommon.client,
                    notes: `[자동-입출고] ${item.itemName} ${item.quantity}${item.unit} 출고`
                });
            }
        }
        alert(`${validItems.length}건의 거래가 등록되었습니다.`);
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
        setActualStock(0);
        setSystemStock(0);
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
        setBatchCommon({
            transactionType: 'IN',
            transactionDate: new Date().toISOString().split('T')[0],
            client: '',
            notes: ''
        });
        setBatchItems([{ ...emptyBatchItem }]);
        setActiveBatchDropdown(-1);
    };

    // 재고현황에서 직접 재고조정 시작
    const handleAdjust = (item) => {
        const stock = getSystemStock(item.itemCode, item.itemName);
        setSystemStock(stock);
        setActualStock(stock);
        setNewItem({
            transactionType: 'ADJUST',
            productId: '',
            itemName: item.itemName,
            itemCode: item.itemCode || '',
            quantity: 0,
            unit: item.unit || 'EA',
            unitPrice: parseFloat(item.lastPrice) || 0,
            transactionDate: new Date().toISOString().split('T')[0],
            client: '',
            notes: ''
        });
        setIsModalOpen(true);
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

            if (trans.transaction_type === 'IN' || trans.transaction_type === 'ADJUST') {
                stockByItem[key].stock += parseFloat(trans.quantity);
            } else if (trans.transaction_type === 'OUT') {
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
                    className={`tab ${activeTab === 'adjust' ? 'active' : ''}`}
                    onClick={() => setActiveTab('adjust')}
                >
                    재고조정
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
                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>재고조정</th>
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
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <button
                                            className="adjust-btn"
                                            onClick={() => handleAdjust(item)}
                                            title="재고조정"
                                        >
                                            <RefreshCw size={14} /> 조정
                                        </button>
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
                title={isEditMode ? '거래 수정' : '거래 일괄 등록'}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                {isEditMode ? (
                    /* ──── 수정 모드: 단일 품목 ──── */
                    <>
                        <div className="form-group">
                            <label className="form-label">거래 구분</label>
                            <select className="form-input" value={newItem.transactionType}
                                onChange={(e) => setNewItem({ ...newItem, transactionType: e.target.value, productId: '', itemName: '', itemCode: '', unitPrice: 0 })}>
                                <option value="IN">입고</option>
                                <option value="OUT">출고</option>
                                <option value="ADJUST">재고조정</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">제품 선택 *</label>
                            <select className="form-input" value={newItem.productId}
                                onChange={(e) => {
                                    handleProductSelect(e.target.value);
                                    if (newItem.transactionType === 'ADJUST') {
                                        const product = products.find(p => p.id === e.target.value);
                                        if (product) {
                                            const stock = getSystemStock(product.product_code, product.name);
                                            setSystemStock(stock);
                                            setActualStock(stock);
                                        }
                                    }
                                }}>
                                <option value="">제품을 선택하세요</option>
                                {products.filter(p => p.status !== '단종').map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.product_code ? `[${p.product_code}] ` : ''}{p.name} ({p.model || '규격 없음'}) {p.unit_price ? `- ₩${Number(p.unit_price).toLocaleString()}` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {newItem.transactionType === 'ADJUST' ? (
                            <>
                                <div className="adjust-info-card">
                                    <div className="adjust-info-row">
                                        <span className="adjust-label">📦 시스템 재고</span>
                                        <span className="adjust-system-value">{systemStock.toLocaleString()} {newItem.unit}</span>
                                    </div>
                                    <div className="adjust-info-row">
                                        <span className="adjust-label">✏️ 실제 재고</span>
                                        <input type="number" className="form-input adjust-actual-input" value={actualStock}
                                            onChange={(e) => setActualStock(parseFloat(e.target.value) || 0)}
                                            style={{ width: '120px', textAlign: 'right', fontWeight: 700 }} />
                                    </div>
                                    <div className="adjust-info-row adjust-diff-row">
                                        <span className="adjust-label">📊 조정 수량</span>
                                        <span className={`adjust-diff-value ${(actualStock - systemStock) > 0 ? 'positive' : (actualStock - systemStock) < 0 ? 'negative' : ''}`}>
                                            {(actualStock - systemStock) > 0 ? '+' : ''}{(actualStock - systemStock).toLocaleString()} {newItem.unit}
                                        </span>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">단가</label>
                                    <input type="number" className="form-input" value={newItem.unitPrice}
                                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="form-group">
                                    <label className="form-label">수량 *</label>
                                    <input type="number" className="form-input" value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">단가</label>
                                    <input type="number" className="form-input" value={newItem.unitPrice}
                                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0" />
                                </div>
                            </>
                        )}
                        <div className="form-group">
                            <label className="form-label">거래일자</label>
                            <input type="date" className="form-input" value={newItem.transactionDate}
                                onChange={(e) => setNewItem({ ...newItem, transactionDate: e.target.value })} />
                        </div>
                        {newItem.transactionType !== 'ADJUST' && (
                            <div className="form-group">
                                <label className="form-label">거래처</label>
                                <input className="form-input" value={newItem.client}
                                    onChange={(e) => setNewItem({ ...newItem, client: e.target.value })} placeholder="공급사 또는 고객사" />
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">비고</label>
                            <textarea className="form-input" value={newItem.notes}
                                onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} rows="2" placeholder="메모사항" />
                        </div>
                    </>
                ) : (
                    /* ──── 신규 등록 모드: 다건 배치 ──── */
                    <>
                        {/* 공통 정보 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">거래 구분 *</label>
                                <select className="form-input" value={batchCommon.transactionType}
                                    onChange={(e) => setBatchCommon({ ...batchCommon, transactionType: e.target.value })}>
                                    <option value="IN">입고</option>
                                    <option value="OUT">출고</option>
                                    <option value="ADJUST">재고조정</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">거래일자 *</label>
                                <input type="date" className="form-input" value={batchCommon.transactionDate}
                                    onChange={(e) => setBatchCommon({ ...batchCommon, transactionDate: e.target.value })} />
                            </div>
                        </div>
                        {batchCommon.transactionType !== 'ADJUST' && (
                            <div className="form-group">
                                <label className="form-label">거래처</label>
                                <input className="form-input" value={batchCommon.client}
                                    onChange={(e) => setBatchCommon({ ...batchCommon, client: e.target.value })} placeholder="공급사 또는 고객사" />
                            </div>
                        )}

                        {batchCommon.transactionType === 'ADJUST' ? (
                            /* 재고조정은 단일 품목만 */
                            <>
                                <div className="form-group">
                                    <label className="form-label">제품 선택 *</label>
                                    <select className="form-input" value={newItem.productId}
                                        onChange={(e) => {
                                            handleProductSelect(e.target.value);
                                            const product = products.find(p => p.id === e.target.value);
                                            if (product) {
                                                const stock = getSystemStock(product.product_code, product.name);
                                                setSystemStock(stock);
                                                setActualStock(stock);
                                            }
                                        }}>
                                        <option value="">제품을 선택하세요</option>
                                        {products.filter(p => p.status !== '단종').map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.product_code ? `[${p.product_code}] ` : ''}{p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="adjust-info-card">
                                    <div className="adjust-info-row">
                                        <span className="adjust-label">📦 시스템 재고</span>
                                        <span className="adjust-system-value">{systemStock.toLocaleString()} {newItem.unit}</span>
                                    </div>
                                    <div className="adjust-info-row">
                                        <span className="adjust-label">✏️ 실제 재고</span>
                                        <input type="number" className="form-input adjust-actual-input" value={actualStock}
                                            onChange={(e) => setActualStock(parseFloat(e.target.value) || 0)}
                                            style={{ width: '120px', textAlign: 'right', fontWeight: 700 }} />
                                    </div>
                                    <div className="adjust-info-row adjust-diff-row">
                                        <span className="adjust-label">📊 조정 수량</span>
                                        <span className={`adjust-diff-value ${(actualStock - systemStock) > 0 ? 'positive' : (actualStock - systemStock) < 0 ? 'negative' : ''}`}>
                                            {(actualStock - systemStock) > 0 ? '+' : ''}{(actualStock - systemStock).toLocaleString()} {newItem.unit}
                                        </span>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* 입고/출고: 다건 품목 */
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 0.5rem' }}>
                                    <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>📦 제품 목록 ({batchItems.filter(i => i.itemName).length}건)</label>
                                    <button type="button" onClick={addBatchItemRow}
                                        style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <Plus size={14} /> 제품 추가
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                                    {batchItems.map((item, idx) => (
                                        <div key={idx} style={{ background: item.itemName ? '#f8fafc' : '#fff', border: `1px solid ${item.itemName ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '10px', padding: '0.6rem 0.75rem', position: 'relative' }}>
                                            {batchItems.length > 1 && (
                                                <button type="button" onClick={() => removeBatchItemRow(idx)}
                                                    style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }} title="삭제">
                                                    <X size={14} />
                                                </button>
                                            )}
                                            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.35rem' }}>#{idx + 1}</div>
                                            {/* 제품 드롭다운 */}
                                            <select className="form-input" value={item.productId} style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', marginBottom: '0.4rem' }}
                                                onChange={(e) => {
                                                    const product = products.find(p => p.id === e.target.value);
                                                    if (product) selectBatchProduct(idx, product);
                                                    else updateBatchItem(idx, 'productId', '');
                                                }}>
                                                <option value="">제품 선택...</option>
                                                {products.filter(p => p.status !== '단종').map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.product_code ? `[${p.product_code}] ` : ''}{p.name} {p.unit_price ? `₩${Number(p.unit_price).toLocaleString()}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            {/* 수량 / 단가 / 금액 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center' }}>
                                                <div>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>수량</div>
                                                    <input type="number" className="form-input" value={item.quantity}
                                                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => updateBatchItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>단가</div>
                                                    <input type="number" className="form-input" value={item.unitPrice}
                                                        style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                                        onFocus={(e) => e.target.select()}
                                                        onChange={(e) => updateBatchItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} />
                                                </div>
                                                <div>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>금액</div>
                                                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5', padding: '0.35rem 0' }}>
                                                        ₩{(item.quantity * item.unitPrice).toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* 합계 */}
                                {batchItems.some(i => i.itemName) && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: batchCommon.transactionType === 'OUT' ? '#ecfdf5' : '#eff6ff', borderRadius: '10px', border: `1px solid ${batchCommon.transactionType === 'OUT' ? '#a7f3d0' : '#93c5fd'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                            총 {batchItems.filter(i => i.itemName).length}건
                                        </span>
                                        <span style={{ fontWeight: 800, fontSize: '1.15rem', color: batchCommon.transactionType === 'OUT' ? '#059669' : '#2563eb' }}>
                                            ₩{batchItems.reduce((sum, i) => sum + (i.quantity * i.unitPrice), 0).toLocaleString()}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="form-group" style={{ marginTop: '0.75rem' }}>
                            <label className="form-label">비고</label>
                            <textarea className="form-input" value={batchCommon.notes}
                                onChange={(e) => setBatchCommon({ ...batchCommon, notes: e.target.value })} rows="2" placeholder="메모사항" />
                        </div>
                    </>
                )}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>
                        {isEditMode ? '수정' : (batchCommon.transactionType === 'ADJUST' ? '조정' : `${batchItems.filter(i => i.itemName && i.quantity > 0).length}건 일괄 등록`)}
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
                .type-adjust { background: #fef3c7; color: #d97706; }

                .adjust-btn { display: inline-flex; align-items: center; gap: 4px; padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 600; background: #fef3c7; color: #d97706; border: 1px solid #fde68a; transition: all 0.2s; cursor: pointer; }
                .adjust-btn:hover { background: #fde68a; color: #b45309; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(217,119,6,0.2); }

                .adjust-info-card { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
                .adjust-info-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; }
                .adjust-info-row + .adjust-info-row { border-top: 1px dashed #fde68a; }
                .adjust-label { font-size: 0.9rem; font-weight: 600; color: #92400e; }
                .adjust-system-value { font-size: 1.1rem; font-weight: 700; color: #64748b; }
                .adjust-diff-row { margin-top: 0.25rem; padding-top: 0.75rem !important; border-top: 2px solid #f59e0b !important; }
                .adjust-diff-value { font-size: 1.2rem; font-weight: 800; color: #64748b; }
                .adjust-diff-value.positive { color: #059669; }
                .adjust-diff-value.negative { color: #dc2626; }
                .adjust-actual-input { border: 2px solid #f59e0b !important; border-radius: 8px; }

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
