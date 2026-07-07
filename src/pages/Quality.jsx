import React, { useState, useRef, useMemo } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import ExcelToolbar from '../components/ExcelToolbar';
import { ClipboardCheck, AlertTriangle, CheckCircle, XCircle, Image as ImageIcon, FileText, Download, X, Calendar, Filter, Pencil, Trash2, Scale, Settings, Sun, Moon } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import DonutKpi from '../components/viz/DonutKpi';
import MiniBar from '../components/viz/MiniBar';

const Quality = () => {
    const { inspections, employees, products, workOrders, molds, suppliers, addInspection, updateInspection, deleteInspection, uploadImage, addNotification,
        weightChecks, addWeightCheck, updateWeightCheck, deleteWeightCheck, updateProduct } = useData();
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('defect'); // 'defect' | 'weight'
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

    // 일별 불량률 추이
    const trendData = useMemo(() => {
        const byDate = {};
        filteredInspections.forEach(i => {
            const d = i.date;
            if (!d) return;
            if (!byDate[d]) byDate[d] = { date: d, total: 0, ng: 0 };
            byDate[d].total += 1;
            if (i.result === 'NG') byDate[d].ng += 1;
        });
        return Object.values(byDate)
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map(d => ({ date: d.date.slice(5), 불량률: d.total > 0 ? Math.round((d.ng / d.total) * 1000) / 10 : 0 }));
    }, [filteredInspections]);

    // 불량유형 파레토 (TOP 6)
    const ngPareto = useMemo(() => {
        const m = {};
        filteredInspections.filter(i => i.result === 'NG').forEach(i => {
            const t = i.ng_type || '기타';
            m[t] = (m[t] || 0) + 1;
        });
        return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
    }, [filteredInspections]);

    // ============================================================
    // 중량 점검 (Weight Checks)
    // ============================================================
    const todayStr = new Date().toISOString().split('T')[0];

    // 측정 등록 폼 — cavityWeights: 캐비티별 측정값 배열(문자열)
    const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
    const [weightForm, setWeightForm] = useState({
        date: todayStr,
        timeSlot: 'AM',
        productId: '',
        cavityWeights: [],
        inspector: user?.name || '',
        notes: ''
    });
    const [isSavingWeight, setIsSavingWeight] = useState(false);

    // 스펙 설정 폼
    const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);
    const [specProductId, setSpecProductId] = useState('');
    const [specForm, setSpecForm] = useState({ target: '', min: '', max: '' });
    const [isSavingSpec, setIsSavingSpec] = useState(false);

    // 중량 측정 수정 폼
    const [editWeight, setEditWeight] = useState(null);

    // 중량 점검 날짜 필터
    const [wcStartDate, setWcStartDate] = useState(todayStr);
    const [wcEndDate, setWcEndDate] = useState(todayStr);

    // 제품 스펙 헬퍼 — 기준중량은 product_weight, 하한/상한 미설정 시 ±5% 기본
    const getProductSpec = (product) => {
        if (!product) return { target: null, min: null, max: null, hasSpec: false };
        const target = product.product_weight != null && product.product_weight !== 0 ? parseFloat(product.product_weight) : null;
        let min = product.weight_spec_min != null ? parseFloat(product.weight_spec_min) : null;
        let max = product.weight_spec_max != null ? parseFloat(product.weight_spec_max) : null;
        const hasSpec = min != null || max != null;
        return { target, min, max, hasSpec };
    };

    const cavityCountOf = (product) => Math.max(1, parseInt(product?.cavity_count, 10) || 1);

    // 단일 측정값 판정 (스펙 이탈 여부)
    const judgeWeight = (weight, spec) => {
        if (weight == null || weight === '' || isNaN(parseFloat(weight))) return null;
        const w = parseFloat(weight);
        if (spec.min != null && w < spec.min) return 'NG';
        if (spec.max != null && w > spec.max) return 'NG';
        return 'OK';
    };

    // 캐비티 배열 판정 — 입력된 값만 평가, 하나라도 이탈이면 NG
    const judgeCavities = (cavityWeights, spec) => {
        const filled = (cavityWeights || []).map(v => parseFloat(v)).filter(v => !isNaN(v));
        if (filled.length === 0) return { result: null, filled, okCount: 0, ngCount: 0, avg: null };
        let okCount = 0, ngCount = 0;
        filled.forEach(w => { judgeWeight(w, spec) === 'NG' ? ngCount++ : okCount++; });
        const avg = filled.reduce((a, b) => a + b, 0) / filled.length;
        return { result: ngCount > 0 ? 'NG' : 'OK', filled, okCount, ngCount, avg };
    };

    // 측정 폼에서 선택된 제품/스펙/캐비티수/실시간 판정
    const weightFormProduct = useMemo(() => products.find(p => p.id === weightForm.productId), [products, weightForm.productId]);
    const weightFormSpec = useMemo(() => getProductSpec(weightFormProduct), [weightFormProduct]);
    const weightFormCavityCount = useMemo(() => cavityCountOf(weightFormProduct), [weightFormProduct]);
    const weightFormJudge = useMemo(() => judgeCavities(weightForm.cavityWeights, weightFormSpec), [weightForm.cavityWeights, weightFormSpec]);

    // 측정 폼 제품 선택 → 캐비티 수만큼 입력칸 초기화
    const onWeightProductChange = (productId) => {
        const prod = products.find(p => p.id === productId);
        const n = cavityCountOf(prod);
        setWeightForm(f => ({ ...f, productId, cavityWeights: Array(n).fill('') }));
    };
    const setCavityWeight = (idx, value) => {
        setWeightForm(f => {
            const arr = [...f.cavityWeights];
            arr[idx] = value;
            return { ...f, cavityWeights: arr };
        });
    };

    // 진행중 작업의 work_order_id 매핑 (제품 → 진행중 작업지시)
    const activeWoByProduct = useMemo(() => {
        const map = {};
        workOrders.filter(wo => wo.status === '진행중').forEach(wo => {
            if (!map[wo.product_id]) map[wo.product_id] = wo.id;
        });
        return map;
    }, [workOrders]);

    // 날짜 필터된 중량 측정 기록
    const filteredWeightChecks = useMemo(() => {
        return (weightChecks || []).filter(w => w.check_date >= wcStartDate && w.check_date <= wcEndDate);
    }, [weightChecks, wcStartDate, wcEndDate]);

    // 날짜+제품별 그룹핑 → 오전/오후 / 일자 문제 여부
    // 스펙·판정은 "측정 당시 스냅샷"이 아니라 제품의 "현재 스펙"을 기준으로 표시·재판정한다.
    // (스펙을 나중에 설정해도 기존 측정 기록에 반영되도록 — '미설정'으로 굳는 문제 해결)
    const weightDailyRows = useMemo(() => {
        const num = (v) => (v == null || v === '' ? null : parseFloat(v));
        const groups = {};
        filteredWeightChecks.forEach(w => {
            const key = `${w.check_date}__${w.product_id || w.product_name || '?'}`;
            const prod = products.find(p => p.id === w.product_id);
            // 현재 제품 스펙 우선, 없으면(제품 삭제 등) 측정 당시 스냅샷으로 폴백
            const specMin = prod && prod.weight_spec_min != null ? num(prod.weight_spec_min) : num(w.spec_min);
            const specMax = prod && prod.weight_spec_max != null ? num(prod.weight_spec_max) : num(w.spec_max);
            const specTarget = prod && prod.product_weight != null && prod.product_weight !== 0
                ? num(prod.product_weight) : num(w.spec_target);
            if (!groups[key]) {
                groups[key] = {
                    key,
                    date: w.check_date,
                    productName: w.product_name || prod?.name || '-',
                    specMin,
                    specMax,
                    specTarget,
                    am: null,
                    pm: null
                };
            }
            // 현재 스펙으로 재판정한 레코드 사본 (fmtWeight/판정 컬럼이 rec.spec_min/result를 그대로 사용)
            const cavs = Array.isArray(w.cavity_weights) ? w.cavity_weights.filter(v => v != null).map(num) : [];
            const violates = (v) => (specMin != null && v < specMin) || (specMax != null && v > specMax);
            let result = 'OK';
            if (specMin != null || specMax != null) {
                const values = cavs.length > 0 ? cavs : (w.measured_weight != null ? [num(w.measured_weight)] : []);
                result = values.some(violates) ? 'NG' : 'OK';
            }
            const rec = { ...w, spec_min: specMin, spec_max: specMax, spec_target: specTarget, result };
            // 같은 슬롯에 여러 기록이면 최신(created_at) 우선
            const slot = w.time_slot === 'PM' ? 'pm' : 'am';
            const existing = groups[key][slot];
            if (!existing || (w.created_at || '') > (existing.created_at || '')) {
                groups[key][slot] = rec;
            }
        });
        return Object.values(groups).sort((a, b) => {
            if (a.date !== b.date) return a.date < b.date ? 1 : -1;
            return a.productName < b.productName ? -1 : 1;
        });
    }, [filteredWeightChecks, products]);

    // 중량 점검 통계 (오늘 기준 + 필터 기간 이탈)
    const weightStats = useMemo(() => {
        const todayChecks = (weightChecks || []).filter(w => w.check_date === todayStr);
        const amDone = todayChecks.filter(w => w.time_slot === 'AM').length;
        const pmDone = todayChecks.filter(w => w.time_slot === 'PM').length;
        const ngInRange = filteredWeightChecks.filter(w => w.result === 'NG').length;
        return { amDone, pmDone, todayTotal: todayChecks.length, ngInRange, totalInRange: filteredWeightChecks.length };
    }, [weightChecks, filteredWeightChecks, todayStr]);

    const slotLabel = (slot) => slot === 'PM' ? '오후 (14:00)' : '오전 (10:00)';

    // 측정 등록 저장
    const handleWeightSave = async () => {
        if (!weightForm.productId) return alert('제품을 선택하세요.');
        const product = products.find(p => p.id === weightForm.productId);
        const spec = getProductSpec(product);
        const cavityCount = cavityCountOf(product);
        const judge = judgeCavities(weightForm.cavityWeights, spec);
        if (judge.filled.length === 0) return alert('캐비티 중량을 하나 이상 입력하세요.');

        setIsSavingWeight(true);
        const result = judge.result || 'OK';
        // 캐비티별 값 (빈칸은 null로 저장하여 캐비티 번호 위치 유지)
        const cavityWeights = (weightForm.cavityWeights || []).map(v => {
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        });
        const avg = Math.round(judge.avg * 100) / 100;

        const item = {
            check_date: weightForm.date,
            time_slot: weightForm.timeSlot,
            product_id: weightForm.productId,
            product_name: product?.name || '',
            work_order_id: activeWoByProduct[weightForm.productId] || null,
            cavity_count: cavityCount,
            cavity_weights: cavityWeights,
            measured_weight: avg,
            spec_target: spec.target,
            spec_min: spec.min,
            spec_max: spec.max,
            result,
            inspector: weightForm.inspector || (user?.name || ''),
            notes: weightForm.notes || null
        };

        const { error } = await addWeightCheck(item);

        // 스펙 이탈 시 관리자 알림
        if (!error && result === 'NG') {
            const ngList = cavityWeights
                .map((w, i) => (w != null && judgeWeight(w, spec) === 'NG') ? `C/V${i + 1}:${w}g` : null)
                .filter(Boolean).join(', ');
            const managers = employees.filter(emp => emp.position === '관리자' || emp.position === '대표');
            for (const manager of managers) {
                await addNotification(
                    manager.id,
                    '⚠️ 중량 스펙 이탈',
                    `${product?.name || ''} ${slotLabel(weightForm.timeSlot)} — ${ngList} (스펙 ${spec.min ?? '-'}~${spec.max ?? '-'}g)`,
                    'quality',
                    null
                );
            }
        }

        setIsSavingWeight(false);
        if (!error) {
            setIsWeightModalOpen(false);
            setWeightForm({
                date: weightForm.date,
                timeSlot: weightForm.timeSlot,
                productId: '',
                cavityWeights: [],
                inspector: weightForm.inspector,
                notes: ''
            });
        }
    };

    // 스펙 설정 저장
    const openSpecModal = () => {
        setSpecProductId('');
        setSpecForm({ target: '', min: '', max: '' });
        setIsSpecModalOpen(true);
    };
    const onSpecProductChange = (id) => {
        setSpecProductId(id);
        const p = products.find(x => x.id === id);
        setSpecForm({
            target: p?.product_weight ?? '',
            min: p?.weight_spec_min ?? '',
            max: p?.weight_spec_max ?? ''
        });
    };
    const handleSpecSave = async () => {
        if (!specProductId) return alert('제품을 선택하세요.');
        if (specForm.min !== '' && specForm.max !== '' && parseFloat(specForm.min) > parseFloat(specForm.max)) {
            return alert('하한이 상한보다 클 수 없습니다.');
        }
        setIsSavingSpec(true);
        await updateProduct(specProductId, {
            product_weight: specForm.target === '' ? 0 : parseFloat(specForm.target),
            weight_spec_min: specForm.min === '' ? null : parseFloat(specForm.min),
            weight_spec_max: specForm.max === '' ? null : parseFloat(specForm.max)
        });
        setIsSavingSpec(false);
        setIsSpecModalOpen(false);
    };

    // 측정 수정/삭제
    // 수정 모달 열기 — 캐비티 배열을 문자열 입력칸으로 정규화
    const openWeightEdit = (w) => {
        const cavityCount = w.cavity_count || (Array.isArray(w.cavity_weights) ? w.cavity_weights.length : 1) || 1;
        let arr;
        if (Array.isArray(w.cavity_weights) && w.cavity_weights.length > 0) {
            arr = w.cavity_weights.map(v => (v == null ? '' : String(v)));
        } else {
            arr = [w.measured_weight != null ? String(w.measured_weight) : ''];
        }
        setEditWeight({ ...w, cavityWeights: arr, cavity_count: cavityCount });
    };
    const setEditCavityWeight = (idx, value) => {
        setEditWeight(prev => {
            const arr = [...(prev.cavityWeights || [])];
            arr[idx] = value;
            return { ...prev, cavityWeights: arr };
        });
    };
    const editWeightJudge = useMemo(
        () => editWeight ? judgeCavities(editWeight.cavityWeights, { min: editWeight.spec_min, max: editWeight.spec_max }) : null,
        [editWeight]
    );
    const handleWeightEditSave = async () => {
        if (!editWeight) return;
        const spec = { min: editWeight.spec_min, max: editWeight.spec_max };
        const judge = judgeCavities(editWeight.cavityWeights, spec);
        if (judge.filled.length === 0) return alert('캐비티 중량을 하나 이상 입력하세요.');
        const cavityWeights = (editWeight.cavityWeights || []).map(v => {
            const n = parseFloat(v);
            return isNaN(n) ? null : n;
        });
        await updateWeightCheck(editWeight.id, {
            check_date: editWeight.check_date,
            time_slot: editWeight.time_slot,
            cavity_weights: cavityWeights,
            measured_weight: Math.round(judge.avg * 100) / 100,
            result: judge.result || 'OK',
            inspector: editWeight.inspector || null,
            notes: editWeight.notes || null
        });
        setEditWeight(null);
    };
    const handleWeightDelete = async (id) => {
        if (!window.confirm('이 중량 측정 기록을 삭제하시겠습니까?')) return;
        await deleteWeightCheck(id);
    };

    // 스펙이 등록된 제품 목록 (스펙 현황 표시용)
    const productsWithSpec = useMemo(
        () => products.filter(p => p.weight_spec_min != null || p.weight_spec_max != null || (p.product_weight != null && p.product_weight !== 0)),
        [products]
    );

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
                    <h2 className="page-subtitle">품질 관리</h2>
                    <p className="page-description">
                        {activeTab === 'defect'
                            ? '제품 스펙 검사 결과 및 불량 사진을 등록합니다.'
                            : '작업중 제품 중량을 오전 10시 / 오후 2시 측정하고 스펙 대비 이상 여부를 점검합니다.'}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    {activeTab === 'defect' ? (
                        <>
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
                        </>
                    ) : (
                        <>
                            <button className="btn-secondary" onClick={openSpecModal}>
                                <Settings size={16} /> 스펙 설정
                            </button>
                            <button className="btn-primary" onClick={() => { setWeightForm(f => ({ ...f, inspector: f.inspector || (user?.name || '') })); setIsWeightModalOpen(true); }}>
                                <Scale size={18} /> 중량 측정 등록
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 탭 전환 */}
            <div className="qa-tabs">
                <button className={`qa-tab ${activeTab === 'defect' ? 'active' : ''}`} onClick={() => setActiveTab('defect')}>
                    <ClipboardCheck size={16} /> 불량 검사
                </button>
                <button className={`qa-tab ${activeTab === 'weight' ? 'active' : ''}`} onClick={() => setActiveTab('weight')}>
                    <Scale size={16} /> 중량 점검
                </button>
            </div>

            {activeTab === 'defect' && (<>
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

            {/* 품질 시각 블록 — OK/NG 도넛 · 일별 불량률 추이 · 불량유형 파레토 */}
            {stats.total > 0 && (
                <div className="qa-viz">
                    <div className="qa-card">
                        <div className="qa-card-title">합격 / 불량</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <DonutKpi size={108}
                                segments={[{ value: stats.ok, color: '#16a34a' }, { value: stats.ng, color: '#ef4444' }]}
                                centerValue={`${stats.rate}%`} centerLabel="불량률" />
                            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#16a34a', marginRight: 5 }} />합격 <b>{stats.ok}</b></span>
                                <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#ef4444', marginRight: 5 }} />불량 <b>{stats.ng}</b></span>
                                <span style={{ color: 'var(--text-muted)' }}>총 {stats.total}건</span>
                            </div>
                        </div>
                    </div>

                    <div className="qa-card">
                        <div className="qa-card-title">일별 불량률 추이 (%)</div>
                        {trendData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={160}>
                                <LineChart data={trendData} margin={{ top: 5, right: 12, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip formatter={(v) => `${v}%`} />
                                    <Line type="monotone" dataKey="불량률" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : <div className="qa-empty">기간 내 데이터 없음</div>}
                    </div>

                    <div className="qa-card">
                        <div className="qa-card-title">불량유형 TOP (파레토)</div>
                        {ngPareto.length > 0
                            ? <MiniBar items={ngPareto} unit="건" barColor="#ef4444" />
                            : <div className="qa-empty">불량 없음 ✓</div>}
                    </div>
                </div>
            )}

            <style>{`
                .qa-viz { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
                .qa-card { background: var(--bg-card, #fff); border: 1px solid var(--border); border-radius: 12px; padding: 1rem 1.25rem; box-shadow: var(--shadow-sm); min-width: 0; }
                .qa-card-title { font-size: 0.85rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.75rem; }
                .qa-empty { color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0; text-align: center; }
            `}</style>

            <Table columns={columns} data={filteredInspections} pageSize={50} />
            </>)}

            {activeTab === 'weight' && (
                <WeightSection
                    wcStartDate={wcStartDate} setWcStartDate={setWcStartDate}
                    wcEndDate={wcEndDate} setWcEndDate={setWcEndDate}
                    weightStats={weightStats}
                    weightDailyRows={weightDailyRows}
                    slotLabel={slotLabel}
                    productsWithSpec={productsWithSpec}
                    getProductSpec={getProductSpec}
                    onEdit={openWeightEdit}
                    onDelete={handleWeightDelete}
                />
            )}

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
                                <td style={{ ...cellStyle, ...headerCellStyle }}>이메일</td>
                                <td style={cellStyle} colSpan={3}>{selectedSupplier?.email || '-'}</td>
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

            {/* 중량 측정 등록 모달 */}
            <Modal title="중량 측정 등록" isOpen={isWeightModalOpen} onClose={() => setIsWeightModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">측정 일자</label>
                    <input type="date" className="form-input" value={weightForm.date} onChange={(e) => setWeightForm({ ...weightForm, date: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">측정 시간대</label>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <label className={`slot-pick ${weightForm.timeSlot === 'AM' ? 'active am' : ''}`} onClick={() => setWeightForm({ ...weightForm, timeSlot: 'AM' })}>
                            <Sun size={16} /> 오전 (10:00)
                        </label>
                        <label className={`slot-pick ${weightForm.timeSlot === 'PM' ? 'active pm' : ''}`} onClick={() => setWeightForm({ ...weightForm, timeSlot: 'PM' })}>
                            <Moon size={16} /> 오후 (14:00)
                        </label>
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">제품명 (진행중 작업)</label>
                    <select className="form-input" value={weightForm.productId} onChange={(e) => onWeightProductChange(e.target.value)}>
                        <option value="">제품을 선택하세요</option>
                        {activeProducts.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({cavityCountOf(p)}-C/V)</option>
                        ))}
                    </select>
                    {activeProducts.length === 0 && (
                        <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '4px' }}>진행중인 작업지시가 없습니다. 작업지시를 먼저 시작하세요.</p>
                    )}
                </div>

                {/* 선택된 제품의 스펙 안내 */}
                {weightForm.productId && (
                    <div className="spec-hint">
                        {weightFormSpec.hasSpec || weightFormSpec.target != null ? (
                            <>
                                기준중량 <b>{weightFormSpec.target ?? '-'}g</b> · 스펙 <b>{weightFormSpec.min ?? '-'} ~ {weightFormSpec.max ?? '-'}g</b> · <b>{weightFormCavityCount}-C/V</b> (단품 기준)
                                {!weightFormSpec.hasSpec && <span style={{ color: '#f59e0b' }}> · 하한/상한 미설정 — '스펙 설정'에서 등록하세요</span>}
                            </>
                        ) : (
                            <span style={{ color: '#f59e0b' }}>이 제품은 중량 스펙이 없습니다. '스펙 설정'에서 먼저 등록하세요.</span>
                        )}
                    </div>
                )}

                {/* 캐비티별 측정 입력 */}
                {weightForm.productId && (
                    <div className="form-group">
                        <label className="form-label">캐비티별 측정 중량 (g) — 각 캐비티 단품 무게</label>
                        <div className="cavity-grid">
                            {weightForm.cavityWeights.map((val, idx) => {
                                const j = judgeWeight(val, weightFormSpec);
                                return (
                                    <div key={idx} className={`cavity-input ${j === 'NG' ? 'ng' : j === 'OK' ? 'ok' : ''}`}>
                                        <span className="cavity-label">C/V {idx + 1}</span>
                                        <input type="number" step="0.01" value={val}
                                            onChange={(e) => setCavityWeight(idx, e.target.value)} placeholder="g" />
                                    </div>
                                );
                            })}
                        </div>
                        {/* 종합 판정 */}
                        {weightFormJudge.result && (
                            <div className={`live-judge ${weightFormJudge.result === 'OK' ? 'ok' : 'ng'}`}>
                                {weightFormJudge.result === 'OK'
                                    ? <><CheckCircle size={15} /> 전체 정상 · 평균 {Math.round(weightFormJudge.avg * 100) / 100}g ({weightFormJudge.okCount}/{weightFormJudge.filled.length})</>
                                    : <><AlertTriangle size={15} /> 스펙 이탈 {weightFormJudge.ngCount}개 · 평균 {Math.round(weightFormJudge.avg * 100) / 100}g</>}
                            </div>
                        )}
                    </div>
                )}
                <div className="form-group">
                    <label className="form-label">측정자</label>
                    <input className="form-input" value={weightForm.inspector} onChange={(e) => setWeightForm({ ...weightForm, inspector: e.target.value })} placeholder="측정한 사람" />
                </div>
                <div className="form-group">
                    <label className="form-label">비고 (선택)</label>
                    <textarea className="form-input" rows="2" value={weightForm.notes} onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })} placeholder="특이사항이 있으면 입력하세요." />
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsWeightModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleWeightSave} disabled={isSavingWeight}>
                        {isSavingWeight ? '저장 중...' : '측정 등록'}
                    </button>
                </div>
            </Modal>

            {/* 중량 스펙 설정 모달 */}
            <Modal title="제품 중량 스펙 설정" isOpen={isSpecModalOpen} onClose={() => setIsSpecModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">제품 선택</label>
                    <select className="form-input" value={specProductId} onChange={(e) => onSpecProductChange(e.target.value)}>
                        <option value="">제품을 선택하세요</option>
                        {products.filter(Boolean).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>
                {specProductId && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                            <div className="form-group">
                                <label className="form-label">기준중량 (g)</label>
                                <input type="number" step="0.01" className="form-input" value={specForm.target}
                                    onChange={(e) => setSpecForm({ ...specForm, target: e.target.value })} placeholder="예: 25" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">하한 (g)</label>
                                <input type="number" step="0.01" className="form-input" value={specForm.min}
                                    onChange={(e) => setSpecForm({ ...specForm, min: e.target.value })} placeholder="예: 24" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">상한 (g)</label>
                                <input type="number" step="0.01" className="form-input" value={specForm.max}
                                    onChange={(e) => setSpecForm({ ...specForm, max: e.target.value })} placeholder="예: 26" />
                            </div>
                        </div>
                        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            측정 중량이 하한~상한을 벗어나면 자동으로 "스펙 이탈(NG)"로 판정됩니다.
                        </p>
                    </>
                )}
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsSpecModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSpecSave} disabled={isSavingSpec || !specProductId}>
                        {isSavingSpec ? '저장 중...' : '스펙 저장'}
                    </button>
                </div>
            </Modal>

            {/* 중량 측정 수정 모달 */}
            <Modal title="중량 측정 수정" isOpen={!!editWeight} onClose={() => setEditWeight(null)}>
                {editWeight && (
                    <>
                        <div className="form-group">
                            <label className="form-label">제품명</label>
                            <input className="form-input" value={editWeight.product_name || ''} disabled />
                        </div>
                        <div className="form-group">
                            <label className="form-label">측정 일자</label>
                            <input type="date" className="form-input" value={editWeight.check_date} onChange={(e) => setEditWeight({ ...editWeight, check_date: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">측정 시간대</label>
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <label className={`slot-pick ${editWeight.time_slot === 'AM' ? 'active am' : ''}`} onClick={() => setEditWeight({ ...editWeight, time_slot: 'AM' })}>
                                    <Sun size={16} /> 오전 (10:00)
                                </label>
                                <label className={`slot-pick ${editWeight.time_slot === 'PM' ? 'active pm' : ''}`} onClick={() => setEditWeight({ ...editWeight, time_slot: 'PM' })}>
                                    <Moon size={16} /> 오후 (14:00)
                                </label>
                            </div>
                        </div>
                        <div className="spec-hint">스펙 <b>{editWeight.spec_min ?? '-'} ~ {editWeight.spec_max ?? '-'}g</b> (기준 {editWeight.spec_target ?? '-'}g · {editWeight.cavity_count || 1}-C/V)</div>
                        <div className="form-group">
                            <label className="form-label">캐비티별 측정 중량 (g)</label>
                            <div className="cavity-grid">
                                {(editWeight.cavityWeights || []).map((val, idx) => {
                                    const j = judgeWeight(val, { min: editWeight.spec_min, max: editWeight.spec_max });
                                    return (
                                        <div key={idx} className={`cavity-input ${j === 'NG' ? 'ng' : j === 'OK' ? 'ok' : ''}`}>
                                            <span className="cavity-label">C/V {idx + 1}</span>
                                            <input type="number" step="0.01" value={val}
                                                onChange={(e) => setEditCavityWeight(idx, e.target.value)} placeholder="g" />
                                        </div>
                                    );
                                })}
                            </div>
                            {editWeightJudge?.result && (
                                <div className={`live-judge ${editWeightJudge.result === 'OK' ? 'ok' : 'ng'}`}>
                                    {editWeightJudge.result === 'OK'
                                        ? <><CheckCircle size={15} /> 전체 정상 · 평균 {Math.round(editWeightJudge.avg * 100) / 100}g</>
                                        : <><AlertTriangle size={15} /> 스펙 이탈 {editWeightJudge.ngCount}개 · 평균 {Math.round(editWeightJudge.avg * 100) / 100}g</>}
                                </div>
                            )}
                        </div>
                        <div className="form-group">
                            <label className="form-label">측정자</label>
                            <input className="form-input" value={editWeight.inspector || ''} onChange={(e) => setEditWeight({ ...editWeight, inspector: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">비고</label>
                            <textarea className="form-input" rows="2" value={editWeight.notes || ''} onChange={(e) => setEditWeight({ ...editWeight, notes: e.target.value })} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setEditWeight(null)}>취소</button>
                            <button className="btn-submit" onClick={handleWeightEditSave}>수정 저장</button>
                        </div>
                    </>
                )}
            </Modal>

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .btn-secondary { background: var(--bg-subtle, #f1f5f9); color: var(--text-main, #334155); border: 1px solid var(--border, #e2e8f0); padding: 0.6rem 1rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.4rem; font-weight: 600; font-size: 0.85rem; }

                /* 탭 */
                .qa-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border, #e2e8f0); }
                .qa-tab { display: flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.1rem; background: none; border: none; border-bottom: 3px solid transparent; color: var(--text-muted, #64748b); font-weight: 700; font-size: 0.9rem; cursor: pointer; margin-bottom: -1px; }
                .qa-tab.active { color: var(--primary, #4f46e5); border-bottom-color: var(--primary, #4f46e5); }

                /* 시간대 선택 */
                .slot-pick { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0.6rem; border-radius: 8px; cursor: pointer; background: #f1f5f9; color: #475569; font-weight: 600; font-size: 0.88rem; border: 2px solid #e2e8f0; }
                .slot-pick.active.am { background: #fff7ed; color: #c2410c; border-color: #fdba74; }
                .slot-pick.active.pm { background: #eef2ff; color: #4338ca; border-color: #a5b4fc; }

                /* 스펙 안내 / 실시간 판정 */
                .spec-hint { font-size: 0.82rem; color: var(--text-muted, #64748b); background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.55rem 0.75rem; margin-bottom: 1rem; }
                .live-judge { margin-top: 0.5rem; display: flex; align-items: center; gap: 6px; font-weight: 700; font-size: 0.88rem; padding: 0.5rem 0.75rem; border-radius: 8px; }
                .live-judge.ok { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }
                .live-judge.ng { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }

                /* 캐비티별 입력 그리드 */
                .cavity-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem; }
                .cavity-input { display: flex; align-items: center; gap: 6px; border: 2px solid #e2e8f0; border-radius: 8px; padding: 0.3rem 0.5rem; background: var(--bg-elevated, #fff); }
                .cavity-input.ok { border-color: #86efac; background: #f0fdf4; }
                .cavity-input.ng { border-color: #fca5a5; background: #fef2f2; }
                .cavity-input .cavity-label { font-size: 0.72rem; font-weight: 700; color: #64748b; white-space: nowrap; }
                .cavity-input.ng .cavity-label { color: #dc2626; }
                .cavity-input input { width: 100%; border: none; background: transparent; font-size: 0.9rem; color: var(--text-main, #1e293b); outline: none; padding: 0.25rem 0; text-align: right; -moz-appearance: textfield; }
                .cavity-input input::-webkit-outer-spin-button, .cavity-input input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }

                /* 중량 점검 섹션 */
                .wc-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem; }
                .wc-stat { text-align: center; padding: 0.75rem; border-radius: 10px; background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); }
                .wc-stat-label { display: block; font-size: 0.72rem; font-weight: 500; color: var(--text-muted, #94a3b8); margin-bottom: 3px; }
                .wc-stat-value { display: block; font-size: 1.15rem; font-weight: 800; color: var(--text-main, #1e293b); }
                .wc-stat.warn { background: #fffbeb; border-color: #fcd34d; }
                .wc-stat.warn .wc-stat-value { color: #d97706; }
                .wc-stat.danger { background: #fef2f2; border-color: #fca5a5; }
                .wc-stat.danger .wc-stat-value { color: #dc2626; }
                .wc-stat.safe { background: #f0fdf4; border-color: #86efac; }
                .wc-stat.safe .wc-stat-value { color: #16a34a; }
                .wc-spec-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
                .wc-spec-chip { font-size: 0.8rem; background: var(--bg-card, #fff); border: 1px solid var(--border, #e2e8f0); border-radius: 20px; padding: 0.35rem 0.8rem; color: var(--text-main, #334155); }
                .wc-spec-chip b { color: var(--primary, #4f46e5); }
                .wc-spec-chip.nospec { color: #f59e0b; border-color: #fcd34d; background: #fffbeb; }
                .wc-cell-ng { color: #dc2626; font-weight: 700; }
                .wc-cell-ok { color: #16a34a; font-weight: 600; }
                .wc-cell-empty { color: #cbd5e1; }

                @media (max-width: 600px) {
                    .wc-stats { grid-template-columns: repeat(2, 1fr); }
                }

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

// ============================================================
// 중량 점검 섹션 (표시 전용)
// ============================================================
const WeightSection = ({
    wcStartDate, setWcStartDate, wcEndDate, setWcEndDate,
    weightStats, weightDailyRows, slotLabel,
    productsWithSpec, getProductSpec, onEdit, onDelete
}) => {
    const fmtWeight = (rec) => {
        if (!rec) return <span className="wc-cell-empty">-</span>;
        const cls = rec.result === 'NG' ? 'wc-cell-ng' : 'wc-cell-ok';
        const cavs = Array.isArray(rec.cavity_weights) ? rec.cavity_weights.filter(v => v != null) : [];
        const total = cavs.length || (rec.cavity_count || 1);
        let okCount = total;
        if (cavs.length > 0 && (rec.spec_min != null || rec.spec_max != null)) {
            okCount = cavs.filter(w => !((rec.spec_min != null && w < rec.spec_min) || (rec.spec_max != null && w > rec.spec_max))).length;
        }
        const avg = parseFloat(rec.measured_weight);
        return (
            <span className={cls} title={cavs.length ? cavs.map((w, i) => `C/V${i + 1}: ${w}g`).join('\n') : ''}>
                평균 {avg}g {rec.result === 'NG' ? '⚠' : ''}
                <br /><span style={{ fontSize: '0.72rem', fontWeight: 500 }}>C/V {okCount}/{total} 정상</span>
            </span>
        );
    };

    const dayBtns = (row) => {
        const recs = [];
        if (row.am) recs.push(row.am);
        if (row.pm) recs.push(row.pm);
        if (recs.length === 0) return '-';
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {recs.map(rec => (
                    <div key={rec.id} style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8', width: '30px' }}>{rec.time_slot === 'PM' ? '오후' : '오전'}</span>
                        <button onClick={() => onEdit(rec)} style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '2px 7px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', fontWeight: 600 }}><Pencil size={11} /></button>
                        <button onClick={() => onDelete(rec.id)} style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', padding: '2px 7px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.72rem', fontWeight: 600 }}><Trash2 size={11} /></button>
                    </div>
                ))}
            </div>
        );
    };

    const columns = [
        { header: '측정일', accessor: 'date' },
        { header: '제품명', accessor: 'productName' },
        { header: '오전 (10:00)', accessor: 'am', render: (row) => fmtWeight(row.am) },
        { header: '오후 (14:00)', accessor: 'pm', render: (row) => fmtWeight(row.pm) },
        {
            header: '스펙 (g)', accessor: 'spec', render: (row) =>
                (row.specMin != null || row.specMax != null)
                    ? <span style={{ color: '#64748b' }}>{row.specMin ?? '-'} ~ {row.specMax ?? '-'}</span>
                    : <span style={{ color: '#f59e0b' }}>미설정</span>
        },
        {
            header: '판정', accessor: 'result', render: (row) => {
                const ngCount = (row.am?.result === 'NG' ? 1 : 0) + (row.pm?.result === 'NG' ? 1 : 0);
                const measured = (row.am ? 1 : 0) + (row.pm ? 1 : 0);
                if (ngCount > 0) {
                    return <span className="status-badge status-danger"><AlertTriangle size={12} style={{ marginRight: 4 }} />이상 {ngCount}건</span>;
                }
                if (measured >= 2) {
                    return <span className="status-badge status-active"><CheckCircle size={12} style={{ marginRight: 4 }} />정상</span>;
                }
                return <span className="status-badge status-warning">측정 {measured}/2</span>;
            }
        },
        { header: '관리', accessor: 'actions', render: (row) => dayBtns(row) }
    ];

    return (
        <>
            {/* 날짜 필터 + 통계 */}
            <div className="quality-filter-section">
                <div className="filter-row">
                    <div className="filter-dates">
                        <Calendar size={16} color="#64748b" />
                        <input type="date" className="form-input filter-date-input" value={wcStartDate} onChange={e => setWcStartDate(e.target.value)} />
                        <span className="filter-separator">~</span>
                        <input type="date" className="form-input filter-date-input" value={wcEndDate} onChange={e => setWcEndDate(e.target.value)} />
                    </div>
                </div>
                <div className="wc-stats">
                    <div className={`wc-stat ${weightStats.amDone > 0 ? 'safe' : 'warn'}`}>
                        <span className="wc-stat-label">오늘 오전(10시) 측정</span>
                        <span className="wc-stat-value">{weightStats.amDone}건</span>
                    </div>
                    <div className={`wc-stat ${weightStats.pmDone > 0 ? 'safe' : 'warn'}`}>
                        <span className="wc-stat-label">오늘 오후(2시) 측정</span>
                        <span className="wc-stat-value">{weightStats.pmDone}건</span>
                    </div>
                    <div className="wc-stat">
                        <span className="wc-stat-label">기간 내 측정</span>
                        <span className="wc-stat-value">{weightStats.totalInRange}건</span>
                    </div>
                    <div className={`wc-stat ${weightStats.ngInRange > 0 ? 'danger' : 'safe'}`}>
                        <span className="wc-stat-label">스펙 이탈</span>
                        <span className="wc-stat-value">{weightStats.ngInRange}건</span>
                    </div>
                </div>
            </div>

            {/* 등록된 제품 스펙 현황 */}
            {productsWithSpec.length > 0 && (
                <div className="wc-spec-list">
                    {productsWithSpec.map(p => {
                        const s = getProductSpec(p);
                        return (
                            <span key={p.id} className={`wc-spec-chip ${s.hasSpec ? '' : 'nospec'}`}>
                                {p.name} · 기준 <b>{s.target ?? '-'}g</b>
                                {s.hasSpec ? <> · {s.min ?? '-'}~{s.max ?? '-'}g</> : <> · 하한/상한 미설정</>}
                            </span>
                        );
                    })}
                </div>
            )}

            <Table columns={columns} data={weightDailyRows} pageSize={50} />
        </>
    );
};

export default Quality;
