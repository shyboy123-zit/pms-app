import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, X, FileText, Calendar } from 'lucide-react';
import { useData } from '../context/DataContext';

/**
 * 월말 결산 보고서 모달
 * - 월 선택 → 그달의 매출/매입/순이익, 거래처별 잔액, 입출고 통계, 미결제 잔액
 * - "PDF 다운로드" 버튼 클릭 시 html2canvas로 캡처 → jsPDF로 저장
 */
const MonthlyReportModal = ({ isOpen, onClose }) => {
    const { vouchers, inventoryTransactions, materials, products } = useData();
    const reportRef = useRef(null);

    const [targetMonth, setTargetMonth] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [isGenerating, setIsGenerating] = useState(false);

    // 상태/계산
    const getOutstanding = (v) => {
        const paid = parseFloat(v.paid_amount || 0);
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        return Math.max(0, total - paid);
    };

    const reportData = useMemo(() => {
        const monthVouchers = (vouchers || []).filter(v => (v.voucher_date || '').startsWith(targetMonth));
        const monthTx = (inventoryTransactions || []).filter(t => (t.transaction_date || '').startsWith(targetMonth));

        // 매출/매입
        const salesVouchers = monthVouchers.filter(v => v.voucher_type === '매출');
        const purchaseVouchers = monthVouchers.filter(v => v.voucher_type === '매입');
        const totalSales = salesVouchers.reduce((s, v) => s + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);
        const totalPurchases = purchaseVouchers.reduce((s, v) => s + parseFloat(v.total_amount || v.quantity * v.unit_price || 0), 0);

        // 결제 현황
        const salesPaid = salesVouchers.reduce((s, v) => s + parseFloat(v.paid_amount || 0), 0);
        const purchasePaid = purchaseVouchers.reduce((s, v) => s + parseFloat(v.paid_amount || 0), 0);
        const salesOutstanding = totalSales - salesPaid;
        const purchaseOutstanding = totalPurchases - purchasePaid;

        // 거래처별 매출/매입
        const clientStats = {};
        monthVouchers.forEach(v => {
            const key = v.client || '(거래처 미지정)';
            if (!clientStats[key]) clientStats[key] = { client: key, sales: 0, purchases: 0, salesOutstanding: 0, purchaseOutstanding: 0 };
            const amount = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
            const outstanding = getOutstanding(v);
            if (v.voucher_type === '매출') {
                clientStats[key].sales += amount;
                clientStats[key].salesOutstanding += outstanding;
            } else if (v.voucher_type === '매입') {
                clientStats[key].purchases += amount;
                clientStats[key].purchaseOutstanding += outstanding;
            }
        });
        const clientArr = Object.values(clientStats).sort((a, b) => (b.sales + b.purchases) - (a.sales + a.purchases));

        // 입출고 수량
        const totalIn = monthTx.filter(t => t.transaction_type === 'IN').reduce((s, t) => s + parseFloat(t.quantity || 0), 0);
        const totalOut = monthTx.filter(t => t.transaction_type === 'OUT').reduce((s, t) => s + parseFloat(t.quantity || 0), 0);
        const totalAdjust = monthTx.filter(t => t.transaction_type === 'ADJUST').reduce((s, t) => s + parseFloat(t.quantity || 0), 0);

        // 재고 회전율 Top 5 (그 달 출고량 기준)
        const productSold = {};
        monthTx.filter(t => t.transaction_type === 'OUT').forEach(t => {
            const key = t.item_code || t.item_name;
            if (!productSold[key]) productSold[key] = { itemName: t.item_name, itemCode: t.item_code, qty: 0, amount: 0 };
            productSold[key].qty += parseFloat(t.quantity || 0);
            productSold[key].amount += parseFloat(t.total_amount || t.quantity * t.unit_price || 0);
        });
        const topProducts = Object.values(productSold).sort((a, b) => b.amount - a.amount).slice(0, 5);

        // 안전재고 미달 원재료
        const lowStock = (materials || []).filter(m => m.min_stock > 0 && parseFloat(m.stock || 0) < parseFloat(m.min_stock));

        return {
            targetMonth,
            totalSales, totalPurchases, profit: totalSales - totalPurchases,
            salesPaid, purchasePaid, salesOutstanding, purchaseOutstanding,
            salesCount: salesVouchers.length, purchaseCount: purchaseVouchers.length,
            totalIn, totalOut, totalAdjust,
            txCount: monthTx.length,
            clientArr, topProducts, lowStock
        };
    }, [vouchers, inventoryTransactions, materials, targetMonth]);

    const handleDownloadPDF = async () => {
        if (!reportRef.current) return;
        setIsGenerating(true);
        try {
            // 캡처 전 약간 대기 (렌더 안정화)
            await new Promise(r => setTimeout(r, 200));
            const canvas = await html2canvas(reportRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff'
            });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgWidth = pdfWidth;
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            // 페이지 넘김 처리
            if (imgHeight <= pdfHeight) {
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            } else {
                let yOffset = 0;
                while (yOffset < imgHeight) {
                    if (yOffset > 0) pdf.addPage();
                    pdf.addImage(imgData, 'PNG', 0, -yOffset, imgWidth, imgHeight);
                    yOffset += pdfHeight;
                }
            }

            pdf.save(`월말결산_${targetMonth}.pdf`);
        } catch (err) {
            console.error('PDF 생성 실패:', err);
            alert('PDF 생성에 실패했습니다.');
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isOpen) return null;

    const f = (n) => `₩${Math.round(n).toLocaleString()}`;
    const fNum = (n) => Math.round(n).toLocaleString();

    return (
        <div className="report-modal-overlay" onClick={onClose}>
            <div className="report-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* 헤더 (PDF에 포함 안 됨) */}
                <div className="report-modal-header">
                    <h2><FileText size={20} /> 월말 결산 보고서</h2>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <Calendar size={16} color="#64748b" />
                        <input
                            type="month"
                            className="month-input"
                            value={targetMonth}
                            onChange={(e) => setTargetMonth(e.target.value)}
                        />
                        <button className="download-btn" onClick={handleDownloadPDF} disabled={isGenerating}>
                            <Download size={16} /> {isGenerating ? '생성 중...' : 'PDF 다운로드'}
                        </button>
                        <button className="close-btn" onClick={onClose}><X size={20} /></button>
                    </div>
                </div>

                {/* PDF 캡처 영역 */}
                <div className="report-scroll">
                    <div ref={reportRef} className="report-content">
                        <div className="report-title">
                            <h1>월말 결산 보고서</h1>
                            <div className="report-period">{targetMonth.replace('-', '년 ')}월</div>
                            <div className="report-generated">생성일: {new Date().toLocaleString('ko-KR')}</div>
                        </div>

                        {/* 1. 매출/매입 요약 */}
                        <section className="report-section">
                            <h2>1. 매출 · 매입 요약</h2>
                            <table className="report-table">
                                <thead>
                                    <tr>
                                        <th>구분</th>
                                        <th style={{ textAlign: 'right' }}>건수</th>
                                        <th style={{ textAlign: 'right' }}>총액</th>
                                        <th style={{ textAlign: 'right' }}>결제완료액</th>
                                        <th style={{ textAlign: 'right' }}>미결제 잔액</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>매출 (받을)</td>
                                        <td style={{ textAlign: 'right' }}>{reportData.salesCount}건</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{f(reportData.totalSales)}</td>
                                        <td style={{ textAlign: 'right', color: '#059669' }}>{f(reportData.salesPaid)}</td>
                                        <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{f(reportData.salesOutstanding)}</td>
                                    </tr>
                                    <tr>
                                        <td>매입 (지급)</td>
                                        <td style={{ textAlign: 'right' }}>{reportData.purchaseCount}건</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{f(reportData.totalPurchases)}</td>
                                        <td style={{ textAlign: 'right', color: '#059669' }}>{f(reportData.purchasePaid)}</td>
                                        <td style={{ textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>{f(reportData.purchaseOutstanding)}</td>
                                    </tr>
                                    <tr className="row-summary">
                                        <td><strong>순이익</strong></td>
                                        <td colSpan={3} style={{ textAlign: 'right' }}>
                                            매출 - 매입 = {f(reportData.totalSales)} - {f(reportData.totalPurchases)}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 800, color: reportData.profit >= 0 ? '#059669' : '#dc2626' }}>
                                            {reportData.profit >= 0 ? '+' : ''}{f(reportData.profit)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        {/* 2. 입출고 통계 */}
                        <section className="report-section">
                            <h2>2. 입출고 통계</h2>
                            <div className="stats-grid">
                                <div className="stat-box"><span>총 거래 건수</span><strong>{reportData.txCount}건</strong></div>
                                <div className="stat-box"><span>입고 수량</span><strong>{fNum(reportData.totalIn)}</strong></div>
                                <div className="stat-box"><span>출고 수량</span><strong>{fNum(reportData.totalOut)}</strong></div>
                                <div className="stat-box"><span>재고 조정</span><strong>{reportData.totalAdjust >= 0 ? '+' : ''}{fNum(reportData.totalAdjust)}</strong></div>
                            </div>
                        </section>

                        {/* 3. 거래처별 매출/매입 */}
                        <section className="report-section">
                            <h2>3. 거래처별 매출 · 매입 ({reportData.clientArr.length}개 거래처)</h2>
                            {reportData.clientArr.length > 0 ? (
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>거래처</th>
                                            <th style={{ textAlign: 'right' }}>매출액</th>
                                            <th style={{ textAlign: 'right' }}>매출 미수금</th>
                                            <th style={{ textAlign: 'right' }}>매입액</th>
                                            <th style={{ textAlign: 'right' }}>매입 미지급</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.clientArr.slice(0, 20).map((c, i) => (
                                            <tr key={i}>
                                                <td><strong>{c.client}</strong></td>
                                                <td style={{ textAlign: 'right' }}>{f(c.sales)}</td>
                                                <td style={{ textAlign: 'right', color: c.salesOutstanding > 0 ? '#dc2626' : '#94a3b8' }}>{f(c.salesOutstanding)}</td>
                                                <td style={{ textAlign: 'right' }}>{f(c.purchases)}</td>
                                                <td style={{ textAlign: 'right', color: c.purchaseOutstanding > 0 ? '#2563eb' : '#94a3b8' }}>{f(c.purchaseOutstanding)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p className="empty">거래처 데이터가 없습니다.</p>}
                        </section>

                        {/* 4. 매출 Top 5 제품 */}
                        <section className="report-section">
                            <h2>4. 매출 상위 5개 제품</h2>
                            {reportData.topProducts.length > 0 ? (
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>순위</th>
                                            <th>제품</th>
                                            <th style={{ textAlign: 'right' }}>판매 수량</th>
                                            <th style={{ textAlign: 'right' }}>매출액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.topProducts.map((p, i) => (
                                            <tr key={i}>
                                                <td>{i + 1}</td>
                                                <td><strong>{p.itemName}</strong>{p.itemCode && ` (${p.itemCode})`}</td>
                                                <td style={{ textAlign: 'right' }}>{fNum(p.qty)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>{f(p.amount)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : <p className="empty">출고 데이터가 없습니다.</p>}
                        </section>

                        {/* 5. 안전재고 미달 원재료 */}
                        {reportData.lowStock.length > 0 && (
                            <section className="report-section">
                                <h2>5. 안전재고 미달 원재료 ({reportData.lowStock.length}건)</h2>
                                <table className="report-table">
                                    <thead>
                                        <tr>
                                            <th>원재료명</th>
                                            <th style={{ textAlign: 'right' }}>현재 재고</th>
                                            <th style={{ textAlign: 'right' }}>안전 재고</th>
                                            <th style={{ textAlign: 'right' }}>부족분</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportData.lowStock.map((m, i) => (
                                            <tr key={i}>
                                                <td><strong>{m.name}</strong></td>
                                                <td style={{ textAlign: 'right' }}>{fNum(m.stock)} {m.unit}</td>
                                                <td style={{ textAlign: 'right' }}>{fNum(m.min_stock)} {m.unit}</td>
                                                <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                                                    -{fNum(m.min_stock - m.stock)} {m.unit}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </section>
                        )}

                        <div className="report-footer">
                            <em>본 보고서는 PMS-APP에 의해 자동 생성되었습니다.</em>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .report-modal-overlay { position: fixed; inset: 0; background: var(--bg-overlay); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(4px); }
                .report-modal-container { background: var(--bg-card); color: var(--text-main); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 100%; max-width: 900px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: var(--shadow-xl); }
                .report-modal-header { padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; background: var(--bg-card); }
                .report-modal-header h2 { margin: 0; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); }
                .month-input { padding: 0.45rem 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.9rem; background: var(--bg-elevated); color: var(--text-main); }
                .download-btn { display: flex; align-items: center; gap: 6px; background: var(--success); color: white; padding: 0.5rem 1rem; border: none; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all var(--transition-base); }
                .download-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: var(--shadow-md); }
                .download-btn:disabled { opacity: 0.5; cursor: wait; }
                .close-btn { background: transparent; border: none; cursor: pointer; padding: 0.25rem; color: var(--text-muted); }

                /* 보고서 본문은 PDF 인쇄용이므로 항상 흰 배경 + 검은 텍스트 (다크모드와 무관) */
                .report-scroll { overflow-y: auto; flex: 1; background: var(--bg-subtle); padding: 1.5rem; }
                .report-content { background: #ffffff; color: #0b1729; padding: 2rem; max-width: 800px; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.08); border-radius: 6px; }
                .report-content * { color: inherit; }
                .report-content strong { color: #0b1729; }

                .report-title { text-align: center; padding-bottom: 1.25rem; border-bottom: 3px solid #4f46e5; margin-bottom: 1.5rem; }
                .report-title h1 { margin: 0; font-size: 1.75rem; color: #1e293b; }
                .report-period { font-size: 1.1rem; color: #4f46e5; font-weight: 700; margin-top: 0.5rem; }
                .report-generated { font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem; }

                .report-section { margin-bottom: 1.75rem; }
                .report-section h2 { font-size: 1.05rem; color: #1e293b; border-left: 4px solid #4f46e5; padding-left: 0.75rem; margin-bottom: 0.75rem; }

                .report-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .report-table th { background: #f8fafc; padding: 0.55rem 0.65rem; text-align: left; border-bottom: 2px solid #e2e8f0; font-weight: 700; color: #475569; }
                .report-table td { padding: 0.55rem 0.65rem; border-bottom: 1px solid #f1f5f9; }
                .row-summary { background: #fef3c7; }
                .row-summary td { padding: 0.7rem 0.65rem; border-top: 2px solid #f59e0b; }

                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; }
                .stat-box { background: #f8fafc; padding: 0.85rem 1rem; border-radius: 8px; display: flex; flex-direction: column; gap: 4px; border-left: 3px solid #4f46e5; }
                .stat-box span { font-size: 0.75rem; color: #64748b; }
                .stat-box strong { font-size: 1.1rem; color: #1e293b; }

                .empty { color: #94a3b8; padding: 0.75rem; }
                .report-footer { text-align: center; padding-top: 1.5rem; border-top: 1px dashed #e2e8f0; margin-top: 2rem; font-size: 0.8rem; color: #94a3b8; }
            `}</style>
        </div>
    );
};

export default MonthlyReportModal;
