import React, { useState, useRef, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Image as ImageIcon, FileText, Download, X, Calendar, Filter, Pencil, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Quality = () => {
    const { inspections, employees, products, workOrders, molds, suppliers, addInspection, updateInspection, deleteInspection, uploadImage, addNotification } = useData();
    const { user } = useAuth();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isPdfPreview, setIsPdfPreview] = useState(false);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    // 이미지 뷰어
    const [viewerImages, setViewerImages] = useState([]);
    const [isViewerOpen, setIsViewerOpen] = useState(false);
    const pdfRef = useRef(null);

    const [newItem, setNewItem] = useState({
        date: new Date().toISOString().split('T')[0],
        product: '',
        checkItem: [],
        result: 'OK',
        ngType: '',
        action: '',
        files: []
    });
    const [isUploading, setIsUploading] = useState(false);

    // 진행중인 작업지시의 제품만 필터
    const activeProducts = useMemo(() => {
        const activeWOs = workOrders.filter(wo => wo.status === '진행중');
        const productIds = [...new Set(activeWOs.map(wo => wo.product_id))];
        return products.filter(p => productIds.includes(p.id));
    }, [workOrders, products]);

    // 수정 폼 상태
    const [editItem, setEditItem] = useState(null);

    // 수리 의뢰서 폼 상태
    const [repairForm, setRepairForm] = useState({
        date: new Date().toISOString().split('T')[0],
        moldId: '',
        repairContent: '',
        supplierId: '',
        urgency: '일반',
        inspectionData: null
    });

    // 날짜 필터 상태
    const [filterStartDate, setFilterStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterEndDate, setFilterEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [filterResult, setFilterResult] = useState('전체'); // 전체, OK, NG

    // 필터링된 검사 데이터
    const filteredInspections = useMemo(() => {
        return (inspections || []).filter(i => {
            const dateMatch = i.date >= filterStartDate && i.date <= filterEndDate;
            const resultMatch = filterResult === '전체' || i.result === filterResult;
            return dateMatch && resultMatch;
        });
    }, [inspections, filterStartDate, filterEndDate, filterResult]);

    // 필터된 데이터 통계
    const stats = useMemo(() => {
        const total = filteredInspections.length;
        const ng = filteredInspections.filter(i => i.result === 'NG').length;
        const ok = total - ng;
        const rate = total > 0 ? ((ng / total) * 100).toFixed(1) : '0.0';
        return { total, ng, ok, rate };
    }, [filteredInspections]);

    // image_url 파싱 (단일 URL 또는 JSON 배열 호환)
    const parseImageUrls = (imageUrl) => {
        if (!imageUrl) return [];
        try {
            const parsed = JSON.parse(imageUrl);
            if (Array.isArray(parsed)) return parsed;
            return [imageUrl];
        } catch {
            return [imageUrl];
        }
    };

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
            header: '사진', accessor: 'image_url', render: (row) => {
                const urls = parseImageUrls(row.image_url);
                if (urls.length === 0) return '-';
                return (
                    <button
                        onClick={() => { setViewerImages(urls); setIsViewerOpen(true); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
                    >
                        <ImageIcon size={16} /> {urls.length}장 보기
                    </button>
                );
            }
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
        },
        {
            header: '관리', accessor: 'actions', render: (row) => (
                <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEditModal(row)} style={{
                        background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                        padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 600
                    }}><Pencil size={12} /> 수정</button>
                    <button onClick={() => handleDelete(row.id)} style={{
                        background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
                        padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.75rem', fontWeight: 600
                    }}><Trash2 size={12} /> 삭제</button>
                </div>
            )
        }
    ];

    // 파일 추가
    const handleFilesChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setNewItem(prev => ({ ...prev, files: [...prev.files, ...selectedFiles] }));
        e.target.value = ''; // 같은 파일 재선택 허용
    };

    // 파일 삭제
    const removeFile = (index) => {
        setNewItem(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
    };

    // 수정 모달 열기
    const openEditModal = (row) => {
        setEditItem({
            id: row.id,
            date: row.date || '',
            product: row.product || '',
            checkItem: row.check_item || '',
            result: row.result || 'OK',
            ngType: row.ng_type || '',
            action: row.action || ''
        });
        setIsEditModalOpen(true);
    };

    // 수정 저장
    const handleEditSave = async () => {
        if (!editItem) return;
        await updateInspection(editItem.id, {
            date: editItem.date,
            product: editItem.product,
            check_item: editItem.checkItem,
            result: editItem.result,
            ng_type: editItem.result === 'OK' ? '-' : editItem.ngType,
            action: editItem.result === 'OK' ? '-' : editItem.action
        });
        setIsEditModalOpen(false);
        setEditItem(null);
    };

    // 삭제
    const handleDelete = async (id) => {
        if (!window.confirm('이 검사 기록을 삭제하시겠습니까?')) return;
        await deleteInspection(id);
    };

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
        await new Promise(r => setTimeout(r, 800));

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
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // 여러 페이지 지원
            let heightLeft = imgHeight;
            let position = 0;

            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

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
        if (newItem.checkItem.length === 0) return alert('검사 항목을 하나 이상 선택하세요.');
        if (newItem.result === 'NG' && !newItem.ngType) return alert('NG 판정 시 불량유형은 필수입니다.');

        setIsUploading(true);

        // 여러 이미지 업로드
        let imageUrls = [];
        for (const file of newItem.files) {
            const url = await uploadImage(file);
            if (url) imageUrls.push(url);
        }

        const dateStr = newItem.date.replace(/-/g, '').slice(2);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const newCode = `QC-${dateStr}-${rand}`;

        const itemToAdd = {
            qc_code: newCode,
            date: newItem.date,
            product: newItem.product,
            check_item: newItem.checkItem.join(', '),
            result: newItem.result,
            ng_type: newItem.result === 'OK' ? '-' : newItem.ngType,
            action: newItem.result === 'OK' ? '-' : newItem.action,
            image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
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
            checkItem: [],
            result: 'OK',
            ngType: '',
            action: '',
            files: []
        });
    };

    const selectedMold = molds.find(m => m.id === repairForm.moldId);
    const selectedSupplier = suppliers.find(s => s.id === repairForm.supplierId);
    const repairCode = `MR-${repairForm.date.replace(/-/g, '').slice(2)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 수리 의뢰서의 이미지들
    const repairImages = repairForm.inspectionData ? parseImageUrls(repairForm.inspectionData.image_url) : [];

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">품질 관리 (일일 검사)</h2>
                    <p className="page-description">제품 스펙 검사 결과 및 불량 사진을 등록합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <ExcelToolbar
                        data={inspections || []}
                        columns={[
                            { key: 'date', label: '검사일' },
                            { key: 'product_id', label: '제품ID' },
                            { key: 'result', label: '결과' },
                            { key: 'defect_count', label: '불량수', format: (v) => parseFloat(v || 0) },
                            { key: 'sample_size', label: '검사수량', format: (v) => parseFloat(v || 0) },
                            { key: 'inspector', label: '검사자' },
                            { key: 'notes', label: '비고' }
                        ]}
                        fileName="품질검사내역"
                    />
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <ClipboardCheck size={18} /> 검사 결과 등록
                    </button>
                </div>
            </div>

            {/* 날짜 필터 */}
            <div className="quality-filter-section">
                <div className="filter-row">
                    <div className="filter-dates">
                        <Calendar size={16} color="#64748b" />
                        <input type="date" className="form-input filter-date-input" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} />
                        <span className="filter-separator">~</span>
                        <input type="date" className="form-input filter-date-input" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} />
                    </div>
                    <div className="filter-buttons">
                        <button className={`filter-chip ${filterResult === '전체' ? 'active' : ''}`} onClick={() => setFilterResult('전체')}>전체</button>
                        <button className={`filter-chip ok ${filterResult === 'OK' ? 'active' : ''}`} onClick={() => setFilterResult('OK')}>OK</button>
                        <button className={`filter-chip ng ${filterResult === 'NG' ? 'active' : ''}`} onClick={() => setFilterResult('NG')}>NG</button>
                    </div>
                </div>
                <div className="quality-stats-row">
                    <div className="quality-stat">
                        <span className="quality-stat-label">총 검사</span>
                        <span className="quality-stat-value">{stats.total}건</span>
                    </div>
                    <div className="quality-stat ok">
                        <span className="quality-stat-label">합격 (OK)</span>
                        <span className="quality-stat-value">{stats.ok}건</span>
                    </div>
                    <div className="quality-stat ng">
                        <span className="quality-stat-label">불량 (NG)</span>
                        <span className="quality-stat-value">{stats.ng}건</span>
                    </div>
                    <div className={`quality-stat rate ${stats.ng > 0 ? 'danger' : 'safe'}`}>
                        <span className="quality-stat-label">불량률</span>
                        <span className="quality-stat-value">{stats.rate}%</span>
                    </div>
                </div>
            </div>

            <Table columns={columns} data={filteredInspections} />

            {/* 이미지 뷰어 모달 */}
            <Modal title="첨부 사진" isOpen={isViewerOpen} onClose={() => setIsViewerOpen(false)}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                    {viewerImages.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                            <img src={url} alt={`사진 ${i + 1}`} style={{ width: '100%', borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        </a>
                    ))}
                </div>
            </Modal>

            {/* 검사 등록 모달 */}
            <Modal title="일일 품질 검사 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">검사 일자</label>
                    <input type="date" className="form-input" value={newItem.date} onChange={(e) => setNewItem({ ...newItem, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">제품명 (진행중 작업만 표시)</label>
                    <select className="form-input" value={newItem.product} onChange={(e) => setNewItem({ ...newItem, product: e.target.value })}>
                        <option value="">제품을 선택하세요</option>
                        {activeProducts.map(p => (
                            <option key={p.id} value={p.name}>{p.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">검사 항목 (복수 선택 가능)</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {['외관 검사', '치수 검사', '강도 테스트', '조립성 확인', '기능 검사'].map(item => {
                            const isChecked = newItem.checkItem.includes(item);
                            return (
                                <label key={item} onClick={() => {
                                    setNewItem(prev => ({
                                        ...prev,
                                        checkItem: isChecked
                                            ? prev.checkItem.filter(c => c !== item)
                                            : [...prev.checkItem, item]
                                    }));
                                }} style={{
                                    display: 'flex', alignItems: 'center', gap: '6px',
                                    padding: '0.45rem 0.9rem', borderRadius: '8px', cursor: 'pointer',
                                    background: isChecked ? 'linear-gradient(135deg, #4f46e5, #6366f1)' : '#f1f5f9',
                                    color: isChecked ? 'white' : '#475569',
                                    fontWeight: isChecked ? 700 : 500, fontSize: '0.85rem',
                                    border: isChecked ? '2px solid #4f46e5' : '2px solid #e2e8f0',
                                    transition: 'all 0.15s'
                                }}>
                                    {isChecked ? <CheckCircle size={15} /> : <span style={{ width: 15, height: 15, border: '2px solid #cbd5e1', borderRadius: '50%', display: 'inline-block' }} />}
                                    {item}
                                </label>
                            );
                        })}
                    </div>
                    {newItem.checkItem.length === 0 && (
                        <p style={{ fontSize: '0.75rem', color: '#ef4444', marginTop: '4px' }}>하나 이상 선택해주세요</p>
                    )}
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

                {/* 여러 장 사진 첨부 */}
                <div className="form-group">
                    <label className="form-label">현장 사진 첨부 (여러 장 가능)</label>
                    <input type="file" accept="image/*" multiple className="form-input" onChange={handleFilesChange} />
                    {newItem.files.length > 0 && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                            {newItem.files.map((file, i) => (
                                <div key={i} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                    <img src={URL.createObjectURL(file)} alt={`미리보기 ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button
                                        onClick={() => removeFile(i)}
                                        style={{
                                            position: 'absolute', top: '2px', right: '2px',
                                            background: 'rgba(239,68,68,0.9)', color: 'white',
                                            border: 'none', borderRadius: '50%',
                                            width: '20px', height: '20px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            cursor: 'pointer', padding: 0
                                        }}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                        {newItem.files.length > 0 ? `${newItem.files.length}장 선택됨` : '여러 장의 사진을 한번에 또는 추가로 선택할 수 있습니다.'}
                    </p>
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
                        {isUploading ? `업로드 중... (${newItem.files.length}장)` : '등록'}
                    </button>
                </div>
            </Modal>

            {/* 수정 모달 */}
            <Modal title="검사 결과 수정" isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditItem(null); }}>
                {editItem && (
                    <>
                        <div className="form-group">
                            <label className="form-label">검사 일자</label>
                            <input type="date" className="form-input" value={editItem.date} onChange={(e) => setEditItem({ ...editItem, date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">제품명</label>
                            <select className="form-input" value={editItem.product} onChange={(e) => setEditItem({ ...editItem, product: e.target.value })}>
                                <option value="">제품을 선택하세요</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">검사 항목</label>
                            <input className="form-input" value={editItem.checkItem} onChange={(e) => setEditItem({ ...editItem, checkItem: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">판정 결과</label>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="radio" name="editResult" value="OK" checked={editItem.result === 'OK'} onChange={(e) => setEditItem({ ...editItem, result: e.target.value })} />
                                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>OK (합격)</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                    <input type="radio" name="editResult" value="NG" checked={editItem.result === 'NG'} onChange={(e) => setEditItem({ ...editItem, result: e.target.value })} />
                                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>NG (불량)</span>
                                </label>
                            </div>
                        </div>
                        {editItem.result === 'NG' && (
                            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                                <div className="form-group">
                                    <label className="form-label" style={{ color: '#991b1b' }}>불량 유형 (NG Type)</label>
                                    <input className="form-input" value={editItem.ngType} onChange={(e) => setEditItem({ ...editItem, ngType: e.target.value })} style={{ borderColor: '#fca5a5' }} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ color: '#991b1b' }}>조치 내용</label>
                                    <textarea className="form-input" rows="2" value={editItem.action} onChange={(e) => setEditItem({ ...editItem, action: e.target.value })} style={{ borderColor: '#fca5a5' }} />
                                </div>
                            </div>
                        )}
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => { setIsEditModalOpen(false); setEditItem(null); }}>취소</button>
                            <button className="btn-submit" onClick={handleEditSave}>수정 저장</button>
                        </div>
                    </>
                )}
            </Modal>

            {/* 수리 의뢰서 모달 */}
            <Modal title="금형 수리 의뢰서 작성" isOpen={isRepairModalOpen} onClose={() => setIsRepairModalOpen(false)}>
                {!isPdfPreview ? (
                    <>
                        {repairForm.inspectionData && (
                            <div style={{ background: '#fef2f2', padding: '1rem', borderRadius: '8px', border: '1px solid #fee2e2', marginBottom: '1rem' }}>
                                <h4 style={{ fontSize: '0.85rem', color: '#991b1b', marginBottom: '0.5rem', fontWeight: 700 }}>📋 불량 검사 정보</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
                                    <div><span style={{ color: '#94a3b8' }}>검사코드:</span> <strong>{repairForm.inspectionData.qc_code}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>검사일:</span> <strong>{repairForm.inspectionData.date}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>제품명:</span> <strong>{repairForm.inspectionData.product}</strong></div>
                                    <div><span style={{ color: '#94a3b8' }}>불량유형:</span> <strong style={{ color: '#dc2626' }}>{repairForm.inspectionData.ng_type}</strong></div>
                                </div>
                                {repairImages.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {repairImages.map((url, i) => (
                                            <img key={i} src={url} alt={`불량 사진 ${i + 1}`} style={{ maxWidth: '120px', maxHeight: '100px', borderRadius: '6px', border: '1px solid #e2e8f0', objectFit: 'cover' }} />
                                        ))}
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
                                        <span style={{ fontWeight: 600, color: level === '초긴급' ? '#dc2626' : level === '긴급' ? '#f59e0b' : '#10b981' }}>{level}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">수리 요청 내용</label>
                            <textarea className="form-input" rows="4" value={repairForm.repairContent} onChange={(e) => setRepairForm({ ...repairForm, repairContent: e.target.value })} placeholder="수리가 필요한 부분과 요청사항을 상세히 기입해주세요.&#10;&#10;예시:&#10;- 캐비티 #3 파팅라인 부위 찍힘 발생&#10;- 게이트 주변 가스 빼기 불량&#10;- 코어핀 마모로 인한 치수 미달" />
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

            {/* PDF 렌더링 영역 (화면 밖) */}
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
                                        padding: '2px 12px', borderRadius: '4px', fontSize: '12px', fontWeight: 700,
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

                    {/* 불량 사진들 (모든 이미지 포함) */}
                    {repairImages.length > 0 && (
                        <>
                            <h3 style={sectionTitleStyle}>불량 사진 ({repairImages.length}장)</h3>
                            <div style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                padding: '12px',
                                marginBottom: '20px',
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '10px',
                                justifyContent: 'center'
                            }}>
                                {repairImages.map((url, i) => (
                                    <img
                                        key={i}
                                        src={url}
                                        alt={`불량 사진 ${i + 1}`}
                                        crossOrigin="anonymous"
                                        style={{
                                            maxWidth: repairImages.length === 1 ? '100%' : repairImages.length === 2 ? '48%' : '31%',
                                            maxHeight: '220px',
                                            borderRadius: '4px',
                                            border: '1px solid #e2e8f0',
                                            objectFit: 'contain'
                                        }}
                                    />
                                ))}
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

                /* 날짜 필터 섹션 */
                .quality-filter-section {
                    background: rgba(255,255,255,0.6);
                    backdrop-filter: blur(10px);
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 1rem 1.25rem;
                    margin-bottom: 1.25rem;
                }

                .filter-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    flex-wrap: wrap;
                    margin-bottom: 0.75rem;
                }

                .filter-dates {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .filter-date-input {
                    padding: 0.4rem 0.6rem !important;
                    font-size: 0.85rem !important;
                    max-width: 150px;
                }

                .filter-separator {
                    color: #94a3b8;
                    font-weight: 600;
                }

                .filter-buttons {
                    display: flex;
                    gap: 0.4rem;
                }

                .filter-chip {
                    padding: 0.35rem 0.9rem;
                    border-radius: 20px;
                    border: 1px solid #e2e8f0;
                    background: white;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    color: #64748b;
                }

                .filter-chip.active {
                    background: #4f46e5;
                    color: white;
                    border-color: #4f46e5;
                }

                .filter-chip.ok.active {
                    background: #10b981;
                    border-color: #10b981;
                }

                .filter-chip.ng.active {
                    background: #ef4444;
                    border-color: #ef4444;
                }

                .quality-stats-row {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0.75rem;
                }

                .quality-stat {
                    text-align: center;
                    padding: 0.6rem;
                    border-radius: 8px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                }

                .quality-stat.ok { background: #f0fdf4; border-color: #bbf7d0; }
                .quality-stat.ng { background: #fef2f2; border-color: #fecaca; }
                .quality-stat.rate.danger { background: #fef2f2; border-color: #fca5a5; }
                .quality-stat.rate.safe { background: #f0fdf4; border-color: #86efac; }

                .quality-stat-label {
                    display: block;
                    font-size: 0.72rem;
                    font-weight: 500;
                    color: #94a3b8;
                    margin-bottom: 2px;
                }

                .quality-stat-value {
                    display: block;
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: #1e293b;
                }

                .quality-stat.ok .quality-stat-value { color: #16a34a; }
                .quality-stat.ng .quality-stat-value { color: #dc2626; }
                .quality-stat.rate.danger .quality-stat-value { color: #dc2626; }
                .quality-stat.rate.safe .quality-stat-value { color: #16a34a; }

                @media (max-width: 600px) {
                    .filter-row { flex-direction: column; align-items: stretch; }
                    .filter-dates { justify-content: center; }
                    .filter-buttons { justify-content: center; }
                    .quality-stats-row { grid-template-columns: repeat(2, 1fr); }
                }
            `}</style>
        </div>
    );
};

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
