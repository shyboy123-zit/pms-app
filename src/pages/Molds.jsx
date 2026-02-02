import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, PenTool, History, Wrench, LogOut, LogIn, PackageX, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const Molds = () => {
    const {
        molds, repairHistory, addMold, addMoldHistory, updateMold,
        moldMovement, addMoldOutgoing, processMoldIncoming, getMoldMovements
    } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isRepairOpen, setIsRepairOpen] = useState(false);
    const [isOutgoingOpen, setIsOutgoingOpen] = useState(false);
    const [isIncomingOpen, setIsIncomingOpen] = useState(false);

    const [selectedMold, setSelectedMold] = useState(null);
    const [selectedMovement, setSelectedMovement] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', code: '', cycle: 0, status: '사용가능' });
    const [newRepair, setNewRepair] = useState({ date: '', type: '정기점검', note: '', cost: 0 });
    const [outgoingData, setOutgoingData] = useState({
        outgoing_date: new Date().toISOString().split('T')[0],
        destination: '',
        repair_vendor: '',
        expected_return_date: '',
        outgoing_reason: '',
        responsible_person: '',
        notes: ''
    });
    const [incomingData, setIncomingData] = useState({
        incoming_date: new Date().toISOString().split('T')[0],
        actual_cost: 0,
        repair_result: '',
        incoming_notes: '',
        return_status: '사용가능'
    });

    const columns = [
        { header: '금형명', accessor: 'name' },
        { header: '관리분류코드', accessor: 'code' },
        { header: '현재 타수', accessor: 'cycle_count', render: (row) => row.cycle_count ? row.cycle_count.toLocaleString() : '0' },
        { header: '최종 점검일', accessor: 'last_check' },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '사용가능' ? 'status-active' :
                    row.status === '점검필요' ? 'status-warning' : 'status-danger'
                    }`}>
                    {row.status}
                </span>
            )
        },
    ];

    const handleHistory = (row) => {
        setSelectedMold(row);
        setIsHistoryOpen(true);
    };

    const handleSave = () => {
        if (isEditing) {
            // 수정 모드
            const itemToUpdate = {
                name: newItem.name,
                code: newItem.code,
                cycle_count: newItem.cycle,
                status: newItem.status
            };
            updateMold(editingId, itemToUpdate);
            setIsEditing(false);
            setEditingId(null);
        } else {
            // 신규 등록 모드
            let moldCode = newItem.code.trim();
            if (!moldCode) {
                const nextNumber = molds.length + 1;
                moldCode = `MOLD-${String(nextNumber).padStart(3, '0')}`;
            }

            const itemToAdd = {
                name: newItem.name,
                code: moldCode,
                cycle_count: newItem.cycle,
                status: newItem.status,
                last_check: new Date().toISOString().split('T')[0]
            };
            addMold(itemToAdd);
        }
        setIsModalOpen(false);
        setNewItem({ name: '', code: '', cycle: 0, status: '사용가능' });
    };

    const handleRepairSave = () => {
        if (!newRepair.date || !newRepair.note) return alert('내용을 입력해주세요.');

        const historyItem = {
            mold_id: selectedMold.id,
            type: newRepair.type,
            date: newRepair.date,
            note: newRepair.note,
            cost: newRepair.cost
        };
        addMoldHistory(historyItem);

        // Update mold status if needed
        if (newRepair.type === '수리' || newRepair.type === '부품교체') {
            updateMold(selectedMold.id, { last_check: newRepair.date, status: '수리중' });
        }

        setIsRepairOpen(false);
        setNewRepair({ date: '', type: '정기점검', note: '', cost: 0 });
    };

    const getMoldHistory = () => {
        if (!selectedMold) return [];
        return repairHistory.filter(h => h.mold_id === selectedMold.id);
    };

    const handleOpenOutgoing = (mold) => {
        setSelectedMold(mold);
        setOutgoingData({
            outgoing_date: new Date().toISOString().split('T')[0],
            destination: '',
            repair_vendor: '',
            expected_return_date: '',
            outgoing_reason: '',
            responsible_person: '',
            notes: ''
        });
        setIsOutgoingOpen(true);
    };

    const handleOutgoingSave = async () => {
        if (!outgoingData.outgoing_date || !outgoingData.repair_vendor) {
            return alert('출고일과 수리업체를 입력해주세요.');
        }

        const { error } = await addMoldOutgoing({
            mold_id: selectedMold.id,
            ...outgoingData
        });

        if (!error) {
            alert('금형이 출고 처리되었습니다.');
            setIsOutgoingOpen(false);
        }
    };

    const handleEdit = (mold) => {
        setIsEditing(true);
        setEditingId(mold.id);
        setNewItem({
            name: mold.name,
            code: mold.code,
            cycle: mold.cycle_count || 0,
            status: mold.status
        });
        setIsModalOpen(true);
    };

    const handleOpenIncoming = (movement) => {
        setSelectedMovement(movement);
        setIncomingData({
            incoming_date: new Date().toISOString().split('T')[0],
            actual_cost: 0,
            repair_result: '',
            incoming_notes: '',
            return_status: '사용가능'
        });
        setIsIncomingOpen(true);
    };

    const handleIncomingSave = async () => {
        if (!incomingData.incoming_date) {
            return alert('입고일을 입력해주세요.');
        }

        const { error } = await processMoldIncoming(selectedMovement.id, incomingData);

        if (!error) {
            alert('금형이 입고 처리되었습니다.');
            setIsIncomingOpen(false);
        }
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">금형 관리</h2>
                    <p className="page-description">보유 중인 사출 금형의 상태와 점검 이력을 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 금형 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={molds || []}
                actions={(row) => {
                    const isOut = row.status === '출고중';
                    const canGoOut = row.status === '사용가능' || row.status === '점검필요';

                    return (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="icon-btn" onClick={() => handleEdit(row)} title="수정">
                                <Edit size={16} />
                            </button>
                            <button className="icon-btn" onClick={() => handleHistory(row)} title="수리/점검 이력">
                                <History size={16} />
                            </button>
                            {canGoOut && (
                                <button className="icon-btn outgoing-btn" onClick={() => handleOpenOutgoing(row)} title="수리 출고">
                                    <LogOut size={16} />
                                </button>
                            )}
                            {isOut && (
                                <button className="icon-btn incoming-btn" onClick={() => {
                                    const movement = moldMovement.find(m => m.mold_id === row.id && m.status === '출고중');
                                    if (movement) handleOpenIncoming(movement);
                                }} title="수리 입고">
                                    <LogIn size={16} />
                                </button>
                            )}
                        </div>
                    );
                }}
            />

            <Modal title={isEditing ? "금형 정보 수정" : "신규 금형 등록"} isOpen={isModalOpen} onClose={() => {
                setIsModalOpen(false);
                setIsEditing(false);
                setEditingId(null);
                setNewItem({ name: '', code: '', cycle: 0, status: '사용가능' });
            }}>
                <div className="form-group">
                    <label className="form-label">금형명</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="금형 이름" />
                </div>
                <div className="form-group">
                    <label className="form-label">관리코드 (선택사항)</label>
                    <input
                        className="form-input"
                        value={newItem.code}
                        onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                        placeholder="비워두면 자동 생성 (MOLD-001, MOLD-002...)"
                    />
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        💡 미입력 시 자동으로 생성됩니다
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">현재 타수</label>
                    <input type="number" className="form-input" value={newItem.cycle} onChange={(e) => setNewItem({ ...newItem, cycle: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                    <label className="form-label">상태</label>
                    <select className="form-input" value={newItem.status} onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}>
                        <option value="사용가능">사용가능</option>
                        <option value="점검필요">점검필요</option>
                        <option value="수리중">수리중</option>
                        <option value="폐기">폐기</option>
                    </select>
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>등록</button>
                </div>
            </Modal>

            <Modal title={`수리/점검 이력 - ${selectedMold?.name}`} isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }} onClick={() => setIsRepairOpen(true)}>
                        <Wrench size={16} /> 이력 추가
                    </button>
                </div>

                <div className="history-list">
                    {getMoldHistory().length > 0 ? (
                        getMoldHistory().map(item => (
                            <div key={item.id} className="history-item glass-panel" style={{ marginBottom: '0.75rem', padding: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{item.type}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date}</span>
                                </div>
                                <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>{item.note}</p>
                                <div style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: '600' }}>
                                    비용: {item.cost ? item.cost.toLocaleString() : 0}원
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-muted text-center">이력이 없습니다.</p>
                    )}
                </div>
            </Modal>

            <Modal title="보수 내역 등록" isOpen={isRepairOpen} onClose={() => setIsRepairOpen(false)}>
                <div className="form-group">
                    <label className="form-label">일자</label>
                    <input type="date" className="form-input" value={newRepair.date} onChange={(e) => setNewRepair({ ...newRepair, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">구분</label>
                    <select className="form-input" value={newRepair.type} onChange={(e) => setNewRepair({ ...newRepair, type: e.target.value })}>
                        <option value="정기점검">정기점검</option>
                        <option value="수리">수리</option>
                        <option value="부품교체">부품교체</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">내용</label>
                    <textarea
                        className="form-input"
                        rows="3"
                        value={newRepair.note}
                        onChange={(e) => setNewRepair({ ...newRepair, note: e.target.value })}
                        placeholder="보수/점검 내용을 입력하세요"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">비용 (원)</label>
                    <input type="number" className="form-input" value={newRepair.cost} onChange={(e) => setNewRepair({ ...newRepair, cost: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsRepairOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleRepairSave}>등록</button>
                </div>
            </Modal>

            {/* Outgoing Modal */}
            <Modal title={`수리 출고 - ${selectedMold?.name}`} isOpen={isOutgoingOpen} onClose={() => setIsOutgoingOpen(false)}>
                <div className="form-group">
                    <label className="form-label">출고일</label>
                    <input type="date" className="form-input" value={outgoingData.outgoing_date} onChange={(e) => setOutgoingData({ ...outgoingData, outgoing_date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">수리업체 *</label>
                    <input className="form-input" value={outgoingData.repair_vendor} onChange={(e) => setOutgoingData({ ...outgoingData, repair_vendor: e.target.value })} placeholder="예: ABC 금형수리" />
                </div>
                <div className="form-group">
                    <label className="form-label">출고 사유</label>
                    <select className="form-input" value={outgoingData.outgoing_reason} onChange={(e) => setOutgoingData({ ...outgoingData, outgoing_reason: e.target.value })}>
                        <option value="">선택</option>
                        <option value="정기수리">정기수리</option>
                        <option value="부품교체">부품교체</option>
                        <option value="파손수리">파손수리</option>
                        <option value="정밀가공">정밀가공</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">예상 반환일</label>
                    <input type="date" className="form-input" value={outgoingData.expected_return_date} onChange={(e) => setOutgoingData({ ...outgoingData, expected_return_date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">담당자</label>
                    <input className="form-input" value={outgoingData.responsible_person} onChange={(e) => setOutgoingData({ ...outgoingData, responsible_person: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">비고</label>
                    <textarea className="form-input" rows="3" value={outgoingData.notes} onChange={(e) => setOutgoingData({ ...outgoingData, notes: e.target.value })} placeholder="추가 메모" />
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsOutgoingOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleOutgoingSave}>출고 등록</button>
                </div>
            </Modal>

            {/* Incoming Modal */}
            <Modal title={`수리 입고 - ${selectedMovement?.repair_vendor}`} isOpen={isIncomingOpen} onClose={() => setIsIncomingOpen(false)}>
                <div className="form-group">
                    <label className="form-label">입고일</label>
                    <input type="date" className="form-input" value={incomingData.incoming_date} onChange={(e) => setIncomingData({ ...incomingData, incoming_date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">수리 결과</label>
                    <textarea className="form-input" rows="3" value={incomingData.repair_result} onChange={(e) => setIncomingData({ ...incomingData, repair_result: e.target.value })} placeholder="수리 내용 및 결과" />
                </div>
                <div className="form-group">
                    <label className="form-label">실제 비용 (원)</label>
                    <input type="number" className="form-input" value={incomingData.actual_cost} onChange={(e) => setIncomingData({ ...incomingData, actual_cost: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="form-group">
                    <label className="form-label">입고 후 상태</label>
                    <select className="form-input" value={incomingData.return_status} onChange={(e) => setIncomingData({ ...incomingData, return_status: e.target.value })}>
                        <option value="사용가능">사용가능</option>
                        <option value="점검필요">점검필요</option>
                        <option value="폐기">폐기</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">비고</label>
                    <textarea className="form-input" rows="2" value={incomingData.incoming_notes} onChange={(e) => setIncomingData({ ...incomingData, incoming_notes: e.target.value })} />
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsIncomingOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleIncomingSave}>입고 처리</button>
                </div>
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                .outgoing-btn:hover { background: #ffe5e5; color: #dc2626; }
                .incoming-btn:hover { background: #e0f2fe; color: #0284c7; }
                .history-item { border: 1px solid var(--border); }
            `}</style>
        </div>
    );
};

export default Molds;
