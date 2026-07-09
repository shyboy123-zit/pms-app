import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import { PackageCheck, Plus, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const emptyForm = {
    product_id: '',
    client: '',
    packing_quantity: '',
    box_quantity: '',
    box_spec: '',
    vinyl_color: '',
    notes: ''
};

const PackagingStandards = () => {
    const {
        packagingStandards, products, suppliers,
        addPackagingStandard, updatePackagingStandard, deletePackagingStandard
    } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [formData, setFormData] = useState(emptyForm);

    // 필터
    const [filterProduct, setFilterProduct] = useState('');
    const [filterClient, setFilterClient] = useState('');

    const productName = (id) => products.find(p => p.id === id)?.name || '-';

    // 납품처 자동완성 후보: 거래처명 + 이미 입력된 납품처
    const clientOptions = useMemo(() => {
        const set = new Set();
        (suppliers || []).forEach(s => { if (s.name) set.add(s.name); });
        (packagingStandards || []).forEach(p => { if (p.client) set.add(p.client); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [suppliers, packagingStandards]);

    // 납품처 필터 후보 (등록된 납품처만)
    const clientFilterOptions = useMemo(() => {
        const set = new Set();
        (packagingStandards || []).forEach(p => { if (p.client) set.add(p.client); });
        return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
    }, [packagingStandards]);

    const filtered = useMemo(() => {
        return (packagingStandards || []).filter(row => {
            if (filterProduct && row.product_id !== filterProduct) return false;
            if (filterClient && (row.client || '') !== filterClient) return false;
            return true;
        });
    }, [packagingStandards, filterProduct, filterClient]);

    const columns = [
        { header: '제품명', accessor: 'product_name', render: (row) => productName(row.product_id) },
        { header: '납품처', accessor: 'client', render: (row) => row.client || '-' },
        {
            header: '포장수량', accessor: 'packing_quantity',
            render: (row) => row.packing_quantity != null && row.packing_quantity !== '' ? `${Number(row.packing_quantity).toLocaleString()} EA` : '-'
        },
        {
            header: '박스수량', accessor: 'box_quantity',
            render: (row) => row.box_quantity != null && row.box_quantity !== '' ? `${Number(row.box_quantity).toLocaleString()} EA` : '-'
        },
        { header: '포장박스 사양', accessor: 'box_spec', render: (row) => row.box_spec || '-' },
        { header: '비닐색상', accessor: 'vinyl_color', render: (row) => row.vinyl_color || '-' },
        { header: '비고', accessor: 'notes', render: (row) => row.notes || '-' }
    ];

    const openModal = (row = null) => {
        if (row) {
            setEditing(row);
            setFormData({
                product_id: row.product_id || '',
                client: row.client || '',
                packing_quantity: row.packing_quantity ?? '',
                box_quantity: row.box_quantity ?? '',
                box_spec: row.box_spec || '',
                vinyl_color: row.vinyl_color || '',
                notes: row.notes || ''
            });
        } else {
            setEditing(null);
            setFormData(emptyForm);
        }
        setIsModalOpen(true);
    };

    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSave = async () => {
        if (!formData.product_id) return alert('제품을 선택해주세요.');

        // 숫자 필드 정제: 빈 값은 null, 값이 있으면 숫자로
        const toNum = (v) => (v === '' || v == null ? null : Number(v));
        const payload = {
            product_id: formData.product_id,
            client: formData.client?.trim() || null,
            packing_quantity: toNum(formData.packing_quantity),
            box_quantity: toNum(formData.box_quantity),
            box_spec: formData.box_spec?.trim() || null,
            vinyl_color: formData.vinyl_color?.trim() || null,
            notes: formData.notes?.trim() || null
        };

        if (editing) {
            await updatePackagingStandard(editing.id, payload);
        } else {
            await addPackagingStandard(payload);
        }
        setIsModalOpen(false);
        setEditing(null);
        setFormData(emptyForm);
    };

    const handleDelete = async (id) => {
        if (window.confirm('이 포장표준을 삭제하시겠습니까?')) {
            await deletePackagingStandard(id);
        }
    };

    const renderActions = (row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="icon-btn" onClick={() => openModal(row)} title="수정">
                <Edit size={16} />
            </button>
            <button className="icon-btn" onClick={() => handleDelete(row.id)} title="삭제" style={{ color: 'var(--danger)' }}>
                <Trash2 size={16} />
            </button>
        </div>
    );

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">포장표준관리</h2>
                    <p className="page-description">아이템별 포장 표준(포장수량·박스수량·박스사양·비닐색상)을 관리합니다. 동일 아이템도 납품처별로 여러 건 등록할 수 있습니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={filtered.map(r => ({ ...r, product_name: productName(r.product_id) }))}
                        columns={[
                            { key: 'product_name', label: '제품명' },
                            { key: 'client', label: '납품처' },
                            { key: 'packing_quantity', label: '포장수량', format: (v) => (v == null || v === '' ? '' : Number(v)) },
                            { key: 'box_quantity', label: '박스수량', format: (v) => (v == null || v === '' ? '' : Number(v)) },
                            { key: 'box_spec', label: '포장박스사양' },
                            { key: 'vinyl_color', label: '비닐색상' },
                            { key: 'notes', label: '비고' }
                        ]}
                        fileName="포장표준"
                    />
                    <button className="btn-primary" onClick={() => openModal()}>
                        <Plus size={18} /> 포장표준 등록
                    </button>
                </div>
            </div>

            {/* 필터 */}
            <div className="filter-row" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <select className="form-input" style={{ maxWidth: 240 }}
                    value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)}>
                    <option value="">전체 제품</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <select className="form-input" style={{ maxWidth: 200 }}
                    value={filterClient} onChange={(e) => setFilterClient(e.target.value)}>
                    <option value="">전체 납품처</option>
                    {clientFilterOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterProduct || filterClient) && (
                    <button className="btn-cancel" style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        onClick={() => { setFilterProduct(''); setFilterClient(''); }}>
                        필터 초기화
                    </button>
                )}
                <span style={{ alignSelf: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    총 {filtered.length}건
                </span>
            </div>

            <Table columns={columns} data={filtered} actions={renderActions} pageSize={50} />

            <Modal
                title={editing ? '포장표준 수정' : '포장표준 등록'}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                width="640px"
            >
                <div className="pkg-form">
                    <div className="form-grid">
                        <div className="form-group">
                            <label className="form-label">제품 (아이템) *</label>
                            <select className="form-input" value={formData.product_id}
                                onChange={(e) => updateField('product_id', e.target.value)}>
                                <option value="">제품 선택</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.product_code ? `[${p.product_code}] ` : ''}{p.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">납품처</label>
                            <input className="form-input" list="pkg-client-list"
                                value={formData.client}
                                onChange={(e) => updateField('client', e.target.value)}
                                placeholder="예: 코우, 비나 (선택 또는 직접 입력)" />
                            <datalist id="pkg-client-list">
                                {clientOptions.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                        <div className="form-group">
                            <label className="form-label">포장수량 (봉/단위당 EA)</label>
                            <input type="number" className="form-input" value={formData.packing_quantity}
                                onChange={(e) => updateField('packing_quantity', e.target.value)} placeholder="예: 100" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">박스수량 (박스당 EA)</label>
                            <input type="number" className="form-input" value={formData.box_quantity}
                                onChange={(e) => updateField('box_quantity', e.target.value)} placeholder="예: 2000" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">포장박스 사양</label>
                            <input className="form-input" value={formData.box_spec}
                                onChange={(e) => updateField('box_spec', e.target.value)} placeholder="예: A골 40×30×25, 종이박스" />
                        </div>
                        <div className="form-group">
                            <label className="form-label">비닐색상</label>
                            <input className="form-input" value={formData.vinyl_color}
                                onChange={(e) => updateField('vinyl_color', e.target.value)} placeholder="예: 투명 / 청색 / 유백" />
                        </div>
                    </div>
                    <div className="form-group" style={{ marginTop: '0.5rem' }}>
                        <label className="form-label">비고</label>
                        <textarea className="form-input" rows="3" value={formData.notes}
                            onChange={(e) => updateField('notes', e.target.value)}
                            placeholder="포장 방법·주의사항·라벨 등 특이사항" />
                    </div>

                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                        <button className="btn-submit" onClick={handleSave}>
                            {editing ? '수정' : '등록'}
                        </button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .pkg-form { max-height: 70vh; overflow-y: auto; }
                .pkg-form .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 1rem;
                }
                .pkg-form .form-group { margin-bottom: 0; }
            `}</style>
        </div>
    );
};

export default PackagingStandards;
