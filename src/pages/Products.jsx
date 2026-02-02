import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Package, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const Products = () => {
    const { products, addProduct, updateProduct, deleteProduct } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentProduct, setCurrentProduct] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        model: '',
        unit: 'EA',
        standard_cycle_time: 30,
        product_weight: 0,
        runner_weight: 0,
        cavity_count: 1,
        status: '생산중'
    });

    const columns = [
        { header: '제품코드', accessor: 'product_code' },
        { header: '제품명', accessor: 'name' },
        { header: '모델/규격', accessor: 'model' },
        { header: '단위', accessor: 'unit' },
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
            standard_cycle_time: product.standard_cycle_time,
            product_weight: product.product_weight || 0,
            runner_weight: product.runner_weight || 0,
            cavity_count: product.cavity_count || 1,
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
            standard_cycle_time: 30,
            product_weight: 0,
            runner_weight: 0,
            cavity_count: 1,
            status: '생산중'
        });
        setCurrentProduct(null);
        setIsEditMode(false);
        setIsModalOpen(false);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">제품 관리</h2>
                    <p className="page-description">생산하는 제품을 등록하고 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 제품 등록
                </button>
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
            </div>

            <Table
                columns={columns}
                data={products || []}
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
                    <label className="form-label">모델/규격</label>
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
                    <label className="form-label">표준 사이클 타임 (초)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={formData.standard_cycle_time}
                        onChange={(e) => setFormData({ ...formData, standard_cycle_time: parseInt(e.target.value) || 0 })}
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

            <style>{`
                .page-container { padding: 0 1rem; }
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
