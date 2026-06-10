import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { FileText, Download, AlertTriangle, Thermometer, Gauge, Clock, Settings2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 사출조건 필드 그룹 정의 (라벨 + 단위)
const CONDITION_GROUPS = [
    {
        title: '온도 설정 (°C)',
        icon: Thermometer,
        fields: [
            ['hopper_temp', '호퍼'],
            ['cylinder_temp_zone1', '실린더 Z1'],
            ['cylinder_temp_zone2', '실린더 Z2'],
            ['cylinder_temp_zone3', '실린더 Z3'],
            ['cylinder_temp_zone4', '실린더 Z4'],
            ['nozzle_temp', '노즐'],
            ['mold_temp_fixed', '금형(고정측)'],
            ['mold_temp_moving', '금형(가동측)'],
        ],
    },
    {
        title: '압력 / 속도',
        icon: Gauge,
        fields: [
            ['injection_pressure', '1차 압력 (kgf/cm²)'],
            ['injection_speed', '1차 속도'],
            ['holding_pressure', '보압 (kgf/cm²)'],
            ['holding_speed', '2차 속도'],
            ['back_pressure', '배압 (kgf/cm²)'],
        ],
    },
    {
        title: '시간 설정 (초)',
        icon: Clock,
        fields: [
            ['injection_time', '사출 시간'],
            ['holding_time', '보압 시간'],
            ['cooling_time', '냉각 시간'],
            ['cycle_time', '사이클 타임'],
        ],
    },
    {
        title: '기타',
        icon: Settings2,
        fields: [
            ['shot_size', '계량 위치/Shot'],
            ['screw_rpm', '스크류 RPM'],
            ['cushion', '쿠션량 (mm)'],
        ],
    },
];

const fmt = (v) => (v === null || v === undefined || v === '' ? '-' : v);

const WorkStandardSheet = () => {
    const { products, injectionConditions, inspections, materials, equipments } = useData();
    const [selectedProductId, setSelectedProductId] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const sheetRef = useRef(null);

    const product = useMemo(
        () => products.find((p) => p.id === selectedProductId),
        [products, selectedProductId]
    );

    // 해당 제품의 사출조건 (호기별 여러 개 가능)
    const conditions = useMemo(
        () => (injectionConditions || []).filter((c) => c.product_id === selectedProductId),
        [injectionConditions, selectedProductId]
    );

    // 해당 제품의 불량 이력 (inspections.product 는 제품명 문자열, NG만)
    const defects = useMemo(() => {
        if (!product) return [];
        return (inspections || []).filter(
            (i) => i.product === product.name && i.result === 'NG'
        );
    }, [inspections, product]);

    // 불량유형별 집계
    const defectSummary = useMemo(() => {
        const map = {};
        defects.forEach((d) => {
            const type = d.ng_type && d.ng_type !== '-' ? d.ng_type : '기타';
            if (!map[type]) map[type] = { type, count: 0, actions: new Set(), lastDate: '' };
            map[type].count += 1;
            if (d.action) map[type].actions.add(d.action);
            if ((d.date || '') > map[type].lastDate) map[type].lastDate = d.date || '';
        });
        return Object.values(map).sort((a, b) => b.count - a.count);
    }, [defects]);

    const material = materials.find((m) => m.id === product?.material_id);
    const shotWeight = product
        ? (product.product_weight || 0) * (product.cavity_count || 1) + (product.runner_weight || 0)
        : 0;
    const today = new Date().toISOString().split('T')[0];

    const equipmentName = (id) => equipments.find((e) => e.id === id)?.name || '공통';

    const generatePdf = async () => {
        if (!product) return;
        setIsGenerating(true);
        await new Promise((r) => setTimeout(r, 400));
        try {
            const element = sheetRef.current;
            if (!element) return;
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

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
            pdf.save(`작업표준서_${product.name}_${today.replace(/-/g, '')}.pdf`);
        } catch (err) {
            console.error('작업표준서 PDF 생성 오류:', err);
            alert('PDF 생성에 실패했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="widget glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="widget-header">
                <h3>
                    <FileText size={20} />
                    작업표준서 다운로드
                </h3>
            </div>
            <div className="widget-content">
                {/* 컨트롤 바 */}
                <div
                    style={{
                        display: 'flex',
                        gap: '0.75rem',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        marginBottom: product ? '1.25rem' : 0,
                    }}
                >
                    <select
                        className="form-input"
                        value={selectedProductId}
                        onChange={(e) => setSelectedProductId(e.target.value)}
                        style={{ maxWidth: 320 }}
                    >
                        <option value="">제품을 선택하세요</option>
                        {[...products]
                            .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                            .map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.name} {p.product_code ? `(${p.product_code})` : ''}
                                </option>
                            ))}
                    </select>
                    <button
                        className="btn-primary"
                        onClick={generatePdf}
                        disabled={!product || isGenerating}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            opacity: !product || isGenerating ? 0.5 : 1,
                        }}
                    >
                        <Download size={16} />
                        {isGenerating ? '생성 중...' : 'PDF 다운로드'}
                    </button>
                </div>

                {/* 미리보기 + PDF 캡처 영역 */}
                {product && (
                    <div
                        ref={sheetRef}
                        style={{
                            background: '#ffffff',
                            color: '#1e293b',
                            padding: '28px 32px',
                            borderRadius: 8,
                            border: '1px solid #e2e8f0',
                            fontSize: 13,
                            lineHeight: 1.5,
                        }}
                    >
                        {/* 문서 헤더 */}
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-end',
                                borderBottom: '3px solid #1e293b',
                                paddingBottom: 12,
                                marginBottom: 18,
                            }}
                        >
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 6 }}>
                                    작 업 표 준 서
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                                    Injection Work Standard Sheet
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#475569', textAlign: 'right' }}>
                                <div>문서번호: WS-{product.product_code || product.id.slice(0, 8)}</div>
                                <div>작성일: {today}</div>
                            </div>
                        </div>

                        {/* 1. 제품 정보 */}
                        <SectionTitle>1. 제품 정보</SectionTitle>
                        <table style={tableStyle}>
                            <tbody>
                                <tr>
                                    <th style={thStyle}>제품명</th>
                                    <td style={tdStyle}>{product.name}</td>
                                    <th style={thStyle}>제품코드</th>
                                    <td style={tdStyle}>{fmt(product.product_code)}</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>원재료</th>
                                    <td style={tdStyle}>{material?.name || '-'}</td>
                                    <th style={thStyle}>캐비티 수</th>
                                    <td style={tdStyle}>{product.cavity_count || 1}-C/V</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>제품 중량</th>
                                    <td style={tdStyle}>{fmt(product.product_weight)} g</td>
                                    <th style={thStyle}>런너 중량</th>
                                    <td style={tdStyle}>{fmt(product.runner_weight)} g</td>
                                </tr>
                                <tr>
                                    <th style={thStyle}>SHOT 중량</th>
                                    <td style={tdStyle} colSpan={3}>
                                        {shotWeight.toFixed(1)} g
                                        <span style={{ color: '#94a3b8', marginLeft: 6 }}>
                                            (제품 × C/V + 런너)
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 2. 사출 조건 */}
                        <SectionTitle>2. 사출 조건표</SectionTitle>
                        {conditions.length === 0 ? (
                            <div style={emptyStyle}>
                                등록된 사출조건이 없습니다. (사출조건 메뉴에서 먼저 등록하세요)
                            </div>
                        ) : (
                            conditions.map((cond, idx) => (
                                <div key={cond.id || idx} style={{ marginBottom: 16 }}>
                                    <div
                                        style={{
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: '#0369a1',
                                            marginBottom: 6,
                                        }}
                                    >
                                        ▸ 적용 호기: {equipmentName(cond.equipment_id)}
                                    </div>
                                    <div
                                        style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(2, 1fr)',
                                            gap: 10,
                                        }}
                                    >
                                        {CONDITION_GROUPS.map((g) => (
                                            <table key={g.title} style={tableStyle}>
                                                <thead>
                                                    <tr>
                                                        <th
                                                            colSpan={2}
                                                            style={{
                                                                ...thStyle,
                                                                background: '#1e293b',
                                                                color: '#fff',
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {g.title}
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {g.fields.map(([key, label]) => (
                                                        <tr key={key}>
                                                            <th style={{ ...thStyle, width: '55%' }}>
                                                                {label}
                                                            </th>
                                                            <td style={tdStyle}>{fmt(cond[key])}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ))}
                                    </div>
                                    {cond.notes && (
                                        <div style={{ fontSize: 12, marginTop: 6, color: '#475569' }}>
                                            <b>비고:</b> {cond.notes}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}

                        {/* 3. 불량유형 및 주의사항 */}
                        <SectionTitle>
                            <AlertTriangle
                                size={15}
                                style={{ verticalAlign: '-2px', marginRight: 4, color: '#dc2626' }}
                            />
                            3. 불량유형 및 작업 주의사항 (과거 이력 기반)
                        </SectionTitle>
                        {defectSummary.length === 0 ? (
                            <div style={{ ...emptyStyle, color: '#16a34a' }}>
                                등록된 불량 이력이 없습니다. ✓ 표준조건 준수 시 양호.
                            </div>
                        ) : (
                            <table style={tableStyle}>
                                <thead>
                                    <tr>
                                        <th style={{ ...thStyle, background: '#fef2f2' }}>불량유형</th>
                                        <th style={{ ...thStyle, background: '#fef2f2', width: 70 }}>
                                            발생횟수
                                        </th>
                                        <th style={{ ...thStyle, background: '#fef2f2', width: 100 }}>
                                            최근발생
                                        </th>
                                        <th style={{ ...thStyle, background: '#fef2f2' }}>
                                            조치사항 / 주의점
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {defectSummary.map((d) => (
                                        <tr key={d.type}>
                                            <td style={{ ...tdStyle, fontWeight: 700, color: '#dc2626' }}>
                                                {d.type}
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {d.count}회
                                            </td>
                                            <td style={{ ...tdStyle, textAlign: 'center' }}>
                                                {d.lastDate || '-'}
                                            </td>
                                            <td style={tdStyle}>
                                                {d.actions.size > 0
                                                    ? [...d.actions].join(' / ')
                                                    : '조치 기록 없음'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}

                        {/* 푸터 */}
                        <div
                            style={{
                                marginTop: 24,
                                display: 'flex',
                                justifyContent: 'flex-end',
                                gap: 8,
                                fontSize: 12,
                                color: '#475569',
                            }}
                        >
                            {['작성', '검토', '승인'].map((role) => (
                                <div
                                    key={role}
                                    style={{
                                        border: '1px solid #cbd5e1',
                                        width: 90,
                                        textAlign: 'center',
                                    }}
                                >
                                    <div
                                        style={{
                                            borderBottom: '1px solid #cbd5e1',
                                            padding: '3px 0',
                                            background: '#f8fafc',
                                        }}
                                    >
                                        {role}
                                    </div>
                                    <div style={{ height: 36 }} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const SectionTitle = ({ children }) => (
    <div
        style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#1e293b',
            margin: '18px 0 8px',
            paddingLeft: 8,
            borderLeft: '4px solid #6366f1',
        }}
    >
        {children}
    </div>
);

const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
};
const thStyle = {
    border: '1px solid #cbd5e1',
    background: '#f1f5f9',
    padding: '5px 8px',
    textAlign: 'left',
    fontWeight: 700,
    whiteSpace: 'nowrap',
};
const tdStyle = {
    border: '1px solid #cbd5e1',
    padding: '5px 8px',
};
const emptyStyle = {
    padding: '14px',
    background: '#f8fafc',
    border: '1px dashed #cbd5e1',
    borderRadius: 6,
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
};

export default WorkStandardSheet;
