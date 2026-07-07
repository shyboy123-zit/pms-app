import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import { Plus, Package, Edit, Trash2, Calculator } from 'lucide-react';
import { useData } from '../context/DataContext';
import { parsers } from '../lib/excel';
import LevelGauge from '../components/viz/LevelGauge';

const Products = () => {
    const { products, materials, inventoryTransactions, addProduct, updateProduct, deleteProduct } = useData();

    // 입출고 데이터로 제품 재고 계산 (item_code 또는 item_name 기준 매칭)
    const getProductStock = (product) => {
        const code = product.product_code;
        const name = product.name;
        let stock = 0;
        (inventoryTransactions || []).forEach(t => {
            // item_code가 일치하거나, item_name이 일치하면 같은 제품
            const codeMatch = code && t.item_code && t.item_code === code;
            const nameMatch = name && t.item_name && t.item_name === name;
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

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);

    // 안전재고 자동계산 (최근 3개월 일평균 납품 × 14일)
    const SAFETY_WINDOW_DAYS = 90;   // 납품량 집계 기간
    const SAFETY_COVERAGE_DAYS = 14; // 안전재고 = 일평균 납품 × 이 일수
    const [isAutoStockOpen, setIsAutoStockOpen] = useState(false);
    const [autoStockRows, setAutoStockRows] = useState([]);
    const [isApplyingStock, setIsApplyingStock] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        model: '',
        unit: 'EA',
        unit_price: 0,
        product_type: '매출',
        company_name: '',
        standard_cycle_time: 30,
        product_weight: 0,
        runner_weight: 0,
        cavity_count: 1,
        material_id: '',
        min_stock: 0,
        max_stock: 0,
        virgin_ratio: 50,
        status: '생산중'
    });

    const columns = [
        { header: '제품코드', accessor: 'product_code' },
        { header: '제품명', accessor: 'name' },
        { header: '모델/규격', accessor: 'model' },
        { header: '단위', accessor: 'unit' },
        {
            header: '구분', accessor: 'product_type', render: (row) => (
                <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 700,
                    background: row.product_type === '매출' ? '#d1fae5' : '#dbeafe',
                    color: row.product_type === '매출' ? '#059669' : '#2563eb'
                }}>
                    {row.product_type || '미지정'}
                </span>
            )
        },
        { header: '업체명', accessor: 'company_name', render: (row) => row.company_name || '-' },
        {
            header: '단가', accessor: 'unit_price', render: (row) => (
                <span style={{ fontWeight: 700, color: '#0ea5e9' }}>
                    {row.unit_price ? `₩${Number(row.unit_price).toLocaleString()}` : '-'}
                </span>
            )
        },
        { header: 'C/V수', accessor: 'cavity_count', render: (row) => `${row.cavity_count || 1}-C/V` },
        {
            header: '1 Shot 중량(g)',
            render: (row) => {
                const cavityCount = row.cavity_count || 1;
                const shotWeight = ((row.product_weight || 0) * cavityCount) + (row.runner_weight || 0);
                return shotWeight > 0 ? `${shotWeight.toFixed(1)}g` : '-';
            }
        },
        { header: '표준 사이클(초)', accessor: 'standard_cycle_time' },
        {
            header: '원재료', accessor: 'material_id', render: (row) => {
                const mat = materials.find(m => m.id === row.material_id);
                return mat ? (
                    <span style={{ fontWeight: 600, color: '#0369a1' }}>{mat.name}</span>
                ) : <span style={{ color: '#94a3b8' }}>-</span>;
            }
        },
        {
            header: '신재:분쇄 (자체분쇄율)', accessor: 'virgin_ratio', render: (row) => {
                const isVirginOnly = (row.virgin_ratio ?? 50) >= 100;
                if (isVirginOnly) {
                    return <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700, background: '#dbeafe', color: '#1e40af' }}>신재 100%</span>;
                }
                const pw = row.product_weight || 0, rw = row.runner_weight || 0, cv = row.cavity_count || 1;
                const shot = pw * cv + rw;
                const reg = shot > 0 ? Math.round(rw / shot * 100) : 0;
                const ok = reg >= 50;
                return (
                    <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '0.78rem', fontWeight: 700,
                        background: ok ? '#dcfce7' : '#fef3c7', color: ok ? '#166534' : '#d97706'
                    }} title={ok ? '런너로 1:1 이상 충당 가능' : '런너 부족 — 1:1 불가, 신재 더 필요'}>
                        신재 {100 - reg} : 분쇄 {reg}{ok ? '' : ' ⚠'}
                    </span>
                );
            }
        },
        {
            header: '재고', accessor: 'stock', render: (row) => {
                const currentStock = getProductStock(row);
                const isLow = row.min_stock > 0 && currentStock < row.min_stock;
                const isOver = row.max_stock > 0 && currentStock > row.max_stock;
                return (
                    <div style={{ minWidth: 130 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: 600, color: isLow ? '#dc2626' : isOver ? '#d97706' : 'inherit' }}>
                                {currentStock.toLocaleString()} {row.unit}
                            </span>
                            {isLow && (
                                <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}>
                                    부족
                                </span>
                            )}
                            {isOver && (
                                <span style={{ padding: '1px 6px', borderRadius: '8px', fontSize: '0.65rem', fontWeight: 700, background: '#fef3c7', color: '#d97706' }}>
                                    초과
                                </span>
                            )}
                        </div>
                        {row.min_stock > 0 && (
                            <div style={{ marginTop: 5 }}>
                                <LevelGauge value={currentStock} max={row.min_stock} height={8} showText={false} />
                            </div>
                        )}
                    </div>
                );
            }
        },
        { header: '안전재고', accessor: 'min_stock', render: (row) => row.min_stock > 0 ? `${(row.min_stock).toLocaleString()} ${row.unit}` : '-' },
        { header: '초과재고', accessor: 'max_stock', render: (row) => row.max_stock > 0 ? `${(row.max_stock).toLocaleString()} ${row.unit}` : '-' },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '생산중' ? 'status-active' : 'status-danger'}`}>
                    {row.status}
                </span>
            )
        },
    ];

    const handleSubmit = async () => {
        if (!formData.name) return alert('제품명을 입력해주세요.');

        if (isEditMode) {
            await updateProduct(currentProduct.id, formData);
        } else {
            await addProduct(formData);
        }

        resetForm();
    };

    const openEditModal = (product) => {
        setCurrentProduct(product);
        setFormData({
            name: product.name,
            model: product.model,
            unit: product.unit,
            unit_price: product.unit_price || 0,
            product_type: product.product_type || '매출',
            company_name: product.company_name || '',
            standard_cycle_time: product.standard_cycle_time,
            product_weight: product.product_weight || 0,
            runner_weight: product.runner_weight || 0,
            cavity_count: product.cavity_count || 1,
            material_id: product.material_id || '',
            min_stock: product.min_stock || 0,
            max_stock: product.max_stock || 0,
            virgin_ratio: product.virgin_ratio ?? 50,
            status: product.status
        });
        setIsEditMode(true);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        await deleteProduct(id);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            model: '',
            unit: 'EA',
            unit_price: 0,
            product_type: '매출',
            company_name: '',
            standard_cycle_time: 30,
            product_weight: 0,
            runner_weight: 0,
            cavity_count: 1,
            material_id: '',
            min_stock: 0,
            max_stock: 0,
            virgin_ratio: 50,
            status: '생산중'
        });
        setCurrentProduct(null);
        setIsEditMode(false);
        setIsModalOpen(false);
    };

    // --- 안전재고 자동계산 ---
    // 제품별 최근 SAFETY_WINDOW_DAYS일 OUT(납품) 합계 → 일평균 × SAFETY_COVERAGE_DAYS = 제안 안전재고
    const buildSafetyStockSuggestions = () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - SAFETY_WINDOW_DAYS);
        const cutoffStr = cutoff.toISOString().split('T')[0];

        // 출고(매출) 제품만 대상 — 과잉생산 방지가 목적
        const targets = (products || []).filter(p => (p.product_type || '매출') === '매출');

        const rows = targets.map(p => {
            const code = p.product_code;
            const name = p.name;
            let delivered = 0;
            (inventoryTransactions || []).forEach(t => {
                if (t.transaction_type !== 'OUT') return;
                if (!t.transaction_date || t.transaction_date < cutoffStr) return;
                const codeMatch = code && t.item_code && t.item_code === code;
                const nameMatch = name && t.item_name && t.item_name === name;
                if (codeMatch || nameMatch) delivered += parseFloat(t.quantity) || 0;
            });
            const avgDaily = delivered / SAFETY_WINDOW_DAYS;
            const suggested = Math.round(avgDaily * SAFETY_COVERAGE_DAYS);
            const current = parseFloat(p.min_stock) || 0;
            return {
                id: p.id,
                name,
                unit: p.unit,
                delivered,
                avgDaily,
                current,
                suggested,
                changed: suggested !== current
            };
        });
        // 변경 있는 것 우선, 그 안에서 납품량 많은 순
        rows.sort((a, b) => (b.changed - a.changed) || (b.delivered - a.delivered));
        return rows;
    };

    const openAutoStock = () => {
        setAutoStockRows(buildSafetyStockSuggestions());
        setIsAutoStockOpen(true);
    };

    const applyAutoStock = async () => {
        const changes = autoStockRows.filter(r => r.changed);
        if (changes.length === 0) { alert('변경할 제품이 없습니다.'); return; }
        if (!window.confirm(`${changes.length}개 제품의 안전재고를 제안값으로 변경합니다. 진행할까요?`)) return;
        setIsApplyingStock(true);
        let ok = 0;
        for (const r of changes) {
            await updateProduct(r.id, { min_stock: r.suggested });
            ok++;
        }
        setIsApplyingStock(false);
        setIsAutoStockOpen(false);
        alert(`${ok}개 제품의 안전재고를 업데이트했습니다.`);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">제품 관리</h2>
                    <p className="page-description">생산하는 제품을 등록하고 관리합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={products || []}
                        columns={[
                            { key: 'product_code', label: '제품코드', sample: 'PRD-001', parse: parsers.string },
                            { key: 'name', label: '제품명', sample: '예: 베어링 A', parse: parsers.string },
                            { key: 'model', label: '모델', sample: 'BR-100', parse: parsers.string },
                            { key: 'unit', label: '단위', sample: 'EA', parse: parsers.string },
                            { key: 'standard_cycle_time', label: '표준사이클타임(초)', sample: 30, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'unit_price', label: '단가', sample: 5000, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'min_stock', label: '안전재고', sample: 100, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'max_stock', label: '초과재고', sample: 1000, parse: parsers.number, format: (v) => parseFloat(v || 0) },
                            { key: 'virgin_ratio', label: '신재비율(%)', sample: 50, parse: parsers.number, format: (v) => parseFloat(v ?? 50) },
                            { key: 'status', label: '상태', sample: '생산중', parse: parsers.string }
                        ]}
                        fileName="제품목록"
                        onImport={async (rows) => {
                            const valid = rows.filter(r => r.product_code && r.name);
                            if (valid.length === 0) return alert('제품코드와 제품명이 모두 입력된 행이 없습니다.');
                            if (!window.confirm(`${valid.length}건의 제품을 신규 등록합니다. 진행하시겠습니까?\n(제품코드 중복 시 실패합니다)`)) return;
                            let ok = 0, fail = 0;
                            for (const r of valid) {
                                try {
                                    await addProduct({
                                        product_code: r.product_code,
                                        name: r.name,
                                        model: r.model || '',
                                        unit: r.unit || 'EA',
                                        standard_cycle_time: parseInt(r.standard_cycle_time) || 30,
                                        unit_price: parseFloat(r.unit_price) || 0,
                                        min_stock: parseFloat(r.min_stock) || 0,
                                        max_stock: parseFloat(r.max_stock) || 0,
                                        virgin_ratio: (r.virgin_ratio === '' || r.virgin_ratio == null) ? 50 : parseFloat(r.virgin_ratio),
                                        status: r.status || '생산중'
                                    });
                                    ok++;
                                } catch (e) { fail++; console.error(e); }
                            }
                            alert(`${ok}건 등록, ${fail}건 실패`);
                        }}
                    />
                    <button className="btn-secondary" onClick={openAutoStock} title="최근 3개월 납품량 기준으로 안전재고를 자동 계산합니다">
                        <Calculator size={18} /> 안전재고 자동계산
                    </button>
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <Plus size={18} /> 제품 등록
                    </button>
                </div>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">전체 제품</span>
                    <span className="value">{products.length}개</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">생산중</span>
                    <span className="value" style={{ color: 'var(--success)' }}>
                        {products.filter(p => p.status === '생산중').length}개
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">단종</span>
                    <span className="value" style={{ color: 'var(--text-muted)' }}>
                        {products.filter(p => p.status === '단종').length}개
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">⚠️ 안전재고 미달</span>
                    <span className="value" style={{ color: 'var(--danger)' }}>
                        {products.filter(p => p.min_stock > 0 && getProductStock(p) < p.min_stock).length}개
                    </span>
                </div>
            </div>

            <Table
                columns={columns}
                data={products || []}
                pageSize={50}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => openEditModal(row)} title="수정">
                            <Edit size={16} />
                        </button>
                        <button className="icon-btn delete-btn" onClick={() => handleDelete(row.id)} title="삭제">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            />

            {/* Add/Edit Product Modal */}
            <Modal title={isEditMode ? "제품 수정" : "신규 제품 등록"} isOpen={isModalOpen} onClose={resetForm}>
                <div className="form-group">
                    <label className="form-label">제품명 *</label>
                    <input
                        className="form-input"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="예: 플라스틱 커버 A"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">구분 (매입/매출) *</label>
                    <select
                        className="form-input"
                        value={formData.product_type}
                        onChange={(e) => setFormData({ ...formData, product_type: e.target.value })}
                    >
                        <option value="매출">매출 (출고 제품)</option>
                        <option value="매입">매입 (입고 제품)</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">업체명</label>
                    <input
                        className="form-input"
                        value={formData.company_name}
                        onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                        placeholder="예: 현대자동차"
                    />
                </div>
                <div className="form-group">
                    <input
                        className="form-input"
                        value={formData.model}
                        onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                        placeholder="예: CV-100"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">단위</label>
                    <select
                        className="form-input"
                        value={formData.unit}
                        onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                        <option value="EA">EA</option>
                        <option value="SET">SET</option>
                        <option value="BOX">BOX</option>
                        <option value="KG">KG</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">단가 (원)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.unit_price}
                        onChange={(e) => setFormData({ ...formData, unit_price: parseInt(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        placeholder="예: 1500"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">표준 사이클 타임 (초)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.standard_cycle_time}
                        onChange={(e) => setFormData({ ...formData, standard_cycle_time: parseInt(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="1"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">제품 중량 (g)</label>
                    <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={formData.product_weight}
                        onChange={(e) => setFormData({ ...formData, product_weight: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        placeholder="예: 50"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">런너 중량 (g)</label>
                    <input
                        type="number"
                        step="0.1"
                        className="form-input"
                        value={formData.runner_weight}
                        onChange={(e) => setFormData({ ...formData, runner_weight: parseFloat(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        placeholder="예: 10"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Cavity 수</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.cavity_count}
                        onChange={(e) => setFormData({ ...formData, cavity_count: parseInt(e.target.value) || 1 })}
                        onFocus={(e) => e.target.select()}
                        min="1"
                        placeholder="예: 2"
                    />
                </div>
                {(formData.product_weight > 0 || formData.runner_weight > 0 || formData.cavity_count > 1) && (
                    <div style={{ padding: '0.75rem', background: '#eff6ff', borderRadius: '6px', marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>1 Shot 중량</div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                            {((formData.product_weight * formData.cavity_count) + formData.runner_weight).toFixed(1)}g
                        </div>
                        {formData.cavity_count > 1 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                ({formData.product_weight}g × {formData.cavity_count} + {formData.runner_weight}g)
                            </div>
                        )}
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">원재료 (사용 수지)</label>
                    <select
                        className="form-input"
                        value={formData.material_id}
                        onChange={(e) => setFormData({ ...formData, material_id: e.target.value })}
                    >
                        <option value="">원재료를 선택하세요</option>
                        {materials.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">안전재고 수량</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.min_stock}
                        onChange={(e) => setFormData({ ...formData, min_stock: parseInt(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        placeholder="예: 100"
                    />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>현재 재고는 입출고관리 재고현황에서 자동 계산됩니다</span>
                </div>
                <div className="form-group">
                    <label className="form-label">초과재고 수량 (상한선)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.max_stock}
                        onChange={(e) => setFormData({ ...formData, max_stock: parseInt(e.target.value) || 0 })}
                        onFocus={(e) => e.target.select()}
                        min="0"
                        placeholder="예: 1000 (0이면 경고 없음)"
                    />
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>현재고가 이 수량을 넘으면 대시보드에 초과재고 경고가 표시됩니다</span>
                </div>
                <div className="form-group">
                    <label className="form-label">원재료 구성</label>
                    <select
                        className="form-input"
                        value={(formData.virgin_ratio ?? 50) >= 100 ? 'virgin' : 'mixed'}
                        onChange={(e) => setFormData({ ...formData, virgin_ratio: e.target.value === 'virgin' ? 100 : 50 })}
                    >
                        <option value="mixed">신재 + 분쇄 (런너 100% 재사용)</option>
                        <option value="virgin">신재만</option>
                    </select>
                    {(() => {
                        const pw = parseFloat(formData.product_weight) || 0;
                        const rw = parseFloat(formData.runner_weight) || 0;
                        const cv = parseFloat(formData.cavity_count) || 1;
                        const shot = pw * cv + rw;
                        const regPct = shot > 0 ? (rw / shot * 100) : 0;
                        const isVirgin = (formData.virgin_ratio ?? 50) >= 100;
                        if (isVirgin) {
                            return <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px', display: 'block' }}>분쇄 미사용 — 신재 100% 투입 (런너는 스크랩)</span>;
                        }
                        return (
                            <span style={{ fontSize: '0.75rem', color: regPct >= 50 ? '#16a34a' : '#d97706', marginTop: '4px', display: 'block' }}>
                                런너/샷 기준 자체 분쇄율 ≈ <b>{regPct.toFixed(0)}%</b> (신재 {(100 - regPct).toFixed(0)}%)
                                {' '}— {regPct >= 50 ? '1:1 이상 가능 ✓' : '1:1 불가 (런너 부족)'}
                            </span>
                        );
                    })()}
                </div>
                <div className="form-group">
                    <label className="form-label">상태</label>
                    <select
                        className="form-input"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                        <option value="생산중">생산중</option>
                        <option value="단종">단종</option>
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSubmit}>
                        {isEditMode ? '수정' : '등록'}
                    </button>
                </div>
            </Modal>

            {/* 안전재고 자동계산 미리보기 모달 */}
            <Modal title="안전재고 자동계산 (미리보기)" isOpen={isAutoStockOpen} onClose={() => setIsAutoStockOpen(false)}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    최근 <b>3개월</b> 납품량(출고) 기준 <b>일평균 × {SAFETY_COVERAGE_DAYS}일치</b>로 안전재고를 제안합니다.
                    납품이 적은 제품은 안전재고가 낮아져 <b>과잉생산을 막아줍니다.</b> (출고 제품만 대상)
                </p>
                {(() => {
                    const changeCnt = autoStockRows.filter(r => r.changed).length;
                    const downCnt = autoStockRows.filter(r => r.changed && r.suggested < r.current).length;
                    const upCnt = autoStockRows.filter(r => r.changed && r.suggested > r.current).length;
                    return (
                        <div style={{ fontSize: '0.82rem', marginBottom: '0.75rem' }}>
                            대상 {autoStockRows.length}개 · 변경 <b>{changeCnt}</b>개
                            (<span style={{ color: '#2563eb' }}>▼{downCnt} 감소</span> · <span style={{ color: '#d97706' }}>▲{upCnt} 증가</span>)
                        </div>
                    );
                })()}
                <div style={{ maxHeight: '50vh', overflowY: 'auto', border: '1px solid var(--border, #e5e7eb)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-main, #f8fafc)', position: 'sticky', top: 0 }}>
                                <th style={{ textAlign: 'left', padding: '8px' }}>제품명</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>3개월 납품</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>일평균</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>현재</th>
                                <th style={{ textAlign: 'right', padding: '8px' }}>제안</th>
                            </tr>
                        </thead>
                        <tbody>
                            {autoStockRows.length === 0 && (
                                <tr><td colSpan={5} style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>출고 제품이 없습니다.</td></tr>
                            )}
                            {autoStockRows.map(r => (
                                <tr key={r.id} style={{ borderTop: '1px solid var(--border, #eef2f7)', background: r.changed ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                                    <td style={{ padding: '8px' }}>{r.name}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{r.delivered.toLocaleString()}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', color: 'var(--text-muted)' }}>{r.avgDaily.toFixed(1)}</td>
                                    <td style={{ padding: '8px', textAlign: 'right' }}>{r.current.toLocaleString()}</td>
                                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700,
                                        color: !r.changed ? 'var(--text-muted)' : (r.suggested < r.current ? '#2563eb' : '#d97706') }}>
                                        {r.changed && (r.suggested < r.current ? '▼ ' : '▲ ')}{r.suggested.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsAutoStockOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={applyAutoStock} disabled={isApplyingStock || autoStockRows.filter(r => r.changed).length === 0}>
                        {isApplyingStock ? '적용 중...' : '제안값 적용'}
                    </button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .btn-secondary { background: var(--bg-main, #f1f5f9); color: var(--text-main); border: 1px solid var(--border, #e2e8f0); padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; cursor: pointer; }
                .btn-secondary:hover { background: var(--bg-hover, #e2e8f0); }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .stats-row { display: flex; gap: 1rem; margin-bottom: 2rem; }
                .simple-stat { padding: 1rem 1.5rem; display: flex; flex-direction: column; flex: 1; }
                .simple-stat .label { font-size: 0.85rem; color: var(--text-muted); margin-bottom: 0.5rem; }
                .simple-stat .value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                .delete-btn:hover { color: var(--danger); }
            `}</style>
        </div>
    );
};

export default Products;
