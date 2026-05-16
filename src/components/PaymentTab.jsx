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
    const [view, setView] = useState('outstanding');    // 'outstanding'(미결제) | 'paid'(결제완료)
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

    // 필터링: 미결제(미수금/미지급) 또는 결제완료 (보기 모드에 따라)
    const filteredVouchers = useMemo(() => {
        return (vouchers || []).filter(v => {
            const status = getPaymentStatus(v);
            if (view === 'outstanding' && status === '결제완료') return false;
            if (view === 'paid' && status !== '결제완료') return false;
            if (filter === 'receivable' && v.voucher_type !== '매출') return false;
            if (filter === 'payable' && v.voucher_type !== '매입') return false;
            if (clientFilter !== 'all' && (v.client || '미지정') !== clientFilter) return false;
            return true;
        }).sort((a, b) => {
            // 결제완료 보기에선 결제일 내림차순, 미결제 보기에선 발행일 내림차순
            if (view === 'paid') {
                const ad = a.paid_date || a.voucher_date;
                const bd = b.paid_date || b.voucher_date;
                return ad < bd ? 1 : -1;
            }
            return a.voucher_date < b.voucher_date ? 1 : -1;
        });
    }, [vouchers, filter, clientFilter, view]);

    // 결제완료 합계 (보기 모드에 따라 노출)
    const paidTotals = useMemo(() => {
        const arr = (vouchers || []).filter(v => getPaymentStatus(v) === '결제완료');
        const salesPaid = arr.filter(v => v.voucher_type === '매출').reduce((s, v) => s + parseFloat(v.paid_amount || 0), 0);
        const purchasePaid = arr.filter(v => v.voucher_type === '매입').reduce((s, v) => s + parseFloat(v.paid_amount || 0), 0);
        return { salesPaid, purchasePaid, salesCount: arr.filter(v => v.voucher_type === '매출').length, purchaseCount: arr.filter(v => v.voucher_type === '매입').length };
    }, [vouchers]);

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

    const handleCancelPayment = async (v) => {
        if (!window.confirm(`'${v.item_name}' 전표의 결제를 취소하시겠습니까?\n(paid_amount가 0으로 되돌아가며 다시 미결제 상태가 됩니다)`)) return;
        const today = new Date().toISOString().split('T')[0];
        const existingNote = v.payment_notes || '';
        await updateVoucher(v.id, {
            paid_amount: 0,
            paid_date: null,
            payment_notes: `${existingNote}${existingNote ? '\n' : ''}[${today}] 결제 취소`
        });
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

            {/* 전표 리스트 (미결제 / 결제완료 보기) */}
            <div className="section-card">
                <div className="section-header">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <h3 className="section-title" style={{ margin: 0 }}>{view === 'outstanding' ? '미결제 전표 목록' : '결제 완료 이력'}</h3>
                        <div className="filter-tabs">
                            <button className={`filter-btn ${view === 'outstanding' ? 'active' : ''}`} onClick={() => setView('outstanding')}>
                                미결제
                            </button>
                            <button className={`filter-btn ${view === 'paid' ? 'active' : ''}`} onClick={() => setView('paid')}>
                                결제완료
                            </button>
                        </div>
                    </div>
                    <div className="filter-controls">
                        <div className="filter-tabs">
                            <button className={`filter-btn ${filter === 'receivable' ? 'active' : ''}`} onClick={() => setFilter('receivable')}>
                                {view === 'outstanding' ? '미수금 (매출)' : '매출'}
                            </button>
                            <button className={`filter-btn ${filter === 'payable' ? 'active' : ''}`} onClick={() => setFilter('payable')}>
                                {view === 'outstanding' ? '미지급 (매입)' : '매입'}
                            </button>
                        </div>
                        <select className="client-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                            <option value="all">전체 거래처</option>
                            {allClients.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                {/* 결제완료 보기 요약 */}
                {view === 'paid' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem 1rem', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>매출 결제완료 합계</div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>₩{paidTotals.salesPaid.toLocaleString()} ({paidTotals.salesCount}건)</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>매입 결제완료 합계</div>
                            <div style={{ fontWeight: 700, color: 'var(--info)' }}>₩{paidTotals.purchasePaid.toLocaleString()} ({paidTotals.purchaseCount}건)</div>
                        </div>
                    </div>
                )}

                {filteredVouchers.length > 0 ? (
                    <table className="voucher-table">
                        <thead>
                            <tr>
                                <th>{view === 'paid' ? '결제일' : '일자'}</th>
                                <th>거래처</th>
                                <th>품목</th>
                                <th style={{ textAlign: 'right' }}>청구금액</th>
                                <th style={{ textAlign: 'right' }}>{view === 'paid' ? '결제액' : '기결제'}</th>
                                <th style={{ textAlign: 'right' }}>{view === 'paid' ? '메모' : '잔액'}</th>
                                <th>상태</th>
                                <th style={{ textAlign: 'center' }}>{view === 'paid' ? '취소' : '결제 입력'}</th>
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
                                        <td>{view === 'paid' ? (v.paid_date || v.voucher_date) : v.voucher_date}</td>
                                        <td className="client-cell">{v.client || '-'}</td>
                                        <td>
                                            <div className="item-name">{v.item_name}</div>
                                            {v.item_code && <div className="item-code">[{v.item_code}]</div>}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>₩{total.toLocaleString()}</td>
                                        <td style={{ textAlign: 'right', color: view === 'paid' ? 'var(--success)' : 'var(--text-muted)', fontWeight: view === 'paid' ? 700 : 400 }}>
                                            ₩{paid.toLocaleString()}
                                        </td>
                                        <td style={{ textAlign: view === 'paid' ? 'left' : 'right', fontWeight: view === 'paid' ? 400 : 700, color: view === 'paid' ? 'var(--text-muted)' : (filter === 'receivable' ? 'var(--danger)' : 'var(--info)'), fontSize: view === 'paid' ? '0.78rem' : 'inherit' }}>
                                            {view === 'paid'
                                                ? (v.payment_notes ? <span title={v.payment_notes}>{v.payment_notes.split('\n').slice(-1)[0].slice(0, 40)}</span> : '-')
                                                : `₩${outstanding.toLocaleString()}`}
                                        </td>
                                        <td>
                                            <span className={`status-badge status-${status === '미결제' ? 'unpaid' : status === '부분결제' ? 'partial' : 'paid'}`}>
                                                {status}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {view === 'paid' ? (
                                                <button className="full-pay-btn" onClick={() => handleCancelPayment(v)}
                                                    style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}
                                                    title="결제 취소 (paid_amount=0으로 되돌림)">
                                                    <X size={14} />
                                                </button>
                                            ) : (
                                                <>
                                                    <button className="pay-btn" onClick={() => openPaymentModal(v)}>
                                                        <DollarSign size={14} /> 결제
                                                    </button>
                                                    <button className="full-pay-btn" onClick={() => handleMarkFullyPaid(v)} title="전액 결제 처리">
                                                        <CheckCircle2 size={14} />
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                ) : (
                    <div className="empty-msg">
                        {view === 'paid' ? '결제 완료된 전표가 없습니다.' : '조건에 맞는 미결제 전표가 없습니다.'}
                    </div>
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
                .payment-tab { padding: 1rem 0; color: var(--text-main); }
                .balance-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
                .balance-card { background: var(--bg-card); padding: 1.25rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border); display: flex; gap: 1rem; align-items: center; border-left: 4px solid; }
                .balance-card.receivable { border-left-color: var(--danger); }
                .balance-card.payable { border-left-color: var(--info); }
                .balance-card.net { border-left-color: var(--success); }
                .balance-card .card-icon { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--bg-subtle); color: var(--text-muted); }
                .balance-card.receivable .card-icon { background: var(--danger-soft); color: var(--danger); }
                .balance-card.payable .card-icon { background: var(--info-soft); color: var(--info); }
                .balance-card.net .card-icon { background: var(--success-soft); color: var(--success); }
                .balance-card .card-body { display: flex; flex-direction: column; flex: 1; }
                .card-label { font-size: 0.8rem; color: var(--text-muted); }
                .card-value { font-size: 1.35rem; font-weight: 700; color: var(--text-main); margin-top: 2px; }
                .card-value.positive { color: var(--success); }
                .card-value.negative { color: var(--danger); }
                .card-sub { font-size: 0.75rem; color: var(--text-subtle); margin-top: 2px; }

                .section-card { background: var(--bg-card); padding: 1.25rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--border); margin-bottom: 1rem; }
                .section-title { font-size: 1rem; font-weight: 700; color: var(--text-main); margin: 0 0 0.75rem; letter-spacing: -0.01em; }
                .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem; }
                .filter-controls { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
                .filter-tabs { display: flex; background: var(--bg-subtle); border-radius: var(--radius-sm); padding: 3px; }
                .filter-btn { padding: 0.4rem 0.85rem; border: none; background: transparent; border-radius: var(--radius-xs); cursor: pointer; font-size: 0.85rem; color: var(--text-muted); transition: all var(--transition-base); font-weight: 600; }
                .filter-btn.active { background: var(--bg-card); color: var(--primary); box-shadow: var(--shadow-xs); }
                .client-select { padding: 0.4rem 0.65rem; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 0.85rem; background: var(--bg-elevated); color: var(--text-main); cursor: pointer; }

                .balance-table, .voucher-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
                .balance-table th, .voucher-table th { text-align: left; padding: 0.65rem 0.5rem; border-bottom: 1px solid var(--border); color: var(--text-muted); font-weight: 600; font-size: 0.78rem; background: var(--bg-subtle); }
                .balance-table td, .voucher-table td { padding: 0.7rem 0.5rem; border-bottom: 1px solid var(--border); color: var(--text-main); }
                .client-cell { font-weight: 600; color: var(--text-main); }
                .item-name { font-weight: 600; color: var(--text-main); }
                .item-code { font-size: 0.72rem; color: var(--text-subtle); }
                .count-badge { display: inline-block; background: var(--bg-subtle); color: var(--text-muted); padding: 1px 6px; border-radius: 9px; font-size: 0.7rem; margin-left: 4px; font-weight: 600; }

                .status-badge { display: inline-block; padding: 0.2rem 0.55rem; border-radius: 9px; font-size: 0.72rem; font-weight: 600; }
                .status-unpaid { background: var(--danger-soft); color: var(--danger); }
                .status-partial { background: var(--warning-soft); color: var(--warning); }
                .status-paid { background: var(--success-soft); color: var(--success); }

                .pay-btn { display: inline-flex; align-items: center; gap: 4px; background: var(--gradient-primary); color: var(--primary-text); padding: 0.35rem 0.65rem; border: none; border-radius: var(--radius-sm); cursor: pointer; font-size: 0.78rem; font-weight: 600; margin-right: 4px; transition: all var(--transition-base); }
                .pay-btn:hover { transform: translateY(-1px); box-shadow: var(--shadow-md); }
                .full-pay-btn { background: var(--success-soft); color: var(--success); border: none; padding: 0.35rem; border-radius: var(--radius-sm); cursor: pointer; transition: all var(--transition-base); }
                .full-pay-btn:hover { opacity: 0.85; }

                .empty-msg { padding: 2.5rem; text-align: center; color: var(--text-subtle); }

                .voucher-info { background: var(--bg-subtle); padding: 1rem; border-radius: var(--radius-sm); margin-bottom: 1rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.9rem; color: var(--text-main); border: 1px solid var(--border); }
                .voucher-info strong { color: var(--text-muted); font-weight: 600; margin-right: 0.5rem; }

                .form-group { margin-bottom: 0.85rem; }
                .form-group label { display: block; font-size: 0.85rem; font-weight: 600; color: var(--text-main); margin-bottom: 0.35rem; }

                .modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }

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
