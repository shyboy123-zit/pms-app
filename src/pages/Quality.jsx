import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useData } from '../context/DataContext';

const Quality = () => {
    const { inspections, addInspection } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initial state for new item
    const [newItem, setNewItem] = useState({
        date: new Date().toISOString().split('T')[0],
        product: '',
        checkItem: '외관 검사',
        result: 'OK',
        ngType: '',
        action: ''
    });

    const columns = [
        { header: '검사ID', accessor: 'id' },
        { header: '검사일자', accessor: 'date' },
        { header: '품목명', accessor: 'product' },
        { header: '검사항목', accessor: 'checkItem' },
        {
            header: '판정', accessor: 'result', render: (row) => (
                <span className={`status-badge ${row.result === 'OK' ? 'status-active' : 'status-danger'
                    }`}>
                    {row.result === 'OK' ? <CheckCircle size={12} style={{ marginRight: 4 }} /> : <XCircle size={12} style={{ marginRight: 4 }} />}
                    {row.result}
                </span>
            )
        },
        {
            header: '불량유형(NG)', accessor: 'ngType', render: (row) =>
                row.result === 'NG' ? <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{row.ngType}</span> : '-'
        },
        {
            header: '조치내용(조건수정)', accessor: 'action', render: (row) => {
                if (row.result !== 'NG') return '-';
                return row.action ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.action}</span>
                ) : (
                    <span className="blink-red" style={{ color: 'var(--danger)', fontWeight: 700 }}>조치 필요 (미입력)</span>
                );
            }
        },
    ];

    const handleSave = () => {
        if (!newItem.product) return alert('품목명을 입력하세요.');
        if (newItem.result === 'NG' && !newItem.ngType) return alert('NG 판정 시 불량유형은 필수입니다.');

        const dateStr = newItem.date.replace(/-/g, '').slice(2); // YYMMDD
        // Simple random ID to avoid collision in basic mock
        const newId = `QC-${dateStr}-${Math.floor(1000 + Math.random() * 9000)}`;

        const itemToAdd = {
            id: newId,
            ...newItem,
            ngType: newItem.result === 'OK' ? '-' : newItem.ngType,
            action: newItem.result === 'OK' ? '-' : newItem.action // Allow empty action for NG
        };

        addInspection(itemToAdd);
        setIsModalOpen(false);
        setNewItem({
            date: newItem.date,
            product: newItem.product,
            checkItem: '외관 검사',
            result: 'OK',
            ngType: '',
            action: ''
        });
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">품질 관리 (일일 검사)</h2>
                    <p className="page-description">제품 스펙 검사 결과(OK/NG) 관리. 조치가 되지 않은 건은 대시보드에 긴급 알림이 표시됩니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <ClipboardCheck size={18} /> 검사 결과 등록
                </button>
            </div>

            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">금일 검사 건수</span>
                    <span className="value">{inspections.filter(i => i.date === new Date().toISOString().split('T')[0]).length}건</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">금일 불량(NG)</span>
                    <span className="value" style={{ color: 'var(--danger)' }}>
                        {inspections.filter(i => i.date === new Date().toISOString().split('T')[0] && i.result === 'NG').length}건
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">미조치 건수</span>
                    <span className="value" style={{ color: 'var(--danger)' }}>
                        {inspections.filter(i => i.result === 'NG' && !i.action).length}건
                    </span>
                </div>
            </div>

            <Table columns={columns} data={inspections} />

            <Modal title="일일 품질 검사 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">검사 일자</label>
                    <input type="date" className="form-input" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">품목명</label>
                    <input className="form-input" value={newItem.product} onChange={(e) => setNewItem({ ...newItem, product: e.target.value })} placeholder="예: Bumper Case A" />
                </div>
                <div className="form-group">
                    <label className="form-label">검사 항목</label>
                    <select className="form-input" value={newItem.checkItem} onChange={(e) => setNewItem({ ...newItem, checkItem: e.target.value })}>
                        <option value="외관 검사">외관 검사</option>
                        <option value="치수 검사">치수 검사</option>
                        <option value="강도 테스트">강도 테스트</option>
                        <option value="조립성 확인">조립성 확인</option>
                        <option value="기능 검사">기능 검사</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">판정 결과</label>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="result"
                                value="OK"
                                checked={newItem.result === 'OK'}
                                onChange={(e) => setNewItem({ ...newItem, result: e.target.value })}
                            />
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>OK (합격)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="radio"
                                name="result"
                                value="NG"
                                checked={newItem.result === 'NG'}
                                onChange={(e) => setNewItem({ ...newItem, result: e.target.value })}
                            />
                            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>NG (불량)</span>
                        </label>
                    </div>
                </div>

                {newItem.result === 'NG' && (
                    <div className="ng-section" style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ color: '#991b1b' }}>불량 유형 (NG Type)</label>
                            <input
                                className="form-input"
                                value={newItem.ngType}
                                onChange={(e) => setNewItem({ ...newItem, ngType: e.target.value })}
                                placeholder="예: 외관 찍힘, 길이 미달 (-0.2)"
                                style={{ borderColor: '#fca5a5' }}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ color: '#991b1b' }}>조치 및 조건 수정 내용</label>
                            <textarea
                                className="form-input"
                                rows="2"
                                value={newItem.action}
                                onChange={(e) => setNewItem({ ...newItem, action: e.target.value })}
                                placeholder="조치 사항이 있으면 입력하세요. (미입력 시 대시보드에 긴급 알림 뜸)"
                                style={{ borderColor: '#fca5a5' }}
                            />
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>등록</button>
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
                
                @keyframes blink { 50% { opacity: 0.5; } }
                .blink-red { animation: blink 1.5s infinite; }
            `}</style>
        </div>
    );
};

export default Quality;
