import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Settings, Activity, Power, History, Wrench, Image as ImageIcon } from 'lucide-react';
import { useData } from '../context/DataContext';

const Equipments = () => {
    const { equipments, eqHistory, workOrders, products, addEquipment, updateEquipment, addEqHistory, uploadImage } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isRepairOpen, setIsRepairOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // New Equipment State
    const [newItem, setNewItem] = useState({ name: '', model: '', status: '대기', operator: '', file: null });
    // Edit Equipment State
    const [editItem, setEditItem] = useState({ id: null, name: '', model: '', operator: '' });
    // Selected Equipment
    const [selectedEq, setSelectedEq] = useState(null);
    // New Repair History State
    const [newHistory, setNewHistory] = useState({ date: '', type: '정기점검', note: '', worker: '', file: null });

    const columns = [
        { header: '설비번호', accessor: 'eq_code' },
        {
            header: '설비사진', accessor: 'image_url', render: (row) => (
                row.image_url ?
                    <a href={row.image_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}>
                        <ImageIcon size={16} /> 보기
                    </a> : ''
            )
        },
        { header: '설비명', accessor: 'name' },
        { header: '모델명', accessor: 'model' },
        {
            header: '현재 작업',
            render: (row) => {
                if (!row.current_work_order_id) return '-';
                const workOrder = workOrders.find(wo => wo.id === row.current_work_order_id);
                if (!workOrder) return '-';
                const product = products.find(p => p.id === workOrder.product_id);
                const progress = workOrder.target_quantity > 0
                    ? Math.round((workOrder.produced_quantity / workOrder.target_quantity) * 100)
                    : 0;
                return (
                    <div style={{ fontSize: '0.9rem' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>
                            {product?.name || '?'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {workOrder.produced_quantity}/{workOrder.target_quantity} ({progress}%)
                        </div>
                    </div>
                );
            }
        },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '가동중' ? 'status-active' :
                    row.status === '대기' ? 'status-warning' : 'status-danger'
                    }`}>
                    {row.status === '가동중' && <Activity size={12} style={{ marginRight: 4 }} className="spin-slow" />}
                    {row.status}
                </span>
            )
        },
        { header: '담당자', accessor: 'operator' },
    ];

    const handleSave = async () => {
        if (!newItem.name) return alert('설비명을 입력해주세요.');

        setIsUploading(true);
        let imageUrl = null;
        if (newItem.file) {
            imageUrl = await uploadImage(newItem.file);
        }

        const count = equipments.length + 1;
        const newCode = `EQ-NJ-${String(count).padStart(3, '0')}`;

        const itemToAdd = {
            eq_code: newCode,
            name: newItem.name,
            model: newItem.model,
            status: newItem.status,
            operator: newItem.operator,
            temperature: 0,
            cycle_time: 0,
            image_url: imageUrl
        };

        await addEquipment(itemToAdd);
        setIsUploading(false);
        setIsModalOpen(false);
        setNewItem({ name: '', model: '', status: '대기', operator: '', file: null });
    };

    const openEditModal = (row) => {
        setEditItem({
            id: row.id,
            name: row.name,
            model: row.model,
            operator: row.operator
        });
        setIsEditModalOpen(true);
    };

    const handleEditSave = () => {
        if (!editItem.name) return alert('설비명을 입력해주세요.');

        updateEquipment(editItem.id, {
            name: editItem.name,
            model: editItem.model,
            operator: editItem.operator
        });

        setIsEditModalOpen(false);
        setEditItem({ id: null, name: '', model: '', operator: '' });
    };

    const toggleStatus = (row) => {
        const newStatus = row.status === '가동중' ? '대기' : '가동중';
        const updates = {
            status: newStatus,
            temperature: newStatus === '가동중' ? 220 : 0,
            cycle_time: newStatus === '가동중' ? 38 : 0
        };
        updateEquipment(row.id, updates);
    };

    const openHistory = (eq) => {
        setSelectedEq(eq);
        setIsHistoryOpen(true);
    };

    const handleHistorySave = async () => {
        if (!newHistory.date || !newHistory.note) return alert('필수 항목을 입력해주세요.');

        setIsUploading(true);
        let imageUrl = null;
        if (newHistory.file) {
            imageUrl = await uploadImage(newHistory.file);
        }

        const itemToAdd = {
            eq_id: selectedEq.id,
            date: newHistory.date,
            type: newHistory.type,
            note: newHistory.note,
            worker: newHistory.worker,
            image_url: imageUrl
        };

        await addEqHistory(itemToAdd);
        setIsUploading(false);
        setIsRepairOpen(false);
        setNewHistory({ date: '', type: '정기점검', note: '', worker: '', file: null });
    };

    const getEqHistory = () => {
        if (!selectedEq) return [];
        return eqHistory.filter(h => h.eq_id === selectedEq.id);
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">기계 설비 관리</h2>
                    <p className="page-description">주요 설비 사진 및 정비 완료 사진을 첨부하여 이력을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 설비 등록
                </button>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">총 설비</span>
                    <span className="value">{equipments ? equipments.length : 0}대</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">가동 중</span>
                    <span className="value" style={{ color: 'var(--success)' }}>
                        {equipments ? equipments.filter(m => m.status === '가동중').length : 0}대
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">가동률</span>
                    <span className="value">
                        {equipments && equipments.length > 0 ? ((equipments.filter(m => m.status === '가동중').length / equipments.length) * 100).toFixed(1) : 0}%
                    </span>
                </div>
            </div>

            <Table
                columns={columns}
                data={equipments || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => openEditModal(row)} title="설비 정보 수정">
                            <Settings size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => openHistory(row)} title="수리/보수 이력">
                            <History size={16} />
                        </button>
                        <button
                            className="icon-btn"
                            onClick={() => toggleStatus(row)}
                            title={row.status === '가동중' ? '가동 중지' : '가동 시작'}
                            style={{ color: row.status === '가동중' ? 'var(--success)' : 'var(--text-muted)' }}
                        >
                            <Power size={16} />
                        </button>
                    </div>
                )}
            />

            {/* Add Equipment Modal */}
            <Modal title="신규 설비 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">설비명</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="예: 사출성형기 #16" />
                </div>
                <div className="form-group">
                    <label className="form-label">모델명</label>
                    <input className="form-input" value={newItem.model} onChange={(e) => setNewItem({ ...newItem, model: e.target.value })} placeholder="예: MODEL-250T" />
                </div>
                <div className="form-group">
                    <label className="form-label">초기 상태</label>
                    <select className="form-input" value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
                        <option value="대기">대기</option>
                        <option value="가동중">가동중</option>
                        <option value="점검중">점검중</option>
                        <option value="고장">고장</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">담당자</label>
                    <input className="form-input" value={newItem.operator} onChange={(e) => setNewItem({ ...newItem, operator: e.target.value })} placeholder="담당 작업자" />
                </div>
                <div className="form-group">
                    <label className="form-label">설비 사진</label>
                    <input type="file" accept="image/*" className="form-input" onChange={(e) => setNewItem({ ...newItem, file: e.target.files[0] })} />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave} disabled={isUploading}>
                        {isUploading ? '업로드 중...' : '등록'}
                    </button>
                </div>
            </Modal>

            {/* Edit Equipment Modal */}
            <Modal title="설비 정보 수정" isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">설비명</label>
                    <input className="form-input" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} placeholder="예: 사출성형기 #16" />
                </div>
                <div className="form-group">
                    <label className="form-label">모델명</label>
                    <input className="form-input" value={editItem.model} onChange={(e) => setEditItem({ ...editItem, model: e.target.value })} placeholder="예: MODEL-250T" />
                </div>
                <div className="form-group">
                    <label className="form-label">담당자</label>
                    <input className="form-input" value={editItem.operator} onChange={(e) => setEditItem({ ...editItem, operator: e.target.value })} placeholder="담당 작업자" />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsEditModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleEditSave}>저장</button>
                </div>
            </Modal>

            {/* History List Modal */}
            <Modal title={`수리/보수 이력 - ${selectedEq?.name}`} isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsRepairOpen(true)}>
                        <Wrench size={16} /> 이력 추가
                    </button>
                </div>

                <div className="history-list">
                    {getEqHistory().length > 0 ? (
                        getEqHistory().map(item => (
                            <div key={item.id} className="history-item glass-panel" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{item.type}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date} · {item.worker}</span>
                                </div>
                                <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>{item.note}</p>
                                {item.image_url && (
                                    <div style={{ marginTop: '0.5rem' }}>
                                        <a href={item.image_url} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <ImageIcon size={14} /> 첨부 사진 보기
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <p className="text-muted text-center">이력이 없습니다.</p>
                    )}
                </div>
            </Modal>

            {/* Add History Modal */}
            <Modal title="보수 내역 등록" isOpen={isRepairOpen} onClose={() => setIsRepairOpen(false)}>
                <div className="form-group">
                    <label className="form-label">일자</label>
                    <input type="date" className="form-input" value={newHistory.date} onChange={(e) => setNewHistory({ ...newHistory, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">구분</label>
                    <select className="form-input" value={newHistory.type} onChange={(e) => setNewHistory({ ...newHistory, type: e.target.value })}>
                        <option value="정기점검">정기점검</option>
                        <option value="수리">수리</option>
                        <option value="부품교체">부품교체</option>
                        <option value="기타">기타</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">작업자</label>
                    <input className="form-input" value={newHistory.worker} onChange={(e) => setNewHistory({ ...newHistory, worker: e.target.value })} placeholder="작업자명" />
                </div>
                <div className="form-group">
                    <label className="form-label">내용</label>
                    <textarea
                        className="form-input"
                        rows="3"
                        value={newHistory.note}
                        onChange={(e) => setNewHistory({ ...newHistory, note: e.target.value })}
                        placeholder="보수/점검 내용을 입력하세요"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">완료 사진</label>
                    <input type="file" accept="image/*" className="form-input" onChange={(e) => setNewHistory({ ...newHistory, file: e.target.files[0] })} />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsRepairOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleHistorySave} disabled={isUploading}>
                        {isUploading ? '업로드 중...' : '등록'}
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
                
                .spin-slow {
                    animation: spin 3s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .history-item { border: 1px solid var(--border); }
            `}</style>
        </div>
    );
};

export default Equipments;
