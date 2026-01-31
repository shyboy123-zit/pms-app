import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, PenTool, History, Wrench } from 'lucide-react';
import { useData } from '../context/DataContext';

const Molds = () => {
    const { molds, repairHistory, addMold, addMoldHistory, updateMold } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isRepairOpen, setIsRepairOpen] = useState(false);

    const [selectedMold, setSelectedMold] = useState(null);
    const [newItem, setNewItem] = useState({ name: '', code: '', cycle: 0, status: '사용가능' });
    const [newRepair, setNewRepair] = useState({ date: '', type: '정기점검', note: '', cost: 0 });

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
        const itemToAdd = {
            name: newItem.name,
            code: newItem.code,
            cycle_count: newItem.cycle,
            status: newItem.status,
            last_check: new Date().toISOString().split('T')[0]
        };
        addMold(itemToAdd);
        setIsModalOpen(false);
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
                actions={(row) => (
                    <button className="icon-btn" onClick={() => handleHistory(row)} title="수리/점검 이력">
                        <History size={16} />
                    </button>
                )}
            />

            <Modal title="신규 금형 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">금형명</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="금형 이름" />
                </div>
                <div className="form-group">
                    <label className="form-label">관리코드</label>
                    <input className="form-input" value={newItem.code} onChange={(e) => setNewItem({ ...newItem, code: e.target.value })} placeholder="예: MD-2023-001" />
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

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                .history-item { border: 1px solid var(--border); }
            `}</style>
        </div>
    );
};

export default Molds;
