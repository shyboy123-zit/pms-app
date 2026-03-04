import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { DollarSign, TrendingUp, TrendingDown, Calendar, BarChart3, ArrowUpRight, ArrowDownRight, Plus, Edit, Trash2, FileText, CheckCircle, AlertTriangle, Search, X } from 'lucide-react';
import { useData } from '../context/DataContext';

const Sales = () => {
    const { inventoryTransactions, salesRecords, products, materials, suppliers, vouchers, addVoucher, updateVoucher, deleteVoucher } = useData();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState('analysis'); // 'analysis', 'voucher', 'reconciliation'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [voucherFilter, setVoucherFilter] = useState('all'); // 'all', '매입', '매출'
    const [reconView, setReconView] = useState('monthly'); // 'monthly', 'client'
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [clientFilter, setClientFilter] = useState('all'); // 거래처별 필터

    // 전표 공통 정보
    const [voucherCommon, setVoucherCommon] = useState({
        voucher_date: new Date().toISOString().split('T')[0],
        voucher_type: '매출',
        client: '',
        notes: ''
    });

    // 복수 품목 리스트
    const emptyItem = { productId: '', item_name: '', item_code: '', quantity: 0, unit: 'EA', unit_price: 0, searchText: '' };
    const [voucherItems, setVoucherItems] = useState([{ ...emptyItem }]);
    const [activeItemDropdown, setActiveItemDropdown] = useState(-1);

    // 단일 수정용 (기존 호환)
    const [newVoucher, setNewVoucher] = useState({
        voucher_date: new Date().toISOString().split('T')[0],
        voucher_type: '매출',
        item_name: '',
        item_code: '',
        quantity: 0,
        unit: 'EA',
        unit_price: 0,
        client: '',
        notes: ''
    });
    const [itemSearch, setItemSearch] = useState('');
    const [showItemDropdown, setShowItemDropdown] = useState(false);

    // ──────────────────────── 공통 ────────────────────────
    const availableYears = useMemo(() => {
        const years = new Set();
        (inventoryTransactions || []).forEach(t => {
            const y = new Date(t.transaction_date).getFullYear();
            if (y) years.add(y);
        });
        (vouchers || []).forEach(v => {
            const y = new Date(v.voucher_date).getFullYear();
            if (y) years.add(y);
        });
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [inventoryTransactions, vouchers]);

    // ──────────────────── 탭1: 전표 기반 분석 ────────────────────
    const monthlyData = useMemo(() => {
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;
            const monthVouchers = (vouchers || []).filter(v =>
                (v.voucher_date || '').startsWith(monthKey)
            );
            const sales = monthVouchers
                .filter(v => v.voucher_type === '매출')
                .reduce((sum, v) => sum + ((v.quantity || 0) * (v.unit_price || 0)), 0);
            const purchases = monthVouchers
                .filter(v => v.voucher_type === '매입')
                .reduce((sum, v) => sum + ((v.quantity || 0) * (v.unit_price || 0)), 0);
            const salesCount = monthVouchers.filter(v => v.voucher_type === '매출').length;
            const purchaseCount = monthVouchers.filter(v => v.voucher_type === '매입').length;
            months.push({
                month: m, monthLabel: `${m}월`,
                sales, purchases, profit: sales - purchases,
                salesCount, purchaseCount, totalCount: salesCount + purchaseCount
            });
        }
        return months;
    }, [vouchers, selectedYear]);

    const yearSummary = useMemo(() => {
        return monthlyData.reduce((acc, m) => ({
            totalSales: acc.totalSales + m.sales,
            totalPurchases: acc.totalPurchases + m.purchases,
            totalProfit: acc.totalProfit + m.profit,
            totalTransactions: acc.totalTransactions + m.totalCount
        }), { totalSales: 0, totalPurchases: 0, totalProfit: 0, totalTransactions: 0 });
    }, [monthlyData]);

    const maxAmount = useMemo(() => {
        const max = Math.max(...monthlyData.map(m => Math.max(m.sales, m.purchases)));
        return max > 0 ? max : 1;
    }, [monthlyData]);

    const currentMonthIdx = new Date().getMonth();
    const currentMonthData = monthlyData[currentMonthIdx];
    const prevMonthData = currentMonthIdx > 0 ? monthlyData[currentMonthIdx - 1] : null;
    const salesChange = prevMonthData && prevMonthData.sales > 0
        ? ((currentMonthData.sales - prevMonthData.sales) / prevMonthData.sales * 100).toFixed(1)
        : null;

    // ──────────────────── 탭2: 전표 관리 ────────────────────
    const filteredVouchers = useMemo(() => {
        let list = (vouchers || []).filter(v => {
            const y = new Date(v.voucher_date).getFullYear();
            return y === selectedYear;
        });
        if (voucherFilter !== 'all') {
            list = list.filter(v => v.voucher_type === voucherFilter);
        }
        if (clientFilter !== 'all') {
            list = list.filter(v => (v.client || '') === clientFilter);
        }
        return list.sort((a, b) => b.voucher_date.localeCompare(a.voucher_date));
    }, [vouchers, selectedYear, voucherFilter, clientFilter]);

    // 거래처 목록 추출
    const clientList = useMemo(() => {
        const clients = new Set();
        (vouchers || []).filter(v => new Date(v.voucher_date).getFullYear() === selectedYear)
            .forEach(v => { if (v.client) clients.add(v.client); });
        return Array.from(clients).sort();
    }, [vouchers, selectedYear]);

    const voucherStats = useMemo(() => {
        let yearVouchers = (vouchers || []).filter(v => new Date(v.voucher_date).getFullYear() === selectedYear);
        if (clientFilter && clientFilter !== 'all') {
            yearVouchers = yearVouchers.filter(v => v.client === clientFilter);
        }
        const totalSales = yearVouchers.filter(v => v.voucher_type === '매출').reduce((s, v) => s + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);
        const totalPurchases = yearVouchers.filter(v => v.voucher_type === '매입').reduce((s, v) => s + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);
        return { totalSales, totalPurchases, count: yearVouchers.length };
    }, [vouchers, selectedYear, clientFilter]);

    const handleVoucherSave = async () => {
        if (isEditMode && editingId) {
            // 단일 수정 모드
            if (!newVoucher.item_name || newVoucher.quantity <= 0) {
                return alert('품목명과 수량을 입력해주세요.');
            }
            const payload = {
                voucher_date: newVoucher.voucher_date,
                voucher_type: newVoucher.voucher_type,
                item_name: newVoucher.item_name,
                item_code: newVoucher.item_code,
                quantity: parseFloat(newVoucher.quantity),
                unit: newVoucher.unit,
                unit_price: parseFloat(newVoucher.unit_price),
                client: newVoucher.client,
                notes: newVoucher.notes
            };
            await updateVoucher(editingId, payload);
            resetForm();
            return;
        }

        // 복수 등록 모드
        const validItems = voucherItems.filter(item => item.item_name && item.quantity > 0);
        if (validItems.length === 0) {
            return alert('최소 1개 이상의 품목을 입력해주세요.');
        }
        for (const item of validItems) {
            const payload = {
                voucher_date: voucherCommon.voucher_date,
                voucher_type: voucherCommon.voucher_type,
                item_name: item.item_name,
                item_code: item.item_code,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unit_price: parseFloat(item.unit_price),
                client: voucherCommon.client,
                notes: voucherCommon.notes
            };
            await addVoucher(payload);
        }
        alert(`${validItems.length}건의 전표가 등록되었습니다.`);
        resetForm();
    };

    // 품목 행 관리
    const addVoucherItemRow = () => {
        setVoucherItems(prev => [...prev, { ...emptyItem }]);
    };
    const removeVoucherItemRow = (idx) => {
        if (voucherItems.length <= 1) return;
        setVoucherItems(prev => prev.filter((_, i) => i !== idx));
    };
    const updateVoucherItem = (idx, field, value) => {
        setVoucherItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };
    const selectProductForItem = (idx, product) => {
        setVoucherItems(prev => prev.map((item, i) => i === idx ? {
            ...item,
            productId: product.id,
            item_name: product.name,
            item_code: product.product_code || '',
            unit_price: product.unit_price || item.unit_price,
            unit: product.unit || 'EA',
            searchText: `${product.product_code ? `[${product.product_code}] ` : ''}${product.name}`
        } : item));
        setActiveItemDropdown(-1);
    };

    const handleEditVoucher = (v) => {
        setNewVoucher({
            voucher_date: v.voucher_date,
            voucher_type: v.voucher_type,
            item_name: v.item_name,
            item_code: v.item_code || '',
            quantity: v.quantity,
            unit: v.unit || 'EA',
            unit_price: v.unit_price,
            client: v.client || '',
            notes: v.notes || ''
        });
        setEditingId(v.id);
        setIsEditMode(true);
        setIsModalOpen(true);
        setItemSearch(`${v.item_code ? `[${v.item_code}] ` : ''}${v.item_name}`);
        setClientSearch(v.client || '');
    };

    const handleDeleteVoucher = async (v) => {
        if (window.confirm(`'${v.item_name}' 전표를 삭제하시겠습니까?`)) {
            await deleteVoucher(v.id);
        }
    };

    const resetForm = () => {
        setIsModalOpen(false);
        setIsEditMode(false);
        setEditingId(null);
        setNewVoucher({
            voucher_date: new Date().toISOString().split('T')[0],
            voucher_type: '매출',
            item_name: '',
            item_code: '',
            quantity: 0,
            unit: 'EA',
            unit_price: 0,
            client: '',
            notes: ''
        });
        setVoucherCommon({
            voucher_date: new Date().toISOString().split('T')[0],
            voucher_type: '매출',
            client: '',
            notes: ''
        });
        setVoucherItems([{ ...emptyItem }]);
        setActiveItemDropdown(-1);
        setItemSearch('');
        setClientSearch('');
        setShowItemDropdown(false);
        setShowClientDropdown(false);
    };

    // ──────────────────── 탭3: 대사 (Reconciliation) ────────────────────
    const reconciliationData = useMemo(() => {
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;

            // 입출고 기반
            const monthTxs = (inventoryTransactions || []).filter(t =>
                (t.transaction_date || '').startsWith(monthKey)
            );
            const txSales = monthTxs
                .filter(t => t.transaction_type === 'OUT')
                .reduce((sum, t) => sum + ((t.quantity || 0) * (t.unit_price || 0)), 0);

            // 전표 기반
            const monthVouchers = (vouchers || []).filter(v =>
                (v.voucher_date || '').startsWith(monthKey)
            );
            const vSales = monthVouchers
                .filter(v => v.voucher_type === '매출')
                .reduce((sum, v) => sum + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);
            const vPurchases = monthVouchers
                .filter(v => v.voucher_type === '매입')
                .reduce((sum, v) => sum + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);

            // 원재료 매입은 전표가 유일 소스 (입출고 IN은 제품입고라 매입 아님)
            const txPurchases = vPurchases;

            months.push({
                month: m,
                monthLabel: `${m}월`,
                txSales, txPurchases,
                vSales, vPurchases,
                salesDiff: txSales - vSales,
                purchasesDiff: txPurchases - vPurchases,
                salesMatch: Math.abs(txSales - vSales) < 1,
                purchasesMatch: Math.abs(txPurchases - vPurchases) < 1
            });
        }
        return months;
    }, [inventoryTransactions, vouchers, selectedYear]);

    const reconciliationSummary = useMemo(() => {
        return reconciliationData.reduce((acc, m) => ({
            txSales: acc.txSales + m.txSales,
            txPurchases: acc.txPurchases + m.txPurchases,
            vSales: acc.vSales + m.vSales,
            vPurchases: acc.vPurchases + m.vPurchases,
            salesDiff: acc.salesDiff + m.salesDiff,
            purchasesDiff: acc.purchasesDiff + m.purchasesDiff,
            mismatchCount: acc.mismatchCount + (!m.salesMatch || !m.purchasesMatch ? 1 : 0)
        }), { txSales: 0, txPurchases: 0, vSales: 0, vPurchases: 0, salesDiff: 0, purchasesDiff: 0, mismatchCount: 0 });
    }, [reconciliationData]);

    // 거래처별 대사 데이터
    const clientReconciliationData = useMemo(() => {
        const clientMap = {};
        // 입출고 데이터에서 거래처별 집계 (OUT=매출만, IN은 제품입고라 매입 아님)
        (inventoryTransactions || []).filter(t => {
            const y = new Date(t.transaction_date).getFullYear();
            return y === selectedYear && t.client && t.transaction_type === 'OUT';
        }).forEach(t => {
            const client = t.client;
            if (!clientMap[client]) clientMap[client] = { client, txSales: 0, txPurchases: 0, vSales: 0, vPurchases: 0 };
            const amount = (t.quantity || 0) * (t.unit_price || 0);
            clientMap[client].txSales += amount;
        });
        // 전표 데이터에서 거래처별 집계
        (vouchers || []).filter(v => {
            const y = new Date(v.voucher_date).getFullYear();
            return y === selectedYear && v.client;
        }).forEach(v => {
            const client = v.client;
            if (!clientMap[client]) clientMap[client] = { client, txSales: 0, txPurchases: 0, vSales: 0, vPurchases: 0 };
            const amount = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
            if (v.voucher_type === '매출') clientMap[client].vSales += amount;
            else if (v.voucher_type === '매입') {
                clientMap[client].vPurchases += amount;
                clientMap[client].txPurchases += amount; // 원재료 매입은 전표가 유일 소스
            }
        });
        return Object.values(clientMap).map(c => ({
            ...c,
            salesDiff: c.txSales - c.vSales,
            purchasesDiff: c.txPurchases - c.vPurchases,
            salesMatch: Math.abs(c.txSales - c.vSales) < 1,
            purchasesMatch: Math.abs(c.txPurchases - c.vPurchases) < 1
        })).sort((a, b) => {
            // 불일치 항목 먼저
            const aMismatch = !a.salesMatch || !a.purchasesMatch;
            const bMismatch = !b.salesMatch || !b.purchasesMatch;
            if (aMismatch !== bMismatch) return aMismatch ? -1 : 1;
            return (b.txSales + b.txPurchases) - (a.txSales + a.txPurchases);
        });
    }, [inventoryTransactions, vouchers, selectedYear]);

    // 전표 테이블 컬럼
    const voucherColumns = [
        { header: '일자', accessor: 'voucher_date' },
        {
            header: '구분', accessor: 'voucher_type',
            render: (row) => (
                <span className={`v-type-badge ${row.voucher_type === '매출' ? 'v-type-sales' : 'v-type-purchase'}`}>
                    {row.voucher_type}
                </span>
            )
        },
        { header: '품목코드', accessor: 'item_code', render: (row) => row.item_code || '-' },
        { header: '품목명', accessor: 'item_name' },
        { header: '수량', accessor: 'quantity', render: (row) => `${parseFloat(row.quantity).toLocaleString()} ${row.unit || 'EA'}` },
        { header: '단가', accessor: 'unit_price', render: (row) => `₩${parseFloat(row.unit_price).toLocaleString()}` },
        {
            header: '금액', accessor: 'total_amount',
            render: (row) => (
                <span style={{ fontWeight: 700, color: row.voucher_type === '매출' ? '#059669' : '#2563eb' }}>
                    ₩{parseFloat(row.total_amount || row.quantity * row.unit_price || 0).toLocaleString()}
                </span>
            )
        },
        { header: '거래처', accessor: 'client', render: (row) => row.client || '-' },
        {
            header: '비고', accessor: 'notes',
            render: (row) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {((row.notes || '').includes('[자동-입출고]') || (row.notes || '').includes('[자동-원재료]')) && (
                        <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '1px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, whiteSpace: 'nowrap' }}>자동</span>
                    )}
                    <span style={{ fontSize: '0.8rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                        {(row.notes || '').replace('[\uc790\ub3d9-\uc785\ucd9c\uace0] ', '') || '-'}
                    </span>
                </div>
            )
        },
    ];

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">매입매출 관리</h2>
                    <p className="page-description">전표 기반 매출/매입 분석, 전표 관리, 대사를 수행합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div className="year-selector">
                        <Calendar size={16} />
                        <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                            {availableYears.map(y => (
                                <option key={y} value={y}>{y}년</option>
                            ))}
                        </select>
                    </div>
                    {activeTab === 'voucher' && (
                        <button className="btn-primary-sales" onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} /> 전표 등록
                        </button>
                    )}
                </div>
            </div>

            {/* 탭 네비게이션 */}
            <div className="sales-tabs">
                <button className={`sales-tab ${activeTab === 'analysis' ? 'active' : ''}`} onClick={() => setActiveTab('analysis')}>
                    <BarChart3 size={16} /> 입출고 분석
                </button>
                <button className={`sales-tab ${activeTab === 'voucher' ? 'active' : ''}`} onClick={() => setActiveTab('voucher')}>
                    <FileText size={16} /> 전표 관리
                </button>
                <button className={`sales-tab ${activeTab === 'reconciliation' ? 'active' : ''}`} onClick={() => setActiveTab('reconciliation')}>
                    <Search size={16} /> 대사 (확인)
                    {reconciliationSummary.mismatchCount > 0 && (
                        <span className="mismatch-badge">{reconciliationSummary.mismatchCount}</span>
                    )}
                </button>
            </div>

            {/* ──────────────── 탭1: 입출고 기반 분석 ──────────────── */}
            {activeTab === 'analysis' && (
                <>
                    {/* 연간 요약 카드 */}
                    <div className="summary-cards">
                        <div className="summary-card sales">
                            <div className="card-icon"><TrendingUp size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">{selectedYear}년 총 매출 (출고)</span>
                                <span className="card-value">₩{yearSummary.totalSales.toLocaleString()}</span>
                                {salesChange !== null && selectedYear === new Date().getFullYear() && (
                                    <span className={`card-change ${Number(salesChange) >= 0 ? 'positive' : 'negative'}`}>
                                        {Number(salesChange) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        전월 대비 {salesChange}%
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="summary-card purchases">
                            <div className="card-icon purchase-icon"><TrendingDown size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">{selectedYear}년 총 매입 (입고)</span>
                                <span className="card-value">₩{yearSummary.totalPurchases.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="summary-card profit">
                            <div className="card-icon profit-icon"><DollarSign size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">{selectedYear}년 순이익</span>
                                <span className="card-value" style={{ color: yearSummary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                    {yearSummary.totalProfit >= 0 ? '+' : ''}₩{yearSummary.totalProfit.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="summary-card count">
                            <div className="card-icon count-icon"><BarChart3 size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">총 거래 건수</span>
                                <span className="card-value">{yearSummary.totalTransactions}건</span>
                            </div>
                        </div>
                    </div>

                    {/* 월별 차트 */}
                    <div className="glass-panel chart-section">
                        <h3 className="section-title"><BarChart3 size={18} /> 월별 매입/매출 추이</h3>
                        <div className="chart-container">
                            {monthlyData.map((m, i) => (
                                <div key={m.month} className={`chart-bar-group ${i === currentMonthIdx && selectedYear === new Date().getFullYear() ? 'current' : ''}`}>
                                    <div className="bar-wrapper">
                                        <div className="bar sales-bar" style={{ height: `${(m.sales / maxAmount) * 100}%` }}
                                            title={`매출: ₩${m.sales.toLocaleString()}`} />
                                        <div className="bar purchase-bar" style={{ height: `${(m.purchases / maxAmount) * 100}%` }}
                                            title={`매입: ₩${m.purchases.toLocaleString()}`} />
                                    </div>
                                    <span className="bar-label">{m.monthLabel}</span>
                                </div>
                            ))}
                        </div>
                        <div className="chart-legend">
                            <span className="legend-item"><span className="legend-dot sales-dot"></span> 매출</span>
                            <span className="legend-item"><span className="legend-dot purchase-dot"></span> 매입</span>
                        </div>
                    </div>

                    {/* 월별 마감 테이블 */}
                    <div className="glass-panel table-section">
                        <h3 className="section-title"><Calendar size={18} /> 월별 마감 금액</h3>
                        <div className="closing-table-wrapper">
                            <table className="closing-table">
                                <thead>
                                    <tr>
                                        <th>월</th><th>매출</th><th>매입</th><th>순이익</th><th>이익률</th><th>거래건수</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {monthlyData.map(m => {
                                        const profitRate = m.sales > 0 ? ((m.profit / m.sales) * 100) : 0;
                                        const isCurrentMonth = m.month === (new Date().getMonth() + 1) && selectedYear === new Date().getFullYear();
                                        return (
                                            <tr key={m.month} className={isCurrentMonth ? 'current-row' : ''}>
                                                <td className="month-cell">
                                                    <strong>{m.monthLabel}</strong>
                                                    {isCurrentMonth && <span className="current-badge">진행중</span>}
                                                </td>
                                                <td className="amount-cell sales-text">{m.sales > 0 ? `₩${m.sales.toLocaleString()}` : '-'}</td>
                                                <td className="amount-cell purchase-text">{m.purchases > 0 ? `₩${m.purchases.toLocaleString()}` : '-'}</td>
                                                <td className="amount-cell">
                                                    <span style={{ color: m.profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                        {m.profit !== 0 ? `${m.profit >= 0 ? '+' : ''}₩${m.profit.toLocaleString()}` : '-'}
                                                    </span>
                                                </td>
                                                <td className="rate-cell">
                                                    {m.sales > 0 ? (
                                                        <span className={`rate-badge ${profitRate >= 0 ? 'positive' : 'negative'}`}>
                                                            {profitRate.toFixed(1)}%
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td className="count-cell">{m.totalCount > 0 ? `${m.totalCount}건` : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="total-row">
                                        <td><strong>합계</strong></td>
                                        <td className="amount-cell sales-text"><strong>₩{yearSummary.totalSales.toLocaleString()}</strong></td>
                                        <td className="amount-cell purchase-text"><strong>₩{yearSummary.totalPurchases.toLocaleString()}</strong></td>
                                        <td className="amount-cell">
                                            <strong style={{ color: yearSummary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                                {yearSummary.totalProfit >= 0 ? '+' : ''}₩{yearSummary.totalProfit.toLocaleString()}
                                            </strong>
                                        </td>
                                        <td className="rate-cell">
                                            {yearSummary.totalSales > 0 ? (
                                                <strong>{((yearSummary.totalProfit / yearSummary.totalSales) * 100).toFixed(1)}%</strong>
                                            ) : '-'}
                                        </td>
                                        <td className="count-cell"><strong>{yearSummary.totalTransactions}건</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* 거래처별 매입/매출 */}
                    <div className="glass-panel table-section" style={{ marginTop: '1.5rem' }}>
                        <h3 className="section-title"><TrendingUp size={18} /> 거래처별 매입/매출 현황</h3>
                        <div className="closing-table-wrapper">
                            <table className="closing-table">
                                <thead>
                                    <tr>
                                        <th>거래처</th><th>매출</th><th>매입</th><th>순이익</th><th>거래건수</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const yearVouchers = (vouchers || []).filter(v =>
                                            (v.voucher_date || '').startsWith(String(selectedYear))
                                        );
                                        const clientMap = {};
                                        yearVouchers.forEach(v => {
                                            const c = v.client || '미지정';
                                            if (!clientMap[c]) clientMap[c] = { sales: 0, purchases: 0, count: 0 };
                                            const amount = (v.quantity || 0) * (v.unit_price || 0);
                                            if (v.voucher_type === '매출') clientMap[c].sales += amount;
                                            else if (v.voucher_type === '매입') clientMap[c].purchases += amount;
                                            clientMap[c].count += 1;
                                        });
                                        const rows = Object.entries(clientMap)
                                            .map(([name, d]) => ({ name, ...d, profit: d.sales - d.purchases }))
                                            .sort((a, b) => (b.sales + b.purchases) - (a.sales + a.purchases));
                                        if (rows.length === 0) return (
                                            <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>데이터가 없습니다.</td></tr>
                                        );
                                        return rows.map(r => (
                                            <tr key={r.name}>
                                                <td><strong>{r.name}</strong></td>
                                                <td className="amount-cell sales-text">{r.sales > 0 ? `₩${r.sales.toLocaleString()}` : '-'}</td>
                                                <td className="amount-cell purchase-text">{r.purchases > 0 ? `₩${r.purchases.toLocaleString()}` : '-'}</td>
                                                <td className="amount-cell">
                                                    <span style={{ color: r.profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                        {r.profit !== 0 ? `${r.profit >= 0 ? '+' : ''}₩${r.profit.toLocaleString()}` : '-'}
                                                    </span>
                                                </td>
                                                <td className="count-cell">{r.count}건</td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}

            {/* ──────────────── 탭2: 전표 관리 ──────────────── */}
            {activeTab === 'voucher' && (
                <>
                    {/* 전표 통계 카드 */}
                    <div className="summary-cards">
                        <div className="summary-card sales">
                            <div className="card-icon"><TrendingUp size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">{selectedYear}년 전표 매출</span>
                                <span className="card-value">₩{voucherStats.totalSales.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="summary-card purchases">
                            <div className="card-icon purchase-icon"><TrendingDown size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">{selectedYear}년 전표 매입</span>
                                <span className="card-value">₩{voucherStats.totalPurchases.toLocaleString()}</span>
                            </div>
                        </div>
                        <div className="summary-card profit">
                            <div className="card-icon profit-icon"><DollarSign size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">전표 순이익</span>
                                <span className="card-value" style={{ color: (voucherStats.totalSales - voucherStats.totalPurchases) >= 0 ? '#10b981' : '#ef4444' }}>
                                    {(voucherStats.totalSales - voucherStats.totalPurchases) >= 0 ? '+' : ''}₩{(voucherStats.totalSales - voucherStats.totalPurchases).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="summary-card count">
                            <div className="card-icon count-icon"><FileText size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">전표 건수</span>
                                <span className="card-value">{voucherStats.count}건</span>
                            </div>
                        </div>
                    </div>

                    {/* 전표 필터 */}
                    <div className="voucher-filter-bar">
                        <button className={`v-filter-btn ${voucherFilter === 'all' ? 'active' : ''}`} onClick={() => setVoucherFilter('all')}>전체</button>
                        <button className={`v-filter-btn ${voucherFilter === '매출' ? 'active' : ''}`} onClick={() => setVoucherFilter('매출')}>매출</button>
                        <button className={`v-filter-btn ${voucherFilter === '매입' ? 'active' : ''}`} onClick={() => setVoucherFilter('매입')}>매입</button>
                        <div style={{ marginLeft: 'auto' }}>
                            <select className="form-input" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}
                                style={{ padding: '0.35rem 0.7rem', fontSize: '0.82rem', borderRadius: '8px', minWidth: '140px' }}>
                                <option value="all">거래처 전체</option>
                                {clientList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 전표 테이블 */}
                    <Table
                        columns={voucherColumns}
                        data={filteredVouchers}
                        actions={(row) => (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="icon-btn" onClick={() => handleEditVoucher(row)} title="수정">
                                    <Edit size={16} />
                                </button>
                                <button className="icon-btn delete-btn" onClick={() => handleDeleteVoucher(row)} title="삭제">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    />
                </>
            )}

            {/* ──────────────── 탭3: 대사 (Reconciliation) ──────────────── */}
            {activeTab === 'reconciliation' && (
                <>
                    {/* 대사 요약 카드 */}
                    <div className="summary-cards">
                        <div className={`summary-card ${reconciliationSummary.mismatchCount === 0 ? 'sales' : 'recon-warn'}`}>
                            <div className="card-icon" style={{ background: reconciliationSummary.mismatchCount === 0 ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                                {reconciliationSummary.mismatchCount === 0 ? <CheckCircle size={22} /> : <AlertTriangle size={22} />}
                            </div>
                            <div className="card-body">
                                <span className="card-label">대사 결과</span>
                                <span className="card-value" style={{ fontSize: '1.1rem' }}>
                                    {reconciliationSummary.mismatchCount === 0 ? '✅ 전체 일치' : `⚠️ ${reconciliationSummary.mismatchCount}개월 불일치`}
                                </span>
                            </div>
                        </div>
                        <div className="summary-card purchases">
                            <div className="card-icon purchase-icon"><TrendingUp size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">매출 차이 합계</span>
                                <span className="card-value" style={{ color: Math.abs(reconciliationSummary.salesDiff) < 1 ? '#10b981' : '#ef4444' }}>
                                    {reconciliationSummary.salesDiff >= 0 ? '+' : ''}₩{reconciliationSummary.salesDiff.toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="summary-card profit">
                            <div className="card-icon profit-icon"><TrendingDown size={22} /></div>
                            <div className="card-body">
                                <span className="card-label">매입 차이 합계</span>
                                <span className="card-value" style={{ color: Math.abs(reconciliationSummary.purchasesDiff) < 1 ? '#10b981' : '#ef4444' }}>
                                    {reconciliationSummary.purchasesDiff >= 0 ? '+' : ''}₩{reconciliationSummary.purchasesDiff.toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 뷰 토글 */}
                    <div className="voucher-filter-bar">
                        <button className={`v-filter-btn ${reconView === 'monthly' ? 'active' : ''}`} onClick={() => setReconView('monthly')}>📅 월별 대사</button>
                        <button className={`v-filter-btn ${reconView === 'client' ? 'active' : ''}`} onClick={() => setReconView('client')}>🏢 거래처별 대사</button>
                    </div>

                    {/* 대사 테이블 */}
                    {reconView === 'monthly' && (
                        <div className="glass-panel table-section">
                            <h3 className="section-title"><Search size={18} /> 월별 입출고 vs 전표 비교</h3>
                            <div className="closing-table-wrapper">
                                <table className="closing-table recon-table">
                                    <thead>
                                        <tr>
                                            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>월</th>
                                            <th colSpan={3} className="recon-header-sales">매출</th>
                                            <th colSpan={3} className="recon-header-purchase">매입</th>
                                            <th rowSpan={2} style={{ verticalAlign: 'middle' }}>상태</th>
                                        </tr>
                                        <tr>
                                            <th className="sub-header">입출고</th>
                                            <th className="sub-header">전표</th>
                                            <th className="sub-header">차이</th>
                                            <th className="sub-header">입출고</th>
                                            <th className="sub-header">전표</th>
                                            <th className="sub-header">차이</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reconciliationData.map(m => {
                                            const hasData = m.txSales > 0 || m.txPurchases > 0 || m.vSales > 0 || m.vPurchases > 0;
                                            const isCurrentMonth = m.month === (new Date().getMonth() + 1) && selectedYear === new Date().getFullYear();
                                            const hasMismatch = !m.salesMatch || !m.purchasesMatch;
                                            return (
                                                <tr key={m.month} className={`${isCurrentMonth ? 'current-row' : ''} ${hasMismatch && hasData ? 'mismatch-row' : ''}`}>
                                                    <td className="month-cell">
                                                        <strong>{m.monthLabel}</strong>
                                                        {isCurrentMonth && <span className="current-badge">진행중</span>}
                                                    </td>
                                                    <td className="amount-cell">{m.txSales > 0 ? `₩${m.txSales.toLocaleString()}` : '-'}</td>
                                                    <td className="amount-cell">{m.vSales > 0 ? `₩${m.vSales.toLocaleString()}` : '-'}</td>
                                                    <td className={`amount-cell ${!m.salesMatch && hasData ? 'diff-cell' : ''}`}>
                                                        {hasData && m.salesDiff !== 0 ? (
                                                            <span className="diff-value">{m.salesDiff > 0 ? '+' : ''}₩{m.salesDiff.toLocaleString()}</span>
                                                        ) : hasData ? <span className="match-check">✓</span> : '-'}
                                                    </td>
                                                    <td className="amount-cell">{m.txPurchases > 0 ? `₩${m.txPurchases.toLocaleString()}` : '-'}</td>
                                                    <td className="amount-cell">{m.vPurchases > 0 ? `₩${m.vPurchases.toLocaleString()}` : '-'}</td>
                                                    <td className={`amount-cell ${!m.purchasesMatch && hasData ? 'diff-cell' : ''}`}>
                                                        {hasData && m.purchasesDiff !== 0 ? (
                                                            <span className="diff-value">{m.purchasesDiff > 0 ? '+' : ''}₩{m.purchasesDiff.toLocaleString()}</span>
                                                        ) : hasData ? <span className="match-check">✓</span> : '-'}
                                                    </td>
                                                    <td className="status-cell">
                                                        {hasData ? (
                                                            hasMismatch ? (
                                                                <span className="status-badge status-mismatch"><AlertTriangle size={12} /> 불일치</span>
                                                            ) : (
                                                                <span className="status-badge status-match"><CheckCircle size={12} /> 일치</span>
                                                            )
                                                        ) : <span style={{ color: '#cbd5e1' }}>—</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="total-row">
                                            <td><strong>합계</strong></td>
                                            <td className="amount-cell"><strong>₩{reconciliationSummary.txSales.toLocaleString()}</strong></td>
                                            <td className="amount-cell"><strong>₩{reconciliationSummary.vSales.toLocaleString()}</strong></td>
                                            <td className={`amount-cell ${Math.abs(reconciliationSummary.salesDiff) >= 1 ? 'diff-cell' : ''}`}>
                                                <strong>{reconciliationSummary.salesDiff !== 0 ? `${reconciliationSummary.salesDiff > 0 ? '+' : ''}₩${reconciliationSummary.salesDiff.toLocaleString()}` : '✓'}</strong>
                                            </td>
                                            <td className="amount-cell"><strong>₩{reconciliationSummary.txPurchases.toLocaleString()}</strong></td>
                                            <td className="amount-cell"><strong>₩{reconciliationSummary.vPurchases.toLocaleString()}</strong></td>
                                            <td className={`amount-cell ${Math.abs(reconciliationSummary.purchasesDiff) >= 1 ? 'diff-cell' : ''}`}>
                                                <strong>{reconciliationSummary.purchasesDiff !== 0 ? `${reconciliationSummary.purchasesDiff > 0 ? '+' : ''}₩${reconciliationSummary.purchasesDiff.toLocaleString()}` : '✓'}</strong>
                                            </td>
                                            <td className="status-cell">
                                                {reconciliationSummary.mismatchCount === 0 ? (
                                                    <span className="status-badge status-match"><CheckCircle size={12} /> 전체 일치</span>
                                                ) : (
                                                    <span className="status-badge status-mismatch"><AlertTriangle size={12} /> {reconciliationSummary.mismatchCount}건 불일치</span>
                                                )}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* 거래처별 대사 테이블 */}
                    {reconView === 'client' && (
                        <div className="glass-panel table-section">
                            <h3 className="section-title"><Search size={18} /> 거래처별 입출고 vs 전표 비교</h3>
                            {clientReconciliationData.length === 0 ? (
                                <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>거래처 데이터가 없습니다.</p>
                            ) : (
                                <div className="closing-table-wrapper">
                                    <table className="closing-table recon-table">
                                        <thead>
                                            <tr>
                                                <th rowSpan={2} style={{ verticalAlign: 'middle' }}>거래처</th>
                                                <th colSpan={3} className="recon-header-sales">매출</th>
                                                <th colSpan={3} className="recon-header-purchase">매입</th>
                                                <th rowSpan={2} style={{ verticalAlign: 'middle' }}>상태</th>
                                            </tr>
                                            <tr>
                                                <th className="sub-header">입출고</th>
                                                <th className="sub-header">전표</th>
                                                <th className="sub-header">차이</th>
                                                <th className="sub-header">입출고</th>
                                                <th className="sub-header">전표</th>
                                                <th className="sub-header">차이</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {clientReconciliationData.map(c => {
                                                const hasMismatch = !c.salesMatch || !c.purchasesMatch;
                                                return (
                                                    <tr key={c.client} className={hasMismatch ? 'mismatch-row' : ''}>
                                                        <td style={{ fontWeight: 600, color: '#1e293b', textAlign: 'left' }}>{c.client}</td>
                                                        <td className="amount-cell">{c.txSales > 0 ? `₩${c.txSales.toLocaleString()}` : '-'}</td>
                                                        <td className="amount-cell">{c.vSales > 0 ? `₩${c.vSales.toLocaleString()}` : '-'}</td>
                                                        <td className={`amount-cell ${!c.salesMatch ? 'diff-cell' : ''}`}>
                                                            {c.salesDiff !== 0 ? (
                                                                <span className="diff-value">{c.salesDiff > 0 ? '+' : ''}₩{c.salesDiff.toLocaleString()}</span>
                                                            ) : <span className="match-check">✓</span>}
                                                        </td>
                                                        <td className="amount-cell">{c.txPurchases > 0 ? `₩${c.txPurchases.toLocaleString()}` : '-'}</td>
                                                        <td className="amount-cell">{c.vPurchases > 0 ? `₩${c.vPurchases.toLocaleString()}` : '-'}</td>
                                                        <td className={`amount-cell ${!c.purchasesMatch ? 'diff-cell' : ''}`}>
                                                            {c.purchasesDiff !== 0 ? (
                                                                <span className="diff-value">{c.purchasesDiff > 0 ? '+' : ''}₩{c.purchasesDiff.toLocaleString()}</span>
                                                            ) : <span className="match-check">✓</span>}
                                                        </td>
                                                        <td className="status-cell">
                                                            {hasMismatch ? (
                                                                <span className="status-badge status-mismatch"><AlertTriangle size={12} /> 불일치</span>
                                                            ) : (
                                                                <span className="status-badge status-match"><CheckCircle size={12} /> 일치</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* 전표 등록/수정 모달 */}
            <Modal
                title={isEditMode ? '전표 수정' : '전표 일괄 등록'}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                {isEditMode ? (
                    /* ──── 수정 모드: 단일 품목 ──── */
                    <>
                        <div className="form-group">
                            <label className="form-label">전표 구분 *</label>
                            <select className="form-input" value={newVoucher.voucher_type}
                                onChange={(e) => setNewVoucher({ ...newVoucher, voucher_type: e.target.value })}>
                                <option value="매출">매출</option>
                                <option value="매입">매입</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">전표 일자 *</label>
                            <input type="date" className="form-input" value={newVoucher.voucher_date}
                                onChange={(e) => setNewVoucher({ ...newVoucher, voucher_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">품목 선택 *</label>
                            <div className="autocomplete-wrapper">
                                <input className="form-input" value={itemSearch} placeholder="품목명 검색..."
                                    onChange={(e) => { setItemSearch(e.target.value); setShowItemDropdown(true); }}
                                    onFocus={() => setShowItemDropdown(true)} />
                                {showItemDropdown && (
                                    <div className="autocomplete-dropdown">
                                        {(products || []).filter(p => {
                                            if (!itemSearch) return true;
                                            const q = itemSearch.toLowerCase();
                                            return (p.name || '').toLowerCase().includes(q) || (p.product_code || '').toLowerCase().includes(q);
                                        }).slice(0, 10).map(p => (
                                            <div key={p.id} className="autocomplete-item" onClick={() => {
                                                setNewVoucher({ ...newVoucher, item_name: p.name, item_code: p.product_code || '', unit_price: p.unit_price || newVoucher.unit_price });
                                                setItemSearch(`${p.product_code ? `[${p.product_code}] ` : ''}${p.name}`);
                                                setShowItemDropdown(false);
                                            }}>
                                                <span className="ac-code">{p.product_code || '-'}</span>
                                                <span className="ac-name">{p.name}</span>
                                                {p.unit_price ? <span className="ac-price">₩{Number(p.unit_price).toLocaleString()}</span> : null}
                                            </div>
                                        ))}
                                        {(products || []).filter(p => {
                                            if (!itemSearch) return true;
                                            const q = itemSearch.toLowerCase();
                                            return (p.name || '').toLowerCase().includes(q) || (p.product_code || '').toLowerCase().includes(q);
                                        }).length === 0 && (
                                                <div className="autocomplete-empty">일치하는 품목이 없습니다</div>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">수량 *</label>
                            <input type="number" className="form-input" value={newVoucher.quantity}
                                onChange={(e) => setNewVoucher({ ...newVoucher, quantity: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">단가 *</label>
                            <input type="number" className="form-input" value={newVoucher.unit_price} placeholder="0"
                                onChange={(e) => setNewVoucher({ ...newVoucher, unit_price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">거래처</label>
                            <input className="form-input" value={newVoucher.client}
                                onChange={(e) => setNewVoucher({ ...newVoucher, client: e.target.value })}
                                placeholder="거래처명" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">비고</label>
                            <textarea className="form-input" value={newVoucher.notes} rows="2" placeholder="메모사항"
                                onChange={(e) => setNewVoucher({ ...newVoucher, notes: e.target.value })} />
                        </div>
                    </>
                ) : (
                    /* ──── 신규 등록 모드: 복수 품목 ──── */
                    <>
                        {/* 공통 정보 영역 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">전표 구분 *</label>
                                <select className="form-input" value={voucherCommon.voucher_type}
                                    onChange={(e) => setVoucherCommon({ ...voucherCommon, voucher_type: e.target.value })}>
                                    <option value="매출">매출</option>
                                    <option value="매입">매입</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">전표 일자 *</label>
                                <input type="date" className="form-input" value={voucherCommon.voucher_date}
                                    onChange={(e) => setVoucherCommon({ ...voucherCommon, voucher_date: e.target.value })} />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">거래처</label>
                            <div className="autocomplete-wrapper">
                                <input className="form-input" value={clientSearch} placeholder="거래처명 검색..."
                                    onChange={(e) => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                                    onFocus={() => setShowClientDropdown(true)} />
                                {showClientDropdown && (
                                    <div className="autocomplete-dropdown">
                                        {(suppliers || []).filter(s => {
                                            if (!clientSearch) return true;
                                            return (s.name || '').toLowerCase().includes(clientSearch.toLowerCase());
                                        }).slice(0, 10).map(s => (
                                            <div key={s.id} className="autocomplete-item" onClick={() => {
                                                setVoucherCommon({ ...voucherCommon, client: s.name });
                                                setClientSearch(s.name);
                                                setShowClientDropdown(false);
                                            }}>
                                                <span className="ac-name">{s.name}</span>
                                            </div>
                                        ))}
                                        {(suppliers || []).filter(s => {
                                            if (!clientSearch) return true;
                                            return (s.name || '').toLowerCase().includes(clientSearch.toLowerCase());
                                        }).length === 0 && (
                                                <div className="autocomplete-empty">일치하는 거래처가 없습니다</div>
                                            )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 품목 리스트 헤더 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 0.5rem' }}>
                            <label className="form-label" style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>📦 품목 목록 ({voucherItems.filter(i => i.item_name).length}건)</label>
                            <button type="button" onClick={addVoucherItemRow}
                                style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Plus size={14} /> 품목 추가
                            </button>
                        </div>

                        {/* 품목 행들 */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                            {voucherItems.map((item, idx) => (
                                <div key={idx} style={{ background: item.item_name ? '#f8fafc' : '#fff', border: `1px solid ${item.item_name ? '#e2e8f0' : '#fca5a5'}`, borderRadius: '10px', padding: '0.6rem 0.75rem', position: 'relative' }}>
                                    {/* 삭제 버튼 */}
                                    {voucherItems.length > 1 && (
                                        <button type="button" onClick={() => removeVoucherItemRow(idx)}
                                            style={{ position: 'absolute', top: '4px', right: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '2px' }}
                                            title="삭제">
                                            <X size={14} />
                                        </button>
                                    )}
                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700, marginBottom: '0.35rem' }}>#{idx + 1}</div>
                                    {/* 품목 선택 */}
                                    <div className="autocomplete-wrapper" style={{ marginBottom: '0.4rem' }}>
                                        <input className="form-input" value={item.searchText} placeholder="품목 검색..."
                                            style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem' }}
                                            onChange={(e) => { updateVoucherItem(idx, 'searchText', e.target.value); setActiveItemDropdown(idx); }}
                                            onFocus={() => setActiveItemDropdown(idx)} />
                                        {activeItemDropdown === idx && (
                                            <div className="autocomplete-dropdown">
                                                {(products || []).filter(p => {
                                                    if (!item.searchText) return true;
                                                    const q = item.searchText.toLowerCase();
                                                    return (p.name || '').toLowerCase().includes(q) || (p.product_code || '').toLowerCase().includes(q);
                                                }).slice(0, 8).map(p => (
                                                    <div key={p.id} className="autocomplete-item" onClick={() => selectProductForItem(idx, p)}>
                                                        <span className="ac-code">{p.product_code || '-'}</span>
                                                        <span className="ac-name">{p.name}</span>
                                                        {p.unit_price ? <span className="ac-price">₩{Number(p.unit_price).toLocaleString()}</span> : null}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* 수량 / 단가 한 줄 */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>수량</div>
                                            <input type="number" className="form-input" value={item.quantity}
                                                style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => updateVoucherItem(idx, 'quantity', parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>단가</div>
                                            <input type="number" className="form-input" value={item.unit_price}
                                                style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem' }}
                                                onFocus={(e) => e.target.select()}
                                                onChange={(e) => updateVoucherItem(idx, 'unit_price', parseFloat(e.target.value) || 0)} />
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>금액</div>
                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#4f46e5', padding: '0.35rem 0' }}>
                                                ₩{(item.quantity * item.unit_price).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* 합계 */}
                        {voucherItems.some(i => i.item_name) && (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: voucherCommon.voucher_type === '매출' ? '#ecfdf5' : '#eff6ff', borderRadius: '10px', border: `1px solid ${voucherCommon.voucher_type === '매출' ? '#a7f3d0' : '#93c5fd'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                                    총 {voucherItems.filter(i => i.item_name).length}건
                                </span>
                                <span style={{ fontWeight: 800, fontSize: '1.15rem', color: voucherCommon.voucher_type === '매출' ? '#059669' : '#2563eb' }}>
                                    ₩{voucherItems.reduce((sum, i) => sum + (i.quantity * i.unit_price), 0).toLocaleString()}
                                </span>
                            </div>
                        )}

                        <div className="form-group" style={{ marginTop: '0.75rem' }}>
                            <label className="form-label">비고</label>
                            <textarea className="form-input" value={voucherCommon.notes} rows="2" placeholder="메모사항"
                                onChange={(e) => setVoucherCommon({ ...voucherCommon, notes: e.target.value })} />
                        </div>
                    </>
                )}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleVoucherSave}>
                        {isEditMode ? '수정' : `${voucherItems.filter(i => i.item_name && i.quantity > 0).length}건 일괄 등록`}
                    </button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1.5rem; max-width: 1600px; margin: 0 auto; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
                .page-subtitle { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .page-description { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; }

                .year-selector { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: white; border: 2px solid #e2e8f0; border-radius: 10px; }
                .year-selector select { border: none; outline: none; font-weight: 700; font-size: 0.95rem; background: transparent; cursor: pointer; }

                .btn-primary-sales { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: 10px; display: flex; align-items: center; gap: 0.5rem; font-weight: 600; transition: all 0.2s; border: none; cursor: pointer; }
                .btn-primary-sales:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3); }

                /* 탭 네비게이션 */
                .sales-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; background: white; padding: 0.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .sales-tab { padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; color: #64748b; transition: all 0.2s; display: flex; align-items: center; gap: 6px; font-size: 0.9rem; border: none; cursor: pointer; background: transparent; position: relative; }
                .sales-tab:hover { background: #f1f5f9; color: #1e293b; }
                .sales-tab.active { background: var(--primary); color: white; box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3); }
                .mismatch-badge { position: absolute; top: 4px; right: 4px; background: #ef4444; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; font-weight: 800; display: flex; align-items: center; justify-content: center; }

                /* 요약 카드 */
                .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
                .summary-card { padding: 1.25rem; border-radius: 14px; display: flex; align-items: center; gap: 1rem; transition: all 0.2s; }
                .summary-card.sales { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; }
                .summary-card.purchases { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; }
                .summary-card.profit { background: linear-gradient(135deg, #fefce8, #fef3c7); border: 1px solid #fde68a; }
                .summary-card.count { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #c4b5fd; }
                .summary-card.recon-warn { background: linear-gradient(135deg, #fffbeb, #fef3c7); border: 1px solid #fde68a; }
                .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #10b981, #059669); color: white; flex-shrink: 0; }
                .purchase-icon { background: linear-gradient(135deg, #3b82f6, #2563eb) !important; }
                .profit-icon { background: linear-gradient(135deg, #f59e0b, #d97706) !important; }
                .count-icon { background: linear-gradient(135deg, #7c3aed, #6d28d9) !important; }
                .card-body { display: flex; flex-direction: column; }
                .card-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }
                .card-value { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin-top: 2px; }
                .card-change { font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; gap: 2px; margin-top: 4px; }
                .card-change.positive { color: #10b981; }
                .card-change.negative { color: #ef4444; }

                /* 차트 */
                .chart-section { padding: 1.5rem; margin-bottom: 1.5rem; }
                .section-title { font-size: 1rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; margin-bottom: 1.25rem; }
                .chart-container { display: flex; gap: 6px; height: 180px; align-items: flex-end; padding: 0 4px; }
                .chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .chart-bar-group.current .bar-label { color: #4f46e5; font-weight: 800; }
                .bar-wrapper { display: flex; gap: 3px; height: 160px; align-items: flex-end; width: 100%; justify-content: center; }
                .bar { width: 45%; min-height: 2px; border-radius: 4px 4px 0 0; transition: height 0.5s ease; cursor: pointer; }
                .bar:hover { opacity: 0.8; }
                .sales-bar { background: linear-gradient(to top, #10b981, #34d399); }
                .purchase-bar { background: linear-gradient(to top, #3b82f6, #60a5fa); }
                .bar-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
                .chart-legend { display: flex; gap: 1.5rem; justify-content: center; margin-top: 1rem; }
                .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #64748b; font-weight: 600; }
                .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
                .sales-dot { background: #10b981; }
                .purchase-dot { background: #3b82f6; }

                /* 마감 테이블 */
                .table-section { padding: 1.5rem; }
                .closing-table-wrapper { overflow-x: auto; }
                .closing-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
                .closing-table th { padding: 10px 14px; text-align: left; font-weight: 700; font-size: 0.8rem; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px; }
                .closing-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
                .closing-table tbody tr:hover { background: #fafbff; }
                .current-row { background: #f5f3ff !important; }
                .current-row:hover { background: #ede9fe !important; }
                .month-cell { font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px; }
                .current-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; background: #4f46e5; color: white; }
                .amount-cell { font-weight: 600; font-variant-numeric: tabular-nums; }
                .sales-text { color: #059669; }
                .purchase-text { color: #2563eb; }
                .rate-cell { text-align: center; }
                .rate-badge { padding: 2px 8px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; }
                .rate-badge.positive { background: #ecfdf5; color: #059669; }
                .rate-badge.negative { background: #fef2f2; color: #dc2626; }
                .count-cell { text-align: center; color: #64748b; }
                .total-row { background: #f8fafc; border-top: 2px solid #e2e8f0; }
                .total-row td { padding: 14px; }

                /* 전표 필터 */
                .voucher-filter-bar { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
                .v-filter-btn { padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; color: #64748b; border: 1px solid #e2e8f0; background: white; cursor: pointer; transition: all 0.2s; }
                .v-filter-btn:hover { border-color: var(--primary); color: var(--primary); }
                .v-filter-btn.active { background: var(--primary); color: white; border-color: var(--primary); }

                /* 전표 배지 */
                .v-type-badge { padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
                .v-type-sales { background: #dcfce7; color: #059669; }
                .v-type-purchase { background: #dbeafe; color: #2563eb; }

                /* 대사 테이블 */
                .recon-table th { text-align: center; }
                .recon-header-sales { background: #ecfdf5 !important; color: #059669 !important; border-bottom: 2px solid #a7f3d0 !important; }
                .recon-header-purchase { background: #eff6ff !important; color: #2563eb !important; border-bottom: 2px solid #93c5fd !important; }
                .sub-header { font-size: 0.72rem !important; font-weight: 600 !important; padding: 6px 10px !important; }
                .recon-table td { text-align: center; }
                .recon-table .month-cell { justify-content: center; }
                .mismatch-row { background: #fef2f2 !important; }
                .mismatch-row:hover { background: #fee2e2 !important; }
                .diff-cell { color: #dc2626 !important; }
                .diff-value { color: #dc2626; font-weight: 700; }
                .match-check { color: #10b981; font-weight: 700; font-size: 1rem; }
                .status-cell { text-align: center !important; }
                .status-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 0.78rem; font-weight: 700; }
                .status-match { background: #dcfce7; color: #059669; }
                .status-mismatch { background: #fef2f2; color: #dc2626; }

                /* 자동완성 드롭다운 */
                .autocomplete-wrapper { position: relative; }
                .autocomplete-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.12); max-height: 220px; overflow-y: auto; z-index: 100; margin-top: 4px; }
                .autocomplete-item { padding: 0.6rem 0.75rem; display: flex; align-items: center; gap: 0.5rem; cursor: pointer; transition: background 0.15s; font-size: 0.88rem; }
                .autocomplete-item:hover { background: #f1f5f9; }
                .ac-code { color: #6366f1; font-weight: 700; font-size: 0.78rem; min-width: 60px; }
                .ac-name { flex: 1; color: #1e293b; font-weight: 500; }
                .ac-price { color: #10b981; font-weight: 600; font-size: 0.8rem; }
                .autocomplete-empty { padding: 0.75rem; color: #94a3b8; text-align: center; font-size: 0.85rem; }

                /* 아이콘 버튼 */
                .icon-btn { padding: 0.5rem; border-radius: 6px; color: #64748b; transition: all 0.2s; border: none; cursor: pointer; background: transparent; }
                .icon-btn:hover { background: #f1f5f9; color: var(--primary); }
                .delete-btn:hover { color: #dc2626; background: #fee2e2; }

                @media (max-width: 768px) {
                    .summary-cards { grid-template-columns: repeat(2, 1fr); }
                    .chart-container { height: 140px; }
                    .card-value { font-size: 1rem; }
                    .sales-tabs { flex-wrap: wrap; }
                    .recon-table { font-size: 0.75rem; }
                    .recon-table th, .recon-table td { padding: 6px 4px; }
                }
                @media (max-width: 480px) {
                    .summary-cards { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Sales;
