import React, { useRef, useState } from 'react';
import { Download, Upload, FileText } from 'lucide-react';
import { exportToExcel, downloadTemplate, importFromExcel } from '../lib/excel';

/**
 * 페이지에 끼워넣는 엑셀 툴바 (내보내기 + 가져오기 + 템플릿)
 *
 * Props:
 *   data        - 현재 페이지 데이터 (내보내기 대상)
 *   columns     - 컬럼 정의 {key, label, format?, parse?, sample?}
 *   fileName    - 파일명 prefix
 *   onImport    - 가져오기 콜백 (parsed rows). 없으면 가져오기 버튼 숨김.
 *   showTemplate- 템플릿 다운로드 버튼 표시 여부 (기본 true if onImport 있음)
 */
const ExcelToolbar = ({ data, columns, fileName, onImport, showTemplate = true }) => {
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);

    const handleExport = () => {
        exportToExcel(data, columns, fileName);
    };

    const handleTemplate = () => {
        downloadTemplate(columns, fileName);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const rows = await importFromExcel(file, columns);
            if (rows.length === 0) {
                alert('가져올 데이터가 없습니다.');
            } else if (onImport) {
                await onImport(rows);
            }
        } catch (err) {
            console.error(err);
            alert(`엑셀 가져오기 실패: ${err.message}`);
        } finally {
            setImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="excel-toolbar">
            <button className="excel-btn export" onClick={handleExport} title="현재 데이터를 엑셀로 내보내기">
                <Download size={14} /> 엑셀 내보내기
            </button>
            {onImport && (
                <>
                    {showTemplate && (
                        <button className="excel-btn template" onClick={handleTemplate} title="가져오기용 빈 양식 다운로드">
                            <FileText size={14} /> 템플릿
                        </button>
                    )}
                    <button className="excel-btn import" onClick={handleImportClick} disabled={importing} title="엑셀 파일에서 데이터 가져오기">
                        <Upload size={14} /> {importing ? '처리 중...' : '엑셀 가져오기'}
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        style={{ display: 'none' }}
                        onChange={handleFileChange}
                    />
                </>
            )}

            <style>{`
                .excel-toolbar { display: inline-flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; }
                .excel-btn { display: inline-flex; align-items: center; gap: 4px; padding: 0.4rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s; background: white; }
                .excel-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
                .excel-btn:disabled { opacity: 0.5; cursor: wait; }
                .excel-btn.export { color: #059669; border-color: #a7f3d0; background: #ecfdf5; }
                .excel-btn.export:hover { background: #d1fae5; }
                .excel-btn.import { color: #2563eb; border-color: #93c5fd; background: #eff6ff; }
                .excel-btn.import:hover { background: #dbeafe; }
                .excel-btn.template { color: #64748b; border-color: #e2e8f0; }
                .excel-btn.template:hover { background: #f8fafc; }
            `}</style>
        </div>
    );
};

export default ExcelToolbar;
