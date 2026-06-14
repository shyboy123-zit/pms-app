import React, { useState, useMemo, useRef } from 'react';
import { useData } from '../context/DataContext';
import { Calculator, Download, Users, ChevronDown, ChevronUp, DollarSign, Clock, Save, History, Trash2, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { exportToExcel } from '../lib/excel';
import DonutKpi from '../components/viz/DonutKpi';
import MiniBar from '../components/viz/MiniBar';

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

// ===== 최저임금 (시급 기준) =====
const MINIMUM_WAGE = {
    2025: 10030,   // 2025년 최저시급
    2026: 10360,   // 2026년 최저시급
};

// ===== 주휴수당 (Weekly Holiday Pay) =====
//
// [법적 근거]
// - 근로기준법 제55조 (휴일): 사용자는 1주간 소정근로일을 개근한 근로자에게
//   1주일에 평균 1회 이상의 유급휴일을 주어야 한다.
// - 근로기준법 시행령 제30조: 1주간 소정근로시간이 15시간 미만인 근로자에
//   대해서는 제55조를 적용하지 아니한다.
//
// [계산 공식]
// 1일 소정근로시간 = 주간 소정근로시간 ÷ 5일
// 주휴수당(주) = 1일 소정근로시간 × 시급
// 주휴수당(월) = 주휴수당(주) × 4.345 (= 52주 ÷ 12개월)
//
// [적용 조건]
// - 주 15시간 이상 근무하는 근로자에게만 지급
// - 해당 주의 소정근로일을 개근해야 지급 (본 시스템에서는 개근 가정)
// - 월급제의 경우 기본급에 주휴수당이 이미 포함되어 있으므로 별도 계산하지 않음
//
// [위반 시 제재]
// - 주휴수당 미지급 시 근로기준법 제109조에 따라 3년 이하의 징역 또는
//   3천만원 이하의 벌금에 처할 수 있음
//
const calcWeeklyHolidayPay = (hourlyWage, weeklyHours) => {
    if (weeklyHours < 15) return 0; // 주 15시간 미만: 주휴수당 미적용 (시행령 제30조)
    const dailyHours = Math.min(weeklyHours, 40) / 5; // 1일 소정근로시간
    return Math.round(dailyHours * hourlyWage * 4.345); // 월 환산 (52주/12개월 ≒ 4.345)
};

// ===== 간이세액표 (월급여 기준, 부양가족 1인 기준) =====
// 근사 계산: 실제 국세청 간이세액표 기준 구간별 세율 적용
// 2024년 3월 개정 간이세액표 기준 (부양가족 1인)
const getIncomeTax = (monthlySalary, dependents = 1) => {
    const taxableIncome = monthlySalary;
    // 부양가족 수에 따른 비과세 기준 조정 (간이세액표 근사)
    const exemptionPerDependent = 150000; // 부양가족 1인당 약 15만원 공제 근사
    const adjustedIncome = Math.max(0, taxableIncome - (dependents - 1) * exemptionPerDependent);

    if (adjustedIncome <= 1060000) return 0;
    if (adjustedIncome <= 1500000) return Math.round((adjustedIncome - 1060000) * 0.06);
    if (adjustedIncome <= 2000000) return Math.round(26400 + (adjustedIncome - 1500000) * 0.06);
    if (adjustedIncome <= 2500000) return Math.round(56400 + (adjustedIncome - 2000000) * 0.06);
    if (adjustedIncome <= 3000000) return Math.round(86400 + (adjustedIncome - 2500000) * 0.15);
    if (adjustedIncome <= 3500000) return Math.round(161400 + (adjustedIncome - 3000000) * 0.15);
    if (adjustedIncome <= 4000000) return Math.round(236400 + (adjustedIncome - 3500000) * 0.15);
    if (adjustedIncome <= 5000000) return Math.round(311400 + (adjustedIncome - 4000000) * 0.15);
    if (adjustedIncome <= 6000000) return Math.round(461400 + (adjustedIncome - 5000000) * 0.24);
    if (adjustedIncome <= 7000000) return Math.round(701400 + (adjustedIncome - 6000000) * 0.24);
    if (adjustedIncome <= 8000000) return Math.round(941400 + (adjustedIncome - 7000000) * 0.24);
    if (adjustedIncome <= 10000000) return Math.round(1181400 + (adjustedIncome - 8000000) * 0.35);
    return Math.round(1881400 + (adjustedIncome - 10000000) * 0.38);
};

// ===== 연차 발생일수 (근속연수 기준, 근로기준법 제60조) =====
//
// [법적 근거] 근로기준법 제60조 (연차 유급휴가)
// - 입사 1년 미만: 1개월 개근 시 1일씩 발생 (최대 11일)
// - 1년 이상(만 1~2년): 15일
// - 3년 이상: 최초 1년을 초과하는 매 2년마다 1일씩 가산 (가산 한도 10일 → 최대 25일)
//   예) 1년 15일 · 3년 16일 · 5년 17일 · … · 21년 25일
//
// 월급제에서 연차를 사용하기 어려운 직원에게 미사용 연차를 수당으로 보상할 때,
// 근속연수에 따라 발생 연차일수가 다르므로 이를 자동으로 산정한다.
const getServiceInfo = (joinDate, refDate = new Date()) => {
    if (!joinDate) return null;
    const join = new Date(joinDate);
    if (isNaN(join.getTime())) return null;
    const ms = refDate - join;
    if (ms < 0) return { years: 0, months: 0, grantedLeave: 0 };

    const dayMs = 1000 * 60 * 60 * 24;
    const totalDays = ms / dayMs;
    const totalYears = totalDays / 365.25;
    const fullYears = Math.floor(totalYears);
    const remMonths = Math.floor((totalDays - fullYears * 365.25) / 30.4375);

    let grantedLeave;
    if (totalYears < 1) {
        // 1개월 개근당 1일, 최대 11일
        grantedLeave = Math.min(Math.floor(totalDays / 30.4375), 11);
    } else {
        // 15일 + (근속 3년차부터 2년마다 1일), 최대 25일
        grantedLeave = Math.min(15 + Math.floor((fullYears - 1) / 2), 25);
    }
    return { years: fullYears, months: remMonths, grantedLeave };
};

// ===== 월 소정근로시간 (주휴 포함) =====
// 월급제의 통상시급 = 기본급 ÷ 월 소정근로시간.
// 1주 = 소정근로시간 + 주휴 1일분(min(주,40)/5), 월 환산 × 4.345(=52주/12개월).
// 주 40시간 → (40 + 8) × 4.345 ≒ 209시간 (법정 기준).
const getMonthlyContractHours = (weeklyHours = 40) => {
    const w = parseFloat(weeklyHours) || 40;
    const weeklyPaid = w + Math.min(w, 40) / 5;
    return Math.round(weeklyPaid * 4.345);
};

// ===== 급여대장 컬럼 (회계사무소 제출용 — 지급/공제 전 항목) =====
const LEDGER_COLUMNS = [
    { key: 'emp_id', label: '사번' },
    { key: 'name', label: '성명' },
    { key: 'department', label: '부서' },
    { key: 'position', label: '직급' },
    { key: 'payTypeLabel', label: '급여형태' },
    { key: 'baseSalary', label: '기본급', num: true },
    { key: 'overtimePay', label: '연장수당', num: true },
    { key: 'nightPay', label: '야간수당', num: true },
    { key: 'holidayPay', label: '휴일·특근수당', num: true },
    { key: 'weeklyHolidayPay', label: '주휴수당', num: true },
    { key: 'bonus', label: '상여금', num: true },
    { key: 'annualLeavePay', label: '연차수당', num: true },
    { key: 'holidayBonus', label: '명절수당', num: true },
    { key: 'performanceBonus', label: '성과금', num: true },
    { key: 'mealAllowance', label: '식대(비과세)', num: true },
    { key: 'transportAllowance', label: '교통비(비과세)', num: true },
    { key: 'totalPay', label: '지급총액', num: true },
    { key: 'nationalPension', label: '국민연금', num: true },
    { key: 'healthInsurance', label: '건강보험', num: true },
    { key: 'longTermCare', label: '장기요양', num: true },
    { key: 'employmentInsurance', label: '고용보험', num: true },
    { key: 'incomeTax', label: '소득세', num: true },
    { key: 'localIncomeTax', label: '지방소득세', num: true },
    { key: 'yearEndAdjust', label: '연말정산', num: true },
    { key: 'totalDeduction', label: '공제총액', num: true },
    { key: 'netPay', label: '실수령액', num: true },
];

const Payroll = () => {
    const { employees, payrollRecords, addPayrollRecord, deletePayrollRecord, attendance } = useData();
    const [selectedEmpId, setSelectedEmpId] = useState('');
    const [payType, setPayType] = useState('monthly'); // monthly | hourly
    const [showHistory, setShowHistory] = useState(false);
    const [showLedger, setShowLedger] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [yearMonth, setYearMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [payData, setPayData] = useState({
        baseSalary: '',       // 기본급 (월급제)
        targetTotal: '',      // 월급 총액 목표 (역산 모드)
        hourlyWage: '',       // 시급 (시급제)
        workedHours: '',      // 근무시간 (시급제 - 직접입력 모드)
        weeklyWorkedHours: ['', '', '', '', ''],  // 주별 근무시간 (시급제 - 주별입력 모드)
        weeklyWorkedDays: ['', '', '', '', ''],    // 주별 출근일수
        weeklyHours: '40',    // 주간 소정근로시간 (주휴수당 계산용)
        scheduledDays: '5',   // 주간 소정근로일수 (개근 판단용, 기본 5일)
        overtimeHours: '',    // 연장근로시간 (월, 약정)
        dailyWorkHours: '',   // 1일 근무시간(휴게 제외) — 약정 연장 자동환산용
        workDays: '5',        // 주 근무일수
        nightHours: '',       // 야간근로시간
        holidayHours: '',     // 휴일근로시간
        bonus: '',            // 상여금
        annualLeavePay: '',   // 연차수당 (직접입력 시)
        annualLeaveDays: '',  // 미사용 연차일수 (자동계산용)
        leavePromotion: false,// 연차사용촉진 시행 여부 (시행 시 수당 미지급)
        holidayBonus: '',     // 명절수당 (설날/추석)
        performanceBonus: '', // 성과금
        mealAllowance: '',    // 식대 (비과세)
        transportAllowance: '',// 교통비 (비과세)
        dependents: '1',      // 부양가족 수
        childDependents: '0', // 자녀 수
        yearEndTax: '',       // 연말정산 정산세액 (2월)
        yearEndType: 'refund' // refund(환급) | pay(추가납부)
    });
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [showPaystub, setShowPaystub] = useState(false);
    // 월급제 입력 방식: manual(기본급 직접) | reverse(총액→기본급 역산) | bonusFlex(기본급 고정+나머지 상여)
    const [monthlyMode, setMonthlyMode] = useState('manual');
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
    const minWage = MINIMUM_WAGE[year] || MINIMUM_WAGE[2026];

    // 선택 직원의 근속연수 → 발생 연차 / 미사용 연차 산정 (급여 월 말일 기준)
    const serviceInfo = useMemo(() => {
        if (!selectedEmp?.join_date) return null;
        const ref = new Date(year, month, 0); // 해당 급여월 말일
        return getServiceInfo(selectedEmp.join_date, ref);
    }, [selectedEmp, year, month]);

    const remainingLeave = useMemo(() => {
        if (!serviceInfo) return null;
        const used = parseInt(selectedEmp?.used_leave) || 0;
        return Math.max(0, serviceInfo.grantedLeave - used);
    }, [serviceInfo, selectedEmp]);

    // 최저임금 검증
    const minWageWarning = useMemo(() => {
        if (payType === 'hourly') {
            const hw = parseFloat(payData.hourlyWage) || 0;
            if (hw > 0 && hw < minWage) return `시급 ${hw.toLocaleString()}원은 ${year}년 최저임금 ${minWage.toLocaleString()}원 미만입니다!`;
        } else {
            const bs = parseFloat(payData.baseSalary) || 0;
            // 월급제: 기본급 / 월 소정근로시간 으로 환산 시급 계산
            const mch = getMonthlyContractHours(payData.weeklyHours);
            if (bs > 0) {
                const converted = Math.round(bs / mch);
                if (converted < minWage) return `기본급 환산 시급 ${converted.toLocaleString()}원은 ${year}년 최저임금 ${minWage.toLocaleString()}원 미만입니다! (기본급 ÷ ${mch}시간)`;
            }
        }
        return null;
    }, [payData.hourlyWage, payData.baseSalary, payData.weeklyHours, payType, minWage, year]);

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
        const annualLeaveDays = parseFloat(payData.annualLeaveDays) || 0;
        const holidayBonus = parseFloat(payData.holidayBonus) || 0;
        const performanceBonus = parseFloat(payData.performanceBonus) || 0;
        const weeklyHours = parseFloat(payData.weeklyHours) || 40;
        const mealAllowance = parseFloat(payData.mealAllowance) || 0;
        const transportAllowance = parseFloat(payData.transportAllowance) || 0;
        const dependents = parseInt(payData.dependents) || 1;

        // 기본급 계산
        let grossBase = 0;
        if (payType === 'monthly') {
            grossBase = baseSalary;
        } else {
            // 주별 입력이 있으면 합산, 아니면 월 총시간 사용
            const weeklySum = payData.weeklyWorkedHours.reduce((s, h) => s + (parseFloat(h) || 0), 0);
            const totalHours = weeklySum > 0 ? weeklySum : workedHours;
            grossBase = hourlyWage * totalHours;
        }

        // 연장/야간/휴일 수당 — 통상시급 = 기본급 ÷ 월 소정근로시간(주휴 포함)
        const monthlyContractHours = getMonthlyContractHours(weeklyHours);
        const effectiveHourly = payType === 'monthly' ? (baseSalary / monthlyContractHours) : hourlyWage;
        const overtimePay = Math.round(effectiveHourly * 1.5 * overtimeHours);
        const nightPay = Math.round(effectiveHourly * 0.5 * nightHours); // 야간수당 가산분
        const holidayPay = Math.round(effectiveHourly * 1.5 * holidayHours);

        // 1일급 계산 (통상시급 × 1일 소정근로시간 8h)
        const dailyWage = Math.round(effectiveHourly * 8);

        // 연차수당: 일수 입력 시 자동계산, 없으면 직접입력 금액 사용
        const calculatedAnnualPay = annualLeaveDays > 0 ? (dailyWage * annualLeaveDays) : annualLeavePay;

        // 주휴수당 (시급제) - 주별 계산
        let weeklyHolidayPay = 0;
        let weeklyBreakdown = [];
        let is209Pattern = false;

        if (payType === 'hourly') {
            // 주별 근무시간이 입력되었는지 확인
            const hasWeeklyInput = payData.weeklyWorkedHours.some(h => parseFloat(h) > 0);
            const scheduledDays = parseInt(payData.scheduledDays) || 5;

            if (hasWeeklyInput) {
                // 주별 계산 모드
                const dailyScheduledHours = Math.min(weeklyHours, 40) / 5;
                payData.weeklyWorkedHours.forEach((wh, idx) => {
                    const hours = parseFloat(wh) || 0;
                    if (hours <= 0) return;
                    const days = parseInt(payData.weeklyWorkedDays[idx]) || 0;
                    const hoursOk = hours >= 15;      // 조건 1: 주 15시간 이상
                    const daysOk = days >= scheduledDays; // 조건 2: 소정근로일 개근
                    const qualifies = hoursOk && daysOk;
                    const weekPay = qualifies ? Math.round(dailyScheduledHours * hourlyWage) : 0;
                    const reason = !hoursOk ? '15h미만' : !daysOk ? `${days}/${scheduledDays}일 미개근` : '지급';
                    weeklyBreakdown.push({ week: idx + 1, hours, days, qualifies, pay: weekPay, reason });
                    weeklyHolidayPay += weekPay;
                });
            } else if (workedHours > 0) {
                // 월 총시간 직접입력 모드
                const monthlyFullHours = Math.round(weeklyHours * 52 / 12);
                is209Pattern = workedHours >= monthlyFullHours;
                if (!is209Pattern) {
                    weeklyHolidayPay = calcWeeklyHolidayPay(hourlyWage, weeklyHours);
                }
            }
        }

        // 과세 총액
        const taxableTotal = grossBase + overtimePay + nightPay + holidayPay + bonus + calculatedAnnualPay + holidayBonus + performanceBonus + weeklyHolidayPay;
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

        // 연말정산 정산세액 (보통 2월 급여 반영): 환급(+)이면 공제 감소, 추가납부(−)면 공제 증가
        const yearEndAmount = parseFloat(payData.yearEndTax) || 0;
        const yearEndType = payData.yearEndType || 'refund';
        // 공제에 더하는 보정값: 추가납부면 +금액(공제↑), 환급이면 -금액(공제↓)
        const yearEndAdjust = yearEndType === 'pay' ? yearEndAmount : -yearEndAmount;

        const totalDeduction = totalInsurance + incomeTax + localIncomeTax + yearEndAdjust;
        const netPay = totalPay - totalDeduction;

        return {
            grossBase, overtimePay, nightPay, holidayPay, bonus,
            annualLeavePay: calculatedAnnualPay, annualLeaveDays, dailyWage,
            holidayBonus, performanceBonus, weeklyHolidayPay,
            taxableTotal, nonTaxMeal, nonTaxTransport, nonTaxTotal, totalPay,
            nationalPension, healthInsurance, longTermCare, employmentInsurance, totalInsurance,
            incomeTax, localIncomeTax, yearEndAmount, yearEndType, yearEndAdjust, totalDeduction, netPay,
            effectiveHourly, monthlyContractHours, is209Pattern, weeklyBreakdown
        };
    }, [payData, payType, rates]);

    const fmt = (n) => Math.round(n).toLocaleString();

    // === 월급 총액 → 기본급 역산 (포괄임금 분해) ===
    // 총액과 법정 근로시간(소정 + 약정 연장/야간/휴일)을 고정하고 통상시급을 역산하여
    // 기본급·연장수당 등을 자동 분해한다. 시간을 임의로 끼워맞추는 왜곡을 방지.
    const reverseCalc = useMemo(() => {
        if (payType !== 'monthly' || monthlyMode !== 'reverse') return null;
        const target = parseFloat(payData.targetTotal) || 0;
        if (target <= 0) return null;

        const ot = parseFloat(payData.overtimeHours) || 0; // 약정 연장시간 (매월 고정)
        const meal = Math.min(parseFloat(payData.mealAllowance) || 0, 200000);
        const transport = Math.min(parseFloat(payData.transportAllowance) || 0, 200000);

        const monthlyContractHours = getMonthlyContractHours(payData.weeklyHours);
        // 고정 월급 = 기본급(소정) + 약정 연장수당. 주말 특근·야간은 역산에 포함하지 않고 별도 가산.
        const divisor = monthlyContractHours + 1.5 * ot;
        if (divisor <= 0) return null;

        // 비과세(식대·교통비)는 통상임금 분해 대상에서 제외 후 역산
        const wageForSplit = Math.max(0, target - meal - transport);
        const hourly = wageForSplit / divisor; // 통상시급

        const baseSalary = Math.round(hourly * monthlyContractHours);
        const overtimePay = Math.round(hourly * 1.5 * ot);
        const sum = baseSalary + overtimePay + meal + transport;

        // 연장근로 법정 한도(주 12h ≒ 월 52h) 초과 여부
        const weeklyOt = ot / 4.345;
        const otOverLimit = weeklyOt > 12;

        return {
            target, hourly, monthlyContractHours, baseSalary, overtimePay,
            meal, transport, sum, ot, weeklyOt,
            belowMinWage: hourly > 0 && hourly < minWage,
            otOverLimit
        };
    }, [payData.targetTotal, payData.weeklyHours, payData.overtimeHours,
        payData.mealAllowance, payData.transportAllowance, payType, monthlyMode, minWage]);

    // 역산 결과를 실제 급여 항목(기본급)에 적용
    const applyReverse = () => {
        if (!reverseCalc) return;
        setPayData(prev => ({ ...prev, baseSalary: String(reverseCalc.baseSalary), annualLeavePay: '' }));
    };

    // === 기본급 고정 + 나머지 상여 (bonusFlex) ===
    // 기본급은 직접 입력(고정), 월급 총액 목표에서 기본급·약정연장·비과세를 뺀 잔액을 상여로 배정.
    // 상여는 경영성과·회사사정에 따라 조정 가능하여 인건비 유연성을 확보.
    const bonusCalc = useMemo(() => {
        if (payType !== 'monthly' || monthlyMode !== 'bonusFlex') return null;
        const target = parseFloat(payData.targetTotal) || 0;
        const base = parseFloat(payData.baseSalary) || 0;
        if (target <= 0 || base <= 0) return null;

        const ot = parseFloat(payData.overtimeHours) || 0;
        const meal = Math.min(parseFloat(payData.mealAllowance) || 0, 200000);
        const transport = Math.min(parseFloat(payData.transportAllowance) || 0, 200000);

        const monthlyContractHours = getMonthlyContractHours(payData.weeklyHours);
        const hourly = base / monthlyContractHours; // 통상시급 (기본급 기준)
        const overtimePay = Math.round(hourly * 1.5 * ot);
        const bonus = Math.round(target - base - overtimePay - meal - transport);

        return {
            target, base, hourly, monthlyContractHours, ot, overtimePay, meal, transport, bonus,
            belowMinWage: hourly > 0 && hourly < minWage,
            negativeBonus: bonus < 0
        };
    }, [payData.targetTotal, payData.baseSalary, payData.weeklyHours, payData.overtimeHours,
        payData.mealAllowance, payData.transportAllowance, payType, monthlyMode, minWage]);

    // 잔액 상여를 상여금 항목에 적용
    const applyBonus = () => {
        if (!bonusCalc) return;
        setPayData(prev => ({ ...prev, bonus: String(Math.max(0, bonusCalc.bonus)), annualLeavePay: '' }));
    };

    // === 근태기록 → 주별 근무시간 자동집계 (시급제) ===
    // 월을 7일 단위로 구간화: 1~7일=1주, 8~14일=2주, … 29일~=5주.
    // 유급시간 = 실 근무시간(work_hours) + 유급휴가분.
    //   · 연차 = 8h 유급휴가 (근로기준법 제60조, 사용 시 1일 통상임금 = 8h 지급)
    //   · 반차 = 실근무(보통 4h) + 4h 유급휴가
    // 개근 일수에는 출근·지각·조퇴·반차 + 연차(유급휴가는 소정근로일 개근 간주) 포함.
    const attendanceWeekly = useMemo(() => {
        if (!selectedEmpId) return null;
        const recs = (attendance || []).filter(a => a.employee_id === selectedEmpId && a.date?.startsWith(yearMonth));
        if (recs.length === 0) return null;
        const PAID_LEAVE = { '연차': 8, '반차': 4 }; // 유급휴가 시간(반차는 work_hours에 더해 4h)
        const ATTEND_DAY = ['출근', '지각', '조퇴', '반차', '연차']; // 개근(소정근로일 출근 간주)
        const hours = [0, 0, 0, 0, 0];
        const days = [0, 0, 0, 0, 0];
        let total = 0, hasHours = false, leaveTotal = 0;
        recs.forEach(a => {
            const day = parseInt((a.date || '').split('-')[2]) || 0;
            if (day < 1) return;
            const wk = Math.min(4, Math.floor((day - 1) / 7));
            const leave = PAID_LEAVE[a.status] || 0;
            const paid = (parseFloat(a.work_hours) || 0) + leave; // 유급시간 = 근무 + 유급휴가
            if (paid > 0) { hours[wk] += paid; total += paid; hasHours = true; }
            if (leave > 0) leaveTotal += leave;
            if (ATTEND_DAY.includes(a.status)) days[wk] += 1;
        });
        return { hours, days, total, leaveTotal, count: recs.length, hasHours };
    }, [attendance, selectedEmpId, yearMonth]);

    const applyAttendance = () => {
        if (!attendanceWeekly) return;
        setPayData(prev => ({
            ...prev,
            weeklyWorkedHours: attendanceWeekly.hours.map(h => h > 0 ? String(Math.round(h * 10) / 10) : ''),
            weeklyWorkedDays: attendanceWeekly.days.map(d => d > 0 ? String(d) : ''),
            workedHours: ''
        }));
    };

    // === 급여대장: 선택월 전체 직원 급여 일람 ===
    const ledgerRows = useMemo(() => {
        const recs = (payrollRecords || []).filter(r => r.year_month === yearMonth);
        return recs.map(r => {
            let c = {};
            try { c = JSON.parse(r.calculation) || {}; } catch { c = {}; }
            const emp = (employees || []).find(e => e.id === r.employee_id) || {};
            return {
                emp_id: emp.emp_id || '',
                name: r.employee_name || emp.name || '',
                department: emp.department || '',
                position: emp.position || '',
                payTypeLabel: r.pay_type === 'hourly' ? '시급제' : '월급제',
                baseSalary: c.grossBase || 0,
                overtimePay: c.overtimePay || 0,
                nightPay: c.nightPay || 0,
                holidayPay: c.holidayPay || 0,
                weeklyHolidayPay: c.weeklyHolidayPay || 0,
                bonus: c.bonus || 0,
                annualLeavePay: c.annualLeavePay || 0,
                holidayBonus: c.holidayBonus || 0,
                performanceBonus: c.performanceBonus || 0,
                mealAllowance: c.nonTaxMeal || 0,
                transportAllowance: c.nonTaxTransport || 0,
                totalPay: c.totalPay ?? r.total_pay ?? 0,
                nationalPension: c.nationalPension || 0,
                healthInsurance: c.healthInsurance || 0,
                longTermCare: c.longTermCare || 0,
                employmentInsurance: c.employmentInsurance || 0,
                incomeTax: c.incomeTax || 0,
                localIncomeTax: c.localIncomeTax || 0,
                yearEndAdjust: c.yearEndAdjust || 0,
                totalDeduction: c.totalDeduction ?? r.total_deduction ?? 0,
                netPay: c.netPay ?? r.net_pay ?? 0,
            };
        }).sort((a, b) => (a.department || '').localeCompare(b.department || '') || (a.name || '').localeCompare(b.name || ''));
    }, [payrollRecords, yearMonth, employees]);

    const ledgerTotals = useMemo(() => {
        const t = {};
        LEDGER_COLUMNS.forEach(col => { if (col.num) t[col.key] = ledgerRows.reduce((s, r) => s + (r[col.key] || 0), 0); });
        return t;
    }, [ledgerRows]);

    const exportLedger = () => {
        if (ledgerRows.length === 0) { alert('해당 월에 저장된 급여 기록이 없습니다.'); return; }
        const totalRow = { emp_id: '', name: '합계', department: '', position: '', payTypeLabel: `${ledgerRows.length}명`, ...ledgerTotals };
        const data = [...ledgerRows, totalRow];
        const columns = LEDGER_COLUMNS.map(c => ({
            key: c.key, label: c.label,
            format: c.num ? (v) => (typeof v === 'number' ? Math.round(v) : (v || '')) : undefined
        }));
        exportToExcel(data, columns, `급여대장_${yearMonth}`, `${yearMonth} 급여대장`);
    };

    // 1일 근무시간 → 월 약정 연장시간 자동환산: (1일근무 − 8) × 주근무일 × 4.345
    const setDailyWork = (field, val) => {
        setPayData(prev => {
            const next = { ...prev, [field]: val };
            const d = parseFloat(next.dailyWorkHours) || 0;
            const wd = parseFloat(next.workDays) || 5;
            if (d > 0) {
                const monthlyOt = Math.round(Math.max(0, d - 8) * wd * 4.345 * 10) / 10;
                next.overtimeHours = String(monthlyOt);
            }
            return next;
        });
    };

    // 1일근무→약정연장 자동환산 입력 행 (역산·기본급+상여 패널 공용)
    const dailyOtRow = (accent) => {
        const lbl = { fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' };
        const inp = { width: '100%', padding: '7px 9px', borderRadius: '8px', border: `1px solid ${accent}`, background: 'white', color: '#1e293b', fontSize: '0.82rem' };
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <div>
                    <label style={lbl}>1일 근무(휴게제외)</label>
                    <input type="number" placeholder="예: 9" value={payData.dailyWorkHours}
                        onChange={(e) => setDailyWork('dailyWorkHours', e.target.value)} style={inp} />
                </div>
                <div>
                    <label style={lbl}>주 근무일수</label>
                    <input type="number" placeholder="5" min="1" max="7" value={payData.workDays}
                        onChange={(e) => setDailyWork('workDays', e.target.value)} style={inp} />
                </div>
                <div>
                    <label style={lbl}>월 약정연장(h)</label>
                    <input type="number" placeholder="자동" value={payData.overtimeHours}
                        onChange={(e) => setPayData({ ...payData, overtimeHours: e.target.value })}
                        style={{ ...inp, fontWeight: 700 }} />
                </div>
            </div>
        );
    };

    const handleEmpSelect = (empId) => {
        setSelectedEmpId(empId);
        setShowPaystub(false);

        const emp = activeEmployees.find(e => e.id === empId);
        if (!emp) return;

        // ① 직전 급여 기록에서 고정 항목(기본급·시급·수당·부양가족 등)을 자동 승계
        //    → 매월 동일 직원의 급여를 백지에서 재입력하던 불편 해소
        const prev = (payrollRecords || [])
            .filter(r => r.employee_id === empId && r.year_month !== yearMonth)
            .sort((a, b) => (b.year_month || '').localeCompare(a.year_month || ''))[0];

        let carried = {};
        if (prev) {
            try {
                const p = JSON.parse(prev.pay_data) || {};
                setPayType(prev.pay_type || 'monthly');
                // 직전에 쓰던 입력 방식 복원
                setMonthlyMode(p.monthlyMode || (p.targetTotal ? 'reverse' : 'manual'));
                carried = {
                    baseSalary: p.baseSalary || '',
                    targetTotal: p.targetTotal || '',     // 월급 총액 (고정)
                    overtimeHours: p.overtimeHours || '', // 약정 연장시간 (매월 고정)
                    dailyWorkHours: p.dailyWorkHours || '', // 1일 근무시간 (고정)
                    workDays: p.workDays || '5',          // 주 근무일수 (고정)
                    hourlyWage: p.hourlyWage || '',
                    weeklyHours: p.weeklyHours || '40',
                    scheduledDays: p.scheduledDays || '5',
                    mealAllowance: p.mealAllowance || '',
                    transportAllowance: p.transportAllowance || '',
                    dependents: p.dependents || '1',
                    childDependents: p.childDependents || '0',
                    leavePromotion: !!p.leavePromotion // 연차사용촉진 시행 여부 (고정)
                };
            } catch { /* 손상된 기록은 무시하고 빈 폼 */ }
        }

        // ② 근속연수 기준 미사용 연차를 연차수당 일수에 자동 반영
        //    단, 연차사용촉진을 시행하는 직원은 수당 지급 의무가 없으므로 0 처리(제61조)
        const ref = new Date(year, month, 0);
        const svc = getServiceInfo(emp.join_date, ref);
        const remaining = svc ? Math.max(0, svc.grantedLeave - (parseInt(emp.used_leave) || 0)) : 0;
        const promo = !!carried.leavePromotion;

        setPayData(prevData => ({
            ...prevData,
            // 월별 변동 항목만 초기화 (약정 연장·월급총액 등 고정값은 위에서 승계)
            workedHours: '',
            weeklyWorkedHours: ['', '', '', '', ''],
            weeklyWorkedDays: ['', '', '', '', ''],
            nightHours: '', holidayHours: '', // 주말 특근·야간은 실제 근무분만 매월 입력
            bonus: '', performanceBonus: '', holidayBonus: '', annualLeavePay: '',
            yearEndTax: '', // 연말정산은 2월에만 직접 입력
            ...carried,
            annualLeaveDays: promo ? '0' : (remaining ? String(remaining) : '')
        }));
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

    // === 급여 저장 ===
    const savePayroll = async () => {
        if (!selectedEmpId || calculation.totalPay <= 0) {
            alert('직원을 선택하고 급여를 입력해주세요.');
            return;
        }
        setIsSaving(true);
        try {
            // Check for existing record
            const existing = (payrollRecords || []).find(r => r.employee_id === selectedEmpId && r.year_month === yearMonth);
            if (existing) {
                if (!confirm(`${selectedEmp?.name}의 ${yearMonth} 급여가 이미 존재합니다. 덮어쓰시겠습니까?`)) {
                    setIsSaving(false);
                    return;
                }
                await deletePayrollRecord(existing.id);
            }
            const record = {
                employee_id: selectedEmpId,
                employee_name: selectedEmp?.name || '',
                year_month: yearMonth,
                pay_type: payType,
                pay_data: JSON.stringify({ ...payData, monthlyMode }),
                calculation: JSON.stringify(calculation),
                total_pay: calculation.totalPay,
                net_pay: calculation.netPay,
                total_deduction: calculation.totalDeduction
            };
            const { error } = await addPayrollRecord(record);
            if (error) throw error;
            alert(`${selectedEmp?.name} ${yearMonth} 급여가 저장되었습니다.`);
        } catch (err) {
            console.error('급여 저장 실패:', err);
            alert('급여 저장에 실패했습니다.');
        } finally {
            setIsSaving(false);
        }
    };

    // === 저장된 급여 불러오기 ===
    const loadPayroll = (record) => {
        try {
            const savedData = JSON.parse(record.pay_data);
            setSelectedEmpId(record.employee_id);
            setPayType(record.pay_type || 'monthly');
            setMonthlyMode(savedData.monthlyMode || (savedData.targetTotal ? 'reverse' : 'manual'));
            setYearMonth(record.year_month);
            // Ensure weeklyWorkedHours/Days arrays exist
            setPayData({
                ...savedData,
                weeklyWorkedHours: savedData.weeklyWorkedHours || ['', '', '', '', ''],
                weeklyWorkedDays: savedData.weeklyWorkedDays || ['', '', '', '', ''],
                scheduledDays: savedData.scheduledDays || '5'
            });
            setShowHistory(false);
        } catch (err) {
            console.error('불러오기 실패:', err);
            alert('급여 데이터를 불러올 수 없습니다.');
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

            {/* 인건비 시각화 — 부서별 도넛(선택월) + 월별 추이 */}
            {(() => {
                const monthRecords = (payrollRecords || []).filter(r => r.year_month === yearMonth);
                const byDept = {};
                monthRecords.forEach(r => {
                    const emp = employees.find(e => e.id === r.employee_id);
                    const d = emp?.department || '미지정';
                    byDept[d] = (byDept[d] || 0) + (parseFloat(r.net_pay || 0) || 0);
                });
                const byMonth = {};
                (payrollRecords || []).forEach(r => {
                    if (!r.year_month) return;
                    byMonth[r.year_month] = (byMonth[r.year_month] || 0) + (parseFloat(r.net_pay || 0) || 0);
                });
                const months = Object.keys(byMonth).sort().slice(-6);
                if (monthRecords.length === 0 && months.length === 0) return null;
                const palette = ['#6366f1', '#16a34a', '#f59e0b', '#ef4444', '#3b82f6', '#a855f7', '#06b6d4', '#94a3b8'];
                const deptEntries = Object.entries(byDept).sort((a, b) => b[1] - a[1]);
                const monthTotal = monthRecords.reduce((s, r) => s + (parseFloat(r.net_pay || 0) || 0), 0);
                return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12 }}>부서별 실수령액 ({yearMonth})</div>
                            {deptEntries.length > 0 ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                    <DonutKpi size={112}
                                        segments={deptEntries.map(([, v], i) => ({ value: v, color: palette[i % palette.length] }))}
                                        centerValue={`${Math.round(monthTotal / 10000).toLocaleString()}만`} centerLabel="합계" />
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: '0.82rem' }}>
                                        {deptEntries.map(([d, v], i) => (
                                            <span key={d} style={{ color: 'var(--text-muted)' }}>
                                                <i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 3, background: palette[i % palette.length], marginRight: 5 }} />
                                                {d} <b style={{ color: 'var(--text-main)' }}>₩{Math.round(v).toLocaleString()}</b>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>해당 월 급여 기록이 없습니다.</div>}
                        </div>
                        <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
                            <div style={{ fontSize: '0.85rem', fontWeight: 800, marginBottom: 12 }}>월별 인건비 추이</div>
                            {months.length > 0
                                ? <MiniBar unit="원" barColor="#6366f1" items={months.map(m => ({ label: m.slice(2), value: Math.round(byMonth[m]) }))} />
                                : <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1rem 0' }}>급여 기록이 없습니다.</div>}
                        </div>
                    </div>
                );
            })()}

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
                        <div style={{ marginBottom: '10px' }}>
                            {/* 입력 방식 토글: 직접입력 / 총액 역산 / 기본급 고정+상여 */}
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                                {[
                                    { key: 'manual', label: '기본급 직접' },
                                    { key: 'reverse', label: '💡 총액 역산' },
                                    { key: 'bonusFlex', label: '🔧 기본급+상여' }
                                ].map(t => (
                                    <button key={t.key} type="button" onClick={() => setMonthlyMode(t.key)}
                                        style={{
                                            flex: 1, padding: '8px 4px', borderRadius: '8px', cursor: 'pointer',
                                            fontWeight: 700, fontSize: '0.73rem',
                                            background: monthlyMode === t.key ? '#4f46e5' : 'var(--card)',
                                            color: monthlyMode === t.key ? 'white' : 'var(--text-muted)',
                                            border: `1px solid ${monthlyMode === t.key ? '#4f46e5' : 'var(--border)'}`
                                        }}>
                                        {t.label}
                                    </button>
                                ))}
                            </div>

                            {monthlyMode === 'manual' && (
                                <div className="form-group">
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>기본급 (월)</label>
                                    <input type="number" placeholder="0" value={payData.baseSalary}
                                        onChange={(e) => setPayData({ ...payData, baseSalary: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                                </div>
                            )}

                            {/* 🔧 기본급 고정 + 나머지 상여 (인건비 유연성) */}
                            {monthlyMode === 'bonusFlex' && (
                                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#9a3412', lineHeight: 1.5, marginBottom: '10px' }}>
                                        <strong>기본급은 직접 고정</strong>하고, 월급 총액에서 기본급·약정연장·비과세를 뺀 <strong>나머지를 상여(변동)</strong>로 배정합니다.
                                        상여는 경영성과에 따라 조정 가능해 인건비 유연성을 확보합니다.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>기본급 (고정)</label>
                                            <input type="number" placeholder="예: 2200000" value={payData.baseSalary}
                                                onChange={(e) => setPayData({ ...payData, baseSalary: e.target.value })}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fdba74', background: 'white', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700 }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>월급 총액 (목표)</label>
                                            <input type="number" placeholder="예: 4400000" value={payData.targetTotal}
                                                onChange={(e) => setPayData({ ...payData, targetTotal: e.target.value })}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #fdba74', background: 'white', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700 }} />
                                        </div>
                                    </div>
                                    {/* 1일 근무시간 → 월 약정연장 자동환산 */}
                                    {dailyOtRow('#fdba74')}

                                    {/* 입력이 덜 됐을 때 안내 */}
                                    {!bonusCalc && (
                                        <div style={{ marginTop: '10px', padding: '8px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.7rem', color: '#92400e', lineHeight: 1.5 }}>
                                            {!(parseFloat(payData.baseSalary) > 0)
                                                ? '👉 기본급을 입력하세요.'
                                                : !(parseFloat(payData.targetTotal) > 0)
                                                    ? '👉 월급 총액(목표)도 입력하면 상여 잔액이 자동 계산됩니다. (상여 = 총액 − 기본급 − 약정연장 − 비과세)'
                                                    : '👉 입력값을 확인하세요.'}
                                            {' '}약정 연장시간은 아래 <strong>연장근로(시간)</strong> 칸에 입력합니다.
                                        </div>
                                    )}

                                    {bonusCalc && (
                                        <div style={{ marginTop: '10px', background: 'white', borderRadius: '8px', padding: '10px 12px', fontSize: '0.74rem', color: '#1e293b' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#9a3412', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '5px' }}>
                                                <span>통상시급</span>
                                                <span>{fmt(bonusCalc.hourly)}원 <span style={{ fontWeight: 500, color: '#94a3b8' }}>(기본급÷{bonusCalc.monthlyContractHours}h)</span></span>
                                            </div>
                                            {[
                                                { label: `기본급 (고정)`, value: bonusCalc.base },
                                                { label: `약정 연장수당 (${bonusCalc.ot || 0}h ×1.5)`, value: bonusCalc.overtimePay },
                                                { label: '식대 (비과세)', value: bonusCalc.meal },
                                                { label: '교통비 (비과세)', value: bonusCalc.transport }
                                            ].filter(r => r.value > 0).map(r => (
                                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                                                    <span style={{ fontWeight: 600 }}>{fmt(r.value)}원</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}>
                                                <span>→ 상여(잔액)</span>
                                                <span style={{ color: bonusCalc.negativeBonus ? '#dc2626' : '#d97706' }}>{fmt(bonusCalc.bonus)}원</span>
                                            </div>

                                            {bonusCalc.negativeBonus && (
                                                <div style={{ marginTop: '6px', padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    ⚠️ 기본급+연장수당이 목표 총액을 초과합니다. 기본급을 낮추거나 총액을 높이세요.
                                                </div>
                                            )}
                                            {bonusCalc.belowMinWage && (
                                                <div style={{ marginTop: '6px', padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    ⚠️ 기본급 환산 통상시급이 {year}년 최저임금({minWage.toLocaleString()}원) 미만입니다. 상여는 최저임금 보전에 한계가 있으니 기본급을 높이세요.
                                                </div>
                                            )}

                                            <button type="button" onClick={applyBonus} disabled={bonusCalc.negativeBonus}
                                                style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '7px', border: 'none', cursor: bonusCalc.negativeBonus ? 'not-allowed' : 'pointer', background: bonusCalc.negativeBonus ? '#cbd5e1' : '#ea580c', color: 'white', fontWeight: 700, fontSize: '0.76rem' }}>
                                                ↓ 상여금 {fmt(Math.max(0, bonusCalc.bonus))}원 자동 입력
                                            </button>
                                            <div style={{ marginTop: '8px', padding: '6px 8px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', color: '#92400e', fontSize: '0.66rem', lineHeight: 1.5 }}>
                                                ⚖️ 상여를 줄이거나 늘리려면 근로계약서·취업규칙에 상여가 <strong>“경영성과·회사사정에 따른 변동 상여”</strong>로 규정돼야 합니다. 매월 정기·고정 지급 시 통상임금에 포함되어 조정이 어려워집니다.
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {monthlyMode === 'reverse' && (
                                <div style={{ background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', padding: '12px' }}>
                                    <div style={{ fontSize: '0.72rem', color: '#4338ca', lineHeight: 1.5, marginBottom: '10px' }}>
                                        월급 총액과 <strong>주간 소정근로 + 약정 연장시간</strong>(매월 고정)을 기준으로 통상시급을 역산해
                                        기본급·연장수당으로 자동 분해합니다. <strong>주말 특근비·야간수당은 역산에 포함하지 않고</strong> 실제 근무한 만큼 별도로 가산됩니다.
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>월급 총액 (목표)</label>
                                            <input type="number" placeholder="예: 4400000" value={payData.targetTotal}
                                                onChange={(e) => setPayData({ ...payData, targetTotal: e.target.value })}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #c7d2fe', background: 'white', color: '#1e293b', fontSize: '0.85rem', fontWeight: 700 }} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>주간 소정근로 (h)</label>
                                            <input type="number" placeholder="40" value={payData.weeklyHours}
                                                onChange={(e) => setPayData({ ...payData, weeklyHours: e.target.value })}
                                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #c7d2fe', background: 'white', color: '#1e293b', fontSize: '0.85rem' }} />
                                        </div>
                                    </div>
                                    {/* 1일 근무시간 → 월 약정연장 자동환산 */}
                                    {dailyOtRow('#c7d2fe')}

                                    {/* 역산 결과 미리보기 */}
                                    {reverseCalc && (
                                        <div style={{ marginTop: '10px', background: 'white', borderRadius: '8px', padding: '10px 12px', fontSize: '0.74rem', color: '#1e293b' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#4338ca', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '5px' }}>
                                                <span>통상시급</span>
                                                <span>{fmt(reverseCalc.hourly)}원 <span style={{ fontWeight: 500, color: '#94a3b8' }}>(÷{reverseCalc.monthlyContractHours}h)</span></span>
                                            </div>
                                            {[
                                                { label: `기본급 (${reverseCalc.monthlyContractHours}h)`, value: reverseCalc.baseSalary },
                                                { label: `약정 연장수당 (${reverseCalc.ot || 0}h ×1.5)`, value: reverseCalc.overtimePay },
                                                { label: '식대 (비과세)', value: reverseCalc.meal },
                                                { label: '교통비 (비과세)', value: reverseCalc.transport }
                                            ].filter(r => r.value > 0).map(r => (
                                                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                                                    <span style={{ color: 'var(--text-muted)' }}>{r.label}</span>
                                                    <span style={{ fontWeight: 600 }}>{fmt(r.value)}원</span>
                                                </div>
                                            ))}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}>
                                                <span>합계</span>
                                                <span style={{ color: reverseCalc.sum === reverseCalc.target ? '#059669' : '#d97706' }}>
                                                    {fmt(reverseCalc.sum)}원 / 목표 {fmt(reverseCalc.target)}원
                                                </span>
                                            </div>

                                            {reverseCalc.belowMinWage && (
                                                <div style={{ marginTop: '6px', padding: '6px 8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#dc2626', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    ⚠️ 통상시급이 {year}년 최저임금({minWage.toLocaleString()}원) 미만입니다.
                                                </div>
                                            )}
                                            {reverseCalc.otOverLimit && (
                                                <div style={{ marginTop: '6px', padding: '6px 8px', background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '6px', color: '#92400e', fontWeight: 600, fontSize: '0.68rem' }}>
                                                    ⚠️ 연장근로 약 주 {reverseCalc.weeklyOt.toFixed(1)}h — 법정 한도(주 12h)를 초과합니다.
                                                </div>
                                            )}

                                            <button type="button" onClick={applyReverse}
                                                style={{ width: '100%', marginTop: '8px', padding: '8px', borderRadius: '7px', border: 'none', cursor: 'pointer', background: '#4f46e5', color: 'white', fontWeight: 700, fontSize: '0.76rem' }}>
                                                ↓ 급여 항목에 기본급 {fmt(reverseCalc.baseSalary)}원 자동 입력
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>시급</label>
                                    <input type="number" placeholder="0" value={payData.hourlyWage}
                                        onChange={(e) => setPayData({ ...payData, hourlyWage: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>주간 소정근로 (h)</label>
                                    <input type="number" placeholder="40" value={payData.weeklyHours}
                                        onChange={(e) => setPayData({ ...payData, weeklyHours: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>주간 소정근로일수</label>
                                    <input type="number" placeholder="5" min="1" max="7" value={payData.scheduledDays}
                                        onChange={(e) => setPayData({ ...payData, scheduledDays: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                                </div>
                            </div>

                            {/* 주별 근무시간 입력 */}
                            <div style={{
                                background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '10px',
                                padding: '12px', marginBottom: '10px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
                                        📅 주별 근무시간 입력
                                    </label>
                                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        ∑ {payData.weeklyWorkedHours.reduce((s, h) => s + (parseFloat(h) || 0), 0)}h
                                    </span>
                                </div>
                                {/* 근태기록에서 자동 불러오기 */}
                                {selectedEmpId && (
                                    <div style={{ marginBottom: '8px' }}>
                                        {attendanceWeekly?.hasHours ? (
                                            <button type="button" onClick={applyAttendance}
                                                style={{ width: '100%', padding: '8px', borderRadius: '8px', border: '1px solid #0ea5e9', background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: '0.76rem', cursor: 'pointer' }}>
                                                📥 근태기록에서 자동 불러오기 ({yearMonth} · 총 {Math.round(attendanceWeekly.total * 10) / 10}h{attendanceWeekly.leaveTotal > 0 ? ` · 연차/반차 유급 ${attendanceWeekly.leaveTotal}h 포함` : ''})
                                            </button>
                                        ) : (
                                            <div style={{ padding: '7px 9px', borderRadius: '8px', background: '#f8fafc', border: '1px dashed var(--border)', fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                💡 {attendanceWeekly?.count > 0
                                                    ? '근태기록은 있으나 근무시간이 0입니다. 근태 관리에서 날짜별 실 근무시간을 입력하세요.'
                                                    : '이 달 근태기록이 없습니다. 직원 페이지 → 근태 관리에서 입력하면 여기로 자동 집계됩니다.'}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                                    {payData.weeklyWorkedHours.map((wh, idx) => {
                                        const hours = parseFloat(wh) || 0;
                                        const days = parseInt(payData.weeklyWorkedDays[idx]) || 0;
                                        const scheduled = parseInt(payData.scheduledDays) || 5;
                                        const hoursOk = hours >= 15;
                                        const daysOk = days >= scheduled;
                                        const qualifies = hoursOk && daysOk;
                                        const hasInput = hours > 0;
                                        return (
                                            <div key={idx} style={{ textAlign: 'center' }}>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '3px', fontWeight: 600 }}>
                                                    {idx + 1}주상
                                                </div>
                                                <input
                                                    type="number"
                                                    placeholder="시간"
                                                    value={wh}
                                                    onChange={(e) => {
                                                        const arr = [...payData.weeklyWorkedHours];
                                                        arr[idx] = e.target.value;
                                                        setPayData({ ...payData, weeklyWorkedHours: arr, workedHours: '' });
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '5px 3px', borderRadius: '6px',
                                                        border: `1.5px solid ${hasInput ? (qualifies ? '#059669' : '#f59e0b') : 'var(--border)'}`,
                                                        background: 'var(--card)', color: 'var(--text)',
                                                        fontSize: '0.82rem', textAlign: 'center', marginBottom: '3px'
                                                    }}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="일"
                                                    min="0" max="7"
                                                    value={payData.weeklyWorkedDays[idx]}
                                                    onChange={(e) => {
                                                        const arr = [...payData.weeklyWorkedDays];
                                                        arr[idx] = e.target.value;
                                                        setPayData({ ...payData, weeklyWorkedDays: arr });
                                                    }}
                                                    style={{
                                                        width: '100%', padding: '4px 3px', borderRadius: '6px',
                                                        border: `1.5px solid ${hasInput && days > 0 ? (daysOk ? '#059669' : '#ef4444') : 'var(--border)'}`,
                                                        background: 'var(--card)', color: 'var(--text)',
                                                        fontSize: '0.75rem', textAlign: 'center'
                                                    }}
                                                />
                                                {hasInput && (
                                                    <div style={{
                                                        fontSize: '0.55rem', marginTop: '2px', fontWeight: 700,
                                                        color: qualifies ? '#059669' : '#dc2626', lineHeight: 1.2
                                                    }}>
                                                        {!hoursOk ? '15h미만' : !daysOk ? `미개근` : '✅주휴O'}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                                    <span>↑시간 / ↓출근일수</span>
                                    <span>주 15h 이상 + {payData.scheduledDays || 5}일 개근 시 주휴수당 지급</span>
                                </div>
                            </div>

                            {/* 또는 월 총시간 직접입력 */}
                            {!payData.weeklyWorkedHours.some(h => parseFloat(h) > 0) && (
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                        또는 월 총 근무시간 직접입력
                                    </label>
                                    <input type="number" placeholder="예: 174 (주휴 미포함) 또는 209 (주휴 포함)" value={payData.workedHours}
                                        onChange={(e) => setPayData({ ...payData, workedHours: e.target.value })}
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.85rem' }} />
                                </div>
                            )}
                        </>
                    )}

                    {/* 최저임금 경고 */}
                    {minWageWarning && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            padding: '10px 14px', borderRadius: '10px', marginBottom: '10px',
                            background: '#fef2f2', color: '#dc2626', fontSize: '0.78rem',
                            border: '1px solid #fecaca', fontWeight: 600
                        }}>
                            ⚠️ {minWageWarning}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                                {payType === 'monthly' && monthlyMode !== 'manual' ? '약정 연장근로 (시간/월·고정)' : '연장근로 (시간)'}
                            </label>
                            <input type="number" placeholder="0" value={payData.overtimeHours}
                                onChange={(e) => setPayData({ ...payData, overtimeHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: `1px solid ${payType === 'monthly' && monthlyMode !== 'manual' ? '#c7d2fe' : 'var(--border)'}`, background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>야간근로 (시간)</label>
                            <input type="number" placeholder="0" value={payData.nightHours}
                                onChange={(e) => setPayData({ ...payData, nightHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>주말특근·휴일근로 (시간)</label>
                            <input type="number" placeholder="0" value={payData.holidayHours}
                                onChange={(e) => setPayData({ ...payData, holidayHours: e.target.value })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                            {calculation.holidayPay > 0 && (
                                <div style={{ fontSize: '0.62rem', color: '#059669', marginTop: '3px', fontWeight: 600 }}>
                                    특근비 +{fmt(calculation.holidayPay)}원 (통상시급×1.5, 별도 가산)
                                </div>
                            )}
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
                            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>미사용 연차 (일수)</label>
                            <input type="number" placeholder="0" min="0" value={payData.annualLeaveDays}
                                disabled={!!payData.leavePromotion}
                                onChange={(e) => setPayData({ ...payData, annualLeaveDays: e.target.value, annualLeavePay: '' })}
                                style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: payData.leavePromotion ? '#f1f5f9' : 'var(--card)', color: payData.leavePromotion ? '#94a3b8' : 'var(--text)', fontSize: '0.82rem' }} />
                            {/* 근속연수 기준 발생/미사용 연차 안내 + 자동입력 */}
                            {serviceInfo && (
                                <div style={{
                                    fontSize: '0.65rem', marginTop: '4px', padding: '5px 7px', borderRadius: '6px',
                                    background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', lineHeight: 1.5
                                }}>
                                    <div style={{ fontWeight: 700 }}>
                                        🗓️ 근속 {serviceInfo.years}년 {serviceInfo.months}개월
                                        <span style={{ fontWeight: 500, color: '#6366f1' }}>
                                            {' '}· 발생연차 {serviceInfo.grantedLeave}일 · 사용 {parseInt(selectedEmp?.used_leave) || 0}일
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '2px' }}>
                                        <span>→ 미사용 <strong style={{ color: '#dc2626' }}>{remainingLeave}일</strong></span>
                                        {!payData.leavePromotion && remainingLeave > 0 && String(remainingLeave) !== String(payData.annualLeaveDays) && (
                                            <button type="button"
                                                onClick={() => setPayData({ ...payData, annualLeaveDays: String(remainingLeave), annualLeavePay: '' })}
                                                style={{ padding: '2px 8px', borderRadius: '5px', border: '1px solid #4f46e5', background: '#4f46e5', color: 'white', fontSize: '0.62rem', fontWeight: 700, cursor: 'pointer' }}>
                                                {remainingLeave}일 자동입력
                                            </button>
                                        )}
                                    </div>
                                    {/* 연차사용촉진 시행 시 미사용 연차수당 지급 의무 면제 (근로기준법 제61조) */}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px', paddingTop: '5px', borderTop: '1px dashed #c7d2fe', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={!!payData.leavePromotion}
                                            onChange={(e) => setPayData({ ...payData, leavePromotion: e.target.checked, annualLeaveDays: e.target.checked ? '0' : '', annualLeavePay: '' })} />
                                        <span style={{ fontWeight: 700 }}>연차사용촉진 시행 (수당 미지급)</span>
                                    </label>
                                    {payData.leavePromotion && (
                                        <div style={{ marginTop: '4px', color: '#059669', fontWeight: 600 }}>
                                            ✅ 사용촉진(제61조) 시행 → 미사용 연차수당 지급 의무 면제. 연차수당 0 처리.
                                        </div>
                                    )}
                                </div>
                            )}
                            {calculation.dailyWage > 0 && (
                                <div style={{ fontSize: '0.65rem', color: '#4f46e5', marginTop: '3px', fontWeight: 600 }}>
                                    1일급: {fmt(calculation.dailyWage)}원
                                    {payData.annualLeaveDays > 0 && ` × ${payData.annualLeaveDays}일 = ${fmt(calculation.annualLeavePay)}원`}
                                </div>
                            )}
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

                    {/* 연말정산 (2월 급여 반영) */}
                    <div style={{ marginTop: '12px', padding: '10px 12px', background: month === 2 ? '#eff6ff' : 'var(--card)', border: `1px solid ${month === 2 ? '#bfdbfe' : 'var(--border)'}`, borderRadius: '10px' }}>
                        <label style={{ fontSize: '0.74rem', fontWeight: 700, color: '#1d4ed8', display: 'block', marginBottom: '6px' }}>
                            🧾 연말정산 정산세액 {month === 2 ? '(2월 — 해당월)' : '(보통 2월 급여 반영)'}
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                            <div>
                                <select value={payData.yearEndType}
                                    onChange={(e) => setPayData({ ...payData, yearEndType: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }}>
                                    <option value="refund">환급 (+, 돌려받음)</option>
                                    <option value="pay">추가납부 (−, 더 냄)</option>
                                </select>
                            </div>
                            <div>
                                <input type="number" placeholder="0" min="0" value={payData.yearEndTax}
                                    onChange={(e) => setPayData({ ...payData, yearEndTax: e.target.value })}
                                    style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--text)', fontSize: '0.82rem' }} />
                            </div>
                        </div>
                        {calculation.yearEndAmount > 0 && (
                            <div style={{ fontSize: '0.66rem', marginTop: '5px', fontWeight: 600, color: payData.yearEndType === 'pay' ? '#dc2626' : '#059669' }}>
                                {payData.yearEndType === 'pay'
                                    ? `추가납부 −${fmt(calculation.yearEndAmount)}원 → 실수령액 차감`
                                    : `환급 +${fmt(calculation.yearEndAmount)}원 → 실수령액 가산`}
                            </div>
                        )}
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
                            {
                                label: payType === 'monthly' ? '기본급' : (() => {
                                    const weeklySum = payData.weeklyWorkedHours.reduce((s, h) => s + (parseFloat(h) || 0), 0);
                                    const displayHours = weeklySum > 0 ? weeklySum : (payData.workedHours || 0);
                                    return `기본급 (${fmt(calculation.effectiveHourly)}원 × ${displayHours}h)`;
                                })(), value: calculation.grossBase
                            },
                            { label: '연장근로수당 (×1.5)', value: calculation.overtimePay },
                            { label: '야간근로수당 (×0.5 가산)', value: calculation.nightPay },
                            { label: '휴일근로수당 (×1.5)', value: calculation.holidayPay },
                            {
                                label: (() => {
                                    if (calculation.weeklyBreakdown?.length > 0) {
                                        const eligible = calculation.weeklyBreakdown.filter(w => w.qualifies).length;
                                        return `주휴수당 (${eligible}/${calculation.weeklyBreakdown.length}주 해당)`;
                                    }
                                    if (calculation.is209Pattern) return `주휴수당 (${payData.workedHours}h에 주휴 포함)`;
                                    return `주휴수당 (주${payData.weeklyHours || 40}h)`;
                                })(), value: calculation.weeklyHolidayPay
                            },
                            { label: '상여금', value: calculation.bonus },
                            { label: `연차수당${calculation.annualLeaveDays > 0 ? ` (1일급 ${fmt(calculation.dailyWage)}원×${calculation.annualLeaveDays}일)` : ''}`, value: calculation.annualLeavePay },
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

                        {/* 주별 주휴수당 상세 */}
                        {calculation.weeklyBreakdown?.length > 0 && (
                            <div style={{
                                background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
                                padding: '8px 10px', marginTop: '6px', fontSize: '0.72rem'
                            }}>
                                <div style={{ fontWeight: 700, color: '#059669', marginBottom: '4px' }}>📊 주별 주휴수당 상세</div>
                                {calculation.weeklyBreakdown.map(w => (
                                    <div key={w.week} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0', color: w.qualifies ? '#065f46' : '#92400e' }}>
                                        <span>{w.week}주차: {w.hours}h / {w.days || 0}일 {w.qualifies ? '✅' : `❌(${w.reason})`}</span>
                                        <span style={{ fontWeight: 600 }}>{w.qualifies ? `${fmt(w.pay)}원` : '미지급'}</span>
                                    </div>
                                ))}
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #bbf7d0', paddingTop: '3px', marginTop: '3px', fontWeight: 700, color: '#059669' }}>
                                    <span>주휴수당 합계</span>
                                    <span>{fmt(calculation.weeklyHolidayPay)}원</span>
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '0.85rem', borderTop: '1px solid var(--border)', marginTop: '4px', fontWeight: 700, color: '#059669' }}>
                            <span>지급총액</span>
                            <span>{fmt(calculation.totalPay)}원</span>
                        </div>
                    </div>

                    {calculation.is209Pattern && (
                        <div style={{
                            background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: '8px',
                            padding: '0.6rem 0.8rem', marginBottom: '14px', fontSize: '0.78rem', color: '#92400e'
                        }}>
                            ⚠️ <strong>근무시간 {payData.workedHours}h</strong>는 주휴시간이 포함된 시간입니다 (주{payData.weeklyHours || 40}h × 52주 ÷ 12개월).
                            주휴수당이 이중 계산되지 않도록 별도 주휴수당을 ₩0으로 처리했습니다.
                        </div>
                    )}

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
                        {/* 연말정산 — 환급(+)/추가납부(−) */}
                        {calculation.yearEndAmount > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '0.8rem' }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    연말정산 {calculation.yearEndType === 'pay' ? '추가납부' : '환급'}
                                </span>
                                <span style={{ fontWeight: 600, color: calculation.yearEndType === 'pay' ? '#dc2626' : '#059669' }}>
                                    {calculation.yearEndType === 'pay' ? '-' : '+'}{fmt(calculation.yearEndAmount)}원
                                </span>
                            </div>
                        )}
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
                        <>
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
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                <button onClick={savePayroll} disabled={isSaving}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                                        padding: '10px', borderRadius: '10px', border: '1px solid #059669',
                                        cursor: 'pointer', background: '#f0fdf4', color: '#059669',
                                        fontWeight: 700, fontSize: '0.85rem', opacity: isSaving ? 0.7 : 1
                                    }}>
                                    <Save size={14} />
                                    {isSaving ? '저장 중...' : 'DB에 저장'}
                                </button>
                            </div>
                        </>
                    )}
                    {!selectedEmp && (
                        <div style={{ fontSize: '0.78rem', color: '#f59e0b', textAlign: 'center', marginTop: '8px', fontWeight: 500 }}>
                            ⚠️ PDF 생성을 위해 직원을 선택해주세요
                        </div>
                    )}
                </div>
            </div>

            {/* 주휴수당 법적 안내 */}
            <div style={{
                background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                border: '1px solid var(--border)', marginBottom: '1.5rem', fontSize: '0.78rem',
                lineHeight: 1.7, color: 'var(--text-muted)'
            }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    📜 주휴수당 계산 방식 및 법적 근거
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#4f46e5' }}>■ 법적 근거</span>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        <li><strong>근로기준법 제55조 (휴일)</strong>: 사용자는 1주간 소정근로일을 개근한 근로자에게 1주일에 평균 1회 이상의 유급휴일을 주어야 한다.</li>
                        <li><strong>근로기준법 시행령 제30조</strong>: 1주간 소정근로시간이 <span style={{ color: '#dc2626', fontWeight: 600 }}>15시간 미만</span>인 근로자에 대해서는 제55조를 적용하지 아니한다.</li>
                    </ul>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#059669' }}>■ 계산 공식</span>
                    <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', margin: '6px 0', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.76rem' }}>
                        • 1일 소정근로시간 = 주간 소정근로시간 ÷ 5일<br />
                        • 주휴수당(주) = 1일 소정근로시간 × 시급<br />
                        • 주휴수당(월) = 주휴수당(주) × 4.345 (= 52주 ÷ 12개월)<br />
                        • 예시) 주 40시간, 시급 10,360원 → (40÷5) × 10,360 × 4.345 = <strong>360,109원/월</strong>
                    </div>
                </div>

                <div style={{ marginBottom: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#d97706' }}>■ 적용 조건</span>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        <li>주 <strong>15시간 이상</strong> 근무하는 근로자에게만 지급</li>
                        <li>해당 주의 소정근로일을 <strong>개근</strong>해야 지급</li>
                        <li><strong>월급제</strong>의 경우 기본급에 주휴수당이 이미 포함되어 있으므로 별도 계산 불필요</li>
                    </ul>
                </div>

                <div style={{
                    background: '#fef2f2', padding: '10px 14px', borderRadius: '8px',
                    border: '1px solid #fecaca', color: '#991b1b'
                }}>
                    <span style={{ fontWeight: 700 }}>⚠️ 위반 시 제재</span>: 주휴수당 미지급 시 <strong>근로기준법 제109조</strong>에 따라 <strong>3년 이하의 징역</strong> 또는 <strong>3천만원 이하의 벌금</strong>에 처할 수 있습니다.
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
                                <tr>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>임금계산기간</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{year}.{String(month).padStart(2, '0')}.01 ~ {year}.{String(month).padStart(2, '0')}.{new Date(year, month, 0).getDate()}</td>
                                    <td style={{ padding: '8px 12px', background: '#f1f5f9', border: '1px solid #e2e8f0', fontWeight: 600 }}>임금지급일</td>
                                    <td style={{ padding: '8px 12px', border: '1px solid #e2e8f0' }}>{(() => { const d = new Date(year, month, 15); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 15일`; })()} (익월 15일)</td>
                                </tr>
                            </tbody>
                        </table>
                    )}

                    {/* 지급/공제 테이블 — 근로기준법 제48조 제2항: 시간 수·계산방법 명시 */}
                    {(() => {
                        const eh = calculation.effectiveHourly || 0;
                        const otH = parseFloat(payData.overtimeHours) || 0;
                        const ntH = parseFloat(payData.nightHours) || 0;
                        const hdH = parseFloat(payData.holidayHours) || 0;
                        const leaveD = calculation.annualLeaveDays || 0;
                        const hourlyW = parseFloat(payData.hourlyWage) || 0;
                        const payRows = [
                            {
                                label: '기본급',
                                calc: payType === 'monthly'
                                    ? `통상시급 ${fmt(eh)}원 × ${calculation.monthlyContractHours}h`
                                    : `시급 ${fmt(hourlyW)}원 기준`,
                                value: calculation.grossBase, always: true
                            },
                            { label: '연장근로수당', calc: `${otH}시간 × ${fmt(eh)}원 × 1.5`, value: calculation.overtimePay },
                            { label: '야간근로수당', calc: `${ntH}시간 × ${fmt(eh)}원 × 0.5`, value: calculation.nightPay },
                            { label: '휴일·주말특근수당', calc: `${hdH}시간 × ${fmt(eh)}원 × 1.5`, value: calculation.holidayPay },
                            { label: '주휴수당', calc: '유급주휴 (주 15h 이상)', value: calculation.weeklyHolidayPay },
                            { label: '상여금', calc: '정액', value: calculation.bonus },
                            { label: '연차수당', calc: `1일급 ${fmt(calculation.dailyWage)}원 × ${leaveD}일`, value: calculation.annualLeavePay },
                            { label: '명절수당', calc: '정액', value: calculation.holidayBonus },
                            { label: '성과금', calc: '정액', value: calculation.performanceBonus },
                            { label: '식대 (비과세)', calc: '월정액 (비과세)', value: calculation.nonTaxMeal },
                            { label: '교통비 (비과세)', calc: '월정액 (비과세)', value: calculation.nonTaxTransport }
                        ].filter(r => r.always || r.value > 0);

                        const dedRows = [
                            { label: '국민연금', calc: `${(rates.nationalPension * 100).toFixed(2)}%`, value: calculation.nationalPension },
                            { label: '건강보험', calc: `${(rates.healthInsurance * 100).toFixed(3)}%`, value: calculation.healthInsurance },
                            { label: '장기요양보험', calc: `건강보험료 × ${(rates.longTermCare * 100).toFixed(2)}%`, value: calculation.longTermCare },
                            { label: '고용보험', calc: `${(rates.employmentInsurance * 100).toFixed(1)}%`, value: calculation.employmentInsurance },
                            { label: '소득세 (갑근세)', calc: '간이세액표', value: calculation.incomeTax },
                            { label: '지방소득세', calc: '소득세 × 10%', value: calculation.localIncomeTax },
                            ...(calculation.yearEndAmount > 0 ? [{
                                label: `연말정산 ${calculation.yearEndType === 'pay' ? '추가납부' : '환급'}`,
                                calc: calculation.yearEndType === 'pay' ? '추가 징수' : '환급 (공제 차감)',
                                value: calculation.yearEndAdjust
                            }] : [])
                        ];

                        const th = { padding: '7px 8px', background: '#ecfdf5', border: '1px solid #e2e8f0', fontWeight: 600 };
                        const td = { padding: '6px 8px', border: '1px solid #e2e8f0' };
                        return (
                            <div style={{ marginBottom: '20px' }}>
                                {/* 지급 항목 */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '14px' }}>
                                    <thead>
                                        <tr>
                                            <th colSpan="3" style={{ padding: '9px', background: '#059669', color: 'white', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px' }}>지급 항목</th>
                                        </tr>
                                        <tr>
                                            <th style={{ ...th, textAlign: 'left', width: '26%' }}>항목</th>
                                            <th style={{ ...th, textAlign: 'left', width: '48%' }}>산출내역 (시간 수 · 계산방법)</th>
                                            <th style={{ ...th, textAlign: 'right', width: '26%' }}>금액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {payRows.map(row => (
                                            <tr key={row.label}>
                                                <td style={td}>{row.label}</td>
                                                <td style={{ ...td, color: '#64748b' }}>{row.calc}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>{fmt(row.value)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ fontWeight: 700 }}>
                                            <td style={{ ...td, background: '#f0fdf4' }} colSpan="2">지급 합계</td>
                                            <td style={{ ...td, background: '#f0fdf4', textAlign: 'right', color: '#059669' }}>{fmt(calculation.totalPay)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* 공제 항목 */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th colSpan="3" style={{ padding: '9px', background: '#dc2626', color: 'white', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px' }}>공제 항목</th>
                                        </tr>
                                        <tr>
                                            <th style={{ ...th, background: '#fef2f2', textAlign: 'left', width: '26%' }}>항목</th>
                                            <th style={{ ...th, background: '#fef2f2', textAlign: 'left', width: '48%' }}>계산방법</th>
                                            <th style={{ ...th, background: '#fef2f2', textAlign: 'right', width: '26%' }}>금액</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dedRows.map(row => (
                                            <tr key={row.label}>
                                                <td style={td}>{row.label}</td>
                                                <td style={{ ...td, color: '#64748b' }}>{row.calc}</td>
                                                <td style={{ ...td, textAlign: 'right' }}>{fmt(row.value)}</td>
                                            </tr>
                                        ))}
                                        <tr style={{ fontWeight: 700 }}>
                                            <td style={{ ...td, background: '#fef2f2' }} colSpan="2">공제 합계</td>
                                            <td style={{ ...td, background: '#fef2f2', textAlign: 'right', color: '#dc2626' }}>{fmt(calculation.totalDeduction)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}

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
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>{(() => { const d = new Date(year, month, 15); return `${d.getFullYear()}년 ${d.getMonth() + 1}월 15일`; })()}</div>
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



            {/* ===== 급여대장 (회계사무소 제출용) ===== */}
            <div style={{
                background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                border: '1px solid var(--border)', marginBottom: '1.5rem'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div onClick={() => setShowLedger(!showLedger)} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer' }}>
                        <FileSpreadsheet size={18} /> 📒 급여대장 <span style={{ color: '#4f46e5' }}>({yearMonth})</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{ledgerRows.length}명</span>
                        {showLedger ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                    <button onClick={exportLedger} disabled={ledgerRows.length === 0}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px', borderRadius: '9px', border: 'none', cursor: ledgerRows.length === 0 ? 'not-allowed' : 'pointer', background: ledgerRows.length === 0 ? '#cbd5e1' : '#059669', color: 'white', fontWeight: 700, fontSize: '0.82rem' }}>
                        <Download size={15} /> 엑셀 다운로드 (전 항목)
                    </button>
                </div>

                {showLedger && (
                    <div style={{ marginTop: '12px' }}>
                        {ledgerRows.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                {yearMonth}에 저장된 급여가 없습니다. 직원별로 급여 계산 후 <strong>"DB에 저장"</strong>하면 여기에 모입니다.
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                                        <thead>
                                            <tr style={{ background: '#f8fafc' }}>
                                                {['성명', '부서', '형태', '지급총액', '4대보험', '소득세계', '공제총액', '실수령액'].map((h, i) => (
                                                    <th key={h} style={{ padding: '8px 10px', borderBottom: '2px solid var(--border)', textAlign: i < 3 ? 'left' : 'right', fontWeight: 700, color: 'var(--text-muted)' }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ledgerRows.map((r, idx) => {
                                                const ins4 = r.nationalPension + r.healthInsurance + r.longTermCare + r.employmentInsurance;
                                                const taxSum = r.incomeTax + r.localIncomeTax + (r.yearEndAdjust || 0);
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                        <td style={{ padding: '7px 10px', fontWeight: 600 }}>{r.name}</td>
                                                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.department}</td>
                                                        <td style={{ padding: '7px 10px', color: 'var(--text-muted)' }}>{r.payTypeLabel}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt(r.totalPay)}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(ins4)}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(taxSum)}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(r.totalDeduction)}</td>
                                                        <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{fmt(r.netPay)}</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ background: '#eef2ff', fontWeight: 700 }}>
                                                <td style={{ padding: '8px 10px' }} colSpan={3}>합계 ({ledgerRows.length}명)</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#059669' }}>{fmt(ledgerTotals.totalPay)}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(ledgerTotals.nationalPension + ledgerTotals.healthInsurance + ledgerTotals.longTermCare + ledgerTotals.employmentInsurance)}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(ledgerTotals.incomeTax + ledgerTotals.localIncomeTax + ledgerTotals.yearEndAdjust)}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626' }}>{fmt(ledgerTotals.totalDeduction)}</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'right', color: '#4f46e5' }}>{fmt(ledgerTotals.netPay)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                    💡 화면은 요약입니다. <strong>엑셀 다운로드</strong>에는 기본급·연장·야간·주휴·상여·연차·명절·식대·교통·4대보험 항목별·소득세·연말정산까지 <strong>전 항목</strong>이 직원별로 포함됩니다 (맨 아래 합계행 포함).
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ===== 급여 이력 조회 ===== */}
            <div style={{
                background: 'var(--card)', borderRadius: '14px', padding: '18px 20px',
                border: '1px solid var(--border)', marginBottom: '1.5rem'
            }}>
                <div
                    onClick={() => setShowHistory(!showHistory)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.95rem' }}>
                        <History size={18} /> 📋 급여 이력 조회
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>({(payrollRecords || []).length}건)</span>
                    </div>
                    {showHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>

                {showHistory && (
                    <div style={{ marginTop: '12px' }}>
                        {(payrollRecords || []).length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                저장된 급여 이력이 없습니다. 급여 계산 후 "DB에 저장" 버튼을 눌러주세요.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {(payrollRecords || []).map(record => (
                                    <div key={record.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '10px 14px', borderRadius: '10px',
                                        background: 'var(--bg)', border: '1px solid var(--border)',
                                        fontSize: '0.82rem'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontWeight: 700, color: '#4f46e5', minWidth: '70px' }}>{record.year_month}</span>
                                            <span style={{ fontWeight: 600 }}>{record.employee_name}</span>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {record.pay_type === 'monthly' ? '월급제' : '시급제'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontWeight: 700, color: '#059669' }}>{fmt(record.net_pay || 0)}원</div>
                                                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                                    지급 {fmt(record.total_pay || 0)} / 공제 {fmt(record.total_deduction || 0)}
                                                </div>
                                            </div>
                                            <button onClick={() => loadPayroll(record)}
                                                style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid #4f46e5', background: '#eef2ff', color: '#4f46e5', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                                                불러오기
                                            </button>
                                            <button onClick={() => { if (confirm('삭제하시겠습니까?')) deletePayrollRecord(record.id); }}
                                                style={{ padding: '4px 6px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fef2f2', color: '#dc2626', cursor: 'pointer' }}>
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Payroll;
