import React, { useState, useEffect } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import DateRangePicker from '../components/DateRangePicker';
import ExcelToolbar from '../components/ExcelToolbar';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import InventoryValuation from '../components/InventoryValuation';
import { Package, TrendingUp, TrendingDown, Edit, Trash2, Plus, RefreshCw, X, Camera, Search, Layers, AlertTriangle, CheckCircle2, Split } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import {
    UNSPECIFIED_LOT, normalizeLot, isSameLot, suggestLotNo, lotDateLabel, toStoredLot,
    buildLotLedger, getLotsForItem, allocateFifo, lotAgeDays, getLotRemain,
    deliveryLotStatus
} from '../lib/lotUtils';

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

    // ── LOT 원장: 제품 × LOT 단위 입고/출고/잔량 집계 ──
    // 출고 시 "그 LOT에 실제로 남은 수량"을 보고 막기 위해 쓰인다.
    const lotLedger = React.useMemo(
        () => buildLotLedger(inventoryTransactions || []),
        [inventoryTransactions]
    );
    // 제품명 → 잔량 있는 LOT 목록 (FIFO 순)
    const availableLots = React.useCallback(
        (itemName) => getLotsForItem(lotLedger, itemName, { onlyRemaining: true }),
        [lotLedger]
    );
    // 납품서 LOT ≠ 시스템 LOT 인 출고 (항상 상단에 경고로 띄운다)
    const lotMismatches = React.useMemo(
        () => (inventoryTransactions || []).filter(t => deliveryLotStatus(t) === 'mismatch'),
        [inventoryTransactions]
    );

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

    const [lotSearch, setLotSearch] = useState('');          // LOT 현황 탭 검색어
    const [lotOnlyRemaining, setLotOnlyRemaining] = useState(true); // 잔량 있는 LOT만
    const [lotDetail, setLotDetail] = useState(null);        // 드릴다운 중인 LOT {itemName, lotNo}

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
        notes: '',
        lotNo: '',
        deliveryLotNo: ''
    });

    // 다건 등록용 state
    const [batchCommon, setBatchCommon] = useState({
        transactionType: 'IN',
        transactionDate: new Date().toISOString().split('T')[0],
        client: '',
        notes: ''
    });
    const emptyBatchItem = { productId: '', itemName: '', itemCode: '', quantity: 0, unit: 'EA', unitPrice: 0, lotNo: '', deliveryLotNo: '' };
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
        // LOT 기본값: 입고는 거래일자 기반 회사 체계(년월일 3자리) 제안, 출고는 잔량 있는 가장 오래된 LOT(FIFO)
        const isOut = batchCommon.transactionType === 'OUT';
        const lots = isOut ? availableLots(product.name) : [];
        const defaultLot = isOut
            ? (lots.find(l => l.lotNo !== UNSPECIFIED_LOT)?.lotNo || lots[0]?.lotNo || '')
            : suggestLotNo(batchCommon.transactionDate);
        setBatchItems(prev => prev.map((item, i) => i === idx ? {
            ...item,
            productId: product.id,
            itemName: product.name,
            itemCode: product.product_code || '',
            unitPrice: product.unit_price || 0,
            unit: product.unit || 'EA',
            lotNo: defaultLot,
            deliveryLotNo: ''
        } : item));
        setActiveBatchDropdown(-1);
    };

    // 다건 출고 행 하나를 FIFO로 여러 LOT 행으로 쪼갠다 (요청 수량을 오래된 LOT부터 채움)
    const splitRowByFifo = (idx) => {
        const row = batchItems[idx];
        if (!row?.itemName) return alert('먼저 제품을 선택해주세요.');
        const qty = parseFloat(row.quantity) || 0;
        if (qty <= 0) return alert('먼저 출고 수량을 입력해주세요.');

        // 이 행을 제외한 다른 행들이 이미 쓴 LOT 수량을 차감한 가용 잔량으로 계산
        const usedByOthers = {};
        batchItems.forEach((it, i) => {
            if (i === idx || it.itemName !== row.itemName) return;
            const key = normalizeLot(it.lotNo);
            usedByOthers[key] = (usedByOthers[key] || 0) + (parseFloat(it.quantity) || 0);
        });
        const lots = availableLots(row.itemName)
            .map(l => ({ ...l, remain: l.remain - (usedByOthers[l.lotNo] || 0) }))
            .filter(l => l.remain > 0);

        const { allocations, shortage } = allocateFifo(lots, qty);
        if (allocations.length === 0) {
            return alert(`'${row.itemName}'의 LOT 잔량이 없습니다.\n입고를 먼저 등록하거나 LOT를 직접 지정해주세요.`);
        }
        if (shortage > 0) {
            const ok = window.confirm(
                `LOT 잔량이 ${shortage.toLocaleString()}${row.unit} 부족합니다.\n` +
                `가능한 ${allocations.reduce((s, a) => s + a.qty, 0).toLocaleString()}${row.unit}만 LOT별로 나눠 채울까요?`
            );
            if (!ok) return;
        }
        const newRows = allocations.map(a => ({ ...row, lotNo: a.lotNo, quantity: a.qty, deliveryLotNo: '' }));
        setBatchItems(prev => [...prev.slice(0, idx), ...newRows, ...prev.slice(idx + 1)]);
    };

    // 제품 선택 시 정보 자동 적용
    const handleProductSelect = (productId) => {
        const product = products.find(p => p.id === productId);
        if (product) {
            setNewItem(prev => {
                const isOut = prev.transactionType === 'OUT';
                const lots = isOut ? availableLots(product.name) : [];
                const defaultLot = isOut
                    ? (lots.find(l => l.lotNo !== UNSPECIFIED_LOT)?.lotNo || lots[0]?.lotNo || '')
                    : (prev.transactionType === 'IN' ? suggestLotNo(prev.transactionDate) : '');
                return {
                    ...prev,
                    productId: productId,
                    itemName: product.name,
                    itemCode: product.product_code || '',
                    unitPrice: product.unit_price || 0,
                    unit: product.unit || 'EA',
                    client: product.company_name || prev.client,
                    lotNo: defaultLot
                };
            });
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

    // 조회 중인 기간·품목·탭에 대한 합계 (필터 결과 기준)
    const filteredSummary = React.useMemo(() => {
        const s = {
            inQty: 0, inAmount: 0,
            outQty: 0, outAmount: 0,
            adjustQty: 0,
            unit: ''
        };
        (filteredTransactions || []).forEach(t => {
            const qty = parseFloat(t.quantity) || 0;
            const amt = parseFloat(t.total_amount || 0) || 0;
            if (!s.unit && t.unit) s.unit = t.unit;
            if (t.transaction_type === 'IN') { s.inQty += qty; s.inAmount += amt; }
            else if (t.transaction_type === 'OUT') { s.outQty += qty; s.outAmount += amt; }
            else if (t.transaction_type === 'ADJUST') { s.adjustQty += qty; }
        });
        // 여러 품목이 섞이면 단위 혼재 → 단위 표기 생략
        if (itemFilter === 'all') s.unit = '';
        return s;
    }, [filteredTransactions, itemFilter]);

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

    // ── LOT 검증 ──
    // 출고는 "그 LOT에 실제 남은 수량" 안에서만 나갈 수 있다.
    // alreadyUsed: 같은 배치 안에서 같은 (제품,LOT)를 앞 행들이 이미 쓴 수량
    // excludeTxId: 수정 모드에서 자기 자신 거래의 영향을 되돌리기 위한 ID
    const checkLotOut = (itemName, lotNo, qty, { excludeTxId = null, alreadyUsed = 0 } = {}) => {
        const remain = getLotRemain(inventoryTransactions, itemName, lotNo, excludeTxId) - alreadyUsed;
        const need = parseFloat(qty) || 0;
        if (need > remain) {
            return {
                ok: false,
                message:
                    `'${itemName}' LOT [${normalizeLot(lotNo)}] 잔량이 부족합니다.\n` +
                    `LOT 잔량: ${remain.toLocaleString()}\n출고 요청: ${need.toLocaleString()}\n` +
                    `부족: ${(need - remain).toLocaleString()}\n\n` +
                    `→ 다른 LOT를 선택하거나 'LOT 분할' 버튼으로 나눠서 출고하세요.`
            };
        }
        return { ok: true, remain };
    };

    // 납품서 LOT ↔ 시스템 LOT 대조. 불일치면 사용자에게 한 번 확인받는다.
    const confirmDeliveryLotMismatch = (rows) => {
        const bad = rows.filter(r => {
            const dlv = (r.deliveryLotNo || '').trim();
            return dlv && !isSameLot(dlv, r.lotNo);
        });
        if (bad.length === 0) return true;
        return window.confirm(
            `⚠️ 납품 LOT와 시스템 LOT가 다릅니다 (${bad.length}건)\n\n` +
            bad.map(r => `  • ${r.itemName}: 시스템 [${normalizeLot(r.lotNo)}] ↔ 납품서 [${r.deliveryLotNo.trim()}]`).join('\n') +
            `\n\n납품서 LOT가 맞다면 시스템 LOT를 그 LOT로 바꿔 선택하세요.\n그래도 이대로 등록하시겠습니까? (불일치로 기록됩니다)`
        );
    };

    // 재고조정 기준 재고: LOT를 지정하면 그 LOT 잔량, 비우면 품목 전체 재고
    const setAdjustStockFor = (itemName, itemCode, lotNo) => {
        const stock = (lotNo || '').trim()
            ? getLotRemain(inventoryTransactions, itemName, lotNo)
            : getSystemStock(itemCode, itemName);
        setSystemStock(stock);
        setActualStock(stock);
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
            header: 'LOT',
            accessor: 'lot_no',
            render: (row) => {
                const sys = (row.lot_no || '').trim();
                const dlv = (row.delivery_lot_no || '').trim();
                if (!sys && !dlv) return <span className="lot-chip lot-none">미지정</span>;
                // 출고 + 납품 LOT 기재 → 시스템 LOT와 대조 결과를 항상 표시
                const status = deliveryLotStatus(row);
                return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                        <span className={`lot-chip ${sys ? '' : 'lot-none'}`}>{sys || '미지정'}</span>
                        {status === 'ok' && (
                            <span className="lot-match ok" title={`납품 LOT ${dlv} 일치`}>
                                <CheckCircle2 size={13} /> 일치
                            </span>
                        )}
                        {status === 'mismatch' && (
                            <span className="lot-match bad" title={`납품서 LOT: ${dlv}`}>
                                <AlertTriangle size={13} /> 납품 {dlv}
                            </span>
                        )}
                        {status === 'pending' && (
                            <span className="lot-match wait" title={`납품서 LOT: ${dlv} — 시스템 LOT 미지정`}>
                                납품 {dlv} 대조대기
                            </span>
                        )}
                    </span>
                );
            }
        },
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
    // LOT 분할 출고 주의: 같은 날 같은 거래처에 같은 품목·같은 수량이 LOT만 다르게
    // 두 번 나갈 수 있다. 이때 전표를 '중복'으로 보고 건너뛰면 매출이 누락되므로,
    // 기존 전표에 [LOT:xxx] 태그가 있으면 LOT까지 같을 때만 중복으로 판정한다.
    const salesVoucherExists = (date, item, qty, client, lotNo = null) =>
        (vouchers || []).some(v => {
            if (v.voucher_type !== '매출') return false;
            if (v.voucher_date !== date) return false;
            if ((v.item_name || '') !== (item || '')) return false;
            if (parseFloat(v.quantity) !== parseFloat(qty)) return false;
            if ((v.client || '') !== (client || '')) return false;
            const tag = (v.notes || '').match(/\[LOT:([^\]]*)\]/);
            if (lotNo && tag) return isSameLot(tag[1], lotNo);
            return true; // LOT 태그가 없는 옛 전표는 보수적으로 중복 취급
        });

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
                    lot_no: toStoredLot(newItem.lotNo),
                    delivery_lot_no: null,
                    notes: `[재고조정:${adjustReason}]${newItem.lotNo?.trim() ? ` [LOT:${newItem.lotNo.trim()}]` : ''} 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff}) / 사유: ${reasonLabel}${newItem.notes ? ' / ' + newItem.notes : ''}`
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
                    // LOT별 잔량 검증 (자기 자신 거래 영향 제외)
                    if (!newItem.lotNo?.trim()) {
                        return alert('출고 LOT를 선택해주세요.\n납품 LOT 대조를 위해 출고는 LOT 지정이 필요합니다.');
                    }
                    const lotCheck = checkLotOut(newItem.itemName, newItem.lotNo, newItem.quantity, { excludeTxId: editingId });
                    if (!lotCheck.ok) return alert(lotCheck.message);
                }
                if (!confirmDeliveryLotMismatch(
                    newItem.transactionType === 'OUT' ? [{ ...newItem }] : []
                )) return;
                // 입고에 LOT가 없으면 한 번 확인 (이후 출고에서 LOT 추적이 끊긴다)
                if (newItem.transactionType === 'IN' && !newItem.lotNo?.trim()) {
                    if (!window.confirm('LOT 번호가 비어 있습니다.\nLOT 없이 입고하면 이 재고는 \'(미지정)\'으로 묶여 납품 LOT 대조가 안 됩니다.\n계속하시겠습니까?')) return;
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
                    notes: newItem.notes,
                    lot_no: toStoredLot(newItem.lotNo),
                    delivery_lot_no: newItem.transactionType === 'OUT'
                        ? (toStoredLot(newItem.deliveryLotNo))
                        : null
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
                const tagNote = (label) => `[자동-입출고 ${label}#${editingId}]${newItem.lotNo?.trim() ? ` [LOT:${newItem.lotNo.trim()}]` : ''} ${newItem.itemName} ${newItem.quantity}${newItem.unit} 출고`;
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
                        } else if (addVoucher && !salesVoucherExists(newItem.transactionDate, newItem.itemName, newItem.quantity, newItem.client, newItem.lotNo)) {
                            // 기존 voucher가 없으면 신규 생성 (과거 누락분 보완) — 단, 동일 전표 중복 방지
                            await addVoucher({
                                voucher_date: newItem.transactionDate, voucher_type: '매출',
                                item_name: newItem.itemName, item_code: newItem.itemCode,
                                quantity: parseFloat(newItem.quantity), unit: newItem.unit,
                                unit_price: parseFloat(newItem.unitPrice), client: newItem.client,
                                notes: tagNote('수정생성')
                            });
                        }
                    } else if (!wasOut && isOut && addVoucher && !salesVoucherExists(newItem.transactionDate, newItem.itemName, newItem.quantity, newItem.client, newItem.lotNo)) {
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
                lot_no: toStoredLot(newItem.lotNo),
                delivery_lot_no: null,
                notes: `[재고조정:${adjustReason}]${newItem.lotNo?.trim() ? ` [LOT:${newItem.lotNo.trim()}]` : ''} 시스템재고: ${systemStock} → 실제재고: ${actualStock} (차이: ${diff > 0 ? '+' : ''}${diff}) / 사유: ${reasonLabel}${batchCommon.notes ? ' / ' + batchCommon.notes : ''}`
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

        // ── LOT 검증 ──
        if (batchCommon.transactionType === 'OUT') {
            // 출고는 LOT 지정 필수 + LOT별 잔량 범위 안에서만 (같은 LOT 누적도 함께 체크)
            const missingLot = validItems.filter(item => !item.lotNo?.trim());
            if (missingLot.length > 0) {
                return alert(
                    `출고 LOT를 선택하지 않은 항목이 있습니다 (${missingLot.length}건)\n` +
                    missingLot.map(i => `  • ${i.itemName}`).join('\n') +
                    `\n\n납품 LOT 대조를 위해 출고는 LOT 지정이 필요합니다.`
                );
            }
            const usedByLot = {};
            for (const item of validItems) {
                const lotKey = `${item.itemName}\u0000${normalizeLot(item.lotNo)}`;
                const already = usedByLot[lotKey] || 0;
                const res = checkLotOut(item.itemName, item.lotNo, item.quantity, { alreadyUsed: already });
                if (!res.ok) return alert(res.message);
                usedByLot[lotKey] = already + (parseFloat(item.quantity) || 0);
            }
            // 납품서 LOT ↔ 시스템 LOT 대조
            if (!confirmDeliveryLotMismatch(validItems)) return;
        } else if (batchCommon.transactionType === 'IN') {
            const noLot = validItems.filter(item => !item.lotNo?.trim());
            if (noLot.length > 0) {
                const ok = window.confirm(
                    `LOT 번호가 비어 있는 입고가 ${noLot.length}건 있습니다.\n` +
                    noLot.map(i => `  • ${i.itemName}`).join('\n') +
                    `\n\nLOT 없이 입고하면 이 재고는 '(미지정)'으로 묶여 납품 LOT 대조가 안 됩니다.\n계속하시겠습니까?`
                );
                if (!ok) return;
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
                notes: batchCommon.notes,
                lot_no: toStoredLot(item.lotNo),
                delivery_lot_no: batchCommon.transactionType === 'OUT'
                    ? (toStoredLot(item.deliveryLotNo))
                    : null
            }, { context: `inventory:batch_${batchCommon.transactionType.toLowerCase()}` });
            const newTxId = txData && txData[0] ? txData[0].id : null;

            // 출고 → 매출 전표 자동 생성 (입고는 제품 입고이므로 매입 아님)
            if (addVoucher && batchCommon.transactionType === 'OUT') {
                // 중복 방지: 동일 (일자/품목/수량/거래처) 전표가 이미 있거나 이번 배치에서 만들었으면 스킵
                const dupKey = `${batchCommon.transactionDate}|${item.itemName}|${parseFloat(item.quantity)}|${batchCommon.client || ''}|${normalizeLot(item.lotNo)}`;
                if (salesVoucherExists(batchCommon.transactionDate, item.itemName, item.quantity, batchCommon.client, item.lotNo) || createdVoucherKeys.has(dupKey)) {
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
                        notes: `[자동-입출고${newTxId ? '#' + newTxId : ''}]${item.lotNo?.trim() ? ` [LOT:${item.lotNo.trim()}]` : ''} ${item.itemName} ${item.quantity}${item.unit} 출고`
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
            notes: row.notes || '',
            lotNo: row.lot_no || '',
            deliveryLotNo: row.delivery_lot_no || ''
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
            // 재고조정 수정에서는 systemStock/actualStock 복원 (LOT 지정분은 LOT 잔량 기준)
            const stockNow = (row.lot_no || '').trim()
                ? getLotRemain(inventoryTransactions, row.item_name, row.lot_no)
                : getSystemStock(row.item_code, row.item_name);
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
            notes: '',
            lotNo: '',
            deliveryLotNo: ''
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
            notes: '',
            lotNo: item.lotNo && item.lotNo !== UNSPECIFIED_LOT ? item.lotNo : '',
            deliveryLotNo: ''
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

    // LOT 현황 탭에 뿌릴 행 (검색어·잔량 필터 적용, 품목명 → 최초입고일 순)
    const lotRows = React.useMemo(() => {
        const q = lotSearch.trim().toLowerCase();
        return lotLedger
            .filter(r => (lotOnlyRemaining ? r.remain !== 0 : true))
            .filter(r => !q
                || r.itemName.toLowerCase().includes(q)
                || r.lotNo.toLowerCase().includes(q)
                || (r.itemCode || '').toLowerCase().includes(q))
            .sort((a, b) => {
                const byName = a.itemName.localeCompare(b.itemName, 'ko');
                if (byName !== 0) return byName;
                return (a.firstInDate || '9999').localeCompare(b.firstInDate || '9999');
            });
    }, [lotLedger, lotSearch, lotOnlyRemaining]);

    // 드릴다운: 선택한 LOT의 입출고 이력 (최신순)
    const lotDetailTxs = React.useMemo(() => {
        if (!lotDetail) return [];
        return (inventoryTransactions || [])
            .filter(t => (t.item_name || '').trim() === lotDetail.itemName
                && normalizeLot(t.lot_no) === lotDetail.lotNo)
            .sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || '') || (b.id - a.id));
    }, [inventoryTransactions, lotDetail]);

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
                            { key: 'lot_no', label: 'LOT', format: (v) => v || '(미지정)' },
                            { key: 'delivery_lot_no', label: '납품LOT' },
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

            {/* 납품 LOT 불일치 경고 — 출고 LOT ≠ 납품서 LOT 인 건이 있으면 항상 띄운다 */}
            {lotMismatches.length > 0 && (
                <div className="lot-warn-banner">
                    <AlertTriangle size={18} />
                    <div style={{ flex: 1 }}>
                        <strong>납품 LOT 불일치 {lotMismatches.length}건</strong>
                        <div style={{ fontSize: '0.82rem', marginTop: '2px', opacity: 0.9 }}>
                            {lotMismatches.slice(0, 3).map(t => (
                                <div key={t.id}>
                                    {t.transaction_date} {t.item_name} — 시스템 [{normalizeLot(t.lot_no)}] ↔ 납품서 [{t.delivery_lot_no}]
                                </div>
                            ))}
                            {lotMismatches.length > 3 && <div>… 외 {lotMismatches.length - 3}건</div>}
                        </div>
                    </div>
                    <button className="adjust-btn" style={{ background: 'white', color: '#b91c1c', borderColor: '#fecaca' }}
                        onClick={() => { setActiveTab('out'); setItemFilter('all'); }}>
                        출고 내역 보기
                    </button>
                </div>
            )}

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
                    className={`tab ${activeTab === 'lot' ? 'active' : ''}`}
                    onClick={() => setActiveTab('lot')}
                >
                    LOT 현황
                </button>
                <button
                    className={`tab ${activeTab === 'valuation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('valuation')}
                >
                    재고 평가
                </button>
            </div>

            {/* Date Range + Item Filter */}
            {activeTab !== 'status' && activeTab !== 'valuation' && activeTab !== 'lot' && (
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

            {/* 조회 기간·품목 합계 (필터 결과 기준) */}
            {activeTab !== 'status' && activeTab !== 'valuation' && activeTab !== 'lot' && filteredTransactions.length > 0 && (
                <div className="filtered-summary-bar" style={{
                    display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center',
                    padding: '0.65rem 1rem', margin: '0.5rem 0',
                    background: 'var(--surface, #f8fafc)', border: '1px solid var(--border, #e2e8f0)',
                    borderRadius: '8px', fontSize: '0.9rem'
                }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-muted, #64748b)' }}>
                        조회 합계 ({filteredTransactions.length}건)
                    </span>
                    {(activeTab === 'all' || activeTab === 'in') && (
                        <span style={{ color: '#2563eb' }}>
                            입고 <strong>{filteredSummary.inQty.toLocaleString()}{filteredSummary.unit ? ' ' + filteredSummary.unit : ''}</strong>
                            {' / '}₩<strong>{filteredSummary.inAmount.toLocaleString()}</strong>
                        </span>
                    )}
                    {(activeTab === 'all' || activeTab === 'out') && (
                        <span style={{ color: '#059669' }}>
                            출고 <strong>{filteredSummary.outQty.toLocaleString()}{filteredSummary.unit ? ' ' + filteredSummary.unit : ''}</strong>
                            {' / '}₩<strong>{filteredSummary.outAmount.toLocaleString()}</strong>
                        </span>
                    )}
                    {(activeTab === 'all' || activeTab === 'adjust') && filteredSummary.adjustQty !== 0 && (
                        <span style={{ color: '#d97706' }}>
                            재고조정 <strong>{filteredSummary.adjustQty > 0 ? '+' : ''}{filteredSummary.adjustQty.toLocaleString()}{filteredSummary.unit ? ' ' + filteredSummary.unit : ''}</strong>
                        </span>
                    )}
                </div>
            )}

            {/* Transaction Table / Inventory Status / LOT / Valuation */}
            {activeTab === 'lot' ? (
                <div className="inventory-status-table">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                        <h3 className="section-title" style={{ margin: 0 }}>
                            <Layers size={17} style={{ verticalAlign: '-3px', marginRight: '6px' }} />
                            LOT별 재고 현황
                        </h3>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <div className="item-filter">
                                <Search size={15} />
                                <input
                                    value={lotSearch}
                                    onChange={(e) => setLotSearch(e.target.value)}
                                    placeholder="품목명 / LOT 검색"
                                    style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: '0.9rem', width: '180px' }}
                                />
                                {lotSearch && (
                                    <button className="item-filter-clear" onClick={() => setLotSearch('')} title="검색 해제">✕</button>
                                )}
                            </div>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#475569', cursor: 'pointer' }}>
                                <input type="checkbox" checked={lotOnlyRemaining} onChange={(e) => setLotOnlyRemaining(e.target.checked)} />
                                잔량 있는 LOT만
                            </label>
                            <ExcelToolbar
                                data={lotRows}
                                columns={[
                                    { key: 'itemCode', label: '품목코드' },
                                    { key: 'itemName', label: '품목명' },
                                    { key: 'lotNo', label: 'LOT' },
                                    { key: 'inQty', label: '입고', format: (v) => parseFloat(v || 0) },
                                    { key: 'outQty', label: '출고', format: (v) => parseFloat(v || 0) },
                                    { key: 'adjustQty', label: '조정', format: (v) => parseFloat(v || 0) },
                                    { key: 'remain', label: '잔량', format: (v) => parseFloat(v || 0) },
                                    { key: 'unit', label: '단위' },
                                    { key: 'firstInDate', label: '최초입고일' },
                                    { key: 'lastOutDate', label: '최근출고일' }
                                ]}
                                fileName="LOT별재고현황"
                                showTemplate={false}
                            />
                        </div>
                    </div>

                    {/* LOT 요약 */}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', padding: '0.65rem 1rem', marginBottom: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}>
                        <span><strong>{lotRows.length}</strong> LOT</span>
                        <span style={{ color: '#059669' }}>잔량 보유 <strong>{lotRows.filter(r => r.remain > 0).length}</strong></span>
                        <span style={{ color: '#64748b' }}>소진 <strong>{lotRows.filter(r => r.remain === 0).length}</strong></span>
                        {lotRows.some(r => r.remain < 0) && (
                            <span style={{ color: '#dc2626' }}>마이너스 <strong>{lotRows.filter(r => r.remain < 0).length}</strong></span>
                        )}
                        <span style={{ color: '#2563eb' }}>총 잔량 <strong>{lotRows.reduce((sum, r) => sum + r.remain, 0).toLocaleString()}</strong></span>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: 600 }}>품목코드</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: 600 }}>품목명</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: 600 }}>LOT</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>입고</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>출고</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>조정</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 600 }}>잔량</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'center', fontWeight: 600 }}>최초입고</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'center', fontWeight: 600 }}>경과</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'center', fontWeight: 600 }}>상태</th>
                                    <th style={{ padding: '0.7rem', textAlign: 'center', fontWeight: 600 }}>이력</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lotRows.length === 0 && (
                                    <tr><td colSpan={11} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                                        표시할 LOT가 없습니다. 입고 등록 시 LOT 번호를 입력하면 여기에 쌓입니다.
                                    </td></tr>
                                )}
                                {lotRows.map((r) => {
                                    const age = lotAgeDays(r.firstInDate);
                                    return (
                                        <tr key={`${r.itemName}|${r.lotNo}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.7rem', color: '#64748b' }}>{r.itemCode || '-'}</td>
                                            <td style={{ padding: '0.7rem', fontWeight: 600 }}>{r.itemName}</td>
                                            <td style={{ padding: '0.7rem' }}>
                                                <span className={`lot-chip ${r.lotNo === UNSPECIFIED_LOT ? 'lot-none' : ''}`}
                                                    title={lotDateLabel(r.lotNo) ? `제조 ${lotDateLabel(r.lotNo)}` : undefined}>{r.lotNo}</span>
                                                {lotDateLabel(r.lotNo) && (
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '2px' }}>제조 {lotDateLabel(r.lotNo)}</div>
                                                )}
                                            </td>
                                            <td style={{ padding: '0.7rem', textAlign: 'right', color: '#2563eb' }}>{r.inQty.toLocaleString()}</td>
                                            <td style={{ padding: '0.7rem', textAlign: 'right', color: '#059669' }}>{r.outQty.toLocaleString()}</td>
                                            <td style={{ padding: '0.7rem', textAlign: 'right', color: r.adjustQty ? '#d97706' : '#cbd5e1' }}>
                                                {r.adjustQty ? `${r.adjustQty > 0 ? '+' : ''}${r.adjustQty.toLocaleString()}` : '-'}
                                            </td>
                                            <td style={{ padding: '0.7rem', textAlign: 'right', fontWeight: 700, color: r.remain > 0 ? '#059669' : r.remain < 0 ? '#dc2626' : '#94a3b8' }}>
                                                {r.remain.toLocaleString()} {r.unit}
                                            </td>
                                            <td style={{ padding: '0.7rem', textAlign: 'center', color: '#64748b' }}>{r.firstInDate || '-'}</td>
                                            <td style={{ padding: '0.7rem', textAlign: 'center', color: age != null && age > 180 ? '#dc2626' : '#64748b' }}>
                                                {age != null ? `${age}일` : '-'}
                                            </td>
                                            <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                                                {r.remain < 0
                                                    ? <span className="lot-status neg">마이너스</span>
                                                    : r.remain === 0
                                                        ? <span className="lot-status done">소진</span>
                                                        : <span className="lot-status live">잔량</span>}
                                            </td>
                                            <td style={{ padding: '0.7rem', textAlign: 'center' }}>
                                                <button className="adjust-btn" style={{ background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}
                                                    onClick={() => setLotDetail({ itemName: r.itemName, lotNo: r.lotNo })} title="이 LOT의 입출고 이력">
                                                    <Layers size={13} /> 이력
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : activeTab === 'valuation' ? (
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
                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>LOT</th>
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
                                        {(() => {
                                            const lots = getLotsForItem(lotLedger, item.itemName, { onlyRemaining: true });
                                            const named = lots.filter(l => l.lotNo !== UNSPECIFIED_LOT);
                                            return (
                                                <button className="adjust-btn" style={{ background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' }}
                                                    onClick={() => { setActiveTab('lot'); setLotSearch(item.itemName); setLotOnlyRemaining(true); }}
                                                    title="이 품목의 LOT별 잔량 보기">
                                                    <Layers size={13} /> {named.length ? `${named.length}개` : '미지정'}
                                                </button>
                                            );
                                        })()}
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

            {/* LOT 이력 모달 — 이 LOT로 들어오고 나간 내역 전체 */}
            <Modal
                title={lotDetail ? `LOT 이력 — ${lotDetail.itemName} [${lotDetail.lotNo}]` : 'LOT 이력'}
                isOpen={!!lotDetail}
                onClose={() => setLotDetail(null)}
            >
                {lotDetail && (() => {
                    const inQty = lotDetailTxs.filter(t => t.transaction_type === 'IN').reduce((a, t) => a + (parseFloat(t.quantity) || 0), 0);
                    const outQty = lotDetailTxs.filter(t => t.transaction_type === 'OUT').reduce((a, t) => a + (parseFloat(t.quantity) || 0), 0);
                    const adjQty = lotDetailTxs.filter(t => t.transaction_type === 'ADJUST').reduce((a, t) => a + (parseFloat(t.quantity) || 0), 0);
                    const unit = lotDetailTxs[0]?.unit || 'EA';
                    return (
                        <>
                            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', padding: '0.7rem 1rem', marginBottom: '0.9rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.9rem' }}>
                                <span style={{ color: '#2563eb' }}>입고 <strong>{inQty.toLocaleString()}</strong></span>
                                <span style={{ color: '#059669' }}>출고 <strong>{outQty.toLocaleString()}</strong></span>
                                {adjQty !== 0 && <span style={{ color: '#d97706' }}>조정 <strong>{adjQty > 0 ? '+' : ''}{adjQty.toLocaleString()}</strong></span>}
                                <span style={{ fontWeight: 700 }}>잔량 <strong>{(inQty - outQty + adjQty).toLocaleString()} {unit}</strong></span>
                            </div>
                            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>일자</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center' }}>구분</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right' }}>수량</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>거래처</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left' }}>납품LOT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {lotDetailTxs.map(t => (
                                            <tr key={t.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '0.5rem' }}>{t.transaction_date}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <span className={`type-badge ${t.transaction_type === 'IN' ? 'type-in' : t.transaction_type === 'ADJUST' ? 'type-adjust' : 'type-out'}`} style={{ fontSize: '0.75rem' }}>
                                                        {t.transaction_type === 'IN' ? '입고' : t.transaction_type === 'ADJUST' ? '조정' : '출고'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                                                    {parseFloat(t.quantity).toLocaleString()} {t.unit}
                                                </td>
                                                <td style={{ padding: '0.5rem', color: '#64748b' }}>{t.client || '-'}</td>
                                                <td style={{ padding: '0.5rem' }}>
                                                    {(() => {
                                                        const st = deliveryLotStatus(t);
                                                        if (st === 'ok') return <span className="lot-match ok"><CheckCircle2 size={13} /> {t.delivery_lot_no}</span>;
                                                        if (st === 'mismatch') return <span className="lot-match bad"><AlertTriangle size={13} /> {t.delivery_lot_no}</span>;
                                                        if (st === 'pending') return <span className="lot-match wait">{t.delivery_lot_no} 대조대기</span>;
                                                        return <span style={{ color: '#cbd5e1' }}>-</span>;
                                                    })()}
                                                </td>
                                            </tr>
                                        ))}
                                        {lotDetailTxs.length === 0 && (
                                            <tr><td colSpan={5} style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8' }}>이력이 없습니다.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="modal-actions">
                                <button className="btn-cancel" onClick={() => setLotDetail(null)}>닫기</button>
                            </div>
                        </>
                    );
                })()}
            </Modal>

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
                                onChange={(e) => setNewItem({ ...newItem, transactionType: e.target.value, productId: '', itemName: '', itemCode: '', unitPrice: 0, lotNo: '', deliveryLotNo: '' })}>
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
                                <div className="form-group">
                                    <label className="form-label">조정 대상 LOT</label>
                                    <select className="form-input" value={newItem.lotNo}
                                        onChange={(e) => {
                                            const lot = e.target.value;
                                            setNewItem(prev => ({ ...prev, lotNo: lot }));
                                            setAdjustStockFor(newItem.itemName, newItem.itemCode, lot);
                                        }}>
                                        <option value="">품목 전체 (LOT 미지정)</option>
                                        {getLotsForItem(lotLedger, newItem.itemName)
                                            .filter(l => l.lotNo !== UNSPECIFIED_LOT)
                                            .map(l => (
                                                <option key={l.lotNo} value={l.lotNo}>
                                                    {l.lotNo} — 잔량 {l.remain.toLocaleString()}{l.unit}
                                                </option>
                                            ))}
                                    </select>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                                        {newItem.lotNo
                                            ? `LOT [${newItem.lotNo}] 잔량만 조정합니다.`
                                            : "LOT를 비우면 품목 전체 기준으로 조정되고, 조정분은 '(미지정)' LOT로 들어갑니다."}
                                    </div>
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
                                <div className="form-group">
                                    <label className="form-label">단가</label>
                                    <input type="number" className="form-input" value={newItem.unitPrice}
                                        onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })} placeholder="0" />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 수량 — LOT보다 먼저. 수량이 있어야 LOT 잔량 확인이 된다 */}
                                <div className="form-group">
                                    <label className="form-label">수량 *</label>
                                    <input type="number" className="form-input" value={newItem.quantity}
                                        onChange={(e) => setNewItem({ ...newItem, quantity: parseFloat(e.target.value) || 0 })} />
                                </div>
                                {/* LOT */}
                                {newItem.transactionType === 'OUT' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">출고 LOT *</label>
                                            <select className="form-input" value={newItem.lotNo}
                                                onChange={(e) => setNewItem({ ...newItem, lotNo: e.target.value })}>
                                                <option value="">LOT 선택...</option>
                                                {getLotsForItem(lotLedger, newItem.itemName).map(l => (
                                                    <option key={l.lotNo} value={l.lotNo}>
                                                        {l.lotNo} — 잔량 {l.remain.toLocaleString()}{l.unit}{l.firstInDate ? ` (입고 ${l.firstInDate})` : ''}
                                                    </option>
                                                ))}
                                                {newItem.lotNo && !getLotsForItem(lotLedger, newItem.itemName).some(l => isSameLot(l.lotNo, newItem.lotNo)) && (
                                                    <option value={newItem.lotNo}>{newItem.lotNo}</option>
                                                )}
                                            </select>
                                            {newItem.itemName && newItem.lotNo && (
                                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                                                    이 거래를 뺀 LOT 잔량: {getLotRemain(inventoryTransactions, newItem.itemName, newItem.lotNo, editingId).toLocaleString()} {newItem.unit}
                                                </div>
                                            )}
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">납품서 LOT (대조용)</label>
                                            <input className="form-input" value={newItem.deliveryLotNo}
                                                placeholder="납품서에 적힌 LOT"
                                                onChange={(e) => setNewItem({ ...newItem, deliveryLotNo: e.target.value })} />
                                            {(newItem.deliveryLotNo || '').trim() && (
                                                <div style={{ marginTop: '0.3rem' }}>
                                                    {isSameLot(newItem.deliveryLotNo, newItem.lotNo)
                                                        ? <span className="lot-match ok"><CheckCircle2 size={13} /> 시스템 LOT와 일치</span>
                                                        : <span className="lot-match bad"><AlertTriangle size={13} /> 시스템 LOT와 불일치</span>}
                                                </div>
                                            )}
                                        </div>
                                    </>
                                ) : (
                                    <div className="form-group">
                                        <label className="form-label">입고 LOT</label>
                                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                                            <input className="form-input" value={newItem.lotNo}
                                                placeholder={`예: ${suggestLotNo(newItem.transactionDate) || 'VKW'}`}
                                                onChange={(e) => setNewItem({ ...newItem, lotNo: e.target.value })} />
                                            <button type="button" className="btn-cancel" style={{ whiteSpace: 'nowrap' }}
                                                onClick={() => setNewItem({ ...newItem, lotNo: suggestLotNo(newItem.transactionDate) })}>
                                                일자 LOT
                                            </button>
                                        </div>
                                        {(newItem.lotNo || '').trim() && lotDateLabel(newItem.lotNo) && (
                                            <div style={{ fontSize: '0.75rem', marginTop: '4px', color: '#16a34a' }}>
                                                {newItem.lotNo.trim().toUpperCase()} = 제조 {lotDateLabel(newItem.lotNo)}
                                            </div>
                                        )}
                                    </div>
                                )}
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
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        setBatchCommon({ ...batchCommon, transactionType: type });
                                        // 구분이 바뀌면 LOT 의미가 달라지므로 초기화 (입고=부여 / 출고=선택)
                                        setBatchItems(prev => prev.map(it => ({
                                            ...it,
                                            lotNo: type === 'IN' && it.itemName ? suggestLotNo(batchCommon.transactionDate) : '',
                                            deliveryLotNo: ''
                                        })));
                                    }}>
                                    <option value="IN">입고</option>
                                    <option value="OUT">출고</option>
                                    <option value="ADJUST">재고조정</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">거래일자 *</label>
                                <input type="date" className="form-input" value={batchCommon.transactionDate}
                                    onChange={(e) => {
                                        const date = e.target.value;
                                        const prevSuggest = suggestLotNo(batchCommon.transactionDate);
                                        setBatchCommon({ ...batchCommon, transactionDate: date });
                                        // 자동 제안값(년월일 코드)을 그대로 쓰던 입고 행만 새 일자로 갱신
                                        if (batchCommon.transactionType === 'IN') {
                                            setBatchItems(prev => prev.map(it => (
                                                it.lotNo === prevSuggest ? { ...it, lotNo: suggestLotNo(date) } : it
                                            )));
                                        }
                                    }} />
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
                                <div className="form-group">
                                    <label className="form-label">조정 대상 LOT</label>
                                    <select className="form-input" value={newItem.lotNo}
                                        onChange={(e) => {
                                            const lot = e.target.value;
                                            setNewItem(prev => ({ ...prev, lotNo: lot }));
                                            setAdjustStockFor(newItem.itemName, newItem.itemCode, lot);
                                        }}>
                                        <option value="">품목 전체 (LOT 미지정)</option>
                                        {getLotsForItem(lotLedger, newItem.itemName)
                                            .filter(l => l.lotNo !== UNSPECIFIED_LOT)
                                            .map(l => (
                                                <option key={l.lotNo} value={l.lotNo}>
                                                    {l.lotNo} — 잔량 {l.remain.toLocaleString()}{l.unit}
                                                </option>
                                            ))}
                                    </select>
                                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.3rem' }}>
                                        {newItem.lotNo
                                            ? `LOT [${newItem.lotNo}] 잔량만 조정합니다.`
                                            : "LOT를 비우면 품목 전체 기준으로 조정되고, 조정분은 '(미지정)' LOT로 들어갑니다."}
                                    </div>
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
                                    {batchItems.map((item, idx) => {
                                        const isOutRow = batchCommon.transactionType === 'OUT';
                                        const lotsForRow = isOutRow && item.itemName ? availableLots(item.itemName) : [];
                                        // 같은 배치의 앞뒤 행이 이미 쓴 같은 LOT 수량 (중복 출고 방지용 표시)
                                        const usedElsewhere = batchItems.reduce((sum, it, i) =>
                                            (i !== idx && it.itemName === item.itemName && normalizeLot(it.lotNo) === normalizeLot(item.lotNo))
                                                ? sum + (parseFloat(it.quantity) || 0) : sum, 0);
                                        const lotRemain = (item.itemName && item.lotNo)
                                            ? getLotRemain(inventoryTransactions, item.itemName, item.lotNo) - usedElsewhere
                                            : null;
                                        const dlvTrim = (item.deliveryLotNo || '').trim();
                                        const dlvMatch = dlvTrim ? isSameLot(dlvTrim, item.lotNo) : null;
                                        const overDraw = isOutRow && lotRemain != null && (parseFloat(item.quantity) || 0) > lotRemain;
                                        return (
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
                                            {/* 수량 / 단가 / 금액 — LOT보다 먼저. 수량이 있어야 LOT 잔량 계산·분할이 동작한다 */}
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', alignItems: 'center', marginBottom: '0.45rem' }}>
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
                                            {/* LOT */}
                                            {isOutRow ? (
                                                <div style={{ marginBottom: '0.45rem' }}>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>출고 LOT *</div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <select className="form-input" value={item.lotNo}
                                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', flex: 1, borderColor: item.lotNo ? '#e2e8f0' : '#fca5a5' }}
                                                            onChange={(e) => updateBatchItem(idx, 'lotNo', e.target.value)}>
                                                            <option value="">LOT 선택...</option>
                                                            {lotsForRow.map(l => (
                                                                <option key={l.lotNo} value={l.lotNo}>
                                                                    {l.lotNo === UNSPECIFIED_LOT ? 'LOT 없는 기존 재고' : l.lotNo} — 잔량 {l.remain.toLocaleString()}{l.unit}{l.firstInDate ? ` (입고 ${l.firstInDate})` : ''}
                                                                </option>
                                                            ))}
                                                            {/* 잔량 0이 된 LOT를 수정 중일 때 선택값 유지 */}
                                                            {item.lotNo && !lotsForRow.some(l => isSameLot(l.lotNo, item.lotNo)) && (
                                                                <option value={item.lotNo}>{item.lotNo} (잔량 없음)</option>
                                                            )}
                                                        </select>
                                                        <button type="button" onClick={() => splitRowByFifo(idx)}
                                                            style={{ background: '#0ea5e9', color: 'white', border: 'none', borderRadius: '8px', padding: '0 0.55rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.72rem', fontWeight: 700 }}
                                                            title="수량을 오래된 LOT부터 자동 분할 (FIFO)">
                                                            <Split size={13} /> 분할
                                                        </button>
                                                    </div>
                                                    {item.itemName && lotsForRow.length === 0 && (
                                                        <div style={{ fontSize: '0.72rem', color: '#dc2626', marginTop: '3px' }}>
                                                            잔량 있는 LOT가 없습니다. 입고를 먼저 등록하세요.
                                                        </div>
                                                    )}
                                                    {item.lotNo === UNSPECIFIED_LOT && (
                                                        <div style={{ fontSize: '0.72rem', color: '#b45309', marginTop: '3px' }}>
                                                            LOT 적용 전 재고라 시스템 LOT가 없습니다 — 납품서 LOT는 「대조대기」로만 기록됩니다.
                                                        </div>
                                                    )}
                                                    {item.lotNo && lotRemain != null && (
                                                        <div style={{ fontSize: '0.72rem', marginTop: '3px', color: overDraw ? '#dc2626' : '#64748b', fontWeight: overDraw ? 700 : 400 }}>
                                                            LOT 잔량 {lotRemain.toLocaleString()}{item.unit}
                                                            {(parseFloat(item.quantity) || 0) > 0 && ` → 출고 후 ${(lotRemain - (parseFloat(item.quantity) || 0)).toLocaleString()}${item.unit}`}
                                                            {overDraw && ' ⚠ 잔량 초과'}
                                                        </div>
                                                    )}
                                                    {/* 납품서(출하요청서·현품표)에 적힌 LOT — 시스템 LOT와 대조 */}
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', margin: '0.35rem 0 2px' }}>납품서 LOT (대조용, 선택)</div>
                                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                        <input className="form-input" value={item.deliveryLotNo}
                                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', flex: 1, borderColor: dlvMatch === false ? '#fca5a5' : '#e2e8f0' }}
                                                            placeholder="납품서에 적힌 LOT를 입력해 대조"
                                                            onChange={(e) => updateBatchItem(idx, 'deliveryLotNo', e.target.value)} />
                                                        {dlvMatch === true && <span className="lot-match ok"><CheckCircle2 size={13} /> 일치</span>}
                                                        {dlvMatch === false && <span className="lot-match bad"><AlertTriangle size={13} /> 불일치</span>}
                                                    </div>
                                                    {(item.deliveryLotNo || '').trim() && lotDateLabel(item.deliveryLotNo) && (
                                                        <div style={{ fontSize: '0.72rem', marginTop: '3px', color: '#64748b' }}>
                                                            납품서 LOT 제조일 {lotDateLabel(item.deliveryLotNo)}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ marginBottom: '0.45rem' }}>
                                                    <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginBottom: '2px' }}>입고 LOT</div>
                                                    <div style={{ display: 'flex', gap: '4px' }}>
                                                        <input className="form-input" value={item.lotNo}
                                                            style={{ fontSize: '0.85rem', padding: '0.35rem 0.5rem', flex: 1 }}
                                                            placeholder={`예: ${suggestLotNo(batchCommon.transactionDate) || 'VKW'}`}
                                                            onChange={(e) => updateBatchItem(idx, 'lotNo', e.target.value)} />
                                                        <button type="button"
                                                            onClick={() => updateBatchItem(idx, 'lotNo', suggestLotNo(batchCommon.transactionDate))}
                                                            style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0 0.55rem', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}
                                                            title="거래일자로 LOT 채우기 (년월일 코드)">
                                                            일자
                                                        </button>
                                                    </div>
                                                    {(item.lotNo || '').trim() && (
                                                        lotDateLabel(item.lotNo)
                                                            ? <div style={{ fontSize: '0.72rem', marginTop: '3px', color: '#16a34a' }}>
                                                                {item.lotNo.trim().toUpperCase()} = 제조 {lotDateLabel(item.lotNo)}
                                                            </div>
                                                            : <div style={{ fontSize: '0.72rem', marginTop: '3px', color: '#94a3b8' }}>
                                                                회사 LOT 체계(년월일 3자리)가 아닙니다 — 그대로 저장됩니다.
                                                            </div>
                                                    )}
                                                    {item.itemName && item.lotNo && lotRemain != null && lotRemain !== 0 && (
                                                        <div style={{ fontSize: '0.72rem', marginTop: '3px', color: '#d97706' }}>
                                                            이미 있는 LOT입니다 (현재 잔량 {lotRemain.toLocaleString()}{item.unit}) — 같은 LOT에 합산됩니다.
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                        </div>
                                        );
                                    })}
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

                .lot-chip { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 6px; background: #eef2ff; color: #4338ca; font-size: 0.82rem; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.02em; }
                .lot-chip.lot-none { background: #f1f5f9; color: #94a3b8; font-weight: 600; }
                .lot-match { display: inline-flex; align-items: center; gap: 3px; padding: 0.15rem 0.45rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
                .lot-match.ok { background: #dcfce7; color: #047857; }
                .lot-match.bad { background: #fee2e2; color: #b91c1c; }
                .lot-match.wait { background: #fef3c7; color: #b45309; }
                .lot-status { padding: 0.18rem 0.55rem; border-radius: 999px; font-size: 0.75rem; font-weight: 700; }
                .lot-status.live { background: #dcfce7; color: #047857; }
                .lot-status.done { background: #f1f5f9; color: #94a3b8; }
                .lot-status.neg { background: #fee2e2; color: #b91c1c; }
                .lot-warn-banner { display: flex; align-items: flex-start; gap: 0.7rem; padding: 0.85rem 1rem; margin-bottom: 1rem; background: #fef2f2; border: 1px solid #fecaca; border-left: 4px solid #dc2626; border-radius: 8px; color: #b91c1c; }

                .inventory-status-table { background: white; padding: 1.5rem; border-radius: var(--radius-lg); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .section-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; }
            `}</style>
        </div>
    );
};

export default InventoryInOut;
