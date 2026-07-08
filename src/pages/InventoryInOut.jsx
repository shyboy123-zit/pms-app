import React, { useState, useEffect } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import DateRangePicker from '../components/DateRangePicker';
import ExcelToolbar from '../components/ExcelToolbar';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import InventoryValuation from '../components/InventoryValuation';
import { Package, TrendingUp, TrendingDown, Edit, Trash2, Plus, RefreshCw, X, Camera, Search } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const InventoryInOut = () => {
    const {
        inventoryTransactions,
        products,
        suppliers,
        addInventoryTransaction,
        updateInventoryTransaction,
        deleteInventoryTransaction,
        getTransactionsByDateRange,
        vouchers,
        addVoucher,
        updateVoucher,
        deleteVoucher
    } = useData();
    const { can } = useAuth();

    // 활성 거래처 목록 (드롭다운용)
    const activeSuppliers = (suppliers || []).filter(s => s.status === '활성');

    const [activeTab, setActiveTab] = useState('all'); // 'all', 'in', 'out', 'adjust', 'status'
    const [actualStock, setActualStock] = useState(0);
    const [systemStock, setSystemStock] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [itemFilter, setItemFilter] = useState('all'); // 특정 품목만 조회
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

    // 거래처 직접입력 토글 (드롭다운에 없는 거래처를 입력할 때 사용)
    const [isBatchClientCustom, setIsBatchClientCustom] = useState(false);
    const [isEditClientCustom, setIsEditClientCustom] = useState(false);

    // 바코드 스캐너 상태 (Phase 4b)
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerTargetIdx, setScannerTargetIdx] = useState(-1); // 다건 등록 시 어느 행에 적용할지

    const openScanner = (idx) => {
        setScannerTargetIdx(idx);
        setIsScannerOpen(true);
    };

    const handleScanResult = (decodedText) => {
        // product_code 우선 매칭, 없으면 name으로
        const code = String(decodedText).trim();
        const product = products.find(p => p.product_code === code) || products.find(p => p.name === code);
        if (!product) {
            alert(`스캔된 코드 '${code}'에 일치하는 제품이 없습니다.\n제품 관리에서 먼저 등록해주세요.`);
            return;
        }
        if (scannerTargetIdx >= 0) {
            selectBatchProduct(scannerTargetIdx, product);
        }
        setIsScannerOpen(false);
        setScannerTargetIdx(-1);
    };

    // 재고조정 사유 코드 (자유서술 → 표준 코드로 분류)
    const ADJUST_REASONS = [
        { code: 'PHYSICAL_COUNT', label: '실사 오차 (정기 실사 결과)' },
        { code: 'DAMAGE', label: '파손/불량 폐기' },
        { code: 'LOSS', label: '분실/도난' },
        { code: 'SAMPLE', label: '시제품/샘플 출고' },
        { code: 'INTERNAL_USE', label: '내부 소모/시험' },
        { code: 'RETURN', label: '반품 처리' },
        { code: 'INITIAL', label: '기초재고 등록' },
        { code: 'OTHER', label: '기타 (비고에 상세 기재)' }
    ];
    const [adjustReason, setAdjustReason] = useState('PHYSICAL_COUNT');
    const [isSaving, setIsSaving] = useState(false); // 등록/수정 중복 제출(더블클릭) 방지

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
    }, [inventoryTransactions, activeTab, startDate, endDate, itemFilter]);

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

        // Filter by item (특정 품목만)
        if (itemFilter !== 'all') {
            filtered = filtered.filter(t => (t.item_name || '') === itemFilter);
        }

        setFilteredTransactions(filtered);
    };

    // 거래내역에 등장한 품목 목록 (중복 제거·정렬)
    const itemOptions = React.useMemo(() => {
        const set = new Set();
        (inventoryTransactions || []).forEach(t => { if (t.item_name) set.add(t.item_name); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [inventoryTransactions]);

    // 시스템 재고 계산 함수 (item_code 또는 item_name 기준 매칭)
    const getSystemStock = (itemCode, itemName) => {
        let stock = 0;
        (inventoryTransactions || []).forEach(t => {
            // item_code가 일치하거나, item_name이 일치하면 같은 제품
            const codeMatch = itemCode && t.item_code && t.item_code === itemCode;
            const nameMatch = itemName && t.item_name && t.item_name === itemName;
            if (codeMatch || nameMatch) {
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

    // 중복 매출전표 방지: 같은 (일자/품목/수량/거래처) 매출 전표가 이미 있으면 true
    // (텔레그램 봇·중복 입력·수정과 겹쳐 전표가 부풀어 거래처 대사가 틀어지는 문제 방지)
    const salesVoucherExists = (date, item, qty, client) =>
        (vouchers || []).some(v =>
            v.voucher_type === '매출' &&
            v.voucher_date === date &&
            (v.item_name || '') === (item || '') &&
            parseFloat(v.quantity) === parseFloat(qty) &&
            (v.client || '') === (client || '')
        );

    // ── 텔레그램 출하요청서 ↔ 앱 입출고 자동 대사 ──
    // 텔레그램 봇은 '출하요청' 시점(실제 출고보다 앞선 날짜)에 출고+매출전표를 먼저 등록한다.
    // 이후 실제 출고를 앱에서 다시 등록하면 같은 물량이 이중 계상된다.
    // → 앱에서 OUT 등록 시, 같은 (품목·수량·거래처)의 '미대사 텔레그램 출고'가 최근 N일 내에
    //    (요청일 ≤ 실제출고일) 있으면 그 재고행+매출전표를 제거해 1:1 상쇄한다.
    //    정상적인 반복 출고는 텔레그램 원본이 1건뿐이라 1회만 매칭되어 영향받지 않는다.
    const RECONCILE_WINDOW_DAYS = 10;
    const daysApart = (a, b) => Math.abs((new Date(a) - new Date(b)) / 86400000);
    const findTelegramOutDup = (item, qty, client, appDate, consumedIds) =>
        (inventoryTransactions || []).find(t =>
            t.transaction_type === 'OUT' &&
            !consumedIds.has(t.id) &&
            (t.item_name || '') === (item || '') &&
            parseFloat(t.quantity) === parseFloat(qty) &&
            (t.client || '') === (client || '') &&
            /\[출하요청서\]/.test(t.notes || '') &&
            new Date(t.transaction_date) <= new Date(appDate) &&
            daysApart(t.transaction_date, appDate) <= RECONCILE_WINDOW_DAYS
        );
    // 텔레그램 출고 재고행에 대응하는 텔레그램 매출전표(같은 일자·품목·수량·거래처, [자동-텔레그램])
    const findTelegramVoucher = (tgTx) =>
        (vouchers || []).find(v =>
            v.voucher_type === '매출' &&
            v.voucher_date === tgTx.transaction_date &&
            (v.item_name || '') === (tgTx.item_name || '') &&
            parseFloat(v.quantity) === parseFloat(tgTx.quantity) &&
            (v.client || '') === (tgTx.client || '') &&
            /\[자동-텔레그램\]/.test(v.notes || '')
        );

    // 중복 제출 가드: 저장이 끝나기 전 재클릭/재실행을 차단. 실제 로직은 handleSaveInner.
    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);
        try {
            await handleSaveInner();
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveInner = async () => {
        // ── 수정 모드 (단일) ──
        if (isEditMode && editingId) {
            if (newItem.transactionType === 'ADJUST') {
                if (!newItem.itemName) return alert('품목을 선택해주세요.');
                const diff = actualStock - systemStock;
                if (diff === 0) return alert('조정할 수량 차이가 없습니다.');
                const reasonLabel = ADJUST_REASONS.find(r => r.code === adjustReason)?.label || adjustReason;
                await updateInventoryTransaction(editingId, {
                    transaction_type: 'ADJUST',
                    item_name: newItem.itemName,
                    item_code: newItem.itemCode,
                    quantity: diff,
                    unit: newItem.unit,
                    unit_price: parseFloat(newItem.unitPrice) || 0,
                    transaction_date: newItem.transactionDate,
                    client: '',
                    notes: `[재고조정:${adjustReason}] 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff}) / 사유: ${reasonLabel}${newItem.notes ? ' / ' + newItem.notes : ''}`
                }, { reason: reasonLabel, context: 'inventory:adjust_update' });
            } else {
                // 입고/출고 수정: product_id 필수
                if (!newItem.productId) return alert('제품을 선택해주세요. (자유입력은 더 이상 허용되지 않습니다)');
                if (!newItem.itemName || newItem.quantity <= 0) return alert('품목명과 수량을 입력해주세요.');

                // 출고 시 음수 재고 방지 (기존 거래 본인은 제외하고 시뮬레이션)
                if (newItem.transactionType === 'OUT') {
                    const original = inventoryTransactions.find(t => t.id === editingId);
                    let stockBefore = getSystemStock(newItem.itemCode, newItem.itemName);
                    if (original) {
                        // 기존 영향 되돌리기
                        if (original.transaction_type === 'OUT') stockBefore += parseFloat(original.quantity);
                        else if (original.transaction_type === 'IN' || original.transaction_type === 'ADJUST') stockBefore -= parseFloat(original.quantity);
                    }
                    const afterOut = stockBefore - parseFloat(newItem.quantity);
                    if (afterOut < 0) {
                        return alert(`출고 후 재고가 음수가 됩니다.\n현재 가용 재고: ${stockBefore.toLocaleString()} ${newItem.unit}\n출고 요청: ${parseFloat(newItem.quantity).toLocaleString()} ${newItem.unit}\n부족: ${Math.abs(afterOut).toLocaleString()} ${newItem.unit}`);
                    }
                }

                const original = inventoryTransactions.find(t => t.id === editingId);
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
                }, { context: 'inventory:update' });

                // ── 매출 전표 동기화 (OUT 거래 변경 시) ──
                // 기존 voucher 매칭: 원래 거래의 (date, item, qty, client)로 찾기
                const findMatchingVoucher = (refDate, refItem, refQty, refClient) => {
                    if (!vouchers) return null;
                    return vouchers.find(v =>
                        v.voucher_type === '매출' &&
                        v.voucher_date === refDate &&
                        v.item_name === refItem &&
                        parseFloat(v.quantity) === parseFloat(refQty) &&
                        (v.client || '') === (refClient || '')
                    );
                };
                // 거래ID 태그(#id) 기반 매칭 — 수량/일자가 바뀌어도 정확히 찾음 (값 매칭은 폴백)
                const findVoucherByTx = (txId) =>
                    (vouchers || []).find(v => v.voucher_type === '매출' && (v.notes || '').includes(`#${txId}`));
                const tagNote = (label) => `[자동-입출고 ${label}#${editingId}] ${newItem.itemName} ${newItem.quantity}${newItem.unit} 출고`;
                const wasOut = original?.transaction_type === 'OUT';
                const isOut = newItem.transactionType === 'OUT';

                try {
                    if (wasOut && isOut) {
                        // OUT → OUT: 연결된 voucher UPDATE (태그 우선, 없으면 값 매칭)
                        const existing = findVoucherByTx(editingId) ||
                            findMatchingVoucher(original.transaction_date, original.item_name, original.quantity, original.client);
                        if (existing && updateVoucher) {
                            await updateVoucher(existing.id, {
                                voucher_date: newItem.transactionDate,
                                item_name: newItem.itemName,
                                item_code: newItem.itemCode,
                                quantity: parseFloat(newItem.quantity),
                                unit: newItem.unit,
                                unit_price: parseFloat(newItem.unitPrice),
                                client: newItem.client,
                                notes: tagNote('수정')
                            });
                        } else if (addVoucher && !salesVoucherExists(newItem.transactionDate, newItem.itemName, newItem.quantity, newItem.client)) {
                            // 기존 voucher가 없으면 신규 생성 (과거 누락분 보완) — 단, 동일 전표 중복 방지
                            await addVoucher({
                                voucher_date: newItem.transactionDate, voucher_type: '매출',
                                item_name: newItem.itemName, item_code: newItem.itemCode,
                                quantity: parseFloat(newItem.quantity), unit: newItem.unit,
                                unit_price: parseFloat(newItem.unitPrice), client: newItem.client,
                                notes: tagNote('수정생성')
                            });
                        }
                    } else if (!wasOut && isOut && addVoucher && !salesVoucherExists(newItem.transactionDate, newItem.itemName, newItem.quantity, newItem.client)) {
                        // non-OUT → OUT: voucher 신규 생성 (동일 전표 중복 방지)
                        await addVoucher({
                            voucher_date: newItem.transactionDate, voucher_type: '매출',
                            item_name: newItem.itemName, item_code: newItem.itemCode,
                            quantity: parseFloat(newItem.quantity), unit: newItem.unit,
                            unit_price: parseFloat(newItem.unitPrice), client: newItem.client,
                            notes: tagNote('수정생성')
                        });
                    } else if (wasOut && !isOut && deleteVoucher) {
                        // OUT → non-OUT: 연결된 voucher DELETE (태그 우선, 없으면 값 매칭)
                        const existing = findVoucherByTx(editingId) ||
                            findMatchingVoucher(original.transaction_date, original.item_name, original.quantity, original.client);
                        if (existing) await deleteVoucher(existing.id);
                    }
                } catch (e) {
                    console.error('매출 전표 동기화 실패:', e);
                    alert(`⚠️ 입출고 수정은 완료되었으나, 매출 전표 동기화에 실패했습니다.\n매입매출 페이지에서 직접 확인/수정 필요.\n원인: ${e.message || e}`);
                }
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
            const reasonLabel = ADJUST_REASONS.find(r => r.code === adjustReason)?.label || adjustReason;
            await addInventoryTransaction({
                transaction_type: 'ADJUST',
                item_name: newItem.itemName,
                item_code: newItem.itemCode,
                quantity: diff,
                unit: newItem.unit,
                unit_price: parseFloat(newItem.unitPrice) || 0,
                transaction_date: batchCommon.transactionDate,
                client: '',
                notes: `[재고조정:${adjustReason}] 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff}) / 사유: ${reasonLabel}${batchCommon.notes ? ' / ' + batchCommon.notes : ''}`
            }, { reason: reasonLabel, context: 'inventory:adjust_new' });
            resetForm();
            return;
        }

        // 입고/출고 다건 등록: 모든 항목이 product_id를 가지고 있어야 함
        const itemsWithoutProduct = batchItems.filter(item => item.itemName && item.quantity > 0 && !item.productId);
        if (itemsWithoutProduct.length > 0) {
            return alert('모든 품목은 등록된 제품에서 선택해야 합니다. (자유입력은 더 이상 허용되지 않습니다)');
        }
        const validItems = batchItems.filter(item => item.productId && item.itemName && item.quantity > 0);
        if (validItems.length === 0) return alert('최소 1개 이상의 품목을 입력해주세요.');

        // 출고 시 음수 재고 사전 시뮬레이션 (같은 품목 누적 출고도 함께 체크)
        if (batchCommon.transactionType === 'OUT') {
            const cumulativeOut = {};
            for (const item of validItems) {
                const key = item.itemCode || item.itemName;
                const currentStock = getSystemStock(item.itemCode, item.itemName);
                cumulativeOut[key] = (cumulativeOut[key] || 0) + parseFloat(item.quantity);
                if (currentStock - cumulativeOut[key] < 0) {
                    return alert(`'${item.itemName}'의 출고 후 재고가 음수가 됩니다.\n현재 가용 재고: ${currentStock.toLocaleString()} ${item.unit}\n출고 요청(누적): ${cumulativeOut[key].toLocaleString()} ${item.unit}\n부족: ${(cumulativeOut[key] - currentStock).toLocaleString()} ${item.unit}`);
                }
            }
        }

        // 출고인데 거래처 비어있으면 사전 차단 (자동 매출 전표 생성 시 고아 voucher 방지)
        if (batchCommon.transactionType === 'OUT' && !batchCommon.client?.trim()) {
            return alert('출고 거래는 거래처를 반드시 선택/입력해야 합니다. (매출 전표 자동 생성용)');
        }

        const voucherFailures = [];
        const createdVoucherKeys = new Set(); // 한 배치 내 동일 전표 중복 방지
        const reconciledTgIds = new Set(); // 이번 등록에서 상쇄한 텔레그램 재고행 (중복매칭 방지)
        const reconciledLog = [];           // 상쇄 결과 안내용
        for (const item of validItems) {
            // 출고면 먼저 텔레그램 '예정 출고'와 자동 대사 (있으면 텔레그램 재고행+전표 제거)
            if (batchCommon.transactionType === 'OUT' && batchCommon.client) {
                const tgDup = findTelegramOutDup(item.itemName, item.quantity, batchCommon.client, batchCommon.transactionDate, reconciledTgIds);
                if (tgDup) {
                    reconciledTgIds.add(tgDup.id);
                    try {
                        const tgV = findTelegramVoucher(tgDup);
                        if (tgV && deleteVoucher) await deleteVoucher(tgV.id);
                        if (deleteInventoryTransaction) await deleteInventoryTransaction(tgDup.id);
                        reconciledLog.push(`${item.itemName} ${parseFloat(item.quantity).toLocaleString()}${item.unit} (텔레그램 ${tgDup.transaction_date} 요청분 상쇄)`);
                    } catch (e) {
                        console.error('텔레그램 출고 대사 실패:', e);
                    }
                }
            }
            const { data: txData } = await addInventoryTransaction({
                transaction_type: batchCommon.transactionType,
                item_name: item.itemName,
                item_code: item.itemCode,
                quantity: parseFloat(item.quantity),
                unit: item.unit,
                unit_price: parseFloat(item.unitPrice),
                transaction_date: batchCommon.transactionDate,
                client: batchCommon.client,
                notes: batchCommon.notes
            }, { context: `inventory:batch_${batchCommon.transactionType.toLowerCase()}` });
            const newTxId = txData && txData[0] ? txData[0].id : null;

            // 출고 → 매출 전표 자동 생성 (입고는 제품 입고이므로 매입 아님)
            if (addVoucher && batchCommon.transactionType === 'OUT') {
                // 중복 방지: 동일 (일자/품목/수량/거래처) 전표가 이미 있거나 이번 배치에서 만들었으면 스킵
                const dupKey = `${batchCommon.transactionDate}|${item.itemName}|${parseFloat(item.quantity)}|${batchCommon.client || ''}`;
                if (salesVoucherExists(batchCommon.transactionDate, item.itemName, item.quantity, batchCommon.client) || createdVoucherKeys.has(dupKey)) {
                    continue;
                }
                createdVoucherKeys.add(dupKey);
                try {
                    const { error: vErr } = await addVoucher({
                        voucher_date: batchCommon.transactionDate,
                        voucher_type: '매출',
                        item_name: item.itemName,
                        item_code: item.itemCode,
                        quantity: parseFloat(item.quantity),
                        unit: item.unit,
                        unit_price: parseFloat(item.unitPrice),
                        client: batchCommon.client,
                        notes: `[자동-입출고${newTxId ? '#' + newTxId : ''}] ${item.itemName} ${item.quantity}${item.unit} 출고`
                    }) || {};
                    if (vErr) voucherFailures.push({ item: item.itemName, error: vErr.message || String(vErr) });
                } catch (e) {
                    console.error('매출 전표 생성 실패:', e);
                    voucherFailures.push({ item: item.itemName, error: e.message || String(e) });
                }
            }
        }
        const reconMsg = reconciledLog.length > 0
            ? `\n\n🔄 텔레그램 예정출고 ${reconciledLog.length}건 자동 대사(중복 제거):\n` +
              reconciledLog.map(r => `  - ${r}`).join('\n')
            : '';
        if (voucherFailures.length > 0) {
            alert(`⚠️ ${validItems.length}건 입출고는 등록되었으나, 매출 전표 ${voucherFailures.length}건 생성 실패\n` +
                  voucherFailures.map(f => `  - ${f.item}: ${f.error}`).join('\n') +
                  '\n매입매출 페이지에서 수동 보충 필요.' + reconMsg);
        } else {
            alert(`${validItems.length}건의 거래가 등록되었습니다.` + reconMsg);
        }
        resetForm();
    };

    const handleEdit = (row) => {
        // 기존 거래의 item_code/item_name으로 products에서 product_id 역추적
        const matchedProduct = products.find(p =>
            (row.item_code && p.product_code === row.item_code) ||
            (row.item_name && p.name === row.item_name)
        );
        setNewItem({
            transactionType: row.transaction_type,
            productId: matchedProduct?.id || '',
            itemName: row.item_name,
            itemCode: row.item_code || '',
            quantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unit_price || 0,
            transactionDate: row.transaction_date,
            client: row.client || '',
            notes: row.notes || ''
        });
        // 거래처가 활성 거래처 목록에 없으면 직접입력 모드로 초기화
        const clientInList = !!row.client && activeSuppliers.some(s => s.name === row.client);
        setIsEditClientCustom(!!row.client && !clientInList);

        // 재고조정 수정 시 사유 코드 복원
        if (row.transaction_type === 'ADJUST' && row.notes) {
            const reasonMatch = row.notes.match(/\[재고조정:([A-Z_]+)\]/);
            if (reasonMatch && ADJUST_REASONS.some(r => r.code === reasonMatch[1])) {
                setAdjustReason(reasonMatch[1]);
            }
            // 재고조정 수정에서는 systemStock/actualStock 복원
            const stockNow = getSystemStock(row.item_code, row.item_name);
            // 본인 거래 영향 제거: stockNow에서 row.quantity 빼야 진짜 "조정 전" 상태
            const stockBefore = stockNow - parseFloat(row.quantity);
            setSystemStock(stockBefore);
            setActualStock(stockBefore + parseFloat(row.quantity));
        }

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
        setIsBatchClientCustom(false);
        setIsEditClientCustom(false);
        setAdjustReason('PHYSICAL_COUNT');
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

    // Calculate current inventory status (item_name 기준 그룹핑)
    const getInventoryStatus = () => {
        const stockByName = {};

        (inventoryTransactions || []).forEach(trans => {
            // item_name을 기본 키로 사용하여 코드 유무와 관계없이 같은 품목 그룹핑
            const key = trans.item_name;
            if (!key) return;
            if (!stockByName[key]) {
                stockByName[key] = {
                    itemName: trans.item_name,
                    itemCode: trans.item_code,
                    stock: 0,
                    unit: trans.unit,
                    lastPrice: trans.unit_price
                };
            }

            // item_code가 있으면 업데이트 (빈 값보다 코드가 있는 게 우선)
            if (trans.item_code && !stockByName[key].itemCode) {
                stockByName[key].itemCode = trans.item_code;
            }

            if (trans.transaction_type === 'IN' || trans.transaction_type === 'ADJUST') {
                stockByName[key].stock += parseFloat(trans.quantity);
            } else if (trans.transaction_type === 'OUT') {
                stockByName[key].stock -= parseFloat(trans.quantity);
            }
            stockByName[key].lastPrice = trans.unit_price;
        });

        return Object.values(stockByName);
    };

    const inventoryStatus = getInventoryStatus();

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">입출고 관리</h2>
                    <p className="page-description">볼 조인트 베어링 제품의 입고/출고 현황을 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={filteredTransactions}
                        columns={[
                            { key: 'transaction_date', label: '일자' },
                            { key: 'transaction_type', label: '구분', format: (v) => v === 'IN' ? '입고' : v === 'OUT' ? '출고' : '재고조정' },
                            { key: 'item_code', label: '품목코드' },
                            { key: 'item_name', label: '품목명' },
                            { key: 'quantity', label: '수량', format: (v) => parseFloat(v) },
                            { key: 'unit', label: '단위' },
                            { key: 'unit_price', label: '단가', format: (v) => parseFloat(v || 0) },
                            { key: 'total_amount', label: '금액', format: (v) => parseFloat(v || 0) },
                            { key: 'client', label: '거래처' },
                            { key: 'notes', label: '비고' }
                        ]}
                        fileName="입출고내역"
                    />
                    {can('delivery', 'create') && (
                        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} /> 거래 등록
                        </button>
                    )}
                </div>
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
                <button
                    className={`tab ${activeTab === 'valuation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('valuation')}
                >
                    재고 평가
                </button>
            </div>

            {/* Date Range + Item Filter */}
            {activeTab !== 'status' && activeTab !== 'valuation' && (
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <DateRangePicker onApply={handleDateRangeApply} />
                    <div className="item-filter">
                        <Search size={15} />
                        <select value={itemFilter} onChange={(e) => setItemFilter(e.target.value)} title="특정 품목만 조회">
                            <option value="all">전체 품목</option>
                            {itemOptions.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        {itemFilter !== 'all' && (
                            <button className="item-filter-clear" onClick={() => setItemFilter('all')} title="품목 필터 해제">✕</button>
                        )}
                    </div>
                    {itemFilter !== 'all' && (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            「{itemFilter}」 {filteredTransactions.length}건
                        </span>
                    )}
                </div>
            )}

            {/* Transaction Table / Inventory Status / Valuation */}
            {activeTab === 'valuation' ? (
                <InventoryValuation />
            ) : activeTab === 'status' ? (
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
                    pageSize={50}
                    actions={(row) => (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {can('delivery', 'update') && (
                                <button className="icon-btn" onClick={() => handleEdit(row)} title="수정">
                                    <Edit size={16} />
                                </button>
                            )}
                            {can('delivery', 'delete') && (
                                <button className="icon-btn delete-btn" onClick={() => handleDelete(row)} title="삭제">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    )}
                />
            )}

            {/* 바코드 스캐너 모달 (Phase 4b) */}
            <BarcodeScannerModal
                isOpen={isScannerOpen}
                onClose={() => { setIsScannerOpen(false); setScannerTargetIdx(-1); }}
                onScan={handleScanResult}
                title="제품 바코드/QR 스캔"
            />

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
                                    <label className="form-label">조정 사유 *</label>
                                    <select className="form-input" value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}>
                                        {ADJUST_REASONS.map(r => (
                                            <option key={r.code} value={r.code}>{r.label}</option>
                                        ))}
                                    </select>
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
                                <select className="form-input"
                                    value={isEditClientCustom ? '__custom__' : newItem.client}
                                    onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                            setIsEditClientCustom(true);
                                            setNewItem({ ...newItem, client: '' });
                                        } else {
                                            setIsEditClientCustom(false);
                                            setNewItem({ ...newItem, client: e.target.value });
                                        }
                                    }}>
                                    <option value="">거래처를 선택하세요</option>
                                    {activeSuppliers.map(s => (
                                        <option key={s.id} value={s.name}>
                                            {s.name}
                                        </option>
                                    ))}
                                    <option value="__custom__">+ 직접 입력</option>
                                </select>
                                {isEditClientCustom && (
                                    <input className="form-input" value={newItem.client}
                                        onChange={(e) => setNewItem({ ...newItem, client: e.target.value })}
                                        placeholder="거래처명을 직접 입력하세요"
                                        style={{ marginTop: '0.5rem' }} />
                                )}
                                {activeSuppliers.length === 0 && !isEditClientCustom && (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                                        등록된 거래처가 없습니다. '거래처 관리'에서 먼저 등록하거나 '직접 입력'을 선택하세요.
                                    </div>
                                )}
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
                                <select className="form-input"
                                    value={isBatchClientCustom ? '__custom__' : batchCommon.client}
                                    onChange={(e) => {
                                        if (e.target.value === '__custom__') {
                                            setIsBatchClientCustom(true);
                                            setBatchCommon({ ...batchCommon, client: '' });
                                        } else {
                                            setIsBatchClientCustom(false);
                                            setBatchCommon({ ...batchCommon, client: e.target.value });
                                        }
                                    }}>
                                    <option value="">거래처를 선택하세요</option>
                                    {activeSuppliers.map(s => (
                                        <option key={s.id} value={s.name}>
                                            {s.name}
                                        </option>
                                    ))}
                                    <option value="__custom__">+ 직접 입력</option>
                                </select>
                                {isBatchClientCustom && (
                                    <input className="form-input" value={batchCommon.client}
                                        onChange={(e) => setBatchCommon({ ...batchCommon, client: e.target.value })}
                                        placeholder="거래처명을 직접 입력하세요"
                                        style={{ marginTop: '0.5rem' }} />
                                )}
                                {activeSuppliers.length === 0 && !isBatchClientCustom && (
                                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                                        등록된 거래처가 없습니다. '거래처 관리'에서 먼저 등록하거나 '직접 입력'을 선택하세요.
                                    </div>
                                )}
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
                                <div className="form-group">
                                    <label className="form-label">조정 사유 *</label>
                                    <select className="form-input" value={adjustReason}
                                        onChange={(e) => setAdjustReason(e.target.value)}>
                                        {ADJUST_REASONS.map(r => (
                                            <option key={r.code} value={r.code}>{r.label}</option>
                                        ))}
                                    </select>
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
                                            {/* 제품 드롭다운 + 바코드 스캔 버튼 */}
                                            <div style={{ display: 'flex', gap: '4px', marginBottom: '0.4rem' }}>
                                                <select className="form-input" value={item.productId} style={{ fontSize: '0.85rem', padding: '0.4rem 0.6rem', flex: 1 }}
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
                                                <button type="button" onClick={() => openScanner(idx)}
                                                    style={{ background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', padding: '0 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', fontWeight: 600 }}
                                                    title="바코드/QR 스캔">
                                                    <Camera size={14} />
                                                </button>
                                            </div>
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
                    <button className="btn-submit" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '처리 중...' : (isEditMode ? '수정' : (batchCommon.transactionType === 'ADJUST' ? '조정' : `${batchItems.filter(i => i.itemName && i.quantity > 0).length}건 일괄 등록`))}
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

                .item-filter { display: flex; align-items: center; gap: 0.4rem; padding: 0.4rem 0.7rem; background: white; border: 1px solid var(--border, #e2e8f0); border-radius: var(--radius-sm); box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
                .item-filter select { border: none; background: transparent; outline: none; font-size: 0.9rem; color: var(--text-main); max-width: 260px; cursor: pointer; }
                .item-filter-clear { border: none; background: #f1f5f9; color: #64748b; border-radius: 50%; width: 20px; height: 20px; font-size: 0.75rem; cursor: pointer; line-height: 1; }
                .item-filter-clear:hover { background: #e2e8f0; color: #ef4444; }

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
