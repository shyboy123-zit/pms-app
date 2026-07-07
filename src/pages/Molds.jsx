import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, PenTool, History, Wrench, LogOut, LogIn, PackageX, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useData } from '../context/DataContext';
import DonutKpi from '../components/viz/DonutKpi';
import LevelGauge from '../components/viz/LevelGauge';

const MOLD_CHECK_CYCLE = 90; // 점검 주기(일)

const Molds = () => {
    const {
        molds, repairHistory, addMold, addMoldHistory, deleteMoldHistory, updateMold, deleteMold,
        moldMovement, addMoldOutgoing, processMoldIncoming, getMoldMovements, inspections
    } = useData();

    const [defectMold, setDefectMold] = useState(null); // 불량 이력 모달 대상 금형
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
        {
            header: '점검 주기', accessor: 'last_check', render: (row) => {
                if (!row.last_check) return <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>점검일 없음</span>;
                if (row.status === '폐기' || row.status === '단종') return <span style={{ fontSize: '0.82rem' }}>{row.last_check}</span>;
                const days = Math.floor((Date.now() - new Date(row.last_check).getTime()) / 86400000);
                const left = MOLD_CHECK_CYCLE - days;
                const ratio = days / MOLD_CHECK_CYCLE;
                const color = ratio >= 1 ? '#ef4444' : ratio >= 0.8 ? '#f59e0b' : '#16a34a';
                const ddayText = left > 0 ? `D-${left}` : `D+${-left} 초과`;
                return (
                    <div style={{ minWidth: 140 }}>
                        <div style={{ fontSize: '0.8rem' }}>{row.last_check} <b style={{ color }}>{ddayText}</b></div>
                        <div style={{ marginTop: 5 }}>
                            <LevelGauge value={days} max={MOLD_CHECK_CYCLE} color={color} height={8} showText={false} />
                        </div>
                    </div>
                );
            }
        },
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

    const handleDeleteMold = async (id) => {
        if (!window.confirm('이 금형 정보를 삭제하시겠습니까? 관련 데이터가 모두 삭제될 수 있습니다.')) return;
        const { error } = await deleteMold(id);
        if (error) alert('삭제 실패: ' + error.message);
    };

    const getMoldHistory = () => {
        if (!selectedMold) return [];
        return repairHistory.filter(h => h.mold_id === selectedMold.id);
    };

    const handleDeleteHistory = async (id) => {
        if (!window.confirm('이 이력을 삭제하시겠습니까?')) return;

        const { error } = await deleteMoldHistory(id);
        if (error) {
            alert('삭제 실패: ' + error.message);
        }
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

            {/* 점검 현황 요약 — 사용가능 도넛 + 점검 임박/초과 카운트 */}
            {(() => {
                const list = molds || [];
                const usable = list.filter(m => m.status === '사용가능').length;
                const active = list.filter(m => m.status !== '폐기' && m.status !== '단종');
                let due = 0, soon = 0;
                active.forEach(m => {
                    if (!m.last_check) return;
                    const days = Math.floor((Date.now() - new Date(m.last_check).getTime()) / 86400000);
                    if (days >= MOLD_CHECK_CYCLE) due += 1;
                    else if (days >= MOLD_CHECK_CYCLE * 0.8) soon += 1;
                });
                const other = list.length - usable;
                return (
                    <div className="glass-panel" style={{ padding: '1.25rem', marginBottom: '1rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <DonutKpi size={104}
                                segments={[{ value: usable, color: '#16a34a' }, { value: other, color: '#cbd5e1' }]}
                                centerValue={`${list.length ? Math.round((usable / list.length) * 100) : 0}%`} centerLabel="사용가능" />
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                전체 <b style={{ color: 'var(--text-main)' }}>{list.length}</b>개 · 사용가능 <b style={{ color: '#16a34a' }}>{usable}</b>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                            <div style={{ background: due > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1.25rem', textAlign: 'center', minWidth: 110 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🔴 점검 초과</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: due > 0 ? '#ef4444' : 'var(--text-main)' }}>{due}건</div>
                            </div>
                            <div style={{ background: soon > 0 ? 'rgba(245,158,11,0.08)' : 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 12, padding: '0.85rem 1.25rem', textAlign: 'center', minWidth: 110 }}>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>🟠 점검 임박</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: soon > 0 ? '#d97706' : 'var(--text-main)' }}>{soon}건</div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <Table
                columns={columns}
                data={molds || []}
                pageSize={50}
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
                            <button className="icon-btn" onClick={() => setDefectMold(row)} title="불량 이력" style={{ color: '#ef4444' }}>
                                <AlertTriangle size={16} />
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
                            <button className="icon-btn" onClick={() => handleDeleteMold(row.id)} title="금형 삭제" style={{ color: 'var(--danger)' }}>
                                <Trash2 size={16} />
                            </button>
                        </div>
                    );
                }}
            />

            {/* 금형별 불량 이력 모달 */}
            <Modal title={defectMold ? `🔺 불량 이력 - ${defectMold.name}` : '불량 이력'} isOpen={!!defectMold} onClose={() => setDefectMold(null)}>
                {defectMold && (() => {
                    const name = defectMold.name || '';
                    const defects = (inspections || [])
                        .filter(i => i.result === 'NG' && i.product && (i.product === name || i.product.includes(name) || name.includes(i.product)))
                        .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));
                    const byType = {};
                    defects.forEach(d => { const t = d.ng_type || '기타'; byType[t] = (byType[t] || 0) + 1; });
                    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);
                    if (defects.length === 0) {
                        return <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>이 금형(제품)의 불량 이력이 없습니다. ✓</div>;
                    }
                    return (
                        <div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: '1rem' }}>
                                {typeEntries.map(([t, c]) => (
                                    <span key={t} style={{ background: '#fee2e2', color: '#dc2626', fontWeight: 700, fontSize: '0.78rem', padding: '4px 10px', borderRadius: 8 }}>
                                        {t} {c}건
                                    </span>
                                ))}
                            </div>
                            <div style={{ maxHeight: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {defects.map((d, i) => (
                                    <div key={i} style={{ padding: '10px 12px', background: 'var(--bg-subtle)', borderRadius: 8, fontSize: '0.85rem', borderLeft: '3px solid #ef4444' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                            <span style={{ fontWeight: 700, color: '#dc2626' }}>{d.ng_type || '불량'}</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.date || d.created_at?.split('T')[0]}</span>
                                        </div>
                                        {d.check_item && <div style={{ color: 'var(--text-main)' }}>검사항목: {d.check_item}</div>}
                                        {d.action && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>조치: {d.action}</div>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}
            </Modal>

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
                            <div key={item.id} className="history-item glass-panel" style={{ marginBottom: '0.75rem', padding: '1rem', position: 'relative' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingRight: '1.5rem' }}>
                                    <span style={{ fontWeight: '600', color: 'var(--primary)' }}>{item.type}</span>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{item.date}</span>
                                </div>
                                <p style={{ fontSize: '0.95rem', marginBottom: '0.5rem', paddingRight: '1.5rem' }}>{item.note}</p>
                                <div style={{ textAlign: 'right', fontSize: '0.9rem', fontWeight: '600', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <button
                                        onClick={() => handleDeleteHistory(item.id)}
                                        className="text-danger"
                                        style={{
                                            fontSize: '0.8rem',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '4px',
                                            border: '1px solid var(--danger)',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            background: 'rgba(239, 68, 68, 0.1)'
                                        }}
                                    >
                                        <Trash2 size={14} /> 이력 삭제
                                    </button>
                                    <span>비용: {item.cost ? item.cost.toLocaleString() : 0}원</span>
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
