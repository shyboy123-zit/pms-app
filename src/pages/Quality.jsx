import React, { useState, useRef } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Image as ImageIcon, FileText, Download } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Quality = () => {
    const { inspections, employees, products, molds, suppliers, addInspection, uploadImage, addNotification } = useData();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
    const [isPdfPreview, setIsPdfPreview] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const pdfRef = useRef(null);

    // 검사 등록 폼 상태
    const [newItem, setNewItem] = useState({
        date: new Date().toISOString().split('T')[0],
        product: '',
        checkItem: '외관 검사',
        result: 'OK',
        ngType: '',
        action: '',
        file: null
    });
    const [isUploading, setIsUploading] = useState(false);

    // 수리 의뢰서 폼 상태
    const [repairForm, setRepairForm] = useState({
        date: new Date().toISOString().split('T')[0],
        moldId: '',
        repairContent: '',
        supplierId: '',
        urgency: '일반',
        inspectionData: null
    });

    const columns = [
        { header: '검사ID', accessor: 'qc_code' },
        { header: '검사일자', accessor: 'date' },
        { header: '제품명', accessor: 'product' },
        { header: '검사항목', accessor: 'check_item' },
        {
            header: '판정', accessor: 'result', render: (row) => (
                <span className={`status-badge ${row.result === 'OK' ? 'status-active' : 'status-danger'}`}>
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
        {
            header: '수리의뢰', accessor: 'repair', render: (row) => {
                if (row.result !== 'NG') return '-';
                return (
                    <button
                        onClick={() => openRepairModal(row)}
                        style={{
                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            color: 'white',
                            border: 'none',
                            padding: '0.35rem 0.7rem',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <FileText size={13} /> 수리 의뢰서
                    </button>
                );
            }
        }
    ];

    // 수리 의뢰서 모달 열기
    const openRepairModal = (inspection) => {
        setRepairForm({
            date: new Date().toISOString().split('T')[0],
            moldId: '',
            repairContent: '',
            supplierId: '',
            urgency: '일반',
            inspectionData: inspection
        });
        setIsPdfPreview(false);
        setIsRepairModalOpen(true);
    };

    // PDF 생성 및 다운로드
    const generatePdf = async () => {
        setIsGeneratingPdf(true);
        setIsPdfPreview(true);

        // DOM 렌더링 시간 확보
        await new Promise(r => setTimeout(r, 500));

        try {
            const element = pdfRef.current;
            if (!element) return;

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const moldName = molds.find(m => m.id === repairForm.moldId)?.name || '금형';
            const dateStr = repairForm.date.replace(/-/g, '');
            pdf.save(`금형수리의뢰서_${moldName}_${dateStr}.pdf`);
        } catch (err) {
            console.error('PDF 생성 오류:', err);
            alert('PDF 생성에 실패했습니다.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const handleSave = async () => {
        if (!newItem.product) return alert('제품명을 선택하세요.');
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

        const managers = employees.filter(emp => emp.position === '관리자' || emp.position === '대표');
        for (const manager of managers) {
            const notifTitle = newItem.result === 'NG' ? '⚠️ 품질 불량 발생' : '품질 검사 완료';
            const notifMessage = newItem.result === 'NG'
                ? `${newItem.product} - ${newItem.checkItem}: ${newItem.ngType || 'NG'}`
                : `${newItem.product} - ${newItem.checkItem}: OK`;

            await addNotification(manager.id, notifTitle, notifMessage, 'quality', null);
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

    // 선택된 금형/거래처 정보
    const selectedMold = molds.find(m => m.id === repairForm.moldId);
    const selectedSupplier = suppliers.find(s => s.id === repairForm.supplierId);
    const repairCode = `MR-${repairForm.date.replace(/-/g, '').slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`;

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

            {/* 검사 등록 모달 */}
            <Modal title="일일 품질 검사 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">검사 일자</label>
                    <input type="date" className="form-input" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">제품명</label>
                    <select className="form-input" value={newItem.product} onChange={(e) => setNewItem({ ...newItem, product: e.target.value })}>
                        <option value="">제품을 선택하세요</option>
                        {products.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </select>
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
                            <input type="radio" name="result" value="OK" checked={newItem.result === 'OK'} onChange={(e) => setNewItem({ ...newItem, result: e.target.value })} />
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>OK (합격)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input type="radio" name="result" value="NG" checked={newItem.result === 'NG'} onChange={(e) => setNewItem({ ...newItem, result: e.target.value })} />
                            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>NG (불량)</span>
                        </label>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">현장 사진 첨부</label>
                    <input type="file" accept="image/*" className="form-input" onChange={(e) => setNewItem({ ...newItem, file: e.target.files[0] })} />
                    {newItem.file && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>선택됨: {newItem.file.name}</p>}
                </div>
                {newItem.result === 'NG' && (
                    <div className="ng-section" style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                        <div className="form-group">
                            <label className="form-label" style={{ color: '#991b1b' }}>불량 유형 (NG Type)</label>
                            <input className="form-input" value={newItem.ngType} onChange={(e) => setNewItem({ ...newItem, ngType: e.target.value })} placeholder="예: 외관 찍힘, 길이 미달 (-0.2)" style={{ borderColor: '#fca5a5' }} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ color: '#991b1b' }}>조치 및 조건 수정 내용</label>
                            <textarea className="form-input" rows="2" value={newItem.action} onChange={(e) => setNewItem({ ...newItem, action: e.target.value })} placeholder="조치 사항이 있으면 입력하세요." style={{ borderColor: '#fca5a5' }} />
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

            {/* 수리 의뢰서 모달 */}
            <Modal title="금형 수리 의뢰서 작성" isOpen={isRepairModalOpen} onClose={() => setIsRepairModalOpen(false)}>
                {!isPdfPreview ? (
                    <>
                        {/* 검사 정보 요약 */}
                        {repairForm.inspectionData && (
                            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fee2e2', marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.5rem', fontWeight: 700 }}>📋 불량 검사 정보</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <div><span style={{ color: '#94a3b8' }}>검사코드:</span> <strong>{repairForm.inspectionData.qc_code}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>검사일:</span> <strong>{repairForm.inspectionData.date}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>제품명:</span> <strong>{repairForm.inspectionData.product}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>불량유형:</span> <strong style={{ color: '#dc2626' }}>{repairForm.inspectionData.ng_type}</strong></div>
                                </div>
                                {repairForm.inspectionData.image_url && (
                                    <div style={{ marginTop: '0.75rem' }}>
                                        <img src={repairForm.inspectionData.image_url} alt="불량 사진" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">의뢰일자</label>
                            <input type="date" className="form-input" value={repairForm.date} onChange={(e) => setRepairForm({ ...repairForm, date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">금형 선택</label>
                            <select className="form-input" value={repairForm.moldId} onChange={(e) => setRepairForm({ ...repairForm, moldId: e.target.value })}>
                                <option value="">금형을 선택하세요</option>
                                {molds.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">수리업체 (거래처)</label>
                            <select className="form-input" value={repairForm.supplierId} onChange={(e) => setRepairForm({ ...repairForm, supplierId: e.target.value })}>
                                <option value="">수리업체를 선택하세요</option>
                                {suppliers.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">긴급도</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {['일반', '긴급', '초긴급'].map(level => (
                                    <label key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                                        <input type="radio" name="urgency" value={level} checked={repairForm.urgency === level} onChange={(e) => setRepairForm({ ...repairForm, urgency: e.target.value })} />
                                        <span style={{
                                            fontWeight: 600,
                                            color: level === '초긴급' ? '#dc2626' : level === '긴급' ? '#f59e0b' : '#10b981'
                                        }}>{level}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">수리 요청 내용</label>
                            <textarea className="form-input" rows="4" value={repairForm.repairContent} onChange={(e) => setRepairForm({ ...repairForm, repairContent: e.target.value })} placeholder="수리가 필요한 부분과 요청사항을 상세히 기입해주세요." />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsRepairModalOpen(false)}>취소</button>
                            <button
                                className="btn-submit"
                                onClick={generatePdf}
                                disabled={!repairForm.moldId || !repairForm.repairContent || isGeneratingPdf}
                                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <Download size={16} />
                                {isGeneratingPdf ? 'PDF 생성 중...' : 'PDF 저장'}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                        <p style={{ color: '#64748b', marginBottom: '1rem' }}>PDF가 생성되어 다운로드됩니다...</p>
                        <button className="btn-cancel" onClick={() => { setIsPdfPreview(false); setIsRepairModalOpen(false); }}>닫기</button>
                    </div>
                )}
            </Modal>

            {/* PDF 렌더링 영역 (화면 밖에서 렌더링) */}
            <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                <div ref={pdfRef} style={{
                    width: '794px',
                    padding: '40px',
                    background: '#ffffff',
                    fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
                    color: '#1a1a1a'
                }}>
                    {/* PDF 헤더 */}
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '8px', marginBottom: '8px', color: '#1e293b' }}>금 형 수 리 의 뢰 서</h1>
                        <div style={{ width: '60px', height: '3px', background: '#4f46e5', margin: '0 auto' }}></div>
                    </div>

                    {/* 기본 정보 */}
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                        <tbody>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>의뢰번호</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{repairCode}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>의뢰일자</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{repairForm.date}</td>
                            </tr>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>요청자</td>
                                <td style={cellStyle}>{user?.name || '미지정'}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>긴급도</td>
                                <td style={cellStyle}>
                                    <span style={{
                                        padding: '2px 12px',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        background: repairForm.urgency === '초긴급' ? '#fef2f2' : repairForm.urgency === '긴급' ? '#fffbeb' : '#f0fdf4',
                                        color: repairForm.urgency === '초긴급' ? '#dc2626' : repairForm.urgency === '긴급' ? '#d97706' : '#16a34a',
                                        border: `1px solid ${repairForm.urgency === '초긴급' ? '#fca5a5' : repairForm.urgency === '긴급' ? '#fcd34d' : '#86efac'}`
                                    }}>{repairForm.urgency}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 금형/제품 정보 */}
                    <h3 style={sectionTitleStyle}>금형 및 제품 정보</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                        <tbody>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>금형명</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{selectedMold?.name || '-'}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>제품명</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{repairForm.inspectionData?.product || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>검사코드</td>
                                <td style={cellStyle}>{repairForm.inspectionData?.qc_code || '-'}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>불량유형</td>
                                <td style={{ ...cellStyle, color: '#dc2626', fontWeight: 600 }}>{repairForm.inspectionData?.ng_type || '-'}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 불량 사진 */}
                    {repairForm.inspectionData?.image_url && (
                        <>
                            <h3 style={sectionTitleStyle}>불량 사진</h3>
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px', marginBottom: '20px', textAlign: 'center' }}>
                                <img
                                    src={repairForm.inspectionData.image_url}
                                    alt="불량 사진"
                                    crossOrigin="anonymous"
                                    style={{ maxWidth: '100%', maxHeight: '250px', borderRadius: '4px' }}
                                />
                            </div>
                        </>
                    )}

                    {/* 수리 요청 내용 */}
                    <h3 style={sectionTitleStyle}>수리 요청 내용</h3>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', minHeight: '80px', fontSize: '13px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                        {repairForm.repairContent || '-'}
                    </div>

                    {/* 수리업체 정보 */}
                    <h3 style={sectionTitleStyle}>수리업체 정보</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px', fontSize: '13px' }}>
                        <tbody>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>업체명</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{selectedSupplier?.name || '-'}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle, width: '15%' }}>연락처</td>
                                <td style={{ ...cellStyle, width: '35%' }}>{selectedSupplier?.phone || selectedSupplier?.contact_info || '-'}</td>
                            </tr>
                            <tr>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>담당자</td>
                                <td style={cellStyle}>{selectedSupplier?.contact_person || '-'}</td>
                                <td style={{ ...cellStyle, ...headerCellStyle }}>이메일</td>
                                <td style={cellStyle}>{selectedSupplier?.email || '-'}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* 서명란 */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '40px' }}>
                        <div style={{ textAlign: 'center', width: '200px' }}>
                            <div style={{ borderBottom: '1px solid #94a3b8', height: '40px', marginBottom: '8px' }}></div>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>요청자 서명</span>
                        </div>
                        <div style={{ textAlign: 'center', width: '200px' }}>
                            <div style={{ borderBottom: '1px solid #94a3b8', height: '40px', marginBottom: '8px' }}></div>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>승인자 서명</span>
                        </div>
                    </div>
                </div>
            </div>

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

// PDF 테이블 스타일
const cellStyle = {
    border: '1px solid #e2e8f0',
    padding: '8px 12px',
    verticalAlign: 'middle'
};

const headerCellStyle = {
    background: '#f8fafc',
    fontWeight: 700,
    color: '#475569',
    fontSize: '12px'
};

const sectionTitleStyle = {
    fontSize: '14px',
    fontWeight: 700,
    color: '#334155',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '2px solid #e2e8f0'
};

export default Quality;
