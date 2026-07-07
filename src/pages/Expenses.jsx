import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import Table from '../components/Table';
import Modal from '../components/Modal';
import MiniKpiCards from '../components/MiniKpiCards';
import ExcelToolbar from '../components/ExcelToolbar';
import { useData } from '../context/DataContext';
import { parsers } from '../lib/excel';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
    Wallet, TrendingDown, Calendar, BarChart3, Plus, Edit, Trash2,
    Upload, Search, CreditCard, Receipt, HelpCircle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// 홈택스 다운로드 엑셀 파서 — 전자세금계산서 매입 / 현금영수증 매입 / 사업용카드 사용내역
// 컬럼 위치가 파일마다 달라도 헤더명을 동의어로 인식해 매핑한다.
// ─────────────────────────────────────────────────────────────
const norm = (s) => String(s ?? '').replace(/\s/g, '').trim();
const toNum = (v) => {
    if (v === '' || v === null || v === undefined) return 0;
    const n = Number(String(v).replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? 0 : n;
};
const toDate = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    if (typeof v === 'number') {
        const d = XLSX.SSF.parse_date_code(v);
        if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    }
    const s = String(v).trim();
    let m = s.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);          // 2026-06-01
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = s.match(/^(\d{4})(\d{2})(\d{2})/);                            // 20260601
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return null;
};

function parseHometaxWorkbook(arrayBuffer) {
    const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
    const all = [];
    for (const sheetName of wb.SheetNames) {
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
        if (aoa.length < 2) continue;

        // 헤더 행 찾기 (금액/일자 관련 키워드가 2개 이상 있는 행)
        const HKEYS = ['작성일자', '거래일자', '승인일자', '발급일자', '사용일자', '이용일자', '거래일시',
            '공급가액', '세액', '합계금액', '거래금액', '이용금액', '승인금액', '상호', '품목', '가맹점'];
        let hIdx = aoa.findIndex(row =>
            row.filter(c => HKEYS.some(k => norm(c).includes(k))).length >= 2
        );
        if (hIdx < 0) hIdx = 0;
        const headers = aoa[hIdx].map(norm);
        const find = (cands) => headers.findIndex(h => h && cands.some(c => h.includes(c)));

        const col = {
            date: find(['작성일자', '거래일자', '승인일자', '발급일자', '사용일자', '이용일자', '거래일시', '일자']),
            vendor: find(['상호', '공급자', '가맹점', '거래처', '법인명']),
            biz: find(['공급자등록번호', '공급자사업자', '사업자등록번호', '등록번호', '가맹점사업자']),
            supply: find(['공급가액']),
            tax: find(['세액', '부가세']),
            total: find(['합계금액', '거래금액', '이용금액', '승인금액', '결제금액', '금액', '합계']),
            item: find(['품목', '품명', '적요', '상품']),
            approval: find(['승인번호', '승인일련번호', '거래번호', '국세청승인번호']),
        };
        if (col.date < 0 || (col.total < 0 && col.supply < 0)) continue; // 지출 데이터 시트 아님

        // 출처/분류 추정
        const hjoined = headers.join('|');
        let source = '세금계산서';
        if (/가맹점|이용금액|이용일자|카드/.test(hjoined)) source = '카드';
        else if (/현금영수증/.test(hjoined)) source = '현금영수증';
        const defaultCategory = source === '카드' ? '카드' : source === '현금영수증' ? '기타' : '원재료매입';

        for (let i = hIdx + 1; i < aoa.length; i++) {
            const r = aoa[i];
            if (!r || r.every(v => v === '' || v === null)) continue;
            const date = toDate(col.date >= 0 ? r[col.date] : '');
            if (!date) continue; // 합계행/안내행 등 스킵
            const supply = col.supply >= 0 ? toNum(r[col.supply]) : 0;
            const tax = col.tax >= 0 ? toNum(r[col.tax]) : 0;
            let total = col.total >= 0 ? toNum(r[col.total]) : 0;
            if (!total) total = supply + tax;
            if (!total) continue;
            const approval = col.approval >= 0 ? norm(r[col.approval]) : '';
            all.push({
                expense_date: date,
                category: defaultCategory,
                source,
                vendor: col.vendor >= 0 ? String(r[col.vendor] || '').trim() || null : null,
                vendor_biz_no: col.biz >= 0 ? String(r[col.biz] || '').trim() || null : null,
                description: col.item >= 0 ? String(r[col.item] || '').trim() || null : null,
                supply_amount: supply,
                tax_amount: tax,
                amount: total,
                payment_method: source === '카드' ? '카드' : null,
                external_id: approval ? `htx_${approval}` : null,
            });
        }
    }
    return all;
}

