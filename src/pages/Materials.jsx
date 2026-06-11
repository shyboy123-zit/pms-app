import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import MiniKpiCards from '../components/MiniKpiCards';
import LevelGauge from '../components/viz/LevelGauge';
import { Plus, ShoppingCart, AlertCircle, PlayCircle, Edit, Trash2, Calendar, CheckCircle, AlertTriangle, Package, TrendingDown } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { parsers } from '../lib/excel';

const Materials = () => {
    const {
        materials, addMaterial, updateMaterial, deleteMaterial,
        materialUsage, addMaterialUsage, updateMaterialUsage, deleteMaterialUsage,
        addPurchaseRequest,
        vouchers,
        addVoucher,
        updateVoucher,
        deleteVoucher,
        productionLogs,
        products,
        suppliers
    } = useData();

    // 공급사 드롭다운 옵션 (거래처 마스터 기준, 이름 정렬)
    const supplierNames = useMemo(
        () => Array.from(new Set((suppliers || []).map(s => s.name).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
        [suppliers]
    );
    const { can } = useAuth();

    // ===== 월 소모량 분석 =====
    const [anMonth, setAnMonth] = useState(() => new Date().toISOString().slice(0, 7)); // 'YYYY-MM'

    const matName = (id) => (materials || []).find(m => m.id === id)?.name || '원재료';

    // 월별 원재료 소모(kg): { 'YYYY-MM': { materialId: kg } }
    const consumptionByMonth = useMemo(() => {
        const map = {};
        (productionLogs || []).forEach(log => {
            const ym = (log.production_date || '').slice(0, 7);
            if (!ym) return;
            const qty = Number(log.daily_quantity) || 0;
            if (qty <= 0) return;
            const product = (products || []).find(p => p.id === log.product_id);
            if (!product || !product.material_id) return;
            const shotW = (Number(product.product_weight) || 0) + (Number(product.runner_weight) || 0);
            const kg = (shotW * qty) / 1000;
            (map[ym] = map[ym] || {});
            map[ym][product.material_id] = (map[ym][product.material_id] || 0) + kg;
        });
        return map;
    }, [productionLogs, products]);

    const last6Months = useMemo(() => {
        const [y, m] = anMonth.split('-').map(Number);
        const arr = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(y, (m - 1) - i, 1);
            arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
        }
        return arr;
    }, [anMonth]);

    const consumptionAnalysis = useMemo(() => {
        const thisM = consumptionByMonth[anMonth] || {};
        const prevKey = last6Months[last6Months.length - 2];
        const prevM = consumptionByMonth[prevKey] || {};
        const totals = {};
        last6Months.forEach(mm => {
            const obj = consumptionByMonth[mm] || {};
            Object.entries(obj).forEach(([id, kg]) => { totals[id] = (totals[id] || 0) + kg; });
        });
        const topIds = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id]) => id);
        const chartData = last6Months.map(mm => {
            const row = { month: mm.slice(2) };
            topIds.forEach(id => { row[matName(id)] = Math.round(((consumptionByMonth[mm] || {})[id] || 0) * 10) / 10; });
            return row;
        });
        const ids = new Set([...Object.keys(thisM), ...Object.keys(prevM)]);
        const rows = [...ids].map(id => {
            const cur = thisM[id] || 0, prev = prevM[id] || 0;
            const change = prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : (cur > 0 ? null : 0);
            return { id, name: matName(id), cur, prev, change };
        }).sort((a, b) => b.cur - a.cur);
        return { chartData, topIds, rows };
    }, [consumptionByMonth, anMonth, last6Months, materials]);

    const stepMonth = (delta) => {
        const [y, m] = anMonth.split('-').map(Number);
        const d = new Date(y, (m - 1) + delta, 1);
        setAnMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const MC_PALETTE = ['#6366f1', '#16a34a', '#f59e0b', '#ef4444', '#06b6d4'];

    const [trackingDate, setTrackingDate] = useState(new Date().toISOString().split('T')[0]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, unit_price: '', supplier: '' });
    const [orderItem, setOrderItem] = useState(null);
    const [usageItem, setUsageItem] = useState({
        materialId: '',
        materialName: '',
        quantity: 0,
        unit: 'kg',
        workOrder: '',
        usageDate: new Date().toISOString().split('T')[0],
        notes: ''
    });
    const [isEditingUsage, setIsEditingUsage] = useState(false);
    const [editingUsageId, setEditingUsageId] = useState(null);
    const [editingUsageOldQuantity, setEditingUsageOldQuantity] = useState(0);
    const [isEditingMaterial, setIsEditingMaterial] = useState(false);
    const [editingMaterialId, setEditingMaterialId] = useState(null);

    const columns = [
        { header: '자재명', accessor: 'name' },
        { header: '유형', accessor: 'type' },
        {
            header: '현재재고', accessor: 'stock', render: (row) => (
                <div style={{ minWidth: 130 }}>
                    <span style={{ fontWeight: 600, color: row.stock < row.min_stock ? 'var(--danger)' : 'inherit' }}>
                        {row.stock.toLocaleString()} {row.unit}
                        {row.min_stock > 0 && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 4 }}>
                                ({Math.round((parseFloat(row.stock || 0) / parseFloat(row.min_stock)) * 100)}%)
                            </span>
                        )}
                    </span>
                    {row.min_stock > 0 && (
                        <div style={{ marginTop: 5 }}>
                            <LevelGauge value={parseFloat(row.stock || 0)} max={parseFloat(row.min_stock)} height={8} showText={false} />
                        </div>
                    )}
                </div>
            )
        },
        { header: '안전재고', accessor: 'min_stock', render: (row) => `${row.min_stock} ${row.unit}` }, // DB min_stock
        { header: '공급사', accessor: 'supplier' },
    ];

    const confirmMaterial = () => {
        if (!newItem.name) return alert('자재명을 입력해주세요.');

        if (isEditingMaterial && editingMaterialId) {
            // Edit mode
            const itemToUpdate = {
                name: newItem.name,
                type: newItem.type,
                stock: newItem.stock,
                unit: newItem.unit,
                min_stock: newItem.minStock,
                unit_price: parseFloat(newItem.unit_price) || 0,
                supplier: newItem.supplier
            };
            updateMaterial(editingMaterialId, itemToUpdate);
            alert('원재료 정보가 수정되었습니다.');
        } else {
            // Add mode
            const itemToAdd = {
                name: newItem.name,
                type: newItem.type,
                stock: newItem.stock,
                unit: newItem.unit,
                min_stock: newItem.minStock,
                unit_price: parseFloat(newItem.unit_price) || 0,
                supplier: newItem.supplier
            };
            addMaterial(itemToAdd);
            alert('원재료가 등록되었습니다.');
        }

        setIsModalOpen(false);
        setIsEditingMaterial(false);
        setEditingMaterialId(null);
        setNewItem({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, unit_price: '', supplier: '' });
    };

    const handleEditMaterial = (material) => {
        setNewItem({
            name: material.name,
            type: material.type,
            stock: material.stock,
            unit: material.unit,
            minStock: material.min_stock,
            unit_price: material.unit_price || '',
            supplier: material.supplier
        });
        setIsEditingMaterial(true);
        setEditingMaterialId(material.id);
        setIsModalOpen(true);
    };

    const handleDeleteMaterial = async (material) => {
        if (window.confirm(`'${material.name}' 원재료를 삭제하시겠습니까?\n삭제 시 관련 사용 내역도 함께 삭제됩니다.`)) {
            await deleteMaterial(material.id);
            alert('원재료가 삭제되었습니다.');
        }
    };

    const handleProductionInstruction = (row) => {
        setOrderItem({
            ...row,
            orderQuantity: row.min_stock - row.stock + 100
        });
        setIsOrderModalOpen(true);
    };

    const confirmOrder = async () => {
        if (!orderItem) return;

        // Create a real purchase request
        const requestData = {
            item_name: orderItem.name,
            quantity: orderItem.orderQuantity,
            unit: orderItem.unit,
            supplier_id: null, // Could find supplier ID by name if needed, or leave for manager
            priority: '긴급',
            reason: '안전재고 미달로 인한 긴급 발주',
            required_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 3 days later
            status: '대기',
            notes: `자동 생성된 요청 (공급사: ${orderItem.supplier})`
        };

        const { error } = await addPurchaseRequest(requestData);

        if (!error) {
            alert(`✅ 긴급 발주 요청이 등록되었습니다.\n'구매 관리' 메뉴에서 확인하세요.`);
        } else {
            alert('발주 요청 등록 실패');
        }

        setIsOrderModalOpen(false);
        setOrderItem(null);
    };

    // 입고 기록(매입 전표) 수정 — 일일 입출고 조회에서 직접 수정/삭제
    const [editingIncoming, setEditingIncoming] = useState(null); // 수정 대상 voucher
    const [incomingEditForm, setIncomingEditForm] = useState({ client: '', quantity: 0, unit_price: 0, voucher_date: '' });

    const openIncomingEdit = (voucher) => {
        setEditingIncoming(voucher);
        setIncomingEditForm({
            client: voucher.client || '',
            quantity: parseFloat(voucher.quantity) || 0,
            unit_price: parseFloat(voucher.unit_price) || 0,
            voucher_date: voucher.voucher_date || new Date().toISOString().split('T')[0],
        });
    };

    const saveIncomingEdit = async () => {
        if (!editingIncoming) return;
        const newQty = parseFloat(incomingEditForm.quantity) || 0;
        if (newQty <= 0) return alert('수량은 0보다 커야 합니다.');
        const oldQty = parseFloat(editingIncoming.quantity) || 0;
        const delta = newQty - oldQty;

        // 수량이 바뀌면 원재료 재고도 그만큼 보정 (입고 시 재고에 더해졌으므로)
        if (delta !== 0) {
            const mat = (materials || []).find(m => m.name === editingIncoming.item_name);
            if (mat) {
                await updateMaterial(mat.id, { stock: (parseFloat(mat.stock) || 0) + delta });
            }
        }
        const price = parseFloat(incomingEditForm.unit_price) || 0;
        // total_amount 는 DB 생성 컬럼(quantity*unit_price 자동) — 보내면 안 됨
        const { error } = await updateVoucher(editingIncoming.id, {
            client: incomingEditForm.client,
            quantity: newQty,
            unit_price: price,
            voucher_date: incomingEditForm.voucher_date,
        });
        if (error) {
            // 수량 보정 롤백
            if (delta !== 0) {
                const mat = (materials || []).find(m => m.name === editingIncoming.item_name);
                if (mat) await updateMaterial(mat.id, { stock: (parseFloat(mat.stock) || 0) - delta });
            }
            alert('수정에 실패했습니다: ' + (error.message || error));
            return;
        }
        setEditingIncoming(null);
        alert('✓ 입고 내역이 수정되었습니다.' + (delta !== 0 ? `\n재고 ${delta > 0 ? '+' : ''}${delta} 보정됨.` : ''));
    };

    const deleteIncoming = async () => {
        if (!editingIncoming) return;
        if (!window.confirm(`'${editingIncoming.item_name}' 입고 기록을 삭제합니다.\n재고에서 ${parseFloat(editingIncoming.quantity).toLocaleString()}${editingIncoming.unit || ''} 차감되고 매입 전표가 제거됩니다.\n진행하시겠습니까?`)) return;
        const oldQty = parseFloat(editingIncoming.quantity) || 0;
        const mat = (materials || []).find(m => m.name === editingIncoming.item_name);
        if (mat) {
            await updateMaterial(mat.id, { stock: (parseFloat(mat.stock) || 0) - oldQty });
        }
        await deleteVoucher(editingIncoming.id);
        setEditingIncoming(null);
        alert('✓ 입고 기록이 삭제되고 재고가 차감되었습니다.');
    };

    // 원재료 입고 등록
    const [isIncomingModalOpen, setIsIncomingModalOpen] = useState(false);
    const [incomingData, setIncomingData] = useState({
        materialId: null,
        materialName: '',
        quantity: 0,
        ordered_quantity: '',
        unit: 'kg',
        unit_price: '',
        supplier: '',
        incoming_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    // 월별 요약
    const [summaryMonth, setSummaryMonth] = useState(new Date().toISOString().slice(0, 7));

    const handleIncoming = (material) => {
        setIncomingData({
            materialId: material.id,
            materialName: material.name,
            quantity: 0,
            ordered_quantity: '',
            unit: material.unit,
            unit_price: material.unit_price || '',
            supplier: material.supplier || '',
            incoming_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setIsIncomingModalOpen(true);
    };

    // 입고 검수 상태 계산
    const getVerificationStatus = (received, ordered) => {
        if (!ordered || ordered <= 0) return null;
        const diff = received - ordered;
        if (Math.abs(diff) < 0.01) return { status: '일치', color: '#059669', bg: '#dcfce7', icon: '✅' };
        if (diff < 0) return { status: '부족', color: '#dc2626', bg: '#fee2e2', icon: '⚠️', diff: Math.abs(diff) };
        return { status: '초과', color: '#d97706', bg: '#fef3c7', icon: '⚠️', diff: Math.abs(diff) };
    };

    const confirmIncoming = async () => {
        if (!incomingData.materialId || incomingData.quantity <= 0) {
            return alert('입고 수량을 입력해주세요.');
        }

        const material = materials.find(m => m.id === incomingData.materialId);
        if (!material) return;

        const newStock = material.stock + parseFloat(incomingData.quantity);
        await updateMaterial(incomingData.materialId, { stock: newStock });

        // 검수 상태 계산
        const orderedQty = incomingData.ordered_quantity ? parseFloat(incomingData.ordered_quantity) : null;
        const receivedQty = parseFloat(incomingData.quantity);
        const unitPrice = parseFloat(incomingData.unit_price) || 0;
        const supplierName = incomingData.supplier || '';
        let verificationStatus = null;
        if (orderedQty && orderedQty > 0) {
            const diff = receivedQty - orderedQty;
            if (Math.abs(diff) < 0.01) verificationStatus = '일치';
            else if (diff < 0) verificationStatus = '부족';
            else verificationStatus = '초과';
        }

        // 매입 전표 생성 (원재료 입고 기록 — 일일/월별 입출고 조회에서 사용)
        try {
            const { error: voucherError } = await addVoucher({
                voucher_date: incomingData.incoming_date,
                voucher_type: '매입',
                item_name: incomingData.materialName,
                item_code: '',
                quantity: receivedQty,
                unit: incomingData.unit,
                unit_price: unitPrice,
                client: supplierName,
                notes: `[자동-원재료] ${incomingData.materialName} ${receivedQty}${incomingData.unit} 입고`
            });
            if (voucherError) {
                console.error('매입 전표 생성 실패:', voucherError);
                alert('⚠️ 입고는 처리되었으나 매입 전표 생성에 실패했습니다.');
            }
        } catch (e) {
            console.error('매입 전표 생성 예외:', e);
            alert('⚠️ 입고는 처리되었으나 매입 전표 생성에 실패했습니다.');
        }

        const statusMsg = verificationStatus ? ` [검수: ${verificationStatus}]` : '';
        alert(`✓ ${incomingData.materialName} ${incomingData.quantity}${incomingData.unit} 입고 처리되었습니다.${statusMsg}\n현재 재고: ${newStock}${incomingData.unit}\n📋 매입 전표가 ${supplierName || '(미지정)'} 업체로 자동 등록되었습니다.`);

        setIsIncomingModalOpen(false);
        setIncomingData({
            materialId: null,
            materialName: '',
            quantity: 0,
            ordered_quantity: '',
            unit: 'kg',
            unit_price: '',
            supplier: '',
            incoming_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
    };

    const handleRecordUsage = (row) => {
        setUsageItem({
            materialId: row.id,
            materialName: row.name,
            quantity: 0,
            unit: row.unit,
            workOrder: '',
            usageDate: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setIsUsageModalOpen(true);
    };

    const confirmUsage = async () => {
        if (!usageItem.materialId || usageItem.quantity <= 0) {
            return alert('자재와 사용량을 입력해주세요.');
        }

        if (isEditingUsage && editingUsageId) {
            // Edit mode
            const usageData = {
                material_id: usageItem.materialId,
                material_name: usageItem.materialName,
                quantity: parseFloat(usageItem.quantity),
                unit: usageItem.unit,
                work_order: usageItem.workOrder || null,
                usage_date: usageItem.usageDate,
                notes: usageItem.notes || null
            };

            const { error } = await updateMaterialUsage(editingUsageId, editingUsageOldQuantity, usageData);

            if (!error) {
                alert('사용 내역이 수정되었습니다.');
                resetUsageForm();
            } else {
                alert('수정에 실패했습니다.');
            }
        } else {
            // Add mode
            const usageData = {
                material_id: usageItem.materialId,
                material_name: usageItem.materialName,
                quantity: parseFloat(usageItem.quantity),
                unit: usageItem.unit,
                work_order: usageItem.workOrder || null,
                usage_date: usageItem.usageDate,
                notes: usageItem.notes || null
            };

            const { error } = await addMaterialUsage(usageData);

            if (!error) {
                alert(`'${usageItem.materialName}' ${usageItem.quantity}${usageItem.unit}이(가) 사용 등록되었습니다.`);
                resetUsageForm();
            } else {
                alert('사용 등록에 실패했습니다.');
            }
        }
    };

    const handleEditUsage = (usage) => {
        setUsageItem({
            materialId: usage.material_id,
            materialName: usage.material_name,
            quantity: usage.quantity,
            unit: usage.unit,
            workOrder: usage.work_order || '',
            usageDate: usage.usage_date,
            notes: usage.notes || ''
        });
        setIsEditingUsage(true);
        setEditingUsageId(usage.id);
        setEditingUsageOldQuantity(usage.quantity);
        setIsUsageModalOpen(true);
    };

    const handleDeleteUsage = async (usage) => {
        if (window.confirm(`'${usage.material_name}' 사용 내역을 삭제하시겠습니까?\n삭제 시 재고가 ${usage.quantity}${usage.unit} 증가합니다.`)) {
            const { error } = await deleteMaterialUsage(usage.id, usage.material_id, usage.quantity);
            if (!error) {
                alert('사용 내역이 삭제되었습니다.');
            } else {
                alert('삭제에 실패했습니다.');
            }
        }
    };

    const resetUsageForm = () => {
        setIsUsageModalOpen(false);
        setIsEditingUsage(false);
        setEditingUsageId(null);
        setEditingUsageOldQuantity(0);
        setUsageItem({
            materialId: '',
            materialName: '',
            quantity: 0,
            unit: 'kg',
            workOrder: '',
            usageDate: new Date().toISOString().split('T')[0],
            notes: ''
        });
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">원재료 관리</h2>
                    <p className="page-description">자재 재고를 확인하고 안전재고 미달 시 긴급 발주를 지시합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={materials || []}
                        columns={[
                            { key: 'name', label: '자재명', sample: '예: PP-001', parse: parsers.string },
                            { key: 'type', label: '종류', sample: '플라스틱', parse: parsers.string },
                            { key: 'stock', label: '현재재고', sample: 100, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'unit', label: '단위', sample: 'kg', parse: parsers.string },
                            { key: 'min_stock', label: '안전재고', sample: 50, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'unit_price', label: '단가', sample: 5000, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'supplier', label: '공급사', sample: '예: 한일케미칼', parse: parsers.string }
                        ]}
                        fileName="원재료목록"
                        onImport={async (rows) => {
                            const valid = rows.filter(r => r.name);
                            if (valid.length === 0) return alert('자재명이 입력된 행이 없습니다.');
                            if (!window.confirm(`${valid.length}건의 자재를 신규 등록합니다. 진행하시겠습니까?\n(기존 자재와 동일한 이름이면 중복 등록됩니다)`)) return;
                            let ok = 0;
                            for (const r of valid) {
                                try {
                                    await addMaterial({
                                        name: r.name,
                                        type: r.type || '기타',
                                        stock: parseFloat(r.stock) || 0,
                                        unit: r.unit || 'kg',
                                        min_stock: parseFloat(r.min_stock) || 0,
                                        unit_price: parseFloat(r.unit_price) || 0,
                                        supplier: r.supplier || ''
                                    });
                                    ok++;
                                } catch (e) { console.error(e); }
                            }
                            alert(`${ok}/${valid.length}건 등록 완료`);
                        }}
                    />
                    {can('materials', 'create') && (
                        <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                            <Plus size={18} /> 자재 등록
                        </button>
                    )}
                </div>
            </div>

            <MiniKpiCards cards={[
                {
                    label: '전체 자재',
                    value: `${(materials || []).length}종`,
                    icon: <Package size={20} />,
                    color: 'var(--primary)'
                },
                {
                    label: '안전재고 미달',
                    value: `${(materials || []).filter(m => m.min_stock > 0 && parseFloat(m.stock || 0) < parseFloat(m.min_stock)).length}건`,
                    icon: <AlertTriangle size={20} />,
                    color: 'var(--danger)',
                    sub: '발주 검토 필요'
                },
                {
                    label: '재고 0',
                    value: `${(materials || []).filter(m => parseFloat(m.stock || 0) <= 0).length}건`,
                    icon: <TrendingDown size={20} />,
                    color: 'var(--warning)'
                },
                {
                    label: '총 재고 가치',
                    value: `₩${(materials || []).reduce((sum, m) => sum + (parseFloat(m.stock || 0) * parseFloat(m.unit_price || 0)), 0).toLocaleString()}`,
                    icon: <CheckCircle size={20} />,
                    color: 'var(--success)'
                }
            ]} />

            {/* 월 소모량 분석 — 월별 추이(원재료별) + 전월 대비 */}
            <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>📉 원재료 월 소모량 분석</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button className="icon-btn" onClick={() => stepMonth(-1)}>◀</button>
                        <input type="month" className="form-input" style={{ width: 150 }} value={anMonth} onChange={(e) => setAnMonth(e.target.value)} />
                        <button className="icon-btn" onClick={() => stepMonth(1)}>▶</button>
                    </div>
                </div>

                {consumptionAnalysis.topIds.length > 0 ? (
                    <ResponsiveContainer width="100%" height={230}>
                        <LineChart data={consumptionAnalysis.chartData} margin={{ top: 5, right: 16, left: -18, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => `${v} kg`} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            {consumptionAnalysis.topIds.map((id, i) => (
                                <Line key={id} type="monotone" dataKey={matName(id)} stroke={MC_PALETTE[i % MC_PALETTE.length]} strokeWidth={2} dot={{ r: 2 }} />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem', fontSize: '0.9rem' }}>
                        생산 기록(일일작업현황)이 있어야 소모량이 집계됩니다.
                    </div>
                )}

                {consumptionAnalysis.rows.length > 0 && (
                    <div style={{ marginTop: '1rem', overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                                    <th style={{ textAlign: 'left', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>원재료</th>
                                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>이번달</th>
                                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>전월</th>
                                    <th style={{ textAlign: 'right', padding: '8px 6px', borderBottom: '1px solid var(--border)' }}>증감</th>
                                </tr>
                            </thead>
                            <tbody>
                                {consumptionAnalysis.rows.map(r => (
                                    <tr key={r.id}>
                                        <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', fontWeight: 600, color: 'var(--text-main)' }}>{r.name}</td>
                                        <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700 }}>{r.cur.toFixed(1)} kg</td>
                                        <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right', color: 'var(--text-muted)' }}>{r.prev.toFixed(1)} kg</td>
                                        <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border)', textAlign: 'right', fontWeight: 700, color: r.change == null ? '#6366f1' : r.change > 0 ? '#dc2626' : r.change < 0 ? '#16a34a' : 'var(--text-muted)' }}>
                                            {r.change == null ? '신규' : r.change === 0 ? '–' : `${r.change > 0 ? '▲' : '▼'} ${Math.abs(r.change)}%`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <Table
                columns={columns}
                data={materials || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {can('materials', 'update') && (
                            <button
                                className="icon-btn-small"
                                onClick={() => handleEditMaterial(row)}
                                title="원재료 정보 수정"
                            >
                                <Edit size={16} />
                            </button>
                        )}
                        {can('materials', 'delete') && (
                            <button
                                className="icon-btn-small delete-btn-small"
                                onClick={() => handleDeleteMaterial(row)}
                                title="원재료 삭제"
                            >
                                <Trash2 size={16} />
                            </button>
                        )}
                        <button
                            className="usage-btn"
                            onClick={() => handleRecordUsage(row)}
                            title="작업 투입량 기록"
                        >
                            <ShoppingCart size={16} /> 사용 등록
                        </button>
                        <button
                            className="incoming-btn"
                            onClick={() => handleIncoming(row)}
                            title="원재료 입고 등록"
                        >
                            <Plus size={16} /> 입고 등록
                        </button>
                        {row.stock < row.min_stock && (
                            <button className="alert-btn" onClick={() => handleProductionInstruction(row)}>
                                <AlertCircle size={16} /> 긴급 생산지시(발주)
                            </button>
                        )}
                    </div>
                )}
            />

            <Modal
                title={isEditingMaterial ? "원재료 정보 수정" : "신규 자재 등록"}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setIsEditingMaterial(false);
                    setEditingMaterialId(null);
                    setNewItem({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
                }}
            >
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
                    <label className="form-label">단가 (₩)</label>
                    <input type="number" className="form-input" value={newItem.unit_price} onChange={(e) => setNewItem({ ...newItem, unit_price: e.target.value })} placeholder="단위당 가격" />
                </div>
                <div className="form-group">
                    <label className="form-label">공급사</label>
                    <select className="form-input" value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}>
                        <option value="">— 거래처 선택 —</option>
                        {supplierNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                        {newItem.supplier && !supplierNames.includes(newItem.supplier) && (
                            <option value={newItem.supplier}>{newItem.supplier} (미등록)</option>
                        )}
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => {
                        setIsModalOpen(false);
                        setIsEditingMaterial(false);
                        setEditingMaterialId(null);
                        setNewItem({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
                    }}>취소</button>
                    <button className="btn-submit" onClick={confirmMaterial}>
                        {isEditingMaterial ? '수정' : '등록'}
                    </button>
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

            <Modal
                title={isEditingUsage ? "원재료 사용 내역 수정" : "원재료 사용 등록"}
                isOpen={isUsageModalOpen}
                onClose={resetUsageForm}
            >
                <div className="form-group">
                    <label className="form-label">자재명</label>
                    <input className="form-input" value={usageItem.materialName} disabled />
                </div>
                <div className="form-group">
                    <label className="form-label">사용량</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={usageItem.quantity}
                            onChange={(e) => setUsageItem({ ...usageItem, quantity: parseFloat(e.target.value) || 0 })}
                            placeholder="사용한 수량"
                        />
                        <input className="form-input" style={{ width: '80px' }} value={usageItem.unit} disabled />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">작업지시번호 (선택)</label>
                    <input
                        className="form-input"
                        value={usageItem.workOrder}
                        onChange={(e) => setUsageItem({ ...usageItem, workOrder: e.target.value })}
                        placeholder="예: WO-2024-001"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">사용일자</label>
                    <input
                        type="date"
                        className="form-input"
                        value={usageItem.usageDate}
                        onChange={(e) => setUsageItem({ ...usageItem, usageDate: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">비고 (선택)</label>
                    <textarea
                        className="form-input"
                        value={usageItem.notes}
                        onChange={(e) => setUsageItem({ ...usageItem, notes: e.target.value })}
                        placeholder="메모 또는 특이사항"
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetUsageForm}>취소</button>
                    <button className="btn-submit" onClick={confirmUsage}>
                        <PlayCircle size={16} style={{ marginRight: '0.5rem' }} />
                        {isEditingUsage ? '수정' : '등록'}
                    </button>
                </div>
            </Modal>

            {/* 원재료 입고 검수 모달 */}
            <Modal
                title="원재료 입고 검수"
                isOpen={isIncomingModalOpen}
                onClose={() => setIsIncomingModalOpen(false)}
            >
                <div className="form-group">
                    <label className="form-label">자재명</label>
                    <input className="form-input" value={incomingData.materialName} disabled />
                </div>
                <div className="form-group">
                    <label className="form-label">공급사</label>
                    <select
                        className="form-input"
                        value={incomingData.supplier}
                        onChange={(e) => setIncomingData({ ...incomingData, supplier: e.target.value })}
                    >
                        <option value="">— 거래처 선택 —</option>
                        {supplierNames.map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                        {incomingData.supplier && !supplierNames.includes(incomingData.supplier) && (
                            <option value={incomingData.supplier}>{incomingData.supplier} (미등록)</option>
                        )}
                    </select>
                    {supplierNames.length === 0 && (
                        <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: 4, display: 'block' }}>
                            등록된 거래처가 없습니다. 거래처 관리에서 먼저 등록하세요.
                        </span>
                    )}
                </div>
                <div className="form-group">
                    <label className="form-label">발주 수량 <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(주문한 수량)</span></label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={incomingData.ordered_quantity}
                            onChange={(e) => setIncomingData({ ...incomingData, ordered_quantity: e.target.value })}
                            placeholder="발주 수량 입력"
                        />
                        <input className="form-input" style={{ width: '80px' }} value={incomingData.unit} disabled />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">실입고 수량</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={incomingData.quantity}
                            onChange={(e) => setIncomingData({ ...incomingData, quantity: parseFloat(e.target.value) || 0 })}
                            placeholder="실제 입고된 수량"
                        />
                        <input className="form-input" style={{ width: '80px' }} value={incomingData.unit} disabled />
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">단가 (₩)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={incomingData.unit_price}
                        onChange={(e) => setIncomingData({ ...incomingData, unit_price: e.target.value })}
                        placeholder="kg당 / EA당 단가"
                    />
                    {incomingData.unit_price && incomingData.quantity > 0 && (
                        <p style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: 600, marginTop: '0.3rem' }}>
                            합계: ₩{(parseFloat(incomingData.unit_price) * parseFloat(incomingData.quantity)).toLocaleString()}
                        </p>
                    )}
                </div>

                {/* 검수 결과 표시 */}
                {incomingData.ordered_quantity && incomingData.quantity > 0 && (() => {
                    const verification = getVerificationStatus(
                        parseFloat(incomingData.quantity),
                        parseFloat(incomingData.ordered_quantity)
                    );
                    if (!verification) return null;
                    return (
                        <div style={{
                            background: verification.bg,
                            border: `1px solid ${verification.color}30`,
                            borderLeft: `4px solid ${verification.color}`,
                            borderRadius: '10px',
                            padding: '0.875rem 1.25rem',
                            marginBottom: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem'
                        }}>
                            <span style={{ fontSize: '1.2rem' }}>{verification.icon}</span>
                            <div>
                                <div style={{ fontWeight: 700, color: verification.color, fontSize: '0.95rem' }}>
                                    검수 결과: {verification.status}
                                </div>
                                <div style={{ fontSize: '0.85rem', color: verification.color, opacity: 0.85, marginTop: '2px' }}>
                                    {verification.status === '일치'
                                        ? `발주 ${incomingData.ordered_quantity}${incomingData.unit} = 입고 ${incomingData.quantity}${incomingData.unit}`
                                        : `발주 ${incomingData.ordered_quantity}${incomingData.unit} → 입고 ${incomingData.quantity}${incomingData.unit} (${verification.status === '부족' ? '-' : '+'}${verification.diff.toFixed(1)}${incomingData.unit})`
                                    }
                                </div>
                            </div>
                        </div>
                    );
                })()}

                <div className="form-group">
                    <label className="form-label">입고일</label>
                    <input
                        type="date"
                        className="form-input"
                        value={incomingData.incoming_date}
                        onChange={(e) => setIncomingData({ ...incomingData, incoming_date: e.target.value })}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">비고 (선택)</label>
                    <textarea
                        className="form-input"
                        value={incomingData.notes}
                        onChange={(e) => setIncomingData({ ...incomingData, notes: e.target.value })}
                        placeholder="입고 관련 메모"
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsIncomingModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={confirmIncoming}>
                        <CheckCircle size={16} style={{ marginRight: '0.5rem' }} />
                        입고 검수 완료
                    </button>
                </div>
            </Modal>

            {/* 입고 기록 수정 모달 */}
            <Modal title="입고 내역 수정" isOpen={!!editingIncoming} onClose={() => setEditingIncoming(null)}>
                {editingIncoming && (
                    <div>
                        <div style={{ background: 'var(--bg-subtle)', padding: '0.75rem 1rem', borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem' }}>
                            <strong>자재:</strong> {editingIncoming.item_name}
                        </div>
                        <div className="form-group">
                            <label className="form-label">거래처(공급사)</label>
                            <select className="form-input" value={incomingEditForm.client}
                                onChange={(e) => setIncomingEditForm({ ...incomingEditForm, client: e.target.value })}>
                                <option value="">— 거래처 선택 —</option>
                                {supplierNames.map(name => <option key={name} value={name}>{name}</option>)}
                                {incomingEditForm.client && !supplierNames.includes(incomingEditForm.client) && (
                                    <option value={incomingEditForm.client}>{incomingEditForm.client} (미등록)</option>
                                )}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">입고일</label>
                            <input type="date" className="form-input" value={incomingEditForm.voucher_date}
                                onChange={(e) => setIncomingEditForm({ ...incomingEditForm, voucher_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">입고 수량 ({editingIncoming.unit || 'kg'})</label>
                            <input type="number" className="form-input" value={incomingEditForm.quantity}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setIncomingEditForm({ ...incomingEditForm, quantity: parseFloat(e.target.value) || 0 })} />
                            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 4, display: 'block' }}>수량을 바꾸면 원재료 재고가 차이만큼 자동 보정됩니다.</span>
                        </div>
                        <div className="form-group">
                            <label className="form-label">단가</label>
                            <input type="number" className="form-input" value={incomingEditForm.unit_price}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setIncomingEditForm({ ...incomingEditForm, unit_price: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginTop: '1rem' }}>
                            <button className="btn-cancel" onClick={deleteIncoming}
                                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '0.5rem 1rem', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                                🗑 입고 삭제
                            </button>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button className="btn-cancel" onClick={() => setEditingIncoming(null)}>취소</button>
                                <button className="btn-submit" onClick={saveIncomingEdit}>저장</button>
                            </div>
                        </div>
                    </div>
                )}
            </Modal>

            {/* 일일 입출고 조회 */}
            <div className="usage-history-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>📋 일일 입출고 조회</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={() => {
                                const d = new Date(trackingDate);
                                d.setDate(d.getDate() - 1);
                                setTrackingDate(d.toISOString().split('T')[0]);
                            }}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                        >◀</button>
                        <input
                            type="date"
                            value={trackingDate}
                            onChange={(e) => setTrackingDate(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}
                        />
                        <button
                            onClick={() => {
                                const d = new Date(trackingDate);
                                d.setDate(d.getDate() + 1);
                                setTrackingDate(d.toISOString().split('T')[0]);
                            }}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                        >▶</button>
                        <button
                            onClick={() => setTrackingDate(new Date().toISOString().split('T')[0])}
                            style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                        >오늘</button>
                    </div>
                </div>

                {(() => {
                    // 해당 날짜 입고 (vouchers 매입 전표 중 원재료 자동생성분)
                    const dayIncoming = (vouchers || []).filter(v =>
                        v.voucher_date === trackingDate && v.voucher_type === '매입' && v.notes && v.notes.includes('[자동-원재료]')
                    );
                    // 해당 날짜 출고 (material_usage)
                    const dayOutgoing = (materialUsage || []).filter(u =>
                        u.usage_date === trackingDate
                    );

                    const totalIn = dayIncoming.length;
                    const totalOut = dayOutgoing.length;

                    return (
                        <div>
                            {/* 요약 카드 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '1rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, marginBottom: '4px' }}>📥 입고</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>{totalIn}건</div>
                                </div>
                                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', padding: '1rem', borderRadius: '10px', border: '1px solid #93c5fd' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600, marginBottom: '4px' }}>📤 출고 (사용)</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb' }}>{totalOut}건</div>
                                </div>
                            </div>

                            {totalIn === 0 && totalOut === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    📭 {trackingDate} 입출고 기록이 없습니다.
                                </div>
                            ) : (
                                <div className="usage-history-table">
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>구분</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>자재명</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>수량</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>비고</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, width: 70 }}>수정</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {dayIncoming.map((t) => (
                                                <tr key={`in-${t.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>입고</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{t.item_name}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                        +{parseFloat(t.quantity).toLocaleString()} {t.unit}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>{t.client || '-'}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <button onClick={() => openIncomingEdit(t)} title="입고 수정"
                                                            style={{ background: '#eef2ff', color: '#4f46e5', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                                                            ✏️ 수정
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {dayOutgoing.map((u) => (
                                                <tr key={`out-${u.id}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                        <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>출고</span>
                                                    </td>
                                                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{u.material_name}</td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                                                        -{parseFloat(u.quantity).toLocaleString()} {u.unit}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                                        {u.work_order ? `작업: ${u.work_order}` : ''}{u.work_order && u.notes ? ' / ' : ''}{u.notes || (!u.work_order ? '-' : '')}
                                                    </td>
                                                    <td style={{ padding: '0.75rem', textAlign: 'center', color: '#cbd5e1', fontSize: '0.8rem' }}>—</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>

            {/* Material Usage History Section */}
            {materialUsage && materialUsage.length > 0 && (
                <div className="usage-history-section">
                    <h3 className="section-title">최근 원재료 사용 내역</h3>
                    <div className="usage-history-table">
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>사용일자</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>자재명</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>사용량</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>작업지시</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>비고</th>
                                    <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>작업</th>
                                </tr>
                            </thead>
                            <tbody>
                                {materialUsage.slice(0, 10).map((usage) => (
                                    <tr key={usage.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '0.75rem' }}>{usage.usage_date}</td>
                                        <td style={{ padding: '0.75rem' }}>{usage.material_name}</td>
                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>
                                            {parseFloat(usage.quantity).toLocaleString()} {usage.unit}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                                            {usage.work_order || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            {usage.notes || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                <button
                                                    className="icon-btn-small"
                                                    onClick={() => handleEditUsage(usage)}
                                                    title="수정"
                                                >
                                                    <Edit size={14} />
                                                </button>
                                                <button
                                                    className="icon-btn-small delete-btn-small"
                                                    onClick={() => handleDeleteUsage(usage)}
                                                    title="삭제"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* 월별 원재료 입고/사용량 요약 */}
            <div className="usage-history-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                        📊 월별 원재료 입고/사용량 요약
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                            onClick={() => {
                                const [y, m] = summaryMonth.split('-').map(Number);
                                const prev = new Date(y, m - 2, 1);
                                setSummaryMonth(`${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`);
                            }}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                        >◀</button>
                        <input
                            type="month"
                            value={summaryMonth}
                            onChange={(e) => setSummaryMonth(e.target.value)}
                            style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}
                        />
                        <button
                            onClick={() => {
                                const [y, m] = summaryMonth.split('-').map(Number);
                                const next = new Date(y, m, 1);
                                setSummaryMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
                            }}
                            style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontSize: '0.85rem' }}
                        >▶</button>
                    </div>
                </div>

                {(() => {
                    // 해당 월의 원재료 입고 (vouchers 매입 전표 중 원재료 자동생성분)
                    const monthIncoming = (vouchers || []).filter(v =>
                        v.voucher_type === '매입' && v.notes && v.notes.includes('[자동-원재료]') && v.voucher_date && v.voucher_date.startsWith(summaryMonth)
                    );
                    // 해당 월의 사용 (material_usage)
                    const monthUsage = (materialUsage || []).filter(u =>
                        u.usage_date && u.usage_date.startsWith(summaryMonth)
                    );

                    // 원재료별 집계
                    const summaryMap = {};

                    // materials 기준으로 초기화
                    (materials || []).forEach(mat => {
                        summaryMap[mat.id] = {
                            name: mat.name,
                            unit: mat.unit,
                            incomingQty: 0,
                            orderedQty: 0,
                            usageQty: 0,
                            incomingCount: 0,
                            usageCount: 0,
                            mismatchCount: 0
                        };
                    });

                    monthIncoming.forEach(t => {
                        // voucher의 item_name으로 materials에서 매칭
                        const matchedMat = (materials || []).find(m => m.name === t.item_name);
                        const key = matchedMat ? matchedMat.id : t.item_name;
                        if (!summaryMap[key]) {
                            summaryMap[key] = { name: t.item_name, unit: t.unit, incomingQty: 0, orderedQty: 0, usageQty: 0, incomingCount: 0, usageCount: 0, mismatchCount: 0 };
                        }
                        summaryMap[key].incomingQty += parseFloat(t.quantity) || 0;
                        summaryMap[key].incomingCount += 1;
                    });

                    monthUsage.forEach(u => {
                        const key = u.material_id;
                        if (!summaryMap[key]) {
                            summaryMap[key] = { name: u.material_name, unit: u.unit, incomingQty: 0, orderedQty: 0, usageQty: 0, incomingCount: 0, usageCount: 0, mismatchCount: 0 };
                        }
                        summaryMap[key].usageQty += parseFloat(u.quantity) || 0;
                        summaryMap[key].usageCount += 1;
                    });

                    // 활동이 있는 원재료만 필터
                    const summaryRows = Object.values(summaryMap).filter(
                        row => row.incomingQty > 0 || row.usageQty > 0
                    );

                    const totalIncoming = summaryRows.reduce((s, r) => s + r.incomingCount, 0);
                    const totalUsage = summaryRows.reduce((s, r) => s + r.usageCount, 0);
                    const totalMismatch = summaryRows.reduce((s, r) => s + r.mismatchCount, 0);

                    return (
                        <div>
                            {/* 요약 카드 */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                                <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '1rem', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#065f46', fontWeight: 600, marginBottom: '4px' }}>📥 입고 건수</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#059669' }}>{totalIncoming}건</div>
                                </div>
                                <div style={{ background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', padding: '1rem', borderRadius: '10px', border: '1px solid #93c5fd' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#1e40af', fontWeight: 600, marginBottom: '4px' }}>📤 사용 건수</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#2563eb' }}>{totalUsage}건</div>
                                </div>
                                <div style={{ background: totalMismatch > 0 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #f0fdf4, #dcfce7)', padding: '1rem', borderRadius: '10px', border: `1px solid ${totalMismatch > 0 ? '#fbbf24' : '#86efac'}` }}>
                                    <div style={{ fontSize: '0.78rem', color: totalMismatch > 0 ? '#92400e' : '#166534', fontWeight: 600, marginBottom: '4px' }}>🔍 검수 불일치</div>
                                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: totalMismatch > 0 ? '#d97706' : '#16a34a' }}>{totalMismatch}건</div>
                                </div>
                            </div>

                            {summaryRows.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                    📭 {summaryMonth} 월 입출고 기록이 없습니다.
                                </div>
                            ) : (
                                <div className="usage-history-table">
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                                <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600 }}>원재료명</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>발주수량</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>실입고수량</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600 }}>과부족</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>사용량</th>
                                                <th style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600 }}>재고 변동</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summaryRows.map((row, idx) => {
                                                const diff = row.orderedQty > 0 ? row.incomingQty - row.orderedQty : null;
                                                const stockChange = row.incomingQty - row.usageQty;
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '0.75rem', fontWeight: 600 }}>{row.name}</td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', color: row.orderedQty > 0 ? '#374151' : 'var(--text-muted)' }}>
                                                            {row.orderedQty > 0 ? `${row.orderedQty.toLocaleString()} ${row.unit}` : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                                                            {row.incomingQty > 0 ? `${row.incomingQty.toLocaleString()} ${row.unit}` : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                                            {diff !== null ? (
                                                                <span style={{
                                                                    padding: '2px 10px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '0.8rem',
                                                                    fontWeight: 700,
                                                                    background: Math.abs(diff) < 0.01 ? '#dcfce7' : diff < 0 ? '#fee2e2' : '#fef3c7',
                                                                    color: Math.abs(diff) < 0.01 ? '#166534' : diff < 0 ? '#dc2626' : '#d97706'
                                                                }}>
                                                                    {Math.abs(diff) < 0.01 ? '✅ 일치' : diff < 0 ? `▼ ${Math.abs(diff).toFixed(1)} 부족` : `▲ ${diff.toFixed(1)} 초과`}
                                                                </span>
                                                            ) : (
                                                                <span style={{ color: 'var(--text-muted)' }}>-</span>
                                                            )}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>
                                                            {row.usageQty > 0 ? `${row.usageQty.toLocaleString()} ${row.unit}` : '-'}
                                                        </td>
                                                        <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: 700, color: stockChange >= 0 ? '#059669' : '#dc2626' }}>
                                                            {stockChange >= 0 ? '+' : ''}{stockChange.toFixed(1)} {row.unit}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })()}
            </div>


            <style>{`
                .page-container { 
                    padding: 0 1.5rem; 
                    max-width: 1600px; 
                    margin: 0 auto;
                }
                .page-header-row { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-end; 
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid var(--border);
                }
                .page-subtitle { 
                    font-size: 1.5rem; 
                    font-weight: 800; 
                    margin-bottom: 0.25rem;
                    background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .page-description { 
                    color: var(--text-muted); 
                    font-size: 0.875rem;
                    font-weight: 500;
                }
                .btn-primary { 
                    background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
                    color: white; 
                    padding: 0.65rem 1.3rem; 
                    border-radius: 8px; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.5rem; 
                    font-weight: 600;
                    box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.2), 0 2px 4px -1px rgba(79, 70, 229, 0.1);
                    transition: all 0.2s;
                }
                .btn-primary:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.3), 0 4px 6px -2px rgba(79, 70, 229, 0.1);
                }
                .alert-btn { 
                    background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
                    color: #991b1b; 
                    border: 1px solid #fca5a5; 
                    padding: 0.5rem 1rem; 
                    border-radius: 8px; 
                    font-size: 0.875rem; 
                    font-weight: 600; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.5rem; 
                    transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .alert-btn:hover { 
                    background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px -1px rgba(220, 38, 38, 0.2);
                }
                .usage-btn { 
                    background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                    color: #1e40af; 
                    border: 1px solid #93c5fd; 
                    padding: 0.5rem 1rem; 
                    border-radius: 8px; 
                    font-size: 0.875rem; 
                    font-weight: 600; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.5rem; 
                    transition: all 0.2s;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                }
                .usage-btn:hover { 
                    background: linear-gradient(135deg, #bfdbfe 0%, #93c5fd 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.2);
                }
                .alert-box { 
                    background: linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%);
                    border-left: 4px solid #f43f5e; 
                    color: #be123c; 
                    padding: 0.875rem 1.25rem; 
                    border-radius: 10px; 
                    display: flex; 
                    align-items: center; 
                    gap: 0.75rem; 
                    margin-bottom: 1.25rem; 
                    font-weight: 600;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
                }
                .usage-history-section { 
                    margin-top: 2.5rem; 
                    background: white; 
                    padding: 1.75rem; 
                    border-radius: 12px; 
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
                    border: 1px solid var(--border);
                }
                .section-title { 
                    font-size: 1.15rem; 
                    font-weight: 700; 
                    margin-bottom: 1.25rem; 
                    color: var(--text-main);
                    padding-bottom: 0.75rem;
                    border-bottom: 2px solid var(--border);
                }
                .usage-history-table { 
                    overflow-x: auto;
                    margin-top: 1rem;
                }
                .usage-history-table table {
                    border-collapse: separate;
                    border-spacing: 0;
                }
                .usage-history-table th {
                    padding: 0.65rem 0.875rem !important;
                    font-size: 0.8125rem !important;
                    font-weight: 700 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.02em !important;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
                }
                .usage-history-table td {
                    padding: 0.625rem 0.875rem !important;
                    font-size: 0.9rem !important;
                }
                .usage-history-table tbody tr {
                    transition: all 0.15s;
                }
                .usage-history-table tbody tr:hover {
                    background: #f8fafc !important;
                    transform: scale(1.002);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
                }
                .icon-btn-small { 
                    padding: 0.375rem; 
                    border-radius: 6px; 
                    color: var(--text-muted); 
                    transition: all 0.2s; 
                    background: transparent;
                }
                .icon-btn-small:hover { 
                    background: #e0e7ff; 
                    color: var(--primary);
                    transform: translateY(-1px);
                }
                .delete-btn-small:hover { 
                    background: #fee2e2; 
                    color: var(--danger);
                }
                
                /* Global Table Compact Styling */
                :global(.glass-panel table) {
                    border-collapse: separate;
                    border-spacing: 0;
                }
                :global(.glass-panel th) {
                    padding: 0.65rem 0.875rem !important;
                    font-size: 0.8125rem !important;
                    font-weight: 700 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.02em !important;
                    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%) !important;
                }
                :global(.glass-panel td) {
                    padding: 0.625rem 0.875rem !important;
                    font-size: 0.9rem !important;
                }
                :global(.glass-panel tbody tr) {
                    transition: all 0.15s;
                }
                :global(.glass-panel tbody tr:hover) {
                    background: #f8fafc !important;
                    transform: scale(1.002);
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
                }

                .incoming-btn {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                    padding: 0.4rem 0.75rem;
                    border: none;
                    border-radius: 6px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 0.3rem;
                    transition: all 0.2s;
                }

                .incoming-btn:hover {
                    background: linear-gradient(135deg, #059669 0%, #047857 100%);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(16, 185, 129, 0.3);
                }
            `}</style>
        </div>
    );
};

export default Materials;
