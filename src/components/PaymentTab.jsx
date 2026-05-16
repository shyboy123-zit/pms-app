import React, { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import Modal from './Modal';
import { Wallet, AlertCircle, CheckCircle2, DollarSign, X, Calendar } from 'lucide-react';

/**
 * 결제 관리 탭
 * - 미수금 (매출 전표 중 결제 안 끝난 것)
 * - 미지급금 (매입 전표 중 결제 안 끝난 것)
 * - 거래처별 잔액 요약
 * - 결제 입력 모달 (paid_amount, paid_date, payment_notes)
 */
const PaymentTab = () => {
    const { vouchers, updateVoucher } = useData();

    const [filter, setFilter] = useState('receivable'); // 'receivable'(미수금) | 'payable'(미지급)
    const [clientFilter, setClientFilter] = useState('all');
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [editingVoucher, setEditingVoucher] = useState(null);
    const [paymentForm, setPaymentForm] = useState({
        paid_amount: 0,
        paid_date: new Date().toISOString().split('T')[0],
        payment_notes: ''
    });

    // payment_status가 없는 옛 데이터(컬럼 추가 전)는 paid_amount/total_amount로 계산
    const getPaymentStatus = (v) => {
        if (v.payment_status) return v.payment_status;
        const paid = parseFloat(v.paid_amount || 0);
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        if (paid === 0) return '미결제';
        if (paid >= total) return '결제완료';
        return '부분결제';
    };

    const getOutstanding = (v) => {
        const paid = parseFloat(v.paid_amount || 0);
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        return Math.max(0, total - paid);
    };

    // 필터링: 미수금(매출+미결제/부분결제) / 미지급(매입+미결제/부분결제)
    const filteredVouchers = useMemo(() => {
        return (vouchers || []).filter(v => {
            const status = getPaymentStatus(v);
            if (status === '결제완료') return false;
            if (filter === 'receivable' && v.voucher_type !== '매출') return false;
            if (filter === 'payable' && v.voucher_type !== '매입') return false;
            if (clientFilter !== 'all' && (v.client || '미지정') !== clientFilter) return false;
            return true;
        }).sort((a, b) => (a.voucher_date < b.voucher_date ? 1 : -1));
    }, [vouchers, filter, clientFilter]);

    // 거래처별 잔액 집계
    const clientBalances = useMemo(() => {
        const balances = {};
        (vouchers || []).forEach(v => {
            const status = getPaymentStatus(v);
            if (status === '결제완료') return;
            const isReceivable = v.voucher_type === '매출';
            const isPayable = v.voucher_type === '매입';
            if (!isReceivable && !isPayable) return;
            const key = v.client || '(거래처 미지정)';
            if (!balances[key]) {
                balances[key] = { client: key, receivable: 0, payable: 0, receivableCount: 0, payableCount: 0 };
            }
            const outstanding = getOutstanding(v);
            if (isReceivable) {
                balances[key].receivable += outstanding;
                balances[key].receivableCount += 1;
            } else {
                balances[key].payable += outstanding;
                balances[key].payableCount += 1;
            }
        });
        return Object.values(balances)
            .filter(b => b.receivable > 0 || b.payable > 0)
            .sort((a, b) => (b.receivable + b.payable) - (a.receivable + a.payable));
    }, [vouchers]);

    // 전체 합계
    const totals = useMemo(() => {
        return clientBalances.reduce((acc, b) => ({
            receivable: acc.receivable + b.receivable,
            payable: acc.payable + b.payable
        }), { receivable: 0, payable: 0 });
    }, [clientBalances]);

    // 거래처 목록 (필터 드롭다운용)
    const allClients = useMemo(() => {
        const set = new Set();
        (vouchers || []).forEach(v => {
            const status = getPaymentStatus(v);
            if (status !== '결제완료' && (v.voucher_type === '매출' || v.voucher_type === '매입')) {
                set.add(v.client || '미지정');
            }
        });
        return Array.from(set).sort();
    }, [vouchers]);

    const openPaymentModal = (v) => {
        setEditingVoucher(v);
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        const paid = parseFloat(v.paid_amount || 0);
        setPaymentForm({
            paid_amount: total - paid,  // 잔액 전액 결제 default
            paid_date: new Date().toISOString().split('T')[0],
            payment_notes: ''
        });
        setIsPaymentModalOpen(true);
    };

    const handlePaymentSubmit = async () => {
        if (!editingVoucher) return;
        const additional = parseFloat(paymentForm.paid_amount) || 0;
        if (additional <= 0) return alert('결제 금액은 0보다 커야 합니다.');

        const currentPaid = parseFloat(editingVoucher.paid_amount || 0);
        const total = parseFloat(editingVoucher.total_amount || editingVoucher.quantity * editingVoucher.unit_price || 0);
        const newPaid = currentPaid + additional;

        if (newPaid > total + 0.01) {
            if (!window.confirm(`결제 합계가 청구금액(₩${total.toLocaleString()})을 초과합니다.\n과결제로 기록하시겠습니까?`)) return;
        }

        const existingNote = editingVoucher.payment_notes || '';
        const newNote = paymentForm.payment_notes
            ? `${existingNote}${existingNote ? '\n' : ''}[${paymentForm.paid_date}] ₩${additional.toLocaleString()} — ${paymentForm.payment_notes}`
            : `${existingNote}${existingNote ? '\n' : ''}[${paymentForm.paid_date}] ₩${additional.toLocaleString()}`;

        await updateVoucher(editingVoucher.id, {
            paid_amount: newPaid,
            paid_date: paymentForm.paid_date,
            payment_notes: newNote
        });

        setIsPaymentModalOpen(false);
        setEditingVoucher(null);
    };

    const handleMarkFullyPaid = async (v) => {
        const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
        if (!window.confirm(`'${v.item_name}' 전표를 결제완료로 처리합니다. (₩${total.toLocaleString()})`)) return;
        const today = new Date().toISOString().split('T')[0];
        const existingNote = v.payment_notes || '';
        await updateVoucher(v.id, {
            paid_amount: total,
            paid_date: today,
            payment_notes: `${existingNote}${existingNote ? '\n' : ''}[${today}] 결제완료 일괄 처리`
        });
    };

    return (
        <div className="payment-tab">
            {/* 전체 잔액 요약 */}
            <div className="balance-cards">
                <div className="balance-card receivable">
                    <div className="card-icon"><AlertCircle size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">미수금 합계 (받을 돈)</span>
                        <span className="card-value">₩{totals.receivable.toLocaleString()}</span>
                        <span className="card-sub">{clientBalances.filter(b => b.receivable > 0).length}개 거래처</span>
                    </div>
                </div>
                <div className="balance-card payable">
                    <div className="card-icon"><Wallet size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">미지급금 합계 (줄 돈)</span>
                        <span className="card-value">₩{totals.payable.toLocaleString()}</span>
                        <span className="card-sub">{clientBalances.filter(b => b.payable > 0).length}개 거래처</span>
                    </div>
                </div>
                <div className="balance-card net">
                    <div className="card-icon"><DollarSign size={22} /></div>
                    <div className="card-body">
                        <span className="card-label">순잔액 (받을 - 줄)</span>
                        <span className={`card-value ${(totals.receivable - totals.payable) >= 0 ? 'positive' : 'negative'}`}>
                            {(totals.receivable - totals.payable) >= 0 ? '+' : ''}₩{(totals.receivable - totals.payable).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* 거래처별 잔액 표 */}
            <div className="section-card">
                <h3 className="section-title">거래처별 미결제 잔액</h3>
                {clientBalances.length > 0 ? (
                    <table className="balance-table">
                        <thead>
                            <tr>
                                <th>거래처</th>
                                <th style={{ textAlign: 'right' }}>미수금 (건수)</th>
                                <th style={{ textAlign: 'right' }}>미지급 (건수)</th>
                                <th style={{ textAlign: 'right' }}>순잔액</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientBalances.map((b, i) => (
                                <tr key={i}>
                                    <td className="client-cell">{b.client}</td>
                                    <td style={{ textAlign: 'right', color: b.receivable > 0 ? '#dc2626' : '#94a3b8' }}>
                                        ₩{b.receivable.toLocaleString()}
                                        {b.receivableCount > 0 && <span className="count-badge">{b.receivableCount}</span>}
                                    </td>
                                    <td style={{ textAlign: 'right', color: b.payable > 0 ? '#2563eb' : '#94a3b8' }}>
                                        ₩{b.payable.toLocaleString()}
                                        {b.payableCount > 0 && <span className="count-badge">{b.payableCount}</span>}
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, color: (b.receivable - b.payable) >= 0 ? '#059669' : '#dc2626' }}>
                                        {(b.receivable - b.payable) >= 0 ? '+' : ''}₩{(b.receivable - b.payable).toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-msg">결제 미완료 전표가 없습니다. 🎉</div>
                )}
            </div>

            {/* 미결제 전표 리스트 */}
            <div className="section-card">
                <div className="section-header">
                    <h3 className="section-title">미결제 전표 목록</h3>
                    <div className="filter-controls">
                        <div className="filter-tabs">
                            <button className={`filter-btn ${filter === 'receivable' ? 'active' : ''}`} onClick={() => setFilter('receivable')}>
                                미수금 (매출)
                            </button>
                            <button className={`filter-btn ${filter === 'payable' ? 'active' : ''}`} onClick={() => setFilter('payable')}>
                                미지급 (매입)
                            </button>
                        </div>
                        <select className="client-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                            <option value="all">전체 거래처</option>
                            {allClients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {filteredVouchers.length > 0 ? (
                    <table className="voucher-table">
                        <thead>
                            <tr>
                                <th>일자</th>
                                <th>거래처</th>
                                <th>품목</th>
                                <th style={{ textAlign: 'right' }}>청구금액</th>
                                <th style={{ textAlign: 'right' }}>기결제</th>
                                <th style={{ textAlign: 'right' }}>잔액</th>
                                <th>상태</th>
                                <th style={{ textAlign: 'center' }}>결제 입력</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredVouchers.map(v => {
                                const status = getPaymentStatus(v);
                                const outstanding = getOutstanding(v);
                                const total = parseFloat(v.total_amount || v.quantity * v.unit_price || 0);
                                const paid = parseFloat(v.paid_amount || 0);
                                return (
                                    <tr key={v.id}>
                                        <td>{v.voucher_date}</td>
                                        <td className="client-cell">{v.client || '-'}</td>
                                        <td>
                                            <div className="item-name">{v.item_name}</div>
                                            {v.item_code && <div className="item-code">[{v.item_code}]</div>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>₩{total.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: '#64748b' }}>₩{paid.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: filter === 'receivable' ? '#dc2626' : '#2563eb' }}>
                                            ₩{outstanding.toLocaleString()}
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${status === '미결제' ? 'unpaid' : status === '부분결제' ? 'partial' : 'paid'}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button className="pay-btn" onClick={() => openPaymentModal(v)}>
                                                <DollarSign size={14} /> 결제
                                            </button>
                                            <button className="full-pay-btn" onClick={() => handleMarkFullyPaid(v)} title="전액 결제 처리">
                                                <CheckCircle2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-msg">조건에 맞는 미결제 전표가 없습니다.</div>
                )}
            </div>

            {/* 결제 입력 모달 */}
            <Modal title="결제 기록 입력" isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)}>
                {editingVoucher && (
                    <div className="payment-form">
                        <div className="voucher-info">
                            <div><strong>품목:</strong> {editingVoucher.item_name}</div>
                            <div><strong>거래처:</strong> {editingVoucher.client || '-'}</div>
                            <div><strong>청구금액:</strong> ₩{parseFloat(editingVoucher.total_amount || editingVoucher.quantity * editingVoucher.unit_price || 0).toLocaleString()}</div>
                            <div><strong>기결제액:</strong> ₩{parseFloat(editingVoucher.paid_amount || 0).toLocaleString()}</div>
                            <div><strong>잔액:</strong> <span style={{ color: '#dc2626', fontWeight: 700 }}>₩{getOutstanding(editingVoucher).toLocaleString()}</span></div>
                        </div>

                        <div className="form-group">
                            <label>결제 금액 *</label>
                            <input
                                type="number"
                                className="form-input"
                                value={paymentForm.paid_amount}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => setPaymentForm({ ...paymentForm, paid_amount: parseFloat(e.target.value) || 0 })}
                                placeholder="0"
                            />
                        </div>

                        <div className="form-group">
                            <label>결제일</label>
                            <input
                                type="date"
                                className="form-input"
                                value={paymentForm.paid_date}
                                onChange={(e) => setPaymentForm({ ...paymentForm, paid_date: e.target.value })}
                            />
                        </div>

                        <div className="form-group">
                            <label>결제 메모 (선택)</label>
                            <input
                                type="text"
                                className="form-input"
                                value={paymentForm.payment_notes}
                                onChange={(e) => setPaymentForm({ ...paymentForm, payment_notes: e.target.value })}
                                placeholder="예: 계좌이체, 신한 1234, 어음 등"
                            />
                        </div>

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsPaymentModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={handlePaymentSubmit}>결제 기록</button>
                        </div>
                    </div>
                )}
            </Modal>

            <style>{`
                .payment-tab { padding: 1rem 0; }
                .balance-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
                .balance-card { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); display: flex; gap: 1rem; align-items: center; border-left: 4px solid; }
                .balance-card.receivable { border-left-color: #dc2626; }
                .balance-card.payable { border-left-color: #2563eb; }
                .balance-card.net { border-left-color: #059669; }
                .balance-card .card-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #f1f5f9; color: #64748b; }
                .balance-card.receivable .card-icon { background: #fee2e2; color: #dc2626; }
                .balance-card.payable .card-icon { background: #dbeafe; color: #2563eb; }
                .balance-card.net .card-icon { background: #dcfce7; color: #059669; }
                .balance-card .card-body { display: flex; flex-direction: column; flex: 1; }
                .card-label { font-size: 0.8rem; color: #64748b; }
                .card-value { font-size: 1.35rem; font-weight: 700; color: #1e293b; margin-top: 2px; }
                .card-value.positive { color: #059669; }
                .card-value.negative { color: #dc2626; }
                .card-sub { font-size: 0.75rem; color: #94a3b8; margin-top: 2px; }

                .section-card { background: white; padding: 1.25rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); margin-bottom: 1rem; }
                .section-title { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0 0 0.75rem; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
                .filter-controls { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
                .filter-tabs { display: flex; background: #f1f5f9; border-radius: 8px; padding: 3px; }
                .filter-btn { padding: 0.4rem 0.85rem; border: none; background: transparent; border-radius: 6px; cursor: pointer; font-size: 0.85rem; color: #64748b; transition: all 0.15s; font-weight: 600; }
                .filter-btn.active { background: white; color: #4f46e5; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
                .client-select { padding: 0.4rem 0.65rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; background: white; cursor: pointer; }

                .balance-table, .voucher-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
                .balance-table th, .voucher-table th { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 2px solid #e2e8f0; color: #64748b; font-weight: 600; font-size: 0.78rem; background: #f8fafc; }
                .balance-table td, .voucher-table td { padding: 0.7rem 0.5rem; border-bottom: 1px solid #f1f5f9; }
                .client-cell { font-weight: 600; color: #1e293b; }
                .item-name { font-weight: 600; color: #1e293b; }
                .item-code { font-size: 0.72rem; color: #94a3b8; }
                .count-badge { display: inline-block; background: #f1f5f9; color: #64748b; padding: 1px 6px; border-radius: 9px; font-size: 0.7rem; margin-left: 4px; font-weight: 600; }

                .status-badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 9px; font-size: 0.72rem; font-weight: 600; }
                .status-unpaid { background: #fee2e2; color: #dc2626; }
                .status-partial { background: #fef3c7; color: #d97706; }
                .status-paid { background: #dcfce7; color: #059669; }

                .pay-btn { display: inline-flex; align-items: center; gap: 4px; background: #4f46e5; color: white; padding: 0.35rem 0.65rem; border: none; border-radius: 6px; cursor: pointer; font-size: 0.78rem; font-weight: 600; margin-right: 4px; }
                .pay-btn:hover { background: #4338ca; }
                .full-pay-btn { background: #dcfce7; color: #059669; border: none; padding: 0.35rem; border-radius: 6px; cursor: pointer; }
                .full-pay-btn:hover { background: #bbf7d0; }

                .empty-msg { padding: 2.5rem; text-align: center; color: #94a3b8; }

                .voucher-info { background: #f8fafc; padding: 1rem; border-radius: 8px; margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.9rem; }
                .voucher-info strong { color: #64748b; font-weight: 600; margin-right: 0.5rem; }

                .form-group { margin-bottom: 0.85rem; }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: #475569; margin-bottom: 0.35rem; }
                .form-input { width: 100%; padding: 0.55rem 0.75rem; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; }
                .form-input:focus { outline: none; border-color: #4f46e5; }

                .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }
                .btn-cancel { background: #f1f5f9; color: #64748b; padding: 0.55rem 1rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .btn-submit { background: #4f46e5; color: white; padding: 0.55rem 1.25rem; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .btn-submit:hover { background: #4338ca; }

                @media (max-width: 768px) {
                    .balance-table, .voucher-table { font-size: 0.78rem; }
                    .balance-table td, .voucher-table td { padding: 0.5rem 0.35rem; }
                    .item-code { display: none; }
                }
            `}</style>
        </div>
    );
};

export default PaymentTab;