const CATEGORIES = ['원재료매입', '카드', '공과금', '인건비', '임차료', '수수료', '세금', '기타'];
const SOURCES = ['세금계산서', '카드', '현금영수증', '수동', '엑셀'];
const won = (n) => '₩' + Math.round(n || 0).toLocaleString();

// 엑셀 가져오기/내보내기 컬럼 정의
const EXCEL_COLUMNS = [
    { key: 'expense_date', label: '일자', parse: parsers.date, sample: '2026-06-01' },
    { key: 'category', label: '분류', parse: parsers.string, sample: '원재료매입' },
    { key: 'source', label: '출처', parse: parsers.string, sample: '세금계산서' },
    { key: 'vendor', label: '거래처', parse: parsers.string, sample: '한림산업' },
    { key: 'vendor_biz_no', label: '사업자번호', parse: parsers.string, sample: '123-45-67890' },
    { key: 'description', label: '품목/적요', parse: parsers.string, sample: 'PP 원재료' },
    { key: 'supply_amount', label: '공급가액', parse: parsers.number, sample: 1000000 },
    { key: 'tax_amount', label: '세액', parse: parsers.number, sample: 100000 },
    { key: 'amount', label: '합계금액', parse: parsers.number, sample: 1100000 },
    { key: 'payment_method', label: '결제수단', parse: parsers.string, sample: '계좌이체' },
    { key: 'notes', label: '비고', parse: parsers.string, sample: '' },
];

const emptyForm = () => ({
    expense_date: new Date().toISOString().split('T')[0],
    category: '원재료매입',
    source: '수동',
    vendor: '',
    vendor_biz_no: '',
    description: '',
    supply_amount: '',
    tax_amount: '',
    amount: '',
    payment_method: '',
    notes: '',
});

