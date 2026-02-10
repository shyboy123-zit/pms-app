import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Calculator, FileText, Download, Users, ChevronDown, ChevronUp, DollarSign, Clock } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ===== 2026년 4대보험 요율 =====
const INSURANCE_RATES = {
    2025: {
        nationalPension: 0.045,       // 국민연금 근로자 4.5%
        healthInsurance: 0.03545,     // 건강보험 근로자 3.545%
        longTermCare: 0.1295,         // 장기요양 건강보험료의 12.95%
        employmentInsurance: 0.009,   // 고용보험 근로자 0.9%
        label: '2025년'
    },
    2026: {
        nationalPension: 0.0475,      // 국민연금 근로자 4.75%
        healthInsurance: 0.03595,     // 건강보험 근로자 3.595%
        longTermCare: 0.1314,         // 장기요양 건강보험료의 13.14%
        employmentInsurance: 0.009,   // 고용보험 근로자 0.9%
        label: '2026년'
    }
};

// ===== 간이세액표 (월급여 기준, 부양가족 1인 기준) =====
// 근사 계산: 실제는 국세청 간이세액표를 사용해야 하나, 구간별 근사치 적용
const getIncomeTax = (monthlySalary, dependents = 1) => {
    const taxableIncome = monthlySalary;
    if (taxableIncome <= 1060000) return 0;
    if (taxableIncome <= 1500000) return Math.round((taxableIncome - 1060000) * 0.06);
    if (taxableIncome <= 2000000) return Math.round(26400 + (taxableIncome - 1500000) * 0.06);
    if (taxableIncome <= 2500000) return Math.round(56400 + (taxableIncome - 2000000) * 0.06);
    if (taxableIncome <= 3000000) return Math.round(56400 + (taxableIncome - 2000000) * 0.15);
    if (taxableIncome <= 3500000) return Math.round(131400 + (taxableIncome - 3000000) * 0.15);
    if (taxableIncome <= 4000000) return Math.round(206400 + (taxableIncome - 3500000) * 0.15);
    if (taxableIncome <= 5000000) return Math.round(281400 + (taxableIncome - 4000000) * 0.15);
    if (taxableIncome <= 6000000) return Math.round(431400 + (taxableIncome - 5000000) * 0.24);
    if (taxableIncome <= 7000000) return Math.round(671400 + (taxableIncome - 6000000) * 0.24);
    if (taxableIncome <= 8000000) return Math.round(911400 + (taxableIncome - 7000000) * 0.24);
    if (taxableIncome <= 10000000) return Math.round(1151400 + (taxableIncome - 8000000) * 0.35);
    return Math.round(1851400 + (taxableIncome - 10000000) * 0.38);
};

