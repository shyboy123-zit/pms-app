import React, { useState, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Calendar, BarChart3, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useData } from '../context/DataContext';

const Sales = () => {
    const { inventoryTransactions, salesRecords, products } = useData();

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    // 연도 옵션 생성
    const availableYears = useMemo(() => {
        const years = new Set();
        (inventoryTransactions || []).forEach(t => {
            const y = new Date(t.transaction_date).getFullYear();
            if (y) years.add(y);
        });
        (salesRecords || []).forEach(r => {
            const y = new Date(r.date).getFullYear();
            if (y) years.add(y);
        });
        years.add(new Date().getFullYear());
        return Array.from(years).sort((a, b) => b - a);
    }, [inventoryTransactions, salesRecords]);

    // 월별 데이터 계산 (입출고 기반)
    const monthlyData = useMemo(() => {
        const months = [];
        for (let m = 1; m <= 12; m++) {
            const monthKey = `${selectedYear}-${String(m).padStart(2, '0')}`;

            const monthTxs = (inventoryTransactions || []).filter(t =>
                (t.transaction_date || '').startsWith(monthKey)
            );

            const sales = monthTxs
                .filter(t => t.type === '출고')
                .reduce((sum, t) => sum + ((t.quantity || 0) * (t.unit_price || 0)), 0);

            const purchases = monthTxs
                .filter(t => t.type === '입고')
                .reduce((sum, t) => sum + ((t.quantity || 0) * (t.unit_price || 0)), 0);

            const salesCount = monthTxs.filter(t => t.type === '출고').length;
            const purchaseCount = monthTxs.filter(t => t.type === '입고').length;

            months.push({
                month: m,
                monthLabel: `${m}월`,
                sales,
                purchases,
                profit: sales - purchases,
                salesCount,
                purchaseCount,
                totalCount: salesCount + purchaseCount
            });
        }
        return months;
    }, [inventoryTransactions, selectedYear]);

    // 연간 합계
    const yearSummary = useMemo(() => {
        return monthlyData.reduce((acc, m) => ({
            totalSales: acc.totalSales + m.sales,
            totalPurchases: acc.totalPurchases + m.purchases,
            totalProfit: acc.totalProfit + m.profit,
            totalTransactions: acc.totalTransactions + m.totalCount
        }), { totalSales: 0, totalPurchases: 0, totalProfit: 0, totalTransactions: 0 });
    }, [monthlyData]);

    // 최대값 (차트용)
    const maxAmount = useMemo(() => {
        const max = Math.max(...monthlyData.map(m => Math.max(m.sales, m.purchases)));
        return max > 0 ? max : 1;
    }, [monthlyData]);

    // 전월 대비 증감
    const currentMonthIdx = new Date().getMonth();
    const currentMonthData = monthlyData[currentMonthIdx];
    const prevMonthData = currentMonthIdx > 0 ? monthlyData[currentMonthIdx - 1] : null;

    const salesChange = prevMonthData && prevMonthData.sales > 0
        ? ((currentMonthData.sales - prevMonthData.sales) / prevMonthData.sales * 100).toFixed(1)
        : null;

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">매입매출 분석</h2>
                    <p className="page-description">입출고 데이터를 기반으로 월별 마감금액을 분석합니다.</p>
                </div>
                <div className="year-selector">
                    <Calendar size={16} />
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}년</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 연간 요약 카드 */}
            <div className="summary-cards">
                <div className="summary-card sales">
                    <div className="card-icon"><TrendingUp size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">{selectedYear}년 총 매출</span>
                        <span className="card-value">₩{yearSummary.totalSales.toLocaleString()}</span>
                        {salesChange !== null && selectedYear === new Date().getFullYear() && (
                            <span className={`card-change ${Number(salesChange) >= 0 ? 'positive' : 'negative'}`}>
                                {Number(salesChange) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                전월 대비 {salesChange}%
                            </span>
                        )}
                    </div>
                </div>
                <div className="summary-card purchases">
                    <div className="card-icon purchase-icon"><TrendingDown size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">{selectedYear}년 총 매입</span>
                        <span className="card-value">₩{yearSummary.totalPurchases.toLocaleString()}</span>
                    </div>
                </div>
                <div className="summary-card profit">
                    <div className="card-icon profit-icon"><DollarSign size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">{selectedYear}년 순이익</span>
                        <span className="card-value" style={{ color: yearSummary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                            {yearSummary.totalProfit >= 0 ? '+' : ''}₩{yearSummary.totalProfit.toLocaleString()}
                        </span>
                    </div>
                </div>
                <div className="summary-card count">
                    <div className="card-icon count-icon"><BarChart3 size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">총 거래 건수</span>
                        <span className="card-value">{yearSummary.totalTransactions}건</span>
                    </div>
                </div>
            </div>

            {/* 월별 차트 */}
            <div className="glass-panel chart-section">
                <h3 className="section-title"><BarChart3 size={18} /> 월별 매입/매출 추이</h3>
                <div className="chart-container">
                    {monthlyData.map((m, i) => (
                        <div key={m.month} className={`chart-bar-group ${i === currentMonthIdx && selectedYear === new Date().getFullYear() ? 'current' : ''}`}>
                            <div className="bar-wrapper">
                                <div className="bar sales-bar" style={{ height: `${(m.sales / maxAmount) * 100}%` }}
                                    title={`매출: ₩${m.sales.toLocaleString()}`} />
                                <div className="bar purchase-bar" style={{ height: `${(m.purchases / maxAmount) * 100}%` }}
                                    title={`매입: ₩${m.purchases.toLocaleString()}`} />
                            </div>
                            <span className="bar-label">{m.monthLabel}</span>
                        </div>
                    ))}
                </div>
                <div className="chart-legend">
                    <span className="legend-item"><span className="legend-dot sales-dot"></span> 매출</span>
                    <span className="legend-item"><span className="legend-dot purchase-dot"></span> 매입</span>
                </div>
            </div>

            {/* 월별 마감 테이블 */}
            <div className="glass-panel table-section">
                <h3 className="section-title"><Calendar size={18} /> 월별 마감 금액</h3>
                <div className="closing-table-wrapper">
                    <table className="closing-table">
                        <thead>
                            <tr>
                                <th>월</th>
                                <th>매출</th>
                                <th>매입</th>
                                <th>순이익</th>
                                <th>이익률</th>
                                <th>거래건수</th>
                            </tr>
                        </thead>
                        <tbody>
                            {monthlyData.map(m => {
                                const profitRate = m.sales > 0 ? ((m.profit / m.sales) * 100) : 0;
                                const isCurrentMonth = m.month === (new Date().getMonth() + 1) && selectedYear === new Date().getFullYear();
                                return (
                                    <tr key={m.month} className={isCurrentMonth ? 'current-row' : ''}>
                                        <td className="month-cell">
                                            <strong>{m.monthLabel}</strong>
                                            {isCurrentMonth && <span className="current-badge">진행중</span>}
                                        </td>
                                        <td className="amount-cell sales-text">
                                            {m.sales > 0 ? `₩${m.sales.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="amount-cell purchase-text">
                                            {m.purchases > 0 ? `₩${m.purchases.toLocaleString()}` : '-'}
                                        </td>
                                        <td className="amount-cell">
                                            <span style={{ color: m.profit >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                {m.profit !== 0 ? `${m.profit >= 0 ? '+' : ''}₩${m.profit.toLocaleString()}` : '-'}
                                            </span>
                                        </td>
                                        <td className="rate-cell">
                                            {m.sales > 0 ? (
                                                <span className={`rate-badge ${profitRate >= 0 ? 'positive' : 'negative'}`}>
                                                    {profitRate.toFixed(1)}%
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="count-cell">{m.totalCount > 0 ? `${m.totalCount}건` : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="total-row">
                                <td><strong>합계</strong></td>
                                <td className="amount-cell sales-text"><strong>₩{yearSummary.totalSales.toLocaleString()}</strong></td>
                                <td className="amount-cell purchase-text"><strong>₩{yearSummary.totalPurchases.toLocaleString()}</strong></td>
                                <td className="amount-cell">
                                    <strong style={{ color: yearSummary.totalProfit >= 0 ? '#10b981' : '#ef4444' }}>
                                        {yearSummary.totalProfit >= 0 ? '+' : ''}₩{yearSummary.totalProfit.toLocaleString()}
                                    </strong>
                                </td>
                                <td className="rate-cell">
                                    {yearSummary.totalSales > 0 ? (
                                        <strong>{((yearSummary.totalProfit / yearSummary.totalSales) * 100).toFixed(1)}%</strong>
                                    ) : '-'}
                                </td>
                                <td className="count-cell"><strong>{yearSummary.totalTransactions}건</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <style>{`
                .page-container { padding: 0 1.5rem; max-width: 1600px; margin: 0 auto; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px solid var(--border); }
                .page-subtitle { font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem; background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
                .page-description { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; }

                .year-selector { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: white; border: 2px solid #e2e8f0; border-radius: 10px; }
                .year-selector select { border: none; outline: none; font-weight: 700; font-size: 0.95rem; background: transparent; cursor: pointer; }

                /* 요약 카드 */
                .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
                .summary-card { padding: 1.25rem; border-radius: 14px; display: flex; align-items: center; gap: 1rem; transition: all 0.2s; }
                .summary-card.sales { background: linear-gradient(135deg, #ecfdf5, #d1fae5); border: 1px solid #a7f3d0; }
                .summary-card.purchases { background: linear-gradient(135deg, #eff6ff, #dbeafe); border: 1px solid #93c5fd; }
                .summary-card.profit { background: linear-gradient(135deg, #fefce8, #fef3c7); border: 1px solid #fde68a; }
                .summary-card.count { background: linear-gradient(135deg, #f5f3ff, #ede9fe); border: 1px solid #c4b5fd; }
                .card-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #10b981, #059669); color: white; flex-shrink: 0; }
                .purchase-icon { background: linear-gradient(135deg, #3b82f6, #2563eb) !important; }
                .profit-icon { background: linear-gradient(135deg, #f59e0b, #d97706) !important; }
                .count-icon { background: linear-gradient(135deg, #7c3aed, #6d28d9) !important; }
                .card-body { display: flex; flex-direction: column; }
                .card-label { font-size: 0.78rem; color: #64748b; font-weight: 600; }
                .card-value { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin-top: 2px; }
                .card-change { font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; gap: 2px; margin-top: 4px; }
                .card-change.positive { color: #10b981; }
                .card-change.negative { color: #ef4444; }

                /* 차트 */
                .chart-section { padding: 1.5rem; margin-bottom: 1.5rem; }
                .section-title { font-size: 1rem; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px; margin-bottom: 1.25rem; }
                .chart-container { display: flex; gap: 6px; height: 180px; align-items: flex-end; padding: 0 4px; }
                .chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
                .chart-bar-group.current .bar-label { color: #4f46e5; font-weight: 800; }
                .bar-wrapper { display: flex; gap: 3px; height: 160px; align-items: flex-end; width: 100%; justify-content: center; }
                .bar { width: 45%; min-height: 2px; border-radius: 4px 4px 0 0; transition: height 0.5s ease; cursor: pointer; }
                .bar:hover { opacity: 0.8; }
                .sales-bar { background: linear-gradient(to top, #10b981, #34d399); }
                .purchase-bar { background: linear-gradient(to top, #3b82f6, #60a5fa); }
                .bar-label { font-size: 0.72rem; color: #94a3b8; font-weight: 600; }
                .chart-legend { display: flex; gap: 1.5rem; justify-content: center; margin-top: 1rem; }
                .legend-item { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: #64748b; font-weight: 600; }
                .legend-dot { width: 10px; height: 10px; border-radius: 3px; }
                .sales-dot { background: #10b981; }
                .purchase-dot { background: #3b82f6; }

                /* 마감 테이블 */
                .table-section { padding: 1.5rem; }
                .closing-table-wrapper { overflow-x: auto; }
                .closing-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
                .closing-table th { padding: 10px 14px; text-align: left; font-weight: 700; font-size: 0.8rem; color: #64748b; background: #f8fafc; border-bottom: 2px solid #e2e8f0; text-transform: uppercase; letter-spacing: 0.5px; }
                .closing-table td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; }
                .closing-table tbody tr:hover { background: #fafbff; }
                .current-row { background: #f5f3ff !important; }
                .current-row:hover { background: #ede9fe !important; }
                .month-cell { font-weight: 600; color: #1e293b; display: flex; align-items: center; gap: 8px; }
                .current-badge { padding: 2px 8px; border-radius: 10px; font-size: 0.65rem; font-weight: 700; background: #4f46e5; color: white; }
                .amount-cell { font-weight: 600; font-variant-numeric: tabular-nums; }
                .sales-text { color: #059669; }
                .purchase-text { color: #2563eb; }
                .rate-cell { text-align: center; }
                .rate-badge { padding: 2px 8px; border-radius: 8px; font-size: 0.78rem; font-weight: 700; }
                .rate-badge.positive { background: #ecfdf5; color: #059669; }
                .rate-badge.negative { background: #fef2f2; color: #dc2626; }
                .count-cell { text-align: center; color: #64748b; }
                .total-row { background: #f8fafc; border-top: 2px solid #e2e8f0; }
                .total-row td { padding: 14px; }

                @media (max-width: 768px) {
                    .summary-cards { grid-template-columns: repeat(2, 1fr); }
                    .chart-container { height: 140px; }
                    .card-value { font-size: 1rem; }
                }
                @media (max-width: 480px) {
                    .summary-cards { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
};

export default Sales;
