import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, ShoppingCart, AlertCircle, PlayCircle, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const Materials = () => {
    const {
        materials, addMaterial, updateMaterial, deleteMaterial,
        materialUsage, addMaterialUsage, updateMaterialUsage, deleteMaterialUsage,
        addPurchaseRequest
    } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isUsageModalOpen, setIsUsageModalOpen] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
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
                <span style={{ fontWeight: 600, color: row.stock < row.min_stock ? 'var(--danger)' : 'inherit' }}>
                    {row.stock.toLocaleString()} {row.unit}
                </span>
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
                supplier: newItem.supplier
            };
            addMaterial(itemToAdd);
            alert('원재료가 등록되었습니다.');
        }

        setIsModalOpen(false);
        setIsEditingMaterial(false);
        setEditingMaterialId(null);
        setNewItem({ name: '', type: '플라스틱', stock: 0, unit: 'kg', minStock: 0, supplier: '' });
    };

    const handleEditMaterial = (material) => {
        setNewItem({
            name: material.name,
            type: material.type,
            stock: material.stock,
            unit: material.unit,
            minStock: material.min_stock,
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

    // 원재료 입고 등록
    const [isIncomingModalOpen, setIsIncomingModalOpen] = useState(false);
    const [incomingData, setIncomingData] = useState({
        materialId: null,
        materialName: '',
        quantity: 0,
        unit: 'kg',
        incoming_date: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const handleIncoming = (material) => {
        setIncomingData({
            materialId: material.id,
            materialName: material.name,
            quantity: 0,
            unit: material.unit,
            incoming_date: new Date().toISOString().split('T')[0],
            notes: ''
        });
        setIsIncomingModalOpen(true);
    };

    const confirmIncoming = async () => {
        if (!incomingData.materialId || incomingData.quantity <= 0) {
            return alert('입고 수량을 입력해주세요.');
        }

        // Update material stock directly
        const material = materials.find(m => m.id === incomingData.materialId);
        if (material) {
            const newStock = material.stock + parseFloat(incomingData.quantity);
            await updateMaterial(incomingData.materialId, { stock: newStock });
            alert(`✓ ${incomingData.materialName} ${incomingData.quantity}${incomingData.unit} 입고 처리되었습니다.\n현재 재고: ${newStock}${incomingData.unit}`);
        }

        setIsIncomingModalOpen(false);
        setIncomingData({
            materialId: null,
            materialName: '',
            quantity: 0,
            unit: 'kg',
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
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 자재 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={materials || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            className="icon-btn-small"
                            onClick={() => handleEditMaterial(row)}
                            title="원재료 정보 수정"
                        >
                            <Edit size={16} />
                        </button>
                        <button
                            className="icon-btn-small delete-btn-small"
                            onClick={() => handleDeleteMaterial(row)}
                            title="원재료 삭제"
                        >
                            <Trash2 size={16} />
                        </button>
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
                    <label className="form-label">공급사</label>
                    <input className="form-input" value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} />
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

            {/* 원재료 입고 등록 모달 */}
            <Modal
                title="원재료 입고 등록"
                isOpen={isIncomingModalOpen}
                onClose={() => setIsIncomingModalOpen(false)}
            >
                <div className="form-group">
                    <label className="form-label">자재명</label>
                    <input className="form-input" value={incomingData.materialName} disabled />
                </div>
                <div className="form-group">
                    <label className="form-label">입고 수량</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input
                            type="number"
                            className="form-input"
                            value={incomingData.quantity}
                            onChange={(e) => setIncomingData({ ...incomingData, quantity: parseFloat(e.target.value) || 0 })}
                            placeholder="입고 수량"
                        />
                        <input className="form-input" style={{ width: '80px' }} value={incomingData.unit} disabled />
                    </div>
                </div>
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
                        <Plus size={16} style={{ marginRight: '0.5rem' }} />
                        입고 처리
                    </button>
                </div>
            </Modal>

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