const Expenses = () => {
    const { expenses, addExpense, updateExpense, deleteExpense, bulkAddExpenses, bulkUpsertExpenses } = useData();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [monthFilter, setMonthFilter] = useState('all');     // 'all' | 1~12
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(emptyForm());
    const [importing, setImporting] = useState(false);
    const [importMsg, setImportMsg] = useState('');
    const [showGuide, setShowGuide] = useState(false);
    const htxFileRef = useRef(null);

    // ── 연도 목록 ──
    const availableYears = useMemo(() => {
        const ys = new Set();
        (expenses || []).forEach(e => {
            const y = new Date(e.expense_date).getFullYear();
            if (y) ys.add(y);
        });
        ys.add(new Date().getFullYear());
        return Array.from(ys).sort((a, b) => b - a);
    }, [expenses]);

    // ── 선택 연도 데이터 ──
    const yearExpenses = useMemo(
        () => (expenses || []).filter(e => (e.expense_date || '').startsWith(String(selectedYear))),
        [expenses, selectedYear]
    );

    // ── 월별 총지출 (12개월) ──
    const monthlyData = useMemo(() => {
        const arr = [];
        for (let m = 1; m <= 12; m++) {
            const key = `${selectedYear}-${String(m).padStart(2, '0')}`;
            const rows = yearExpenses.filter(e => (e.expense_date || '').startsWith(key));
            const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
            arr.push({ month: m, label: `${m}월`, total, count: rows.length });
        }
        return arr;
    }, [yearExpenses, selectedYear]);

    // ── 연 요약 ──
    const summary = useMemo(() => {
        const yearTotal = yearExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const curMonthKey = `${selectedYear}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const thisMonth = yearExpenses
            .filter(e => (e.expense_date || '').startsWith(curMonthKey))
            .reduce((s, e) => s + (Number(e.amount) || 0), 0);
        const activeMonths = monthlyData.filter(m => m.total > 0).length || 1;
        return {
            yearTotal,
            thisMonth,
            monthlyAvg: yearTotal / activeMonths,
            count: yearExpenses.length,
        };
    }, [yearExpenses, monthlyData, selectedYear]);

    // ── 분류별 집계 ──
    const byCategory = useMemo(() => {
        const map = {};
        yearExpenses.forEach(e => {
            const c = e.category || '기타';
            map[c] = (map[c] || 0) + (Number(e.amount) || 0);
        });
        return Object.entries(map)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total);
    }, [yearExpenses]);

    // ── 테이블 필터 ──
    const filtered = useMemo(() => {
        let rows = yearExpenses;
        if (monthFilter !== 'all') {
            const key = `${selectedYear}-${String(monthFilter).padStart(2, '0')}`;
            rows = rows.filter(e => (e.expense_date || '').startsWith(key));
        }
        if (categoryFilter !== 'all') rows = rows.filter(e => (e.category || '기타') === categoryFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            rows = rows.filter(e =>
                (e.vendor || '').toLowerCase().includes(q) ||
                (e.description || '').toLowerCase().includes(q) ||
                (e.vendor_biz_no || '').includes(q)
            );
        }
        return rows;
    }, [yearExpenses, monthFilter, categoryFilter, search, selectedYear]);

    const filteredTotal = filtered.reduce((s, e) => s + (Number(e.amount) || 0), 0);

    // ── 폼 핸들러 ──
    const openAdd = () => { setEditingId(null); setForm(emptyForm()); setIsModalOpen(true); };
    const openEdit = (row) => {
        setEditingId(row.id);
        setForm({
            expense_date: row.expense_date || '',
            category: row.category || '기타',
            source: row.source || '수동',
            vendor: row.vendor || '',
            vendor_biz_no: row.vendor_biz_no || '',
            description: row.description || '',
            supply_amount: row.supply_amount ?? '',
            tax_amount: row.tax_amount ?? '',
            amount: row.amount ?? '',
            payment_method: row.payment_method || '',
            notes: row.notes || '',
        });
        setIsModalOpen(true);
    };

    // 공급가액/세액 입력 시 합계 자동계산 (합계를 직접 안 건드렸을 때)
    const setField = (key, value) => {
        setForm(prev => {
            const next = { ...prev, [key]: value };
            if (key === 'supply_amount' || key === 'tax_amount') {
                const s = Number(String(key === 'supply_amount' ? value : prev.supply_amount).replace(/[,\s]/g, '')) || 0;
                const t = Number(String(key === 'tax_amount' ? value : prev.tax_amount).replace(/[,\s]/g, '')) || 0;
                if (s || t) next.amount = s + t;
            }
            return next;
        });
    };

    const handleSubmit = async () => {
        const amount = parsers.number(form.amount);
        if (!form.expense_date) { alert('일자를 입력하세요.'); return; }
        if (!amount) { alert('금액을 입력하세요.'); return; }
        const payload = {
            expense_date: form.expense_date,
            category: form.category || '기타',
            source: form.source || '수동',
            vendor: form.vendor || null,
            vendor_biz_no: form.vendor_biz_no || null,
            description: form.description || null,
            supply_amount: parsers.number(form.supply_amount),
            tax_amount: parsers.number(form.tax_amount),
            amount,
            payment_method: form.payment_method || null,
            notes: form.notes || null,
        };
        const res = editingId ? await updateExpense(editingId, payload) : await addExpense(payload);
        if (!res.error) { setIsModalOpen(false); setEditingId(null); }
    };

    const handleDelete = async (row) => {
        if (!window.confirm(`${row.expense_date} ${won(row.amount)} 지출을 삭제할까요?`)) return;
        await deleteExpense(row.id);
    };

    // ── 엑셀 가져오기 ──
    const handleImport = async (rows) => {
        const items = rows
            .map(r => {
                const supply = Number(r.supply_amount) || 0;
                const tax = Number(r.tax_amount) || 0;
                const amount = Number(r.amount) || supply + tax;
                if (!r.expense_date || !amount) return null;
                return {
                    expense_date: r.expense_date,
                    category: r.category || '기타',
                    source: r.source || '엑셀',
                    vendor: r.vendor || null,
                    vendor_biz_no: r.vendor_biz_no || null,
                    description: r.description || null,
                    supply_amount: supply,
                    tax_amount: tax,
                    amount,
                    payment_method: r.payment_method || null,
                    notes: r.notes || null,
                };
            })
            .filter(Boolean);
        if (items.length === 0) { alert('가져올 유효한 행이 없습니다. (일자/금액 확인)'); return; }
        const { error } = await bulkAddExpenses(items);
        if (error) alert('엑셀 저장 실패: ' + error.message);
        else alert(`${items.length}건을 가져왔습니다.`);
    };

    // ── 홈택스 다운로드 엑셀 업로드 (전자세금계산서/현금영수증/카드) ──
    const handleHometaxFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        setImportMsg('');
        try {
            const buf = await file.arrayBuffer();
            const items = parseHometaxWorkbook(buf);
            if (items.length === 0) {
                setImportMsg('⚠️ 인식된 지출 행이 없습니다. 홈택스에서 받은 "매입" 엑셀이 맞는지 확인하세요. (양식이 다르면 파일을 보내주시면 맞춰드립니다)');
            } else {
                const { count, error } = await bulkUpsertExpenses(items);
                if (error) setImportMsg(`⚠️ 저장 실패: ${error.message}`);
                else setImportMsg(`✅ ${count}건을 가져왔습니다. (승인번호 기준 중복은 자동 제외)`);
            }
        } catch (err) {
            console.error(err);
            setImportMsg(`⚠️ 파일 읽기 실패: ${err.message}`);
        } finally {
            setImporting(false);
            if (htxFileRef.current) htxFileRef.current.value = '';
        }
    };

    // ── 테이블 컬럼 ──
    const columns = [
        { header: '일자', accessor: 'expense_date', width: '110px' },
        { header: '분류', width: '100px', render: (r) => <span className="exp-badge">{r.category || '기타'}</span> },
        { header: '출처', width: '90px', render: (r) => <span className="exp-src">{r.source || '-'}</span> },
        { header: '거래처', accessor: 'vendor', width: '140px', render: (r) => r.vendor || '-' },
        { header: '품목/적요', accessor: 'description', width: '180px', render: (r) => r.description || '-' },
        { header: '금액', width: '120px', render: (r) => <strong style={{ color: '#ef4444' }}>{won(r.amount)}</strong> },
        { header: '결제수단', accessor: 'payment_method', width: '100px', render: (r) => r.payment_method || '-' },
    ];

    const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1);

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">지출관리</h2>
                    <p className="page-description">원재료 매입·카드·공과금 등 모든 지출을 모아 월별 총지출을 확인합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select className="year-select" value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
                        {availableYears.map(y => <option key={y} value={y}>{y}년</option>)}
                    </select>
                    <input ref={htxFileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleHometaxFile} />
                    <button className="btn-sync" onClick={() => setShowGuide(s => !s)} title="홈택스에서 엑셀 받는 방법">
                        <HelpCircle size={16} /> 받는 방법
                    </button>
                    <button className="btn-htx" onClick={() => htxFileRef.current?.click()} disabled={importing} title="홈택스에서 받은 매입/카드 엑셀 업로드">
                        <Upload size={16} className={importing ? 'spin' : ''} /> {importing ? '불러오는 중…' : '홈택스 엑셀 업로드'}
                    </button>
                    <button className="btn-primary-exp" onClick={openAdd}>
                        <Plus size={16} /> 지출 추가
                    </button>
                </div>
            </div>

            {importMsg && <div className="sync-msg">{importMsg}</div>}

            {showGuide && (
                <div className="guide-panel">
                    <strong>📥 홈택스에서 지출 엑셀 받는 방법</strong>
                    <ol>
                        <li><b>전자세금계산서 매입</b>: 홈택스 → 「계산서·영수증·카드」 → 전자(세금)계산서 <b>매입</b> 조회 → 기간 선택 → <b>엑셀 다운로드</b></li>
                        <li><b>현금영수증 매입</b>: 「계산서·영수증·카드」 → 현금영수증 → <b>매입</b> 내역 → 엑셀 다운로드</li>
                        <li><b>사업용카드 사용내역</b>: 「계산서·영수증·카드」 → 사업용신용카드 → 사용내역 조회 → 엑셀 다운로드</li>
                    </ol>
                    받은 엑셀 파일을 <b>그대로</b> 「홈택스 엑셀 업로드」 버튼으로 올리면 자동 인식됩니다. (가공 불필요 · 같은 건은 승인번호로 중복 자동 제외)
                </div>
            )}

            {/* KPI */}
            <MiniKpiCards cards={[
                { label: `${selectedYear}년 총지출`, value: won(summary.yearTotal), color: '#ef4444', icon: <Wallet size={18} /> },
                { label: '이번달 총지출', value: won(summary.thisMonth), color: '#f59e0b', icon: <Calendar size={18} /> },
                { label: '월평균 지출', value: won(summary.monthlyAvg), color: '#6366f1', icon: <TrendingDown size={18} /> },
                { label: '지출 건수', value: `${summary.count}건`, color: '#10b981', icon: <Receipt size={18} /> },
            ]} />

            {/* 월별 총지출 차트 */}
            <div className="glass-panel chart-section" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={18} /> {selectedYear}년 월별 총지출
                </h3>
                <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={(v) => v >= 1e8 ? `${(v / 1e8).toFixed(1)}억` : v >= 1e4 ? `${Math.round(v / 1e4)}만` : v} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(v) => won(v)} labelStyle={{ color: '#111' }} />
                        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                            {monthlyData.map((m, i) => (
                                <Cell key={i} fill={m.total >= maxMonthly * 0.99 ? '#ef4444' : '#f87171'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 분류별 + 월별 표 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) 2fr', gap: '1.25rem', marginBottom: '1.25rem', alignItems: 'start' }}>
                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CreditCard size={16} /> 분류별 지출
                    </h3>
                    {byCategory.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>데이터 없음</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                            {byCategory.map(c => {
                                const pct = summary.yearTotal ? (c.total / summary.yearTotal) * 100 : 0;
                                return (
                                    <div key={c.category}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 2 }}>
                                            <span>{c.category}</span>
                                            <span style={{ fontWeight: 600 }}>{won(c.total)} <span style={{ color: 'var(--text-muted)' }}>({pct.toFixed(0)}%)</span></span>
                                        </div>
                                        <div style={{ height: 6, background: 'var(--bg-subtle)', borderRadius: 3 }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: '#ef4444', borderRadius: 3 }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>월별 요약</h3>
                    <div className="month-grid">
                        {monthlyData.map(m => (
                            <button
                                key={m.month}
                                className={`month-cell ${monthFilter === m.month ? 'active' : ''}`}
                                onClick={() => setMonthFilter(monthFilter === m.month ? 'all' : m.month)}
                                title="클릭하여 해당 월만 보기"
                            >
                                <span className="mc-label">{m.label}</span>
                                <span className="mc-total">{m.total ? won(m.total) : '-'}</span>
                                <span className="mc-count">{m.count ? `${m.count}건` : ''}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* 필터 + 엑셀 */}
            <div className="glass-panel" style={{ padding: '1rem 1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div className="search-box">
                        <Search size={15} />
                        <input placeholder="거래처·품목·사업자번호 검색" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <select className="flt" value={monthFilter} onChange={e => setMonthFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}>
                        <option value="all">전체 월</option>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{m}월</option>)}
                    </select>
                    <select className="flt" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                        <option value="all">전체 분류</option>
                        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <span style={{ marginLeft: 'auto', fontSize: '0.9rem' }}>
                        {filtered.length}건 · 합계 <strong style={{ color: '#ef4444' }}>{won(filteredTotal)}</strong>
                    </span>
                    <ExcelToolbar data={filtered} columns={EXCEL_COLUMNS} fileName="지출내역" onImport={handleImport} />
                </div>
            </div>

            <Table columns={columns} data={filtered} pageSize={50} actions={(row) => (
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="icon-btn" onClick={() => openEdit(row)} title="수정"><Edit size={15} /></button>
                    <button className="icon-btn danger" onClick={() => handleDelete(row)} title="삭제"><Trash2 size={15} /></button>
                </div>
            )} />

            {/* 추가/수정 모달 */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? '지출 수정' : '지출 추가'}>
                <div className="exp-form">
                    <div className="row2">
                        <label>일자
                            <input type="date" value={form.expense_date} onChange={e => setField('expense_date', e.target.value)} />
                        </label>
                        <label>분류
                            <select value={form.category} onChange={e => setField('category', e.target.value)}>
                                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                    </div>
                    <div className="row2">
                        <label>출처
                            <select value={form.source} onChange={e => setField('source', e.target.value)}>
                                {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label>결제수단
                            <input value={form.payment_method} onChange={e => setField('payment_method', e.target.value)} placeholder="계좌이체/법인카드 등" />
                        </label>
                    </div>
                    <div className="row2">
                        <label>거래처
                            <input value={form.vendor} onChange={e => setField('vendor', e.target.value)} placeholder="거래처/가맹점" />
                        </label>
                        <label>사업자번호
                            <input value={form.vendor_biz_no} onChange={e => setField('vendor_biz_no', e.target.value)} placeholder="000-00-00000" />
                        </label>
                    </div>
                    <label>품목/적요
                        <input value={form.description} onChange={e => setField('description', e.target.value)} placeholder="예: PP 원재료 5톤" />
                    </label>
                    <div className="row3">
                        <label>공급가액
                            <input inputMode="numeric" value={form.supply_amount} onChange={e => setField('supply_amount', e.target.value)} placeholder="0" />
                        </label>
                        <label>세액
                            <input inputMode="numeric" value={form.tax_amount} onChange={e => setField('tax_amount', e.target.value)} placeholder="0" />
                        </label>
                        <label>합계금액 *
                            <input inputMode="numeric" value={form.amount} onChange={e => setField('amount', e.target.value)} placeholder="0" style={{ fontWeight: 700 }} />
                        </label>
                    </div>
                    <label>비고
                        <input value={form.notes} onChange={e => setField('notes', e.target.value)} />
                    </label>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                        <button className="btn-primary-exp" onClick={handleSubmit}>{editingId ? '수정' : '저장'}</button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
                .year-select, .flt { padding: 0.5rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); font-size: 0.9rem; }
                .btn-primary-exp, .btn-sync, .btn-htx, .btn-cancel { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.9rem; border-radius: var(--radius-sm); font-size: 0.9rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; }
                .btn-primary-exp { background: #ef4444; color: #fff; }
                .btn-primary-exp:hover { background: #dc2626; }
                .btn-htx { background: #2563eb; color: #fff; }
                .btn-htx:hover { background: #1d4ed8; }
                .btn-htx:disabled { opacity: 0.6; cursor: default; }
                .btn-sync { background: var(--bg-card); color: var(--text-main); border-color: var(--border); }
                .btn-sync:hover { background: var(--bg-subtle); }
                .btn-cancel { background: var(--bg-subtle); color: var(--text-main); }
                .sync-msg { padding: 0.6rem 1rem; margin-bottom: 1rem; border-radius: var(--radius-sm); background: var(--bg-subtle); border: 1px solid var(--border); font-size: 0.88rem; }
                .guide-panel { padding: 0.9rem 1.1rem; margin-bottom: 1rem; border-radius: var(--radius-sm); background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.25); font-size: 0.86rem; line-height: 1.5; }
                .guide-panel ol { margin: 0.5rem 0 0.4rem; padding-left: 1.2rem; }
                .guide-panel li { margin-bottom: 0.3rem; }
                .spin { animation: expspin 0.9s linear infinite; }
                @keyframes expspin { to { transform: rotate(360deg); } }
                .exp-badge { padding: 2px 8px; border-radius: 999px; background: rgba(239,68,68,0.1); color: #ef4444; font-size: 0.78rem; font-weight: 600; }
                .exp-src { font-size: 0.8rem; color: var(--text-muted); }
                .month-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.5rem; }
                .month-cell { display: flex; flex-direction: column; gap: 2px; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); cursor: pointer; transition: all 0.15s; text-align: left; }
                .month-cell:hover { border-color: #ef4444; }
                .month-cell.active { border-color: #ef4444; background: rgba(239,68,68,0.08); }
                .mc-label { font-size: 0.75rem; color: var(--text-muted); }
                .mc-total { font-size: 0.85rem; font-weight: 700; color: var(--text-main); }
                .mc-count { font-size: 0.68rem; color: var(--text-subtle); }
                .search-box { display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.7rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); }
                .search-box input { border: none; background: transparent; outline: none; color: var(--text-main); font-size: 0.9rem; width: 200px; }
                .icon-btn { display: inline-flex; padding: 0.35rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); cursor: pointer; color: var(--text-main); }
                .icon-btn:hover { background: var(--bg-subtle); }
                .icon-btn.danger:hover { background: rgba(239,68,68,0.1); color: #ef4444; border-color: #ef4444; }
                .exp-form { display: flex; flex-direction: column; gap: 0.75rem; }
                .exp-form label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.85rem; color: var(--text-muted); }
                .exp-form input, .exp-form select { padding: 0.5rem 0.65rem; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); color: var(--text-main); font-size: 0.92rem; }
                .exp-form .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
                .exp-form .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
                @media (max-width: 720px) {
                    .month-grid { grid-template-columns: repeat(3, 1fr); }
                    .exp-form .row2, .exp-form .row3 { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Expenses;
