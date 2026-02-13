import React, { useState, useRef } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, UserPlus, UserMinus, Shield, Trash2, Calendar, Edit, Download, FileText } from 'lucide-react';
import { useData } from '../context/DataContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const Employees = () => {
    // Consume global data from Supabase via DataContext
    const { employees, addEmployee, updateEmployee, deleteEmployee, attendance, addAttendance, updateAttendance, deleteAttendance } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', phone: '', ssn: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [tempPerms, setTempPerms] = useState({});
    const [viewMode, setViewMode] = useState('재직'); // '재직' or '퇴사'
    const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
    const [leaveUsage, setLeaveUsage] = useState({ employeeId: null, days: 1, startDate: '', reason: '' });

    // PDF 관련 상태
    const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
    const [pdfTarget, setPdfTarget] = useState(null); // 대상 직원
    const [pdfType, setPdfType] = useState('promotion'); // 'promotion', 'application', 'retirement'
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isPdfPreview, setIsPdfPreview] = useState(false);
    const pdfRef = useRef(null);
    const trainingPhotoPdfRef = useRef(null);
    const [leaveAppData, setLeaveAppData] = useState({
        startDate: '', endDate: '', days: 1, reason: ''
    });
    const [retireData, setRetireData] = useState({
        resignDate: new Date().toISOString().split('T')[0],
        monthlyWage: '', // 월 기본급
        bonus3m: '', // 최근 3개월 상여금 합계
        annualBonus: '', // 연간 상여금 총액
        otherAllowance: '' // 기타 수당 (월 평균)
    });

    // 근태 관련 상태
    const [attEmpId, setAttEmpId] = useState(null);
    const [attMonth, setAttMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // 의무교육 관련 상태
    const TRAININGS = [
        { code: 'safety', name: '산업안전보건교육', hours: '사무직 3h / 생산직 6h', law: '산업안전보건법 제29조', period: 'quarterly', icon: '🦺' },
        { code: 'harassment', name: '성희롱 예방교육', hours: '1시간 이상', law: '남녀고용평등법 제13조', period: 'yearly', icon: '🛡️' },
        { code: 'privacy', name: '개인정보보호 교육', hours: '1시간 이상', law: '개인정보보호법 제28조', period: 'yearly', icon: '🔒' },
        { code: 'bullying', name: '직장 내 괴롭힘 예방교육', hours: '1시간 이상', law: '근로기준법 제76조의2', period: 'yearly', icon: '🤝' },
        { code: 'fire', name: '소방안전교육', hours: '2시간 이상', law: '화재예방법 제17조', period: 'yearly', icon: '🧯' },
        { code: 'disability', name: '장애인 인식개선 교육', hours: '1시간 이상', law: '장애인고용촉진법 제5조의3', period: 'yearly', icon: '♿' }
    ];
    const [trainingType, setTrainingType] = useState('safety');
    const [trainingFormData, setTrainingFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        startTime: '14:00', endTime: '15:00',
        location: '', instructor: ''
    });
    const [trainingPhotos, setTrainingPhotos] = useState([]);
    const trainingPhotoRef = useRef(null);

    const filteredEmployees = employees.filter(e => {
        if (viewMode === '전체') return true;
        return e.status === viewMode;
    });

    const columns = [
        { header: '사원번호', accessor: 'emp_id' },
        { header: '이름', accessor: 'name' },
        { header: '연락처', accessor: 'phone' },
        { header: '부서', accessor: 'department' },
        { header: '직급', accessor: 'position' },
        { header: '입사일', accessor: 'join_date' },
        {
            header: '연차 (사용/총)', accessor: 'leave', render: (row) => (
                <div>
                    <span style={{ fontWeight: 'bold' }}>{row.used_leave}</span> / {row.total_leave}
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '4px' }}>
                        (잔여: {row.total_leave - row.used_leave})
                    </span>
                </div>
            )
        },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '재직' ? 'status-active' : 'status-danger'
                    }`}>
                    {row.status}
                </span>
            )
        },
    ];

    // Calculate annual leave based on join date
    const calculateAnnualLeave = (joinDate) => {
        if (!joinDate) return 15;

        const join = new Date(joinDate);
        const today = new Date();
        const yearsOfService = (today - join) / (1000 * 60 * 60 * 24 * 365.25);

        // Korean labor law: 15 days for first year, +1 day per year after 1 year (max 25 days)
        if (yearsOfService < 1) {
            // For employees with less than 1 year, calculate proportionally
            const monthsWorked = Math.floor(yearsOfService * 12);
            return Math.floor(monthsWorked * 1.25); // 15 days / 12 months
        } else {
            const additionalYears = Math.floor(yearsOfService - 1);
            const totalLeave = 15 + additionalYears;
            return Math.min(totalLeave, 25); // Max 25 days
        }
    };

    const handleSave = async () => {
        if (!newItem.name || !newItem.joinDate) return alert('필수 항목을 입력해주세요.');

        if (isEditing) {
            // 수정 모드
            const itemToUpdate = {
                name: newItem.name,
                department: newItem.department,
                position: newItem.position,
                join_date: newItem.joinDate
            };
            try {
                await updateEmployee(editingId, itemToUpdate);
                alert(`✅ ${newItem.name} 직원 정보가 수정되었습니다. (직급: ${newItem.position})`);
            } catch (err) {
                alert('❌ 수정 실패: ' + err.message);
            }
            setIsEditing(false);
            setEditingId(null);
        } else {
            // 등록 모드
            const count = employees.length + 1;
            const newId = `EMP-${String(count).padStart(3, '0')}`;
            const defaultPerms = {
                dashboard: true,
                board: true,
                molds: true,
                materials: true,
                delivery: true,
                quality: true,
                sales: true,
                employees: false,
                equipments: true,
                purchase: true,
                suppliers: true
            };

            // Calculate leave automatically based on join date
            const calculatedLeave = calculateAnnualLeave(newItem.joinDate);

            const itemToAdd = {
                emp_id: newId,
                name: newItem.name,
                department: newItem.department,
                position: newItem.position,
                join_date: newItem.joinDate,
                total_leave: calculatedLeave,
                resign_date: null,
                status: '재직',
                used_leave: 0,
                permissions: defaultPerms
            };

            addEmployee(itemToAdd);
        }
        setIsModalOpen(false);
        setNewItem({ name: '', phone: '', ssn: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
    };

    const openLeaveModal = (emp) => {
        setLeaveUsage({
            employeeId: emp.id,
            employeeName: emp.name,
            days: 1,
            startDate: new Date().toISOString().split('T')[0],
            reason: ''
        });
        setIsLeaveModalOpen(true);
    };

    const handleLeaveUsage = () => {
        if (!leaveUsage.startDate || leaveUsage.days <= 0) {
            return alert('사용일자와 일수를 입력해주세요.');
        }

        const emp = employees.find(e => e.id === leaveUsage.employeeId);
        const remainingLeave = emp.total_leave - emp.used_leave;

        if (leaveUsage.days > remainingLeave) {
            return alert(`잔여 연차(${remainingLeave}일)가 부족합니다.`);
        }

        const newUsedLeave = emp.used_leave + leaveUsage.days;
        updateEmployee(leaveUsage.employeeId, { used_leave: newUsedLeave });

        alert(`${leaveUsage.employeeName}님의 연차 ${leaveUsage.days}일이 사용 처리되었습니다.`);
        setIsLeaveModalOpen(false);
        setLeaveUsage({ employeeId: null, employeeName: '', days: 1, startDate: '', reason: '' });
    };

    const handleResign = (id) => {
        if (!window.confirm('해당 직원을 퇴사 처리하시겠습니까?')) return;
        const today = new Date().toISOString().split('T')[0];
        updateEmployee(id, { status: '퇴사', resign_date: today });
    };

    const handleDelete = (id) => {
        if (!window.confirm('정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;
        deleteEmployee(id);
    };

    const handleEdit = (emp) => {
        setIsEditing(true);
        setEditingId(emp.id);
        setNewItem({
            name: emp.name,
            phone: emp.phone || '',
            ssn: emp.ssn || '',
            department: emp.department,
            position: emp.position,
            joinDate: emp.join_date
        });
        setIsModalOpen(true);
    };

    const openPermModal = (emp) => {
        setSelectedEmp(emp);
        setTempPerms({ ...(emp.permissions || {}) });
        setIsPermModalOpen(true);
    };

    const handlePermSave = () => {
        updateEmployee(selectedEmp.id, { permissions: tempPerms });
        setIsPermModalOpen(false);
    };

    const togglePerm = (key) => {
        setTempPerms({ ...tempPerms, [key]: !tempPerms[key] });
    };

    const permissionLabels = {
        dashboard: '대시보드',
        molds: '금형관리',
        materials: '원재료관리',
        delivery: '입출고관리',
        quality: '품질관리',
        sales: '매입매출',
        equipments: '설비관리',
        products: '제품관리',
        work_orders: '작업지시',
        daily_production: '일일작업현황',
        work_history: '작업이력',
        injection_conditions: '사출조건표',
        purchase: '구매관리',
        suppliers: '거래처관리',
        employees: '직원관리',
        government_support: '국가지원사업',
        payroll: '급여관리'
    };

    // === PDF 관련 함수 ===
    const openPdfModal = (emp) => {
        setPdfTarget(emp);
        setPdfType('promotion');
        setLeaveAppData({ startDate: '', endDate: '', days: 1, reason: '' });
        setRetireData({
            resignDate: emp.resign_date || new Date().toISOString().split('T')[0],
            monthlyWage: '', bonus3m: '', annualBonus: '', otherAllowance: ''
        });
        setIsPdfModalOpen(true);
    };

    const generatePdf = async () => {
        setIsGeneratingPdf(true);
        setIsPdfPreview(true);
        await new Promise(r => setTimeout(r, 800));

        try {
            const element = pdfRef.current;
            if (!element) return;

            const canvasOpts = {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff'
            };

            const canvas = await html2canvas(element, canvasOpts);
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const imgHeight = (canvas.height * pdfWidth) / canvas.width;

            let heightLeft = imgHeight;
            let position = 0;

            pdf.setFillColor(255, 255, 255);
            pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;

            while (heightLeft > 0) {
                position = heightLeft - imgHeight;
                pdf.addPage();
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
                pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
                heightLeft -= pdfHeight;
            }

            // Training photos on separate page
            if (pdfType === 'training' && trainingPhotoPdfRef.current && trainingPhotos.length > 0) {
                const photoCanvas = await html2canvas(trainingPhotoPdfRef.current, canvasOpts);
                const photoImgData = photoCanvas.toDataURL('image/png');
                const photoImgHeight = (photoCanvas.height * pdfWidth) / photoCanvas.width;
                pdf.addPage();
                pdf.setFillColor(255, 255, 255);
                pdf.rect(0, 0, pdfWidth, pdfHeight, 'F');
                pdf.addImage(photoImgData, 'PNG', 0, 0, pdfWidth, photoImgHeight);
            }

            const fileNames = {
                promotion: `연차사용촉진_${pdfTarget.name}_${new Date().toISOString().split('T')[0]}.pdf`,
                application: `연차사용신청서_${pdfTarget.name}_${new Date().toISOString().split('T')[0]}.pdf`,
                retirement: `퇴직금계산서_${pdfTarget.name}_${new Date().toISOString().split('T')[0]}.pdf`,
                training: `의무교육_${TRAININGS.find(t => t.code === trainingType)?.name || ''}_${new Date().toISOString().split('T')[0]}.pdf`
            };
            const fileName = fileNames[pdfType] || fileNames.promotion;
            pdf.save(fileName);
        } catch (err) {
            console.error('PDF 생성 실패:', err);
            alert('PDF 생성에 실패했습니다.');
        } finally {
            setIsGeneratingPdf(false);
            setIsPdfPreview(false);
        }
    };

    const today = new Date();
    const formatDate = (d) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">직원 관리</h2>
                    <p className="page-description">직원 입/퇴사 관리 및 접근 권한을 설정합니다.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                        <UserPlus size={18} /> 직원 등록
                    </button>
                </div>
            </div>

            <div className="filter-tabs">
                <button
                    className={`filter-tab ${viewMode === '재직' ? 'active' : ''}`}
                    onClick={() => setViewMode('재직')}
                >
                    재직자 ({employees.filter(e => e.status === '재직').length})
                </button>
                <button
                    className={`filter-tab ${viewMode === '퇴사' ? 'active' : ''}`}
                    onClick={() => setViewMode('퇴사')}
                >
                    퇴사자 ({employees.filter(e => e.status === '퇴사').length})
                </button>
            </div>

            <Table
                columns={columns}
                data={filteredEmployees}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => handleEdit(row)} title="정보 수정">
                            <Edit size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => openPermModal(row)} title="접근 권한 설정">
                            <Shield size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => openPdfModal(row)} title="인사 서식 다운로드"
                            style={{ color: '#6366f1' }}>
                            <FileText size={16} />
                        </button>
                        {row.status === '재직' && (
                            <>
                                <button className="icon-btn leave-btn" onClick={() => openLeaveModal(row)} title="연차 사용 처리">
                                    <Calendar size={16} />
                                </button>
                                <button className="icon-btn" onClick={() => handleResign(row.id)} title="퇴사 처리">
                                    <UserMinus size={16} />
                                </button>
                            </>
                        )}
                        <button className="icon-btn delete-btn" onClick={() => handleDelete(row.id)} title="영구 삭제">
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            />

            {/* ===== 근태계 ===== */}
            {(() => {
                const activeEmployees = employees.filter(e => e.status === '재직');

                const attEmp = employees.find(e => e.id === attEmpId);

                const STATUS_MAP = {
                    '출근': { color: '#059669', bg: '#dcfce7', icon: '✅' },
                    '지각': { color: '#d97706', bg: '#fef3c7', icon: '⏰' },
                    '조퇴': { color: '#ea580c', bg: '#ffedd5', icon: '🚪' },
                    '결근': { color: '#dc2626', bg: '#fee2e2', icon: '❌' },
                    '휴가': { color: '#7c3aed', bg: '#ede9fe', icon: '🌴' },
                    '반차': { color: '#2563eb', bg: '#dbeafe', icon: '🌗' },
                    '공휴일': { color: '#6b7280', bg: '#f3f4f6', icon: '🏖️' }
                };

                // Get days in month
                const [year, month] = attMonth.split('-').map(Number);
                const daysInMonth = new Date(year, month, 0).getDate();
                const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun

                // Filter attendance for this employee+month
                const empAttendance = (attendance || []).filter(a =>
                    a.employee_id === attEmpId && a.date?.startsWith(attMonth)
                );

                const getStatusForDate = (day) => {
                    const dateStr = `${attMonth}-${String(day).padStart(2, '0')}`;
                    return empAttendance.find(a => a.date === dateStr);
                };

                const handleAttClick = async (day) => {
                    if (!attEmpId) return alert('직원을 선택해주세요.');
                    const dateStr = `${attMonth}-${String(day).padStart(2, '0')}`;
                    const existing = empAttendance.find(a => a.date === dateStr);

                    const statusList = Object.keys(STATUS_MAP);
                    const choice = prompt(
                        `${attEmp?.name} - ${dateStr}\n근태 상태를 선택하세요:\n${statusList.map((s, i) => `${i + 1}. ${STATUS_MAP[s].icon} ${s}`).join('\n')}\n\n번호를 입력하세요 (삭제: 0):`,
                        existing ? String(statusList.indexOf(existing.status) + 1) : '1'
                    );
                    if (choice === null) return;
                    const num = parseInt(choice);

                    if (num === 0 && existing) {
                        await deleteAttendance(existing.id);
                        return;
                    }
                    if (num < 1 || num > statusList.length) return;

                    const newStatus = statusList[num - 1];
                    if (existing) {
                        await updateAttendance(existing.id, { status: newStatus });
                    } else {
                        await addAttendance({
                            employee_id: attEmpId,
                            employee_name: attEmp?.name,
                            date: dateStr,
                            status: newStatus
                        });
                    }
                };

                // Summary stats
                const stats = {};
                Object.keys(STATUS_MAP).forEach(s => { stats[s] = empAttendance.filter(a => a.status === s).length; });

                const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

                return (
                    <div style={{
                        marginTop: '2rem', background: 'white', padding: '1.5rem',
                        borderRadius: '12px', border: '1px solid var(--border)',
                        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '2px solid var(--border)' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                                📅 근태 관리
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <select
                                    value={attEmpId || ''}
                                    onChange={(e) => setAttEmpId(e.target.value)}
                                    style={{ padding: '0.4rem 0.6rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', fontWeight: 600 }}
                                >
                                    <option value="">직원 선택</option>
                                    {activeEmployees.map(emp => (
                                        <option key={emp.id} value={emp.id}>{emp.name} ({emp.department})</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => {
                                        const d = new Date(year, month - 2);
                                        setAttMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                    }}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                                >◀</button>
                                <span style={{ fontWeight: 700, fontSize: '1rem', minWidth: '100px', textAlign: 'center' }}>
                                    {year}년 {month}월
                                </span>
                                <button
                                    onClick={() => {
                                        const d = new Date(year, month);
                                        setAttMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
                                    }}
                                    style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer' }}
                                >▶</button>
                            </div>
                        </div>

                        {attEmpId ? (
                            <>
                                {/* Summary cards */}
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                                    {Object.entries(STATUS_MAP).map(([status, s]) => (
                                        <div key={status} style={{
                                            background: s.bg, padding: '0.5rem 0.75rem', borderRadius: '8px',
                                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                                            fontSize: '0.8rem', fontWeight: 600, color: s.color,
                                            border: `1px solid ${s.color}22`
                                        }}>
                                            {s.icon} {status}: <strong>{stats[status]}일</strong>
                                        </div>
                                    ))}
                                </div>

                                {/* Calendar grid */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px',
                                    background: '#e2e8f0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0'
                                }}>
                                    {/* Day headers */}
                                    {dayNames.map(d => (
                                        <div key={d} style={{
                                            background: '#f8fafc', padding: '0.5rem', textAlign: 'center',
                                            fontWeight: 700, fontSize: '0.8rem',
                                            color: d === '일' ? '#dc2626' : d === '토' ? '#2563eb' : '#475569'
                                        }}>
                                            {d}
                                        </div>
                                    ))}
                                    {/* Empty cells before first day */}
                                    {Array.from({ length: firstDay }).map((_, i) => (
                                        <div key={`empty-${i}`} style={{ background: '#f8fafc', padding: '0.5rem' }} />
                                    ))}
                                    {/* Day cells */}
                                    {Array.from({ length: daysInMonth }).map((_, i) => {
                                        const day = i + 1;
                                        const record = getStatusForDate(day);
                                        const dayOfWeek = (firstDay + i) % 7;
                                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                        const statusInfo = record ? STATUS_MAP[record.status] : null;
                                        const todayStr = new Date().toISOString().split('T')[0];
                                        const dateStr = `${attMonth}-${String(day).padStart(2, '0')}`;
                                        const isToday = dateStr === todayStr;

                                        return (
                                            <div
                                                key={day}
                                                onClick={() => handleAttClick(day)}
                                                style={{
                                                    background: statusInfo ? statusInfo.bg : 'white',
                                                    padding: '0.4rem',
                                                    textAlign: 'center',
                                                    cursor: 'pointer',
                                                    minHeight: '52px',
                                                    display: 'flex', flexDirection: 'column',
                                                    alignItems: 'center', justifyContent: 'center',
                                                    transition: 'all 0.15s',
                                                    border: isToday ? '2px solid #4f46e5' : 'none',
                                                    borderRadius: isToday ? '4px' : '0'
                                                }}
                                                title={record ? `${record.status}` : '클릭하여 근태 등록'}
                                            >
                                                <div style={{
                                                    fontSize: '0.8rem', fontWeight: isToday ? 800 : 500,
                                                    color: dayOfWeek === 0 ? '#dc2626' : dayOfWeek === 6 ? '#2563eb' : '#334155',
                                                    marginBottom: '2px'
                                                }}>
                                                    {day}
                                                </div>
                                                {record && (
                                                    <div style={{
                                                        fontSize: '0.65rem', fontWeight: 700,
                                                        color: statusInfo?.color, lineHeight: 1
                                                    }}>
                                                        {statusInfo?.icon}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                    💡 날짜를 클릭하여 근태를 등록/수정하세요 (0 입력 시 삭제)
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                                👆 직원을 선택하면 월별 근태 현황이 표시됩니다.
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Add Employee Modal */}
            <Modal
                title={isEditing ? "직원 정보 수정" : "신규 직원 등록"}
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setIsEditing(false);
                    setEditingId(null);
                    setNewItem({ name: '', phone: '', ssn: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
                }}
            >
                <div className="form-group">
                    <label className="form-label">이름</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="직원 이름" />
                </div>
                <div className="form-group">
                    <label className="form-label">연락처</label>
                    <input
                        className="form-input"
                        value={newItem.phone}
                        onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                        placeholder="010-1234-5678"
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">주민번호 (선택)</label>
                    <input
                        className="form-input"
                        value={newItem.ssn}
                        onChange={(e) => setNewItem({ ...newItem, ssn: e.target.value })}
                        placeholder="000000-0000000"
                        type="password"
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        보안을 위해 마스킹 처리됩니다
                    </p>
                </div>
                <div className="form-group">
                    <label className="form-label">부서</label>
                    <select className="form-input" value={newItem.department} onChange={(e) => setNewItem({ ...newItem, department: e.target.value })}>
                        <option value="생산팀">생산팀</option>
                        <option value="품질팀">품질팀</option>
                        <option value="영업팀">영업팀</option>
                        <option value="경영지원팀">경영지원팀</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">직급</label>
                    <select className="form-input" value={newItem.position} onChange={(e) => setNewItem({ ...newItem, position: e.target.value })}>
                        <option value="사장">사장</option>
                        <option value="전무">전무</option>
                        <option value="상무">상무</option>
                        <option value="부장">부장</option>
                        <option value="차장">차장</option>
                        <option value="과장">과장</option>
                        <option value="대리">대리</option>
                        <option value="주임">주임</option>
                        <option value="사원">사원</option>
                        <option value="반장">반장</option>
                        <option value="조장">조장</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">입사일</label>
                    <input type="date" className="form-input" value={newItem.joinDate} onChange={(e) => setNewItem({ ...newItem, joinDate: e.target.value })} />
                    {!isEditing && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            연차는 입사일 기준으로 자동 계산됩니다 (1년 미만: 월 비례, 1년 이상: 15일 + 매년 1일 추가, 최대 25일)
                        </p>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => {
                        setIsModalOpen(false);
                        setIsEditing(false);
                        setEditingId(null);
                        setNewItem({ name: '', phone: '', ssn: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
                    }}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>{isEditing ? '수정' : '등록'}</button>
                </div>
            </Modal>

            {/* Permission Modal */}
            <Modal title={`접근 권한 설정 - ${selectedEmp?.name}`} isOpen={isPermModalOpen} onClose={() => setIsPermModalOpen(false)}>
                <div className="perm-grid">
                    {Object.keys(permissionLabels).map(key => (
                        <div key={key} className="perm-item" onClick={() => togglePerm(key)}>
                            <input type="checkbox" checked={tempPerms[key] || false} readOnly />
                            <span>{permissionLabels[key]}</span>
                        </div>
                    ))}
                </div>
                <p className="description-text" style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    체크된 항목만 해당 직원의 사이드바 메뉴에 표시됩니다.
                </p>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsPermModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handlePermSave}>저장</button>
                </div>
            </Modal>

            {/* Leave Usage Modal */}
            <Modal title={`연차 사용 처리 - ${leaveUsage.employeeName}`} isOpen={isLeaveModalOpen} onClose={() => setIsLeaveModalOpen(false)}>
                {leaveUsage.employeeId && (() => {
                    const emp = employees.find(e => e.id === leaveUsage.employeeId);
                    const remaining = emp ? emp.total_leave - emp.used_leave : 0;
                    return (
                        <>
                            <div style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>부여 연차</span>
                                    <span style={{ fontWeight: 'bold' }}>{emp?.total_leave}일</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>사용 연차</span>
                                    <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{emp?.used_leave}일</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem', borderTop: '1px solid #bfdbfe' }}>
                                    <span style={{ fontWeight: '600' }}>잔여 연차</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '1.1rem' }}>{remaining}일</span>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">사용 일수</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    value={leaveUsage.days}
                                    onChange={(e) => setLeaveUsage({ ...leaveUsage, days: parseFloat(e.target.value) || 0 })}
                                    min="0.5"
                                    step="0.5"
                                    max={remaining}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">사용 시작일</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={leaveUsage.startDate}
                                    onChange={(e) => setLeaveUsage({ ...leaveUsage, startDate: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">사유 (선택)</label>
                                <textarea
                                    className="form-input"
                                    value={leaveUsage.reason}
                                    onChange={(e) => setLeaveUsage({ ...leaveUsage, reason: e.target.value })}
                                    placeholder="예: 개인 사유, 가족 행사 등"
                                    rows="3"
                                />
                            </div>
                        </>
                    );
                })()}

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsLeaveModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleLeaveUsage}>사용 처리</button>
                </div>
            </Modal>

            {/* PDF 서식 선택 모달 */}
            <Modal title="📄 인사 서식 다운로드" isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)}>
                {pdfTarget && (
                    <div>
                        <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                            <strong>{pdfTarget.name}</strong> ({pdfTarget.department} / {pdfTarget.position})
                            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                                연차: {pdfTarget.used_leave}/{pdfTarget.total_leave}일 사용 (잔여: {pdfTarget.total_leave - pdfTarget.used_leave}일)
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', marginBottom: '1rem', flexWrap: 'wrap' }}>
                            {[{ key: 'promotion', icon: '📋', label: '연차사용촉진' }, { key: 'application', icon: '📝', label: '연차신청서' }, { key: 'retirement', icon: '💰', label: '퇴직금계산' }, { key: 'training', icon: '📚', label: '의무교육' }].map(t => (
                                <button key={t.key}
                                    onClick={() => setPdfType(t.key)}
                                    style={{
                                        flex: 1, padding: '10px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                                        fontWeight: 700, fontSize: '0.8rem', transition: 'all 0.2s', minWidth: '100px',
                                        background: pdfType === t.key ? '#4f46e5' : '#f1f5f9',
                                        color: pdfType === t.key ? 'white' : '#64748b'
                                    }}
                                >
                                    {t.icon} {t.label}
                                </button>
                            ))}
                        </div>

                        {pdfType === 'application' && (
                            <div style={{ background: '#faf5ff', padding: '14px', borderRadius: '10px', marginBottom: '1rem' }}>
                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>사용 시작일</label>
                                    <input type="date" className="form-input" value={leaveAppData.startDate}
                                        onChange={(e) => setLeaveAppData({ ...leaveAppData, startDate: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>사용 종료일</label>
                                    <input type="date" className="form-input" value={leaveAppData.endDate}
                                        onChange={(e) => setLeaveAppData({ ...leaveAppData, endDate: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: '8px' }}>
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>사용 일수</label>
                                    <input type="number" className="form-input" min="0.5" step="0.5" value={leaveAppData.days}
                                        onChange={(e) => setLeaveAppData({ ...leaveAppData, days: parseFloat(e.target.value) || 0 })} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ fontSize: '0.8rem' }}>사유</label>
                                    <textarea className="form-input" rows="2" value={leaveAppData.reason}
                                        onChange={(e) => setLeaveAppData({ ...leaveAppData, reason: e.target.value })}
                                        placeholder="예: 개인 사유, 가족 행사 등" />
                                </div>
                            </div>
                        )}

                        {pdfType === 'retirement' && (
                            <>
                                <div style={{ background: '#fef3c7', padding: '14px', borderRadius: '10px', marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#92400e', marginBottom: '10px', fontWeight: 600 }}>💡 퇴직금 산정을 위한 급여 정보를 입력해주세요</div>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>퇴직일</label>
                                        <input type="date" className="form-input" value={retireData.resignDate}
                                            onChange={(e) => setRetireData({ ...retireData, resignDate: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>월 기본급 (원)</label>
                                        <input type="number" className="form-input" value={retireData.monthlyWage}
                                            onChange={(e) => setRetireData({ ...retireData, monthlyWage: e.target.value })}
                                            placeholder="예: 2500000" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>최근 3개월 상여금 합계 (원)</label>
                                        <input type="number" className="form-input" value={retireData.bonus3m}
                                            onChange={(e) => setRetireData({ ...retireData, bonus3m: e.target.value })}
                                            placeholder="예: 500000 (없으면 0)" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: '8px' }}>
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>연간 상여금 총액 (원)</label>
                                        <input type="number" className="form-input" value={retireData.annualBonus}
                                            onChange={(e) => setRetireData({ ...retireData, annualBonus: e.target.value })}
                                            placeholder="예: 2000000 (없으면 0)" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label" style={{ fontSize: '0.8rem' }}>기타 수당 월평균 (원)</label>
                                        <input type="number" className="form-input" value={retireData.otherAllowance}
                                            onChange={(e) => setRetireData({ ...retireData, otherAllowance: e.target.value })}
                                            placeholder="예: 200000 (교통비, 식대 등)" />
                                    </div>
                                </div>

                                {/* 퇴직금 법적 안내 */}
                                <div style={{
                                    background: '#f8fafc', borderRadius: '10px', padding: '14px 16px',
                                    border: '1px solid #e2e8f0', fontSize: '0.72rem',
                                    lineHeight: 1.7, color: '#64748b'
                                }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '10px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        📜 퇴직금 계산 방식 및 법적 근거
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 700, color: '#4f46e5' }}>■ 법적 근거</span>
                                        <ul style={{ margin: '3px 0 0 14px', padding: 0 }}>
                                            <li><strong>근로자퇴직급여 보장법 제8조</strong>: 사용자는 퇴직하는 근로자에게 <span style={{ color: '#dc2626', fontWeight: 600 }}>계속근로기간 1년에 대하여 30일분 이상의 평균임금</span>을 퇴직금으로 지급하여야 한다.</li>
                                            <li><strong>근로기준법 제2조 (평균임금 정의)</strong>: 평균임금이란 이를 산정하여야 할 사유가 발생한 날 이전 <strong>3개월간</strong>에 그 근로자에게 지급된 임금의 총액을 그 기간의 총일수로 나눈 금액을 말한다.</li>
                                        </ul>
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 700, color: '#059669' }}>■ 계산 공식</span>
                                        <div style={{ background: 'white', padding: '8px 12px', borderRadius: '8px', margin: '4px 0', border: '1px solid #e2e8f0', fontFamily: 'monospace', fontSize: '0.7rem' }}>
                                            • 3개월 임금 총액 = (월 기본급 × 3) + 상여금 비례분 + (기타수당 × 3)<br />
                                            • 1일 평균임금 = 3개월 임금 총액 ÷ 90일<br />
                                            • <strong>퇴직금 = 1일 평균임금 × 30일 × (재직일수 ÷ 365)</strong><br />
                                            • 예시) 월급 250만, 3년 근무 → 평균임금 83,333원 × 30 × 3 = <strong>약 750만원</strong>
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '8px' }}>
                                        <span style={{ fontWeight: 700, color: '#d97706' }}>■ 지급 조건</span>
                                        <ul style={{ margin: '3px 0 0 14px', padding: 0 }}>
                                            <li><strong>1년 이상</strong> 계속 근로한 근로자에게 지급 (1년 미만은 의무 아님)</li>
                                            <li>퇴직일로부터 <strong>14일 이내</strong> 지급 (특별한 사정이 있으면 당사자 합의로 연장 가능)</li>
                                            <li>주 15시간 미만 근로자(초단시간)는 퇴직금 적용 제외</li>
                                        </ul>
                                    </div>

                                    <div style={{
                                        background: '#fef2f2', padding: '8px 12px', borderRadius: '8px',
                                        border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.7rem'
                                    }}>
                                        <span style={{ fontWeight: 700 }}>⚠️ 위반 시 제재</span>: 퇴직금 미지급 시 <strong>근로자퇴직급여 보장법 제44조</strong>에 따라 <strong>3년 이하의 징역</strong> 또는 <strong>3천만원 이하의 벌금</strong>. 14일 이내 미지급 시 <strong>연 20% 지연이자</strong> 발생.
                                    </div>
                                </div>
                            </>
                        )}

                        {pdfType === 'training' && (
                            <div>
                                {/* 교육 유형 선택 */}
                                <div style={{ marginBottom: '12px' }}>
                                    <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>교육 유형 선택</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                                        {TRAININGS.map(t => (
                                            <button key={t.code}
                                                onClick={() => setTrainingType(t.code)}
                                                style={{
                                                    padding: '8px 10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                                    fontSize: '0.75rem', fontWeight: 600, textAlign: 'left',
                                                    background: trainingType === t.code ? '#4f46e5' : '#f1f5f9',
                                                    color: trainingType === t.code ? 'white' : '#64748b',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {t.icon} {t.name}
                                                <div style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: '2px' }}>{t.law}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 교육 정보 입력 */}
                                <div style={{ background: '#f0f9ff', padding: '14px', borderRadius: '10px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#0369a1', marginBottom: '10px', fontWeight: 600 }}>
                                        📝 {TRAININGS.find(t => t.code === trainingType)?.name} 교육 정보
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>교육 날짜</label>
                                            <input type="date" className="form-input" value={trainingFormData.date}
                                                onChange={(e) => setTrainingFormData({ ...trainingFormData, date: e.target.value })} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>교육 시간</label>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <input type="time" className="form-input" value={trainingFormData.startTime}
                                                    onChange={(e) => setTrainingFormData({ ...trainingFormData, startTime: e.target.value })} style={{ flex: 1 }} />
                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>~</span>
                                                <input type="time" className="form-input" value={trainingFormData.endTime}
                                                    onChange={(e) => setTrainingFormData({ ...trainingFormData, endTime: e.target.value })} style={{ flex: 1 }} />
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>교육 장소</label>
                                            <input type="text" className="form-input" placeholder="예: 회의실, 교육장" value={trainingFormData.location}
                                                onChange={(e) => setTrainingFormData({ ...trainingFormData, location: e.target.value })} />
                                        </div>
                                        <div className="form-group" style={{ marginBottom: 0 }}>
                                            <label className="form-label" style={{ fontSize: '0.75rem' }}>강사명</label>
                                            <input type="text" className="form-input" placeholder="예: 안전관리자, 외부강사" value={trainingFormData.instructor}
                                                onChange={(e) => setTrainingFormData({ ...trainingFormData, instructor: e.target.value })} />
                                        </div>
                                    </div>
                                </div>

                                {/* 사진 업로드 */}
                                <div style={{ background: '#fefce8', padding: '14px', borderRadius: '10px', marginBottom: '12px' }}>
                                    <div style={{ fontSize: '0.78rem', color: '#854d0e', marginBottom: '8px', fontWeight: 600 }}>📷 교육 현장 사진</div>
                                    <input type="file" accept="image/*" multiple ref={trainingPhotoRef} style={{ display: 'none' }}
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files);
                                            files.forEach(file => {
                                                const reader = new FileReader();
                                                reader.onload = (ev) => {
                                                    setTrainingPhotos(prev => [...prev, { name: file.name, data: ev.target.result }]);
                                                };
                                                reader.readAsDataURL(file);
                                            });
                                            e.target.value = '';
                                        }} />
                                    <button
                                        onClick={() => trainingPhotoRef.current?.click()}
                                        style={{
                                            padding: '8px 16px', borderRadius: '8px', border: '1px dashed #d97706',
                                            background: 'white', color: '#92400e', fontSize: '0.78rem', fontWeight: 600,
                                            cursor: 'pointer', width: '100%', marginBottom: '8px'
                                        }}>
                                        📎 사진 추가 (클릭하여 선택)
                                    </button>
                                    {trainingPhotos.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                                            {trainingPhotos.map((photo, idx) => (
                                                <div key={idx} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                                                    <img src={photo.data} alt={photo.name} style={{ width: '100%', height: '80px', objectFit: 'cover' }} />
                                                    <button
                                                        onClick={() => setTrainingPhotos(prev => prev.filter((_, i) => i !== idx))}
                                                        style={{
                                                            position: 'absolute', top: '2px', right: '2px',
                                                            background: '#dc2626', color: 'white', border: 'none',
                                                            borderRadius: '50%', width: '18px', height: '18px',
                                                            fontSize: '0.6rem', cursor: 'pointer', lineHeight: 1
                                                        }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* 교육 기록 저장 버튼 */}
                                <button
                                    onClick={() => {
                                        const records = JSON.parse(localStorage.getItem('trainingRecords') || '{}');
                                        records[trainingType] = {
                                            lastDate: trainingFormData.date,
                                            startTime: trainingFormData.startTime,
                                            endTime: trainingFormData.endTime,
                                            instructor: trainingFormData.instructor,
                                            location: trainingFormData.location,
                                            photos: trainingPhotos.map(p => p.data).slice(0, 3) // 최대 3장 저장
                                        };
                                        localStorage.setItem('trainingRecords', JSON.stringify(records));
                                        alert(`${TRAININGS.find(t => t.code === trainingType)?.name} 교육 기록이 저장되었습니다!`);
                                    }}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '10px', border: 'none',
                                        background: 'linear-gradient(135deg, #16a34a, #15803d)', color: 'white',
                                        fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer', marginBottom: '10px'
                                    }}>
                                    💾 교육 실시 기록 저장 (대시보드 D-day 갱신)
                                </button>

                                {/* 교육 이력 조회 */}
                                {(() => {
                                    const records = JSON.parse(localStorage.getItem('trainingRecords') || '{}');
                                    const hasAnyRecord = Object.keys(records).length > 0;
                                    if (!hasAnyRecord) return null;
                                    return (
                                        <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #bbf7d0' }}>
                                            <div style={{ fontSize: '0.82rem', color: '#166534', marginBottom: '10px', fontWeight: 700 }}>
                                                📋 교육 이력 조회
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {TRAININGS.map(t => {
                                                    const rec = records[t.code];
                                                    if (!rec) return null;
                                                    return (
                                                        <div key={t.code} style={{
                                                            background: 'white', padding: '10px 12px', borderRadius: '8px',
                                                            border: trainingType === t.code ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px'
                                                        }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>
                                                                    {t.icon} {t.name}
                                                                </div>
                                                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                                                                    📅 {rec.lastDate || '미기록'} | 👤 {rec.instructor || '미기록'} | 📍 {rec.location || '미기록'}
                                                                </div>
                                                                {rec.photos && rec.photos.length > 0 && (
                                                                    <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '2px' }}>
                                                                        📷 사진 {rec.photos.length}장 첨부
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setTrainingType(t.code);
                                                                    setTrainingFormData({
                                                                        date: rec.lastDate || new Date().toISOString().split('T')[0],
                                                                        startTime: rec.startTime || '14:00',
                                                                        endTime: rec.endTime || '15:00',
                                                                        location: rec.location || '',
                                                                        instructor: rec.instructor || ''
                                                                    });
                                                                    setTrainingPhotos(
                                                                        rec.photos ? rec.photos.map((p, i) => ({ name: `photo_${i + 1}`, data: p })) : []
                                                                    );
                                                                    alert(`✅ ${t.name} 기록을 불러왔습니다. PDF 다운로드 가능합니다.`);
                                                                }}
                                                                style={{
                                                                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                                                                    background: '#4f46e5', color: 'white', fontSize: '0.7rem',
                                                                    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                                                                    flexShrink: 0
                                                                }}
                                                            >
                                                                📄 불러오기
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsPdfModalOpen(false)}>취소</button>
                            <button className="btn-submit" onClick={generatePdf} disabled={isGeneratingPdf}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Download size={16} /> {isGeneratingPdf ? 'PDF 생성 중...' : 'PDF 다운로드'}
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* PDF 랜더링 영역 (숨김) */}
            {isPdfPreview && pdfTarget && (
                <div style={{ position: 'fixed', left: '-9999px', top: 0 }}>
                    <div ref={pdfRef} style={{
                        width: '800px', padding: '60px', background: 'white',
                        fontFamily: "'Noto Sans KR', 'Malgun Gothic', sans-serif",
                        color: '#1e293b', lineHeight: 1.8
                    }}>
                        {pdfType === 'promotion' ? (
                            /* === 연차사용촉진 서식 === */
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                    <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '6px', marginBottom: '8px' }}>연 차 사 용 촉 진 통 보 서</h1>
                                    <div style={{ width: '60px', height: '3px', background: '#4f46e5', margin: '0 auto' }}></div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>수 신</td>
                                            <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.name} ({pdfTarget.position})</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>부 서</td>
                                            <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.department}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>입사일</td>
                                            <td style={cellStyle}>{pdfTarget.join_date}</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>통보일</td>
                                            <td style={cellStyle}>{formatDate(today)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '25%' }}>총 발생 연차일수</td>
                                            <td style={{ ...cellStyle, width: '25%', textAlign: 'center', fontWeight: 700, color: '#4f46e5' }}>{pdfTarget.total_leave}일</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '25%' }}>사용 연차일수</td>
                                            <td style={{ ...cellStyle, width: '25%', textAlign: 'center' }}>{pdfTarget.used_leave}일</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>미사용 연차일수</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{pdfTarget.total_leave - pdfTarget.used_leave}일</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>촉진 기한</td>
                                            <td style={{ ...cellStyle, textAlign: 'center' }}>
                                                {(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); return formatDate(d); })()}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', marginBottom: '24px', fontSize: '13px', lineHeight: 2 }}>
                                    <p style={{ marginBottom: '12px' }}>근로기준법 제61조에 의거하여 귀하의 미사용 연차유급휴가에 대해 아래와 같이 사용을 촉진합니다.</p>
                                    <p style={{ marginBottom: '12px' }}>귀하의 미사용 연차일수는 <strong style={{ color: '#dc2626' }}>{pdfTarget.total_leave - pdfTarget.used_leave}일</strong>입니다.</p>
                                    <p style={{ marginBottom: '12px' }}>본 통보서 수령일부터 <strong>10일 이내</strong>에 미사용 연차의 사용 시기를 정하여 서면으로 통보하여 주시기 바랍니다.</p>
                                    <p>기한 내 사용 시기를 정하지 않을 경우, 사용자가 미사용 연차의 사용 시기를 지정하며, 이 경우 미사용 연차에 대한 보상 의무가 면제됨을 알려드립니다.</p>
                                </div>

                                <div style={{ textAlign: 'center', margin: '40px 0 30px', fontSize: '14px', fontWeight: 600 }}>
                                    {formatDate(today)}
                                </div>

                                <table style={{ width: '80%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '30%', textAlign: 'center' }}>통보자 (사업주)</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', height: '50px' }}>(인)</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>수신자 (근로자)</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', height: '50px' }}>{pdfTarget.name} (인)</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : pdfType === 'application' ? (
                            /* === 연차사용 신청서 === */
                            <div>
                                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                                    <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '6px', marginBottom: '8px' }}>연 차 사 용 신 청 서</h1>
                                    <div style={{ width: '60px', height: '3px', background: '#4f46e5', margin: '0 auto' }}></div>
                                </div>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>성 명</td>
                                            <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.name}</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>사원번호</td>
                                            <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.emp_id}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>부 서</td>
                                            <td style={cellStyle}>{pdfTarget.department}</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>직 급</td>
                                            <td style={cellStyle}>{pdfTarget.position}</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>입사일</td>
                                            <td style={cellStyle}>{pdfTarget.join_date}</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>신청일</td>
                                            <td style={cellStyle}>{formatDate(today)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '25%' }}>총 연차일수</td>
                                            <td style={{ ...cellStyle, width: '25%', textAlign: 'center', fontWeight: 700 }}>{pdfTarget.total_leave}일</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '25%' }}>기사용 연차</td>
                                            <td style={{ ...cellStyle, width: '25%', textAlign: 'center' }}>{pdfTarget.used_leave}일</td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>잔여 연차</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, color: '#4f46e5' }}>{pdfTarget.total_leave - pdfTarget.used_leave}일</td>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>금회 신청</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 700, color: '#dc2626' }}>{leaveAppData.days}일</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '25%' }}>사용 기간</td>
                                            <td colSpan="3" style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 }}>
                                                {leaveAppData.startDate || '____년 __월 __일'} ~ {leaveAppData.endDate || '____년 __월 __일'} ({leaveAppData.days}일간)
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>사 유</td>
                                            <td colSpan="3" style={{ ...cellStyle, minHeight: '60px' }}>
                                                {leaveAppData.reason || '개인 사유'}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '24px', fontSize: '13px', lineHeight: 2, color: '#64748b' }}>
                                    근로기준법 제60조에 의거하여 위와 같이 연차유급휴가를 신청합니다.
                                </div>

                                <div style={{ textAlign: 'center', margin: '40px 0 30px', fontSize: '14px', fontWeight: 600 }}>
                                    {formatDate(today)}
                                </div>

                                <table style={{ width: '80%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '30%', textAlign: 'center' }}>신청인</td>
                                            <td style={{ ...cellStyle, textAlign: 'center', height: '50px' }}>{pdfTarget.name} (인)</td>
                                        </tr>
                                    </tbody>
                                </table>

                                <div style={{ marginTop: '40px', borderTop: '2px solid #e2e8f0', paddingTop: '20px' }}>
                                    <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: '#64748b' }}>결 재</div>
                                    <table style={{ width: '60%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>담당</th>
                                                <th style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>팀장</th>
                                                <th style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>대표</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...cellStyle, textAlign: 'center', height: '60px' }}></td>
                                                <td style={{ ...cellStyle, textAlign: 'center', height: '60px' }}></td>
                                                <td style={{ ...cellStyle, textAlign: 'center', height: '60px' }}></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : pdfType === 'retirement' ? (
                            /* === 퇴직금 계산서 === */
                            (() => {
                                const joinD = new Date(pdfTarget.join_date);
                                const resignD = retireData.resignDate ? new Date(retireData.resignDate) : today;
                                const totalDays = Math.floor((resignD - joinD) / (1000 * 60 * 60 * 24));
                                const years = Math.floor(totalDays / 365);
                                const months = Math.floor((totalDays % 365) / 30);
                                const days = totalDays % 30;

                                const mw = parseFloat(retireData.monthlyWage) || 0;
                                const b3 = parseFloat(retireData.bonus3m) || 0;
                                const ab = parseFloat(retireData.annualBonus) || 0;
                                const oa = parseFloat(retireData.otherAllowance) || 0;

                                // 1일 평균임금 = (최근 3개월 급여 총액 + 3개월 상여금 비례분 + 연차수당) / 해당 일수(보통 90일)
                                const threeMonthWage = mw * 3; // 3개월 기본급
                                const bonusProportion = ab / 12 * 3; // 연간 상여금의 3/12
                                const otherTotal = oa * 3; // 3개월 기타수당
                                const totalThreeMonth = threeMonthWage + (b3 || bonusProportion) + otherTotal;
                                const dailyAvgWage = totalThreeMonth / 90;

                                // 퇴직금 = 1일 평균임금 × 30일 × (재직일수 / 365)
                                const retirePay = dailyAvgWage * 30 * (totalDays / 365);

                                const fmt = (n) => n.toLocaleString('ko-KR', { maximumFractionDigits: 0 });

                                return (
                                    <div>
                                        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                                            <h1 style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '6px', marginBottom: '8px' }}>퇴 직 금 산 정 서</h1>
                                            <div style={{ width: '60px', height: '3px', background: '#4f46e5', margin: '0 auto' }}></div>
                                        </div>

                                        {/* 직원 정보 */}
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>성 명</td>
                                                    <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.name}</td>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '20%' }}>사원번호</td>
                                                    <td style={{ ...cellStyle, width: '30%' }}>{pdfTarget.emp_id}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>부 서</td>
                                                    <td style={cellStyle}>{pdfTarget.department}</td>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>직 급</td>
                                                    <td style={cellStyle}>{pdfTarget.position}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>입사일</td>
                                                    <td style={cellStyle}>{pdfTarget.join_date}</td>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>퇴직일</td>
                                                    <td style={cellStyle}>{retireData.resignDate}</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>재직기간</td>
                                                    <td colSpan="3" style={{ ...cellStyle, fontWeight: 700, color: '#4f46e5' }}>
                                                        {years}년 {months}개월 {days}일 (총 {totalDays}일)
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* 급여 정보 */}
                                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>■ 급여 정보 (퇴직 전 3개월 기준)</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '30%' }}>월 기본급</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(mw)}원</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>기타 수당 (월평균)</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(oa)}원</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>최근 3개월 상여금</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(b3 || bonusProportion)}원</td>
                                                </tr>
                                                <tr style={{ background: '#eff6ff' }}>
                                                    <td style={{ ...cellStyle, fontWeight: 700 }}>3개월간 임금 총액</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700, color: '#4f46e5' }}>{fmt(totalThreeMonth)}원</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        {/* 퇴직금 계산 */}
                                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>■ 퇴직금 산정</div>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '13px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '40%' }}>① 3개월간 임금 총액</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{fmt(totalThreeMonth)}원</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>② 산정 기간 일수</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>90일</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>③ 1일 평균임금 (① ÷ ②)</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(dailyAvgWage)}원</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>④ 30일분 평균임금 (③ × 30)</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>{fmt(dailyAvgWage * 30)}원</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700 }}>⑤ 재직일수 / 365</td>
                                                    <td style={{ ...cellStyle, textAlign: 'right' }}>{(totalDays / 365).toFixed(4)}</td>
                                                </tr>
                                            </tbody>
                                        </table>

                                        <div style={{ background: '#eef2ff', border: '2px solid #4f46e5', borderRadius: '10px', padding: '20px', marginBottom: '24px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>퇴직금 = ④ × ⑤</div>
                                            <div style={{ fontSize: '24px', fontWeight: 800, color: '#4f46e5' }}>{fmt(retirePay)}원</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>({Math.floor(retirePay / 10000).toLocaleString()}만원)</div>
                                        </div>

                                        {/* 계산 공식 설명 */}
                                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>■ 퇴직금 산정 공식</div>
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '12px', lineHeight: 1.9, color: '#475569' }}>
                                            <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '6px', textAlign: 'center', marginBottom: '12px', fontSize: '13px', fontWeight: 700 }}>
                                                퇴직금 = 1일 평균임금 × 30일 × (총 재직일수 ÷ 365)
                                            </div>
                                            <p style={{ marginBottom: '6px' }}>• <strong>1일 평균임금</strong> = 퇴직 전 3개월간 지급된 임금 총액 ÷ 해당 기간의 총 일수 (90일)</p>
                                            <p style={{ marginBottom: '6px' }}>• <strong>3개월 임금 총액</strong> = (기본급 × 3) + (3개월간 상여금) + (기타 수당 × 3)</p>
                                            <p>• 상여금이 연간 단위인 경우 3/12를 적용하여 비례 산정합니다.</p>
                                        </div>

                                        {/* 법적 설명 */}
                                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px', color: '#1e293b' }}>■ 법적 근거 및 안내</div>
                                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', marginBottom: '20px', fontSize: '11.5px', lineHeight: 2, color: '#475569' }}>
                                            <p style={{ marginBottom: '8px' }}><strong>1. 퇴직급여 지급 대상 (근로자퇴직급여 보장법 제4조)</strong></p>
                                            <p style={{ marginBottom: '8px', paddingLeft: '12px' }}>사용자는 계속근로기간이 <strong>1년 이상</strong>이고, <strong>4주간 평균하여 1주간의 소정근로시간이 15시간 이상</strong>인 근로자에게 퇴직급여를 지급하여야 합니다.</p>

                                            <p style={{ marginBottom: '8px' }}><strong>2. 퇴직금 산정 방법 (근로자퇴직급여 보장법 제8조 제1항)</strong></p>
                                            <p style={{ marginBottom: '8px', paddingLeft: '12px' }}>퇴직금은 계속근로기간 1년에 대하여 <strong>30일분 이상의 평균임금</strong>을 퇴직금으로 지급합니다. 평균임금은 퇴직일 이전 3개월간 지급된 임금총액을 기준으로 산정합니다.</p>

                                            <p style={{ marginBottom: '8px' }}><strong>3. 평균임금 산정 (근로기준법 제2조 제1항 제6호)</strong></p>
                                            <p style={{ marginBottom: '8px', paddingLeft: '12px' }}>평균임금은 이를 산정하여야 할 사유가 발생한 날 이전 3개월간에 그 근로자에게 지급된 임금의 총액을 그 기간의 총일수로 나눈 금액을 말합니다. 통상임금보다 평균임금이 낮은 경우 통상임금을 적용합니다.</p>

                                            <p style={{ marginBottom: '8px' }}><strong>4. 퇴직금 지급 기한 (근로자퇴직급여 보장법 제9조)</strong></p>
                                            <p style={{ marginBottom: '8px', paddingLeft: '12px' }}>퇴직금은 지급사유가 발생한 날부터 <strong>14일 이내</strong>에 지급하여야 합니다. 다만, 특별한 사정이 있는 경우 당사자 간 합의에 의하여 연장할 수 있습니다.</p>

                                            <p style={{ marginBottom: '8px' }}><strong>5. 퇴직소득세 (소득세법 제22조)</strong></p>
                                            <p style={{ marginBottom: '8px', paddingLeft: '12px' }}>퇴직금은 퇴직소득에 해당하며, 근속연수에 따른 공제 후 세금이 부과됩니다. 퇴직소득세는 별도 산정하여 원천징수합니다.</p>

                                            <p style={{ marginBottom: '8px' }}><strong>6. 위반 시 제재 (근로자퇴직급여 보장법 제44조)</strong></p>
                                            <p style={{ paddingLeft: '12px' }}>퇴직금을 정당한 사유 없이 기한 내 미지급 시 <strong>3년 이하의 징역 또는 2천만원 이하의 벌금</strong>에 처할 수 있습니다. 또한 미지급 기간에 대한 지연이자(연 20%)가 발생합니다.</p>
                                        </div>

                                        {/* 주의사항 */}
                                        <div style={{ background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px', padding: '14px', marginBottom: '24px', fontSize: '11.5px', lineHeight: 1.8, color: '#854d0e' }}>
                                            <strong>※ 유의사항</strong>
                                            <p>• 본 산정서는 참고용이며, 정확한 퇴직금은 실제 급여대장 기준으로 산정하여야 합니다.</p>
                                            <p>• 퇴직소득세는 별도로 계산되어 원천징수되며, 실수령액은 상이할 수 있습니다.</p>
                                            <p>• 미사용 연차수당이 있는 경우 평균임금 산정 시 포함하여야 합니다.</p>
                                        </div>

                                        {/* 서명란 */}
                                        <div style={{ textAlign: 'center', margin: '30px 0 20px', fontSize: '14px', fontWeight: 600 }}>
                                            {formatDate(today)}
                                        </div>

                                        <table style={{ width: '80%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '13px' }}>
                                            <tbody>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, width: '30%', textAlign: 'center' }}>확인자 (사업주)</td>
                                                    <td style={{ ...cellStyle, textAlign: 'center', height: '50px' }}>(인)</td>
                                                </tr>
                                                <tr>
                                                    <td style={{ ...cellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>수령자 (근로자)</td>
                                                    <td style={{ ...cellStyle, textAlign: 'center', height: '50px' }}>{pdfTarget.name} (인)</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })()
                        ) : null}

                        {/* === 의무교육 출석부 === */}
                        {pdfType === 'training' && (() => {
                            const selTraining = TRAININGS.find(t => t.code === trainingType);
                            const activeEmps = employees.filter(e => e.status === '재직');
                            const tCellStyle = { ...cellStyle, padding: '5px 8px', fontSize: '11px' };
                            return (
                                <div>
                                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                                        <h1 style={{ fontSize: '22px', fontWeight: 800, letterSpacing: '4px', marginBottom: '6px' }}>의 무 교 육 실 시 확 인 서</h1>
                                        <div style={{ width: '50px', height: '2px', background: '#4f46e5', margin: '0 auto' }}></div>
                                    </div>

                                    {/* 교육 정보 */}
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, width: '18%' }}>교육명</td>
                                                <td style={{ ...tCellStyle, width: '32%', fontWeight: 700, color: '#4f46e5' }}>{selTraining?.icon} {selTraining?.name}</td>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, width: '18%' }}>법적 근거</td>
                                                <td style={{ ...tCellStyle, width: '32%' }}>{selTraining?.law}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>교육일시</td>
                                                <td style={tCellStyle}>{trainingFormData.date} {trainingFormData.startTime}~{trainingFormData.endTime}</td>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>교육시간</td>
                                                <td style={tCellStyle}>{selTraining?.hours}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>교육장소</td>
                                                <td style={tCellStyle}>{trainingFormData.location || '-'}</td>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>강사</td>
                                                <td style={tCellStyle}>{trainingFormData.instructor || '-'}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>교육주기</td>
                                                <td style={tCellStyle}>{selTraining?.period === 'quarterly' ? '분기별 (매 3개월)' : '연 1회'}</td>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700 }}>교육대상</td>
                                                <td style={tCellStyle}>전 직원 ({activeEmps.length}명)</td>
                                            </tr>
                                        </tbody>
                                    </table>

                                    {/* 출석부 */}
                                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>■ 교육 참석자 명단</div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px', fontSize: '11px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '8%' }}>No.</th>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '15%' }}>성명</th>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '15%' }}>부서</th>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '12%' }}>직급</th>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '25%' }}>서명</th>
                                                <th style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center', width: '25%' }}>비고</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeEmps.map((emp, idx) => (
                                                <tr key={emp.id}>
                                                    <td style={{ ...tCellStyle, textAlign: 'center' }}>{idx + 1}</td>
                                                    <td style={{ ...tCellStyle, textAlign: 'center', fontWeight: 600 }}>{emp.name}</td>
                                                    <td style={{ ...tCellStyle, textAlign: 'center' }}>{emp.department}</td>
                                                    <td style={{ ...tCellStyle, textAlign: 'center' }}>{emp.position}</td>
                                                    <td style={{ ...tCellStyle, textAlign: 'center', height: '28px' }}></td>
                                                    <td style={tCellStyle}></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* 교육 내용 요약 */}
                                    <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: '#1e293b' }}>■ 법적 안내</div>
                                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 14px', marginBottom: '16px', fontSize: '10.5px', lineHeight: 1.8, color: '#475569' }}>
                                        <p style={{ marginBottom: '6px' }}>• <strong>{selTraining?.name}</strong>은 <strong>{selTraining?.law}</strong>에 의거하여 {selTraining?.period === 'quarterly' ? '매 분기(3개월)마다' : '연 1회 이상'} 실시하여야 합니다.</p>
                                        <p style={{ marginBottom: '6px' }}>• 교육시간: <strong>{selTraining?.hours}</strong> (법정 최소 교육시간)</p>
                                        <p style={{ marginBottom: '6px' }}>• 교육 미실시 시 <strong>과태료 또는 벌금</strong>이 부과될 수 있습니다.</p>
                                        <p>• 본 확인서는 교육 실시 증빙 서류로 <strong>3년간 보관</strong>하여야 합니다.</p>
                                    </div>

                                    {/* 첨부 사진은 별도 페이지로 이동 */}

                                    {/* 서명란 */}
                                    <div style={{ textAlign: 'center', margin: '20px 0 14px', fontSize: '12px', fontWeight: 600 }}>
                                        {formatDate(today)}
                                    </div>

                                    <table style={{ width: '70%', margin: '0 auto', borderCollapse: 'collapse', fontSize: '11px' }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, width: '30%', textAlign: 'center' }}>교육 실시자</td>
                                                <td style={{ ...tCellStyle, textAlign: 'center', height: '40px' }}>{trainingFormData.instructor || ''} (인)</td>
                                            </tr>
                                            <tr>
                                                <td style={{ ...tCellStyle, background: '#f8fafc', fontWeight: 700, textAlign: 'center' }}>확인자 (사업주)</td>
                                                <td style={{ ...tCellStyle, textAlign: 'center', height: '40px' }}>(인)</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* 교육 사진 별도 페이지 (숨김) */}
            {isPdfPreview && pdfType === 'training' && trainingPhotos.length > 0 && (
                <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                    <div ref={trainingPhotoPdfRef} style={{
                        width: '210mm', minHeight: '297mm', padding: '20mm',
                        background: 'white', fontFamily: 'Malgun Gothic, sans-serif'
                    }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '16px', color: '#1e293b', textAlign: 'center' }}>
                            ■ 교육 현장 사진
                        </div>
                        {trainingPhotos.slice(0, 4).map((photo, idx) => (
                            <div key={idx} style={{ textAlign: 'center', marginBottom: '12px' }}>
                                <img src={photo.data} alt={`교육사진${idx + 1}`}
                                    style={{ maxWidth: '100%', height: 'auto', borderRadius: '6px', border: '1px solid #e2e8f0' }} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                .leave-btn:hover { background: #dcfce7; color: #16a34a; }
                .delete-btn:hover { background: #fee2e2; color: var(--danger); }
                
                .perm-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                }
                .perm-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem;
                    border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .perm-item:hover {
                    background: var(--bg-main);
                }
                .perm-item input {
                    cursor: pointer;
                    width: 16px;
                    height: 16px;
                }

                .filter-tabs { display: flex; gap: 1rem; margin-bottom: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0px; }
                .filter-tab { 
                    padding: 0.75rem 1.5rem; 
                    background: transparent; 
                    border: none; 
                    border-bottom: 2px solid transparent; 
                    color: var(--text-muted); 
                    font-weight: 600; 
                    cursor: pointer; 
                }
                .filter-tab.active { 
                    border-bottom-color: var(--primary); 
                    color: var(--primary); 
                }
            `}</style>
        </div >
    );
};

const cellStyle = {
    border: '1px solid #e2e8f0',
    padding: '8px 12px',
    fontSize: '13px'
};

export default Employees;
