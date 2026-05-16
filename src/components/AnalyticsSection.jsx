import React, { useMemo } from 'react';
import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import { TrendingUp, RefreshCw, AlertCircle } from 'lucide-react';
import { useData } from '../context/DataContext';

/**
 * Dashboard 분석 섹션
 * - 30일 매출/매입 추이 (라인차트)
 * - 30일 재고 변동 (바차트, 입고/출고)
 * - 제품별 재고 회전율 Top 5
 */
const AnalyticsSection = () => {
    const { vouchers, inventoryTransactions, products } = useData();

    // 최근 30일 날짜 배열 (오늘 포함, 과거 → 현재 순)
    const last30Days = useMemo(() => {
        const days = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    }, []);

    // ── 30일 매출/매입 추이 (vouchers 기반) ──
    const salesPurchaseData = useMemo(() => {
        return last30Days.map(date => {
            const dayVouchers = (vouchers || []).filter(v => v.voucher_date === date);
            const sales = dayVouchers.filter(v => v.voucher_type === '매출').reduce((s, v) => s + ((v.quantity || 0) * (v.unit_price || 0)), 0);
            const purchases = dayVouchers.filter(v => v.voucher_type === '매입').reduce((s, v) => s + ((v.quantity || 0) * (v.unit_price || 0)), 0);
            return {
                date: date.slice(5),  // MM-DD
                매출: Math.round(sales / 1000),    // 천원 단위
                매입: Math.round(purchases / 1000),
                이익: Math.round((sales - purchases) / 1000)
            };
        });
    }, [vouchers, last30Days]);

    // ── 30일 입고/출고 (inventory_transactions 기반) ──
    const inventoryFlowData = useMemo(() => {
        return last30Days.map(date => {
            const dayTx = (inventoryTransactions || []).filter(t => t.transaction_date === date);
            const inQty = dayTx.filter(t => t.transaction_type === 'IN').reduce((s, t) => s + parseFloat(t.quantity || 0), 0);
            const outQty = dayTx.filter(t => t.transaction_type === 'OUT').reduce((s, t) => s + parseFloat(t.quantity || 0), 0);
            return {
                date: date.slice(5),
                입고: inQty,
                출고: outQty
            };
        });
    }, [inventoryTransactions, last30Days]);

    // ── 30일 합계 (요약 카드) ──
    const periodSummary = useMemo(() => {
        const totalSales = salesPurchaseData.reduce((s, d) => s + d.매출, 0) * 1000;
        const totalPurchases = salesPurchaseData.reduce((s, d) => s + d.매입, 0) * 1000;
        const totalIn = inventoryFlowData.reduce((s, d) => s + d.입고, 0);
        const totalOut = inventoryFlowData.reduce((s, d) => s + d.출고, 0);
        return { totalSales, totalPurchases, totalIn, totalOut };
    }, [salesPurchaseData, inventoryFlowData]);

    // ── 제품별 재고 회전율 Top 5 ──
    // 회전율 = 최근 30일 출고량 / 평균재고 (값이 클수록 잘 팔리는 제품)
    const turnoverTop5 = useMemo(() => {
        const productStock = {};

        // 누적 재고 계산 (item_code 우선, fallback item_name)
        (inventoryTransactions || []).forEach(t => {
            const key = t.item_code || t.item_name;
            if (!key) return;
            if (!productStock[key]) {
                productStock[key] = {
                    key,
                    itemName: t.item_name,
                    itemCode: t.item_code,
                    currentStock: 0,
                    out30d: 0,
                    in30d: 0
                };
            }
            const qty = parseFloat(t.quantity || 0);
            if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') {
                productStock[key].currentStock += qty;
            } else if (t.transaction_type === 'OUT') {
                productStock[key].currentStock -= qty;
            }
            // 30일 출고/입고만 별도 집계
            if (last30Days.includes(t.transaction_date)) {
                if (t.transaction_type === 'OUT') productStock[key].out30d += qty;
                else if (t.transaction_type === 'IN') productStock[key].in30d += qty;
            }
        });

        // 회전율 계산: 30일 출고 / 평균재고 (평균재고는 (현재 + 30일전) / 2 로 근사)
        const items = Object.values(productStock)
            .map(p => {
                const stock30dAgo = p.currentStock + p.out30d - p.in30d;  // 30일 전 재고
                const avgStock = Math.max((p.currentStock + stock30dAgo) / 2, 1);
                const turnover = p.out30d / avgStock;
                return { ...p, avgStock, turnover, daysOfStock: p.out30d > 0 ? Math.round((p.currentStock / p.out30d) * 30) : Infinity };
            })
            .filter(p => p.out30d > 0)
            .sort((a, b) => b.turnover - a.turnover)
            .slice(0, 5);

        return items;
    }, [inventoryTransactions, last30Days]);

    // ── 장기 재고 (출고 없음 30일+) Top 5 ──
    const staleStockTop5 = useMemo(() => {
        const productStock = {};
        (inventoryTransactions || []).forEach(t => {
            const key = t.item_code || t.item_name;
            if (!key) return;
            if (!productStock[key]) {
                productStock[key] = { key, itemName: t.item_name, itemCode: t.item_code, currentStock: 0, lastOutDate: null };
            }
            const qty = parseFloat(t.quantity || 0);
            if (t.transaction_type === 'IN' || t.transaction_type === 'ADJUST') productStock[key].currentStock += qty;
            else if (t.transaction_type === 'OUT') {
                productStock[key].currentStock -= qty;
                if (!productStock[key].lastOutDate || t.transaction_date > productStock[key].lastOutDate) {
                    productStock[key].lastOutDate = t.transaction_date;
                }
            }
        });

        const today = new Date();
        return Object.values(productStock)
            .filter(p => p.currentStock > 0)
            .map(p => {
                const daysSinceLastOut = p.lastOutDate
                    ? Math.floor((today - new Date(p.lastOutDate)) / (1000 * 60 * 60 * 24))
                    : 999;
                return { ...p, daysSinceLastOut };
            })
            .sort((a, b) => b.daysSinceLastOut - a.daysSinceLastOut)
            .slice(0, 5);
    }, [inventoryTransactions]);

    const formatCurrency = (val) => `₩${(val * 1000).toLocaleString()}`;
    const formatNumber = (val) => val.toLocaleString();

    return (
        <div className="analytics-section">
            <div className="section-header">
                <h2><TrendingUp size={20} /> 30일 추이 분석</h2>
                <span className="period-label">최근 30일 데이터 기준</span>
            </div>

            {/* 요약 카드 4개 */}
            <div className="summary-grid">
                <div className="summary-card sales-card">
                    <div className="card-label">매출 합계</div>
                    <div className="card-value">₩{periodSummary.totalSales.toLocaleString()}</div>
                </div>
                <div className="summary-card purchase-card">
                    <div className="card-label">매입 합계</div>
                    <div className="card-value">₩{periodSummary.totalPurchases.toLocaleString()}</div>
                </div>
                <div className="summary-card in-card">
                    <div className="card-label">총 입고</div>
                    <div className="card-value">{periodSummary.totalIn.toLocaleString()}</div>
                </div>
                <div className="summary-card out-card">
                    <div className="card-label">총 출고</div>
                    <div className="card-value">{periodSummary.totalOut.toLocaleString()}</div>
                </div>
            </div>

            {/* 매출/매입 추이 라인 차트 */}
            <div className="chart-card">
                <h3 className="chart-title">매출 · 매입 추이 (단위: 천원)</h3>
                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={salesPurchaseData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
                        <YAxis fontSize={11} stroke="#64748b" />
                        <Tooltip
                            formatter={(value) => `₩${(value * 1000).toLocaleString()}`}
                            labelStyle={{ color: 'var(--text-main)' }}
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-main)' }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="매출" stroke="#059669" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="매입" stroke="#2563eb" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="이익" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* 입출고 바 차트 */}
            <div className="chart-card">
                <h3 className="chart-title">입고 · 출고 수량 추이</h3>
                <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={inventoryFlowData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" fontSize={11} stroke="#64748b" />
                        <YAxis fontSize={11} stroke="#64748b" />
                        <Tooltip
                            formatter={(value) => value.toLocaleString()}
                            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-main)' }}
                        />
                        <Legend />
                        <Bar dataKey="입고" fill="#3b82f6" />
                        <Bar dataKey="출고" fill="#ef4444" />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* 재고 회전율 Top 5 + 장기재고 Top 5 */}
            <div className="turnover-grid">
                <div className="chart-card">
                    <h3 className="chart-title"><RefreshCw size={16} style={{ verticalAlign: 'middle' }} /> 재고 회전율 Top 5</h3>
                    <p className="chart-subtitle">최근 30일 출고량 ÷ 평균재고 — 값이 클수록 회전이 빠른 제품</p>
                    {turnoverTop5.length > 0 ? (
                        <table className="mini-table">
                            <thead>
                                <tr>
                                    <th>품목</th>
                                    <th>30일 출고</th>
                                    <th>현재 재고</th>
                                    <th>회전율</th>
                                    <th>재고일수</th>
                                </tr>
                            </thead>
                            <tbody>
                                {turnoverTop5.map((p, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className="item-name">{p.itemName}</div>
                                            {p.itemCode && <div className="item-code">{p.itemCode}</div>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{formatNumber(p.out30d)}</td>
                                        <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(p.currentStock))}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669' }}>
                                            {p.turnover.toFixed(2)}회
                                        </td>
                                        <td style={{ textAlign: 'right', color: '#64748b' }}>
                                            {p.daysOfStock === Infinity ? '∞' : `${p.daysOfStock}일`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-msg">최근 30일 출고 데이터가 없습니다.</div>
                    )}
                </div>

                <div className="chart-card">
                    <h3 className="chart-title"><AlertCircle size={16} style={{ verticalAlign: 'middle', color: '#f59e0b' }} /> 장기 재고 Top 5</h3>
                    <p className="chart-subtitle">출고 없이 오래 묶여있는 재고 — 처분 검토 대상</p>
                    {staleStockTop5.length > 0 ? (
                        <table className="mini-table">
                            <thead>
                                <tr>
                                    <th>품목</th>
                                    <th>현재 재고</th>
                                    <th>마지막 출고</th>
                                    <th>경과일</th>
                                </tr>
                            </thead>
                            <tbody>
                                {staleStockTop5.map((p, i) => (
                                    <tr key={i}>
                                        <td>
                                            <div className="item-name">{p.itemName}</div>
                                            {p.itemCode && <div className="item-code">{p.itemCode}</div>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>{formatNumber(Math.round(p.currentStock))}</td>
                                        <td style={{ textAlign: 'right', color: '#64748b', fontSize: '0.85rem' }}>
                                            {p.lastOutDate || '없음'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: p.daysSinceLastOut > 90 ? '#dc2626' : p.daysSinceLastOut > 30 ? '#f59e0b' : '#64748b' }}>
                                            {p.daysSinceLastOut >= 999 ? '출고이력없음' : `${p.daysSinceLastOut}일`}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="empty-msg">재고 데이터가 없습니다.</div>
                    )}
                </div>
            </div>

            <style>{`
                .analytics-section { margin-top: 2rem; padding: 0 1rem; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
                .section-header h2 { display: flex; align-items: center; gap: 0.5rem; font-size: 1.15rem; font-weight: 700; color: var(--text-main); margin: 0; letter-spacing: -0.01em; }
                .period-label { font-size: 0.8rem; color: var(--text-subtle); }

                .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
                .summary-card { background: var(--bg-card); padding: 1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border-left: 4px solid; border-top: 1px solid var(--border); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border); }
                .summary-card.sales-card { border-left-color: var(--success); }
                .summary-card.purchase-card { border-left-color: var(--info); }
                .summary-card.in-card { border-left-color: var(--primary); }
                .summary-card.out-card { border-left-color: var(--danger); }
                .card-label { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem; }
                .card-value { font-size: 1.25rem; font-weight: 700; color: var(--text-main); letter-spacing: -0.01em; }

                .chart-card { background: var(--bg-card); padding: 1.25rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border); margin-bottom: 1rem; }
                .chart-title { font-size: 0.95rem; font-weight: 700; color: var(--text-main); margin: 0 0 0.25rem; }
                .chart-subtitle { font-size: 0.75rem; color: var(--text-subtle); margin: 0 0 0.75rem; }

                .turnover-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1rem; }
                .mini-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                .mini-table th { text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--border); font-weight: 600; color: var(--text-muted); font-size: 0.78rem; }
                .mini-table th:not(:first-child) { text-align: right; }
                .mini-table td { padding: 0.6rem 0.5rem; border-bottom: 1px solid var(--border); color: var(--text-main); }
                .item-name { font-weight: 600; color: var(--text-main); }
                .item-code { font-size: 0.7rem; color: var(--text-subtle); }
                .empty-msg { padding: 2rem; text-align: center; color: var(--text-subtle); font-size: 0.9rem; }

                @media (max-width: 768px) {
                    .turnover-grid { grid-template-columns: 1fr; }
                    .summary-grid { grid-template-columns: 1fr 1fr; }
                    .card-value { font-size: 1.05rem; }
                }
            `}</style>
        </div>
    );
};

export default AnalyticsSection;
