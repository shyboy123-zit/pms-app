import React, { useMemo, useState } from 'react';
import { Calendar, Package, Boxes, Wallet, Printer } from 'lucide-react';
import { useData } from '../context/DataContext';
import ExcelToolbar from './ExcelToolbar';

const num = (v) => parseFloat(v) || 0;
const won = (n) => '₩' + Math.round(n).toLocaleString('ko-KR');

// 특정 시점(기준일) 재고 평가
// - 제품: 입출고 트랜잭션(거래일자 ≤ 기준일)으로 시점 재고를 정확히 재구성
// - 원재료: 현재고에서 기준일 이후의 입고/소모를 되돌려 추정 (기준일이 오늘 이후면 현재고 = 정확)
// - 단가: 제품/원재료 마스터의 등록단가(unit_price)
const InventoryValuation = () => {
    const { products, inventoryTransactions, materials, materialUsage, vouchers } = useData();
    const today = new Date().toISOString().split('T')[0];
    const [asOf, setAsOf] = useState(today);
    const isSnapshot = asOf >= today; // 오늘 이후 → 현재고 스냅샷 사용(정확)

    // 제품 시점 재고 (입출고 기반)
    const productRows = useMemo(() => {
        return (products || []).map(p => {
            let stock = 0;
            (inventoryTransactions || []).forEach(t => {
                if (!t.transaction_date || t.transaction_date > asOf) return;
                const codeMatch = p.product_code && t.item_code && t.item_code === p.product_code;
                const nameMatch = p.name && t.item_name && t.item_name === p.name;
                if (codeMatch || nameMatch) {
                    if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') stock += num(t.quantity);
                    else if (t.transaction_type === 'OUT') stock -= num(t.quantity);
                }
            });
            const price = num(p.unit_price);
            return { kind: '제품', name: p.name, code: p.product_code || '', unit: p.unit || 'EA', stock, price, value: stock * price };
        }).filter(r => r.stock !== 0).sort((a, b) => b.value - a.value);
    }, [products, inventoryTransactions, asOf]);

    // 원재료 시점 재고 (현재고 ∓ 기준일 이후 변동 되돌리기)
    const materialRows = useMemo(() => {
        // 실제 재고를 증가시킨 입고만 되돌림 = confirmIncoming이 만든 자동 매입 전표
        const autoIncoming = (vouchers || []).filter(v => v.voucher_type === '매입' && v.notes && v.notes.includes('[자동-원재료]'));
        return (materials || []).map(m => {
            let stock = num(m.stock);
            if (!isSnapshot) {
                // 기준일 이후 입고분 제거
                autoIncoming.forEach(v => {
                    if (v.voucher_date && v.voucher_date > asOf && v.item_name === m.name) stock -= num(v.quantity);
                });
                // 기준일 이후 소모분 복원
                (materialUsage || []).forEach(u => {
                    if (u.usage_date && u.usage_date > asOf && u.material_id === m.id) stock += num(u.quantity);
                });
            }
            const price = num(m.unit_price);
            return { kind: '원재료', name: m.name, code: '', unit: m.unit || 'kg', stock, price, value: stock * price };
        }).filter(r => r.stock !== 0).sort((a, b) => b.value - a.value);
    }, [materials, materialUsage, vouchers, asOf, isSnapshot]);

    const matTotal = materialRows.reduce((s, r) => s + r.value, 0);
    const prodTotal = productRows.reduce((s, r) => s + r.value, 0);
    const grandTotal = matTotal + prodTotal;
    const noPriceCount = [...materialRows, ...productRows].filter(r => r.stock > 0 && r.price === 0).length;

    const exportData = [...materialRows, ...productRows].map(r => ({
        kind: r.kind, code: r.code, name: r.name, stock: r.stock, unit: r.unit, price: r.price, value: r.value
    }));
    const exportColumns = [
        { key: 'kind', label: '구분' },
        { key: 'code', label: '품목코드' },
        { key: 'name', label: '품목명' },
        { key: 'stock', label: '재고수량', format: (v) => num(v) },
        { key: 'unit', label: '단위' },
        { key: 'price', label: '단가', format: (v) => num(v) },
        { key: 'value', label: '평가액', format: (v) => Math.round(num(v)) }
    ];

    const handlePrint = () => {
        const rowsHtml = (title, rows, subtotal) => `
            <h3 style="margin:18px 0 6px;font-size:14px;">${title} <span style="color:#4f46e5;">소계 ${won(subtotal)}</span></h3>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr style="background:#f1f5f9;">
                <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;">품목코드</th>
                <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:left;">품목명</th>
                <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;">재고수량</th>
                <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;">단가</th>
                <th style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;">평가액</th>
              </tr></thead>
              <tbody>
                ${rows.length === 0 ? '<tr><td colspan="5" style="border:1px solid #cbd5e1;padding:8px;text-align:center;color:#94a3b8;">내역 없음</td></tr>'
                : rows.map(r => `<tr>
                    <td style="border:1px solid #cbd5e1;padding:5px 8px;">${r.code || '-'}</td>
                    <td style="border:1px solid #cbd5e1;padding:5px 8px;">${r.name}</td>
                    <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;">${num(r.stock).toLocaleString()} ${r.unit}</td>
                    <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;">${won(r.price)}</td>
                    <td style="border:1px solid #cbd5e1;padding:5px 8px;text-align:right;font-weight:700;">${won(r.value)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>`;
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>재고 평가서</title>
          <style>@page{size:A4;margin:14mm;}body{font-family:'Malgun Gothic',sans-serif;color:#1e293b;}</style></head>
          <body>
            <h1 style="font-size:20px;text-align:center;margin-bottom:4px;">재 고 평 가 서</h1>
            <div style="text-align:center;color:#64748b;font-size:13px;margin-bottom:6px;">기준일: ${asOf}${isSnapshot ? ' (현재고 기준)' : ' (원재료는 추정치)'}</div>
            <div style="text-align:right;font-size:16px;font-weight:800;margin-bottom:10px;">총 재고자산 ${won(grandTotal)}</div>
            ${rowsHtml('■ 원재료', materialRows, matTotal)}
            ${rowsHtml('■ 제품', productRows, prodTotal)}
            <script>window.onload=function(){window.focus();window.print();};window.onafterprint=function(){window.close();};<\/script>
          </body></html>`;
        const w = window.open('', '_blank', 'width=900,height=1000');
        if (!w) { alert('팝업이 차단되었습니다. 인쇄하려면 팝업을 허용해주세요.'); return; }
        w.document.write(html);
        w.document.close();
    };

    const Section = ({ title, icon, rows, subtotal, estimated }) => (
        <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '1rem', fontWeight: 700 }}>
                    {icon} {title} <span style={{ color: '#94a3b8', fontWeight: 500, fontSize: '0.85rem' }}>({rows.length}개 품목)</span>
                    {estimated && <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '999px', fontWeight: 700 }}>추정</span>}
                </h3>
                <span style={{ fontWeight: 800, color: '#4f46e5' }}>{won(subtotal)}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', fontSize: '0.88rem' }}>
                <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>품목코드</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600 }}>품목명</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>재고수량</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>단가</th>
                        <th style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>평가액</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan="5" style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8' }}>해당 시점 재고 내역이 없습니다.</td></tr>
                    ) : rows.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '0.55rem 0.75rem', color: '#64748b' }}>{r.code || '-'}</td>
                            <td style={{ padding: '0.55rem 0.75rem', fontWeight: 600 }}>{r.name}</td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: r.stock < 0 ? '#dc2626' : '#059669', fontWeight: 600 }}>
                                {num(r.stock).toLocaleString()} {r.unit}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', color: r.price === 0 ? '#dc2626' : '#64748b' }}>
                                {r.price === 0 ? '단가없음' : won(r.price)}
                            </td>
                            <td style={{ padding: '0.55rem 0.75rem', textAlign: 'right', fontWeight: 700, color: '#1e293b' }}>{won(r.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* 기준일 + 액션 */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.35rem' }}>
                            <Calendar size={15} /> 조회 기준일
                        </label>
                        <input type="date" value={asOf} max={today} onChange={(e) => setAsOf(e.target.value || today)}
                            style={{ padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                        {[{ l: '오늘', d: today }, { l: '이번달 말', d: (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth() + 1, 0).toISOString().split('T')[0]; })() }, { l: '작년말', d: `${new Date().getFullYear() - 1}-12-31` }].map(b => (
                            <button key={b.l} onClick={() => setAsOf(b.d > today ? today : b.d)}
                                style={{ padding: '0.4rem 0.7rem', fontSize: '0.78rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: asOf === (b.d > today ? today : b.d) ? '#eef2ff' : '#f8fafc', color: '#4f46e5', cursor: 'pointer', fontWeight: 600 }}>
                                {b.l}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <ExcelToolbar data={exportData} columns={exportColumns} fileName={`재고평가_${asOf}`} />
                    <button onClick={handlePrint}
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0.5rem 0.9rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#475569', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                        <Printer size={15} /> 인쇄
                    </button>
                </div>
            </div>

            {/* 총액 요약 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <div style={{ background: 'linear-gradient(135deg,#4f46e5,#6366f1)', color: 'white', padding: '1.1rem 1.25rem', borderRadius: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', opacity: 0.9, marginBottom: '0.35rem' }}><Wallet size={16} /> 총 재고자산</div>
                    <div style={{ fontSize: '1.6rem', fontWeight: 800 }}>{won(grandTotal)}</div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.85, marginTop: '0.25rem' }}>{asOf} 기준</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1.1rem 1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.35rem' }}><Boxes size={16} /> 원재료 재고</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{won(matTotal)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>{materialRows.length}개 품목</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '1.1rem 1.25rem', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#64748b', marginBottom: '0.35rem' }}><Package size={16} /> 제품 재고</div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{won(prodTotal)}</div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.25rem' }}>{productRows.length}개 품목</div>
                </div>
            </div>

            {/* 안내 문구 */}
            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '10px', padding: '0.7rem 1rem', fontSize: '0.78rem', color: '#0369a1', lineHeight: 1.6, marginBottom: '1.25rem' }}>
                평가액 = 기준일 시점 재고수량 × 등록단가(제품/원재료 관리의 단가).&nbsp;
                <b>제품</b>은 입출고 기록으로 정확히 재구성됩니다.&nbsp;
                {isSnapshot
                    ? <><b>원재료</b>는 현재고 기준입니다.</>
                    : <><b>원재료</b>는 현재고에서 기준일 이후의 입고·소모를 되돌린 <b>추정치</b>입니다(수기 재고 수정·기초재고는 시점 추적이 안 되어 오차가 있을 수 있음).</>}
                {noPriceCount > 0 && <> · 단가 미등록 재고 {noPriceCount}건은 평가액 0원으로 집계됩니다.</>}
            </div>

            <Section title="원재료" icon={<Boxes size={18} color="#0d9488" />} rows={materialRows} subtotal={matTotal} estimated={!isSnapshot} />
            <Section title="제품" icon={<Package size={18} color="#4f46e5" />} rows={productRows} subtotal={prodTotal} estimated={false} />
        </div>
    );
};

export default InventoryValuation;