const Payroll = () => {
    const { employees } = useData();
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [payType, setPayType] = useState('monthly'); // monthly | hourly
    const [yearMonth, setYearMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [payData, setPayData] = useState({
        baseSalary: '',       // 기본급 (월급제)
        hourlyWage: '',       // 시급 (시급제)
        workedHours: '',      // 근무시간 (시급제)
        overtimeHours: '',    // 연장근로시간
        nightHours: '',       // 야간근로시간
        holidayHours: '',     // 휴일근로시간
        bonus: '',            // 상여금
        annualLeavePay: '',   // 연차수당
        holidayBonus: '',     // 명절수당 (설날/추석)
        performanceBonus: '', // 성과금
        mealAllowance: '',    // 식대 (비과세)
        transportAllowance: '',// 교통비 (비과세)
        dependents: '1',      // 부양가족 수
        childDependents: '0'  // 자녀 수
    });
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showPaystub, setShowPaystub] = useState(false);
    const paystubRef = useRef(null);

    const activeEmployees = useMemo(() =>
        (employees || []).filter(e => e.status === '재직'),
        [employees]);

    const selectedEmp = useMemo(() =>
        activeEmployees.find(e => e.id === selectedEmpId),
        [activeEmployees, selectedEmpId]);

    const year = parseInt(yearMonth.split('-')[0]);
    const month = parseInt(yearMonth.split('-')[1]);
    const rates = INSURANCE_RATES[year] || INSURANCE_RATES[2026];

    // === 급여 계산 ===
    const calculation = useMemo(() => {
        const baseSalary = parseFloat(payData.baseSalary) || 0;
        const hourlyWage = parseFloat(payData.hourlyWage) || 0;
        const workedHours = parseFloat(payData.workedHours) || 0;
        const overtimeHours = parseFloat(payData.overtimeHours) || 0;
        const nightHours = parseFloat(payData.nightHours) || 0;
        const holidayHours = parseFloat(payData.holidayHours) || 0;
        const bonus = parseFloat(payData.bonus) || 0;
        const annualLeavePay = parseFloat(payData.annualLeavePay) || 0;
        const holidayBonus = parseFloat(payData.holidayBonus) || 0;
        const performanceBonus = parseFloat(payData.performanceBonus) || 0;
        const mealAllowance = parseFloat(payData.mealAllowance) || 0;
        const transportAllowance = parseFloat(payData.transportAllowance) || 0;
        const dependents = parseInt(payData.dependents) || 1;

        // 기본급 계산
        let grossBase = 0;
        if (payType === 'monthly') {
            grossBase = baseSalary;
        } else {
            grossBase = hourlyWage * workedHours;
        }

        // 연장/야간/휴일 수당
        const effectiveHourly = payType === 'monthly' ? (baseSalary / 209) : hourlyWage;
        const overtimePay = Math.round(effectiveHourly * 1.5 * overtimeHours);
        const nightPay = Math.round(effectiveHourly * 0.5 * nightHours); // 야간수당 가산분
        const holidayPay = Math.round(effectiveHourly * 1.5 * holidayHours);

        // 과세 총액
        const taxableTotal = grossBase + overtimePay + nightPay + holidayPay + bonus + annualLeavePay + holidayBonus + performanceBonus;
        // 비과세 총액 (식대 월 20만원, 교통비 월 20만원 한도)
        const nonTaxMeal = Math.min(mealAllowance, 200000);
        const nonTaxTransport = Math.min(transportAllowance, 200000);
        const nonTaxTotal = nonTaxMeal + nonTaxTransport;

        // 지급 총액
        const totalPay = taxableTotal + nonTaxTotal;

        // === 공제 계산 ===
        // 4대보험 (과세 총액 기준)
        const pensionBase = Math.min(Math.max(taxableTotal, 400000), 6370000); // 국민연금 상하한
        const nationalPension = Math.round(pensionBase * rates.nationalPension);
        const healthInsurance = Math.round(taxableTotal * rates.healthInsurance);
        const longTermCare = Math.round(healthInsurance * rates.longTermCare);
        const employmentInsurance = Math.round(taxableTotal * rates.employmentInsurance);

        const totalInsurance = nationalPension + healthInsurance + longTermCare + employmentInsurance;

        // 소득세 (갑종근로소득세)
        const incomeTax = getIncomeTax(taxableTotal, dependents);
        // 지방소득세 (소득세의 10%)
        const localIncomeTax = Math.round(incomeTax * 0.1);

        const totalDeduction = totalInsurance + incomeTax + localIncomeTax;
        const netPay = totalPay - totalDeduction;

        return {
            grossBase, overtimePay, nightPay, holidayPay, bonus,
            annualLeavePay, holidayBonus, performanceBonus,
            taxableTotal, nonTaxMeal, nonTaxTransport, nonTaxTotal, totalPay,
            nationalPension, healthInsurance, longTermCare, employmentInsurance, totalInsurance,
            incomeTax, localIncomeTax, totalDeduction, netPay,
            effectiveHourly
        };
    }, [payData, payType, rates]);

    const fmt = (n) => Math.round(n).toLocaleString();

    const handleEmpSelect = (empId) => {
        setSelectedEmpId(empId);
        setShowPaystub(false);
    };

    const generatePdf = async () => {
        if (!paystubRef.current) return;
        setIsGeneratingPdf(true);
        setShowPaystub(true);
        await new Promise(r => setTimeout(r, 500));

        try {
            const element = paystubRef.current;
            const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);

            const empName = selectedEmp?.name || '직원';
            const fileName = `급여명세서_${empName}_${yearMonth}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error('PDF 생성 실패:', err);
            alert('PDF 생성에 실패했습니다.');
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

    return (
        <div style={{ padding: '0 1rem' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>급여 관리</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        월급제/시급제 급여 계산 · 4대보험 공제 · 급여명세서 PDF
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#6366f1', fontWeight: 600, background: '#eef2ff', padding: '6px 14px', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
                    📋 {rates.label || year + '년'} 보험요율 적용
                </div>
            </div>

            {/* 4대보험 요율 표시 */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '8px', marginBottom: '1.5rem'
            }}>
                {[
                    { label: '국민연금', rate: `${(rates.nationalPension * 100).toFixed(2)}%`, icon: '🏛️', color: '#4f46e5' },
                    { label: '건강보험', rate: `${(rates.healthInsurance * 100).toFixed(3)}%`, icon: '🏥', color: '#059669' },
                    { label: '장기요양', rate: `건보 ${(rates.longTermCare * 100).toFixed(2)}%`, icon: '👴', color: '#d97706' },
                    { label: '고용보험', rate: `${(rates.employmentInsurance * 100).toFixed(1)}%`, icon: '💼', color: '#dc2626' }
                ].map(item => (
                    <div key={item.label} style={{
                        background: 'var(--card)', borderRadius: '12px', padding: '12px 14px',
                        border: '1px solid var(--border)', textAlign: 'center'
                    }}>
                        <div style={{ fontSize: '1rem', marginBottom: '4px' }}>{item.icon}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.label}</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 700, color: item.color }}>{item.rate}</div>
                    </div>
                ))}
            </div>

            {/* 설정 영역 */}
            <div style={{
                background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                border: '1px solid var(--border)', marginBottom: '1rem'
            }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    {/* 직원 선택 */}
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                            👤 직원 선택
                        </label>
                        <select value={selectedEmpId} onChange={(e) => handleEmpSelect(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                border: '1px solid var(--border)', background: 'var(--card)',
                                color: 'var(--text)', fontSize: '0.85rem'
                            }}>
                            <option value="">-- 직원을 선택하세요 --</option>
                            {activeEmployees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.name} ({emp.department} / {emp.position})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 급여 월 */}
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                            📅 급여 월
                        </label>
                        <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)}
                            style={{
                                width: '100%', padding: '10px 12px', borderRadius: '8px',
                                border: '1px solid var(--border)', background: 'var(--card)',
                                color: 'var(--text)', fontSize: '0.85rem'
                            }} />
                    </div>

                    {/* 급여 유형 */}
                    <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
                            💰 급여 유형
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {[
                                { key: 'monthly', label: '월급제', icon: <DollarSign size={14} /> },
                                { key: 'hourly', label: '시급제', icon: <Clock size={14} /> }
                            ].map(t => (
                                <button key={t.key} onClick={() => setPayType(t.key)}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                                        padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                        fontWeight: 600, fontSize: '0.82rem', transition: 'all 0.2s',
                                        background: payType === t.key ? '#4f46e5' : 'var(--card)',
                                        color: payType === t.key ? 'white' : 'var(--text-muted)',
                                        border: `1px solid ${payType === t.key ? '#4f46e5' : 'var(--border)'}`
                                    }}>
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* 급여 입력 */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem'
            }}>
                {/* 지급 항목 */}
                <div style={{
                    background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#059669' }}>
                        💵 지급 항목
                    </div>

                    {payType === 'monthly' ? (
                        <div className="form-group" style={{ marginBottom: '10px' }}>
                            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>기본급 (월)</label>
                            <input type="number" placeholder="0" value={payData.baseSalary}
                                onChange={(e) => setPayData({ ...payData, baseSalary: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>시급</label>
                                <input type="number" placeholder="0" value={payData.hourlyWage}
                                    onChange={(e) => setPayData({ ...payData, hourlyWage: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>근무시간 (월)</label>
                                <input type="number" placeholder="209" value={payData.workedHours}
                                    onChange={(e) => setPayData({ ...payData, workedHours: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>연장근로 (시간)</label>
                            <input type="number" placeholder="0" value={payData.overtimeHours}
                                onChange={(e) => setPayData({ ...payData, overtimeHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>야간근로 (시간)</label>
                            <input type="number" placeholder="0" value={payData.nightHours}
                                onChange={(e) => setPayData({ ...payData, nightHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>휴일근로 (시간)</label>
                            <input type="number" placeholder="0" value={payData.holidayHours}
                                onChange={(e) => setPayData({ ...payData, holidayHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>상여금</label>
                            <input type="number" placeholder="0" value={payData.bonus}
                                onChange={(e) => setPayData({ ...payData, bonus: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>연차수당</label>
                            <input type="number" placeholder="0" value={payData.annualLeavePay}
                                onChange={(e) => setPayData({ ...payData, annualLeavePay: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>성과금</label>
                            <input type="number" placeholder="0" value={payData.performanceBonus}
                                onChange={(e) => setPayData({ ...payData, performanceBonus: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>명절수당</label>
                            <input type="number" placeholder="0" value={payData.holidayBonus}
                                onChange={(e) => setPayData({ ...payData, holidayBonus: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>식대 (비과세)</label>
                            <input type="number" placeholder="200000" value={payData.mealAllowance}
                                onChange={(e) => setPayData({ ...payData, mealAllowance: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>교통비 (비과세)</label>
                            <input type="number" placeholder="100000" value={payData.transportAllowance}
                                onChange={(e) => setPayData({ ...payData, transportAllowance: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>부양가족 수</label>
                            <input type="number" min="1" placeholder="1" value={payData.dependents}
                                onChange={(e) => setPayData({ ...payData, dependents: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>20세 이하 자녀 수</label>
                            <input type="number" min="0" placeholder="0" value={payData.childDependents}
                                onChange={(e) => setPayData({ ...payData, childDependents: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                    </div>
                </div>

                {/* 계산 결과 */}
                <div style={{
                    background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                    border: '1px solid var(--border)', display: 'flex', flexDirection: 'column'
                }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: '#4f46e5' }}>
                        📊 급여 계산 결과
                    </div>

                    {/* 지급 합계 */}
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600, marginBottom: '6px' }}>[ 지급 합계 ]</div>
                        {[
                            { label: payType === 'monthly' ? '기본급' : `기본급 (${fmt(calculation.effectiveHourly)}원 × ${payData.workedHours || 0}h)`, value: calculation.grossBase },
                            { label: '연장근로수당 (×1.5)', value: calculation.overtimePay },
                            { label: '야간근로수당 (×0.5 가산)', value: calculation.nightPay },
                            { label: '휴일근로수당 (×1.5)', value: calculation.holidayPay },
                            { label: '상여금', value: calculation.bonus },
                            { label: '연차수당', value: calculation.annualLeavePay },
                            { label: '명절수당', value: calculation.holidayBonus },
                            { label: '성과금', value: calculation.performanceBonus },
                            { label: '식대 (비과세)', value: calculation.nonTaxMeal },
                            { label: '교통비 (비과세)', value: calculation.nonTaxTransport }
                        ].filter(r => r.value > 0).map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                                <span style={{ fontWeight: 600 }}>{fmt(row.value)}원</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', borderTop: '1px solid var(--border)', marginTop: '4px', fontWeight: 700, color: '#059669' }}>
                            <span>지급총액</span>
                            <span>{fmt(calculation.totalPay)}원</span>
                        </div>
                    </div>

                    {/* 공제 합계 */}
                    <div style={{ marginBottom: '14px' }}>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600, marginBottom: '6px' }}>[ 공제 합계 ]</div>
                        {[
                            { label: `국민연금 (${(rates.nationalPension * 100).toFixed(2)}%)`, value: calculation.nationalPension },
                            { label: `건강보험 (${(rates.healthInsurance * 100).toFixed(3)}%)`, value: calculation.healthInsurance },
                            { label: `장기요양보험 (건보×${(rates.longTermCare * 100).toFixed(2)}%)`, value: calculation.longTermCare },
                            { label: `고용보험 (${(rates.employmentInsurance * 100).toFixed(1)}%)`, value: calculation.employmentInsurance },
                            { label: '소득세 (갑근세)', value: calculation.incomeTax },
                            { label: '지방소득세 (소득세×10%)', value: calculation.localIncomeTax }
                        ].map(row => (
                            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                                <span style={{ fontWeight: 600, color: '#dc2626' }}>-{fmt(row.value)}원</span>
                            </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', borderTop: '1px solid var(--border)', marginTop: '4px', fontWeight: 700, color: '#dc2626' }}>
                            <span>공제총액</span>
                            <span>-{fmt(calculation.totalDeduction)}원</span>
                        </div>
                    </div>

                    {/* 실수령액 */}
                    <div style={{
                        background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)', borderRadius: '12px',
                        padding: '16px', textAlign: 'center', border: '2px solid #4f46e5', marginTop: 'auto'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '4px' }}>실수령액</div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5' }}>{fmt(calculation.netPay)}원</div>
                    </div>

                    {/* PDF 버튼 */}
                    {selectedEmp && calculation.totalPay > 0 && (
                        <button onClick={generatePdf} disabled={isGeneratingPdf}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                width: '100%', marginTop: '12px', padding: '12px',
                                borderRadius: '10px', border: 'none', cursor: 'pointer',
                                background: '#4f46e5', color: 'white', fontWeight: 700, fontSize: '0.9rem',
                                opacity: isGeneratingPdf ? 0.7 : 1
                            }}>
                            <Download size={16} />
                            {isGeneratingPdf ? '생성 중...' : '급여명세서 PDF 다운로드'}
                        </button>
                    )}
                    {!selectedEmp && (
                        <div style={{ fontSize: '0.78rem', color: '#f59e0b', textAlign: 'center', marginTop: '8px', fontWeight: 500 }}>
                            ⚠️ PDF 생성을 위해 직원을 선택해주세요
                        </div>
                    )}
                </div>
            </div>

            {/* ===== 급여명세서 PDF 템플릿 (숨김) ===== */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <div ref={paystubRef} style={{
                    width: '800px', padding: '40px', fontFamily: "'Malgun Gothic', '맑은 고딕', sans-serif",
                    background: 'white', color: '#1e293b'
                }}>
                    {/* PDF 헤더 */}
                    <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', marginBottom: '6px' }}>급 여 명 세 서</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{year}년 {month}월분</div>
                    </div>

                    {/* 직원 정보 */}
                    {selectedEmp && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '12px' }}>
                            <tbody>
                                <tr>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600, width: '15%' }}>성명</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: '35%' }}>{selectedEmp.name}</td>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600, width: '15%' }}>사번</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0', width: '35%' }}>{selectedEmp.employee_id || '-'}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>부서</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{selectedEmp.department}</td>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>직급</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{selectedEmp.position}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>입사일</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{selectedEmp.join_date}</td>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>급여형태</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{payType === 'monthly' ? '월급제' : '시급제'}</td>
                                </tr>
                            </tbody>
                        </table>
                    )}

                    {/* 지급/공제 테이블 */}
                    <div style={{ display: 'flex', gap: '0px', marginBottom: '20px' }}>
                        {/* 지급 항목 */}
                        <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th colSpan="2" style={{ padding: '10px', background: '#059669', color: 'white', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px' }}>지급 항목</th>
                                </tr>
                                <tr>
                                    <th style={{ padding: '8px 10px', background: '#ecfdf5', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 600, width: '60%' }}>항목</th>
                                    <th style={{ padding: '8px 10px', background: '#ecfdf5', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: '기본급', value: calculation.grossBase },
                                    { label: '연장근로수당', value: calculation.overtimePay },
                                    { label: '야간근로수당', value: calculation.nightPay },
                                    { label: '휴일근로수당', value: calculation.holidayPay },
                                    { label: '상여금', value: calculation.bonus },
                                    { label: '연차수당', value: calculation.annualLeavePay },
                                    { label: '명절수당', value: calculation.holidayBonus },
                                    { label: '성과금', value: calculation.performanceBonus },
                                    { label: '식대 (비과세)', value: calculation.nonTaxMeal },
                                    { label: '교통비 (비과세)', value: calculation.nonTaxTransport }
                                ].map(row => (
                                    <tr key={row.label}>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{row.label}</td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{fmt(row.value)}</td>
                                    </tr>
                                ))}
                                <tr style={{ fontWeight: 700 }}>
                                    <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', background: '#f0fdf4' }}>지급 합계</td>
                                    <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', background: '#f0fdf4', textAlign: 'right', color: '#059669' }}>{fmt(calculation.totalPay)}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* 공제 항목 */}
                        <table style={{ flex: 1, borderCollapse: 'collapse', fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th colSpan="2" style={{ padding: '10px', background: '#dc2626', color: 'white', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px' }}>공제 항목</th>
                                </tr>
                                <tr>
                                    <th style={{ padding: '8px 10px', background: '#fef2f2', border: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 600, width: '60%' }}>항목</th>
                                    <th style={{ padding: '8px 10px', background: '#fef2f2', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: 600 }}>금액</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: '국민연금', value: calculation.nationalPension },
                                    { label: '건강보험', value: calculation.healthInsurance },
                                    { label: '장기요양보험', value: calculation.longTermCare },
                                    { label: '고용보험', value: calculation.employmentInsurance },
                                    { label: '소득세 (갑근세)', value: calculation.incomeTax },
                                    { label: '지방소득세', value: calculation.localIncomeTax },
                                    { label: '', value: 0 }
                                ].map((row, i) => (
                                    <tr key={row.label || i}>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0' }}>{row.label}</td>
                                        <td style={{ padding: '6px 10px', border: '1px solid #e2e8f0', textAlign: 'right' }}>{row.value ? fmt(row.value) : ''}</td>
                                    </tr>
                                ))}
                                <tr style={{ fontWeight: 700 }}>
                                    <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', background: '#fef2f2' }}>공제 합계</td>
                                    <td style={{ padding: '8px 10px', border: '1px solid #e2e8f0', background: '#fef2f2', textAlign: 'right', color: '#dc2626' }}>{fmt(calculation.totalDeduction)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* 실수령액 */}
                    <div style={{
                        background: '#eef2ff', border: '2px solid #4f46e5', borderRadius: '10px',
                        padding: '18px', textAlign: 'center', marginBottom: '24px'
                    }}>
                        <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>실수령액 (지급총액 - 공제총액)</div>
                        <div style={{ fontSize: '26px', fontWeight: 800, color: '#4f46e5' }}>
                            ₩ {fmt(calculation.netPay)}
                        </div>
                    </div>

                    {/* 적용 보험요율 안내 */}
                    <div style={{ fontSize: '10px', color: '#94a3b8', marginBottom: '16px', padding: '10px 12px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontWeight: 600, marginBottom: '4px', color: '#64748b' }}>■ {year}년 적용 4대보험 요율 (근로자 부담분)</div>
                        <div>• 국민연금: {(rates.nationalPension * 100).toFixed(2)}% | 건강보험: {(rates.healthInsurance * 100).toFixed(3)}% | 장기요양: 건보의 {(rates.longTermCare * 100).toFixed(2)}% | 고용보험: {(rates.employmentInsurance * 100).toFixed(1)}%</div>
                        <div style={{ marginTop: '4px' }}>• 비과세 항목(식대·교통비)은 4대보험료 및 소득세 산정 시 제외됩니다.</div>
                        <div>• 소득세는 간이세액표 기준이며, 실제 세액과 차이가 있을 수 있습니다.</div>
                    </div>

                    {/* 서명란 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', fontSize: '11px' }}>
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ marginBottom: '6px', color: '#64748b' }}>위 내용을 확인합니다.</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{year}년 {month}월 {new Date(year, month, 0).getDate()}일</div>
                        </div>
                        <div style={{ display: 'flex', gap: '40px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '80px', borderBottom: '1px solid #cbd5e1', marginBottom: '6px', height: '40px' }}></div>
                                <div style={{ color: '#64748b' }}>대표이사</div>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: '80px', borderBottom: '1px solid #cbd5e1', marginBottom: '6px', height: '40px' }}></div>
                                <div style={{ color: '#64748b' }}>수령인</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Payroll;
