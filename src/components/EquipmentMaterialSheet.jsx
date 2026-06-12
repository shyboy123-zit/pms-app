import React, { useState, useRef, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Factory, Download, Printer } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// 호기별 원재료 투입량 — 작업지시서 첨부용 A4 서류 (PDF/인쇄)
// 신재/분쇄 계산: 런너 100% 재사용 → 신재=제품중량분, 분쇄=런너발생분. 신재만 제품은 전량 신재.
const EquipmentMaterialSheet = () => {
    const { equipments, workOrders, products, materials } = useData();
    const [mode, setMode] = useState('daily'); // 'total' | 'daily'
    const [hours, setHours] = useState(24);
    const [isGen, setIsGen] = useState(false);
    const sheetRef = useRef(null);
    const today = new Date().toISOString().split('T')[0];

    const data = useMemo(() => {
        const rows = [];
        const matTotals = {};
        (workOrders || [])
            .filter(w => w.status === '진행중')
            .forEach(wo => {
                const product = products.find(p => p.id === wo.product_id);
                if (!product) return;
                const remaining = Math.max(0, (wo.target_quantity || 0) - (wo.produced_quantity || 0));
                if (remaining <= 0) return;
                const pw = product.product_weight || 0;
                const rw = product.runner_weight || 0;
                const cv = product.cavity_count || 1;
                let qty = remaining;
                if (mode === 'daily') {
                    const cycle = parseFloat(product.standard_cycle_time) || 0;
                    const cap = cycle > 0 ? Math.floor((hours * 3600 / cycle) * cv) : remaining;
                    qty = Math.min(remaining, cap);
                }
                if (qty <= 0) return;
                const shots = qty / cv;
                const virginOnly = (product.virgin_ratio ?? 50) >= 100;
                let virginKg, regrindKg;
                if (virginOnly) {
                    virginKg = (pw * cv + rw) * shots / 1000;
                    regrindKg = 0;
                } else {
                    virginKg = pw * qty / 1000;
                    regrindKg = rw * shots / 1000;
                }
                const shot = pw * cv + rw;
                const regPct = shot > 0 ? Math.round(rw / shot * 100) : 0;
                const eq = equipments.find(e => e.id === wo.equipment_id);
                const material = materials.find(m => m.id === product.material_id);
                const matName = material?.name || '(미지정)';
                rows.push({
                    eqName: eq?.name || '(호기 미지정)',
                    product: product.name,
                    material: matName,
                    ratio: virginOnly ? '신재 100%' : `${100 - regPct} : ${regPct}`,
                    qty, virginKg, regrindKg, totalKg: virginKg + regrindKg, virginOnly,
                });
                if (!matTotals[matName]) matTotals[matName] = { material: matName, virgin: 0, regrind: 0 };
                matTotals[matName].virgin += virginKg;
                matTotals[matName].regrind += regrindKg;
            });
        rows.sort((a, b) => a.eqName.localeCompare(b.eqName, 'ko'));
        const totV = rows.reduce((s, r) => s + r.virginKg, 0);
        const totR = rows.reduce((s, r) => s + r.regrindKg, 0);
        return { rows, mats: Object.values(matTotals).sort((a, b) => (b.virgin + b.regrind) - (a.virgin + a.regrind)), totV, totR };
    }, [workOrders, products, materials, equipments, mode, hours]);

    const generatePdf = async () => {
        setIsGen(true);
        await new Promise(r => setTimeout(r, 300));
        try {
            const el = sheetRef.current;
            const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const img = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const w = pdf.internal.pageSize.getWidth();
            const h = pdf.internal.pageSize.getHeight();
            const imgH = (canvas.height * w) / canvas.width;
            let left = imgH, pos = 0;
            pdf.addImage(img, 'PNG', 0, pos, w, imgH); left -= h;
            while (left > 0) { pos = left - imgH; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, w, imgH); left -= h; }
            pdf.save(`호기별_원재료투입량_${today.replace(/-/g, '')}.pdf`);
        } catch (e) {
            console.error(e); alert('PDF 생성에 실패했습니다.');
        } finally { setIsGen(false); }
    };

    const printSheet = () => {
        if (!sheetRef.current) return;
        const html = sheetRef.current.outerHTML;
        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) { alert('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.'); return; }
        w.document.write(`<!DOCTYPE html><html><head><title>호기별 원재료 투입량</title>
            <style>@page{size:A4;margin:12mm;} body{margin:0;font-family:'Malgun Gothic',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}</style>
            </head><body>${html}</body></html>`);
        w.document.close(); w.focus();
        setTimeout(() => { w.print(); }, 400);
    };

    return (
        <div className="widget glass-panel" style={{ gridColumn: '1 / -1' }}>
            <div className="widget-header">
                <h3><Factory size={20} /> 호기별 원재료 투입량 (작업지시 첨부용)</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 8, padding: 3 }}>
                        <button onClick={() => setMode('total')} style={{ padding: '0.3rem 0.7rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: mode === 'total' ? 'var(--bg-card)' : 'transparent', color: mode === 'total' ? 'var(--primary)' : 'var(--text-muted)' }}>작업 전체</button>
                        <button onClick={() => setMode('daily')} style={{ padding: '0.3rem 0.7rem', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: mode === 'daily' ? 'var(--bg-card)' : 'transparent', color: mode === 'daily' ? 'var(--primary)' : 'var(--text-muted)' }}>일일</button>
                    </div>
                    {mode === 'daily' && (
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            가동
                            <input type="number" min="1" max="24" value={hours}
                                onChange={(e) => setHours(Math.max(1, Math.min(24, parseInt(e.target.value) || 1)))}
                                onFocus={(e) => e.target.select()}
                                style={{ width: 50, padding: '0.25rem', border: '1px solid var(--border)', borderRadius: 6, textAlign: 'center', background: 'var(--bg-elevated)', color: 'var(--text-main)' }} />
                            시간
                        </label>
                    )}
                    <button onClick={printSheet} disabled={data.rows.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#475569', color: '#fff', border: 'none', borderRadius: 8, padding: '0.4rem 0.8rem', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', opacity: data.rows.length === 0 ? 0.5 : 1 }}>
                        <Printer size={15} /> 인쇄
                    </button>
                    <button onClick={generatePdf} disabled={data.rows.length === 0 || isGen}
                        className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: data.rows.length === 0 || isGen ? 0.5 : 1 }}>
                        <Download size={15} /> {isGen ? '생성 중...' : 'PDF 저장'}
                    </button>
                </div>
            </div>
            <div className="widget-content">
                {data.rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8' }}>진행중인 작업지시가 없습니다.</div>
                ) : (
                    <div ref={sheetRef} style={{ background: '#fff', color: '#1e293b', padding: '24px 28px', border: '1px solid #e2e8f0', borderRadius: 8 }}>
                        {/* 문서 헤더 */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '3px solid #1e293b', paddingBottom: 10, marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4 }}>호기별 원재료 투입량</div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                    {mode === 'daily' ? `일일 기준 (가동 ${hours}시간/일)` : '작업 전체 기준'} · 신재/분쇄 비율 적용
                                </div>
                            </div>
                            <div style={{ fontSize: 12, color: '#475569', textAlign: 'right' }}>
                                <div>작성일: {today}</div>
                                <div>진행중 작업 {data.rows.length}건</div>
                            </div>
                        </div>

                        {/* 호기별 표 */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                                <tr>
                                    {['호기', '제품', '원재료', '신재:분쇄', mode === 'daily' ? '일일생산' : '남은수량', '신재(kg)', '분쇄(kg)', '총투입(kg)'].map((h, i) => (
                                        <th key={i} style={{ border: '1px solid #cbd5e1', background: '#1e293b', color: '#fff', padding: '6px 8px', textAlign: i < 4 ? 'left' : 'right', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((r, i) => (
                                    <tr key={i}>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: 700 }}>{r.eqName}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{r.product}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', color: '#0369a1', fontWeight: 600 }}>{r.material}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px' }}>{r.ratio}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right' }}>{Math.round(r.qty).toLocaleString()}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>{r.virginKg.toFixed(1)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>{r.regrindKg.toFixed(1)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{r.totalKg.toFixed(1)}</td>
                                    </tr>
                                ))}
                                <tr style={{ background: '#f1f5f9', fontWeight: 800 }}>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '7px 8px' }} colSpan={5}>합계</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '7px 8px', textAlign: 'right', color: '#1e40af' }}>{data.totV.toFixed(1)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '7px 8px', textAlign: 'right', color: '#166534' }}>{data.totR.toFixed(1)}</td>
                                    <td style={{ border: '1px solid #cbd5e1', padding: '7px 8px', textAlign: 'right' }}>{(data.totV + data.totR).toFixed(1)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 원재료별 준비량 요약 */}
                        <div style={{ fontSize: 14, fontWeight: 700, margin: '18px 0 8px', paddingLeft: 8, borderLeft: '4px solid #6366f1' }}>원재료별 준비량 (신재 발주 기준)</div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                                <tr>
                                    {['원재료', '신재(kg)', '분쇄(kg)', '총(kg)'].map((h, i) => (
                                        <th key={i} style={{ border: '1px solid #cbd5e1', background: '#f1f5f9', padding: '6px 8px', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.mats.map((m, i) => (
                                    <tr key={i}>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', fontWeight: 600 }}>{m.material}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: '#1e40af', fontWeight: 700 }}>{m.virgin.toFixed(1)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', color: '#166534', fontWeight: 700 }}>{m.regrind.toFixed(1)}</td>
                                        <td style={{ border: '1px solid #cbd5e1', padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{(m.virgin + m.regrind).toFixed(1)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 10 }}>
                            ※ 신재 = 제품중량분(런너 제외, 런너는 100% 분쇄 재사용) / 분쇄 = 자체 런너 발생분. 신재만 제품은 전량 신재.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EquipmentMaterialSheet;
