import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import { useData } from '../context/DataContext';

const Quality = () => {
    const { inspections, employees, addInspection, uploadImage, addNotification } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Initial state for new item including file
    const [newItem, setNewItem] = useState({
        date: new Date().toISOString().split('T')[0],
        product: '',
        checkItem: '외관 검사',
        result: 'OK',
        ngType: '',
        action: '',
        file: null // For file input
    });
    const [isUploading, setIsUploading] = useState(false);

    const columns = [
        { header: '검사ID', accessor: 'qc_code' },
        { header: '검사일자', accessor: 'date' },
        { header: '품목명', accessor: 'product' },
        { header: '검사항목', accessor: 'check_item' }, // Mapped to DB check_item
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
            header: '사진', accessor: 'image_url', render: (row) => (
                row.image_url ?
                    <a href={row.image_url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)' }}>
                        <ImageIcon size={16} /> 보기
                    </a> : '-'
            )
        },
        {
            header: '불량유형(NG)', accessor: 'ng_type', render: (row) =>
                row.result === 'NG' ? <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{row.ng_type}</span> : '-'
        },
        {
            header: '조치내용', accessor: 'action', render: (row) => {
                if (row.result !== 'NG') return '-';
                return row.action ? (
                    <span style={{ color: 'var(--success)', fontWeight: 600 }}>{row.action}</span>
                ) : (
                    <span className="blink-red" style={{ color: 'var(--danger)', fontWeight: 700 }}>조치 필요</span>
                );
            }
        },
    ];

    const handleSave = async () => {
        if (!newItem.product) return alert('품목명을 입력하세요.');
        if (newItem.result === 'NG' && !newItem.ngType) return alert('NG 판정 시 불량유형은 필수입니다.');

        setIsUploading(true);
        let imageUrl = null;
        if (newItem.file) {
            imageUrl = await uploadImage(newItem.file);
        }

        const dateStr = newItem.date.replace(/-/g, '').slice(2);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const newCode = `QC-${dateStr}-${rand}`;

        const itemToAdd = {
            qc_code: newCode,
            date: newItem.date,
            product: newItem.product,
            check_item: newItem.checkItem,
            result: newItem.result,
            ng_type: newItem.result === 'OK' ? '-' : newItem.ngType,
            action: newItem.result === 'OK' ? '-' : newItem.action,
            image_url: imageUrl
        };

        await addInspection(itemToAdd);

        // 관리자에게 알림 (특히 NG인 경우)
        const managers = employees.filter(emp => emp.position === '관리자' || emp.position === '대표');
        for (const manager of managers) {
            const notifTitle = newItem.result === 'NG' ? '⚠️ 품질 불량 발생' : '품질 검사 완료';
            const notifMessage = newItem.result === 'NG'
                ? `${newItem.product} - ${newItem.checkItem}: ${newItem.ngType || 'NG'}`
                : `${newItem.product} - ${newItem.checkItem}: OK`;

            await addNotification(
                manager.id,
                notifTitle,
                notifMessage,
                'quality',
                null
            );
        }

        setIsUploading(false);
        setIsModalOpen(false);
        setNewItem({
            date: newItem.date,
            product: newItem.product,
            checkItem: '외관 검사',
            result: 'OK',
            ngType: '',
            action: '',
            file: null
        });
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">품질 관리 (일일 검사)</h2>
                    <p className="page-description">제품 스펙 검사 결과 및 불량 사진을 등록합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <ClipboardCheck size={18} /> 검사 결과 등록
                </button>
            </div>

            <Table columns={columns} data={inspections || []} />

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

                <div className="form-group">
                    <label className="form-label">현장 사진 첨부</label>
                    <input
                        type="file"
                        accept="image/*"
                        className="form-input"
                        onChange={(e) => setNewItem({ ...newItem, file: e.target.files[0] })}
                    />
                    {newItem.file && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>선택됨: {newItem.file.name}</p>}
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
                                placeholder="조치 사항이 있으면 입력하세요."
                                style={{ borderColor: '#fca5a5' }}
                            />
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave} disabled={isUploading}>
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
                
                @keyframes blink { 50% { opacity: 0.5; } }
                .blink-red { animation: blink 1.5s infinite; }
            `}</style>
        </div>
    );
};

export default Quality;
