import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, UserPlus, UserMinus, Shield } from 'lucide-react';
import { useData } from '../context/DataContext';

const Employees = () => {
    // Consume global data from Supabase via DataContext
    const { employees, addEmployee, updateEmployee } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);

    const [newItem, setNewItem] = useState({ name: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
    const [selectedEmp, setSelectedEmp] = useState(null);
    const [tempPerms, setTempPerms] = useState({});

    const columns = [
        { header: '사원번호', accessor: 'emp_id' }, // Changed to match DB column name somewhat, or we map it? DB has emp_id
        { header: '이름', accessor: 'name' },
        { header: '부서', accessor: 'department' },
        { header: '직급', accessor: 'position' },
        { header: '입사일', accessor: 'join_date' }, // DB column
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

    const handleSave = () => {
        if (!newItem.name || !newItem.joinDate) return alert('필수 항목을 입력해주세요.');

        const count = employees.length + 1;
        const newId = `EMP-${String(count).padStart(3, '0')}`;
        const defaultPerms = { dashboard: true, molds: true, materials: true, delivery: true, quality: true, sales: true, employees: false, equipments: true };

        const itemToAdd = {
            emp_id: newId,
            name: newItem.name,
            department: newItem.department,
            position: newItem.position,
            join_date: newItem.joinDate,
            total_leave: newItem.totalLeave,
            resign_date: null,
            status: '재직',
            used_leave: 0,
            permissions: defaultPerms
        };

        addEmployee(itemToAdd);
        setIsModalOpen(false);
        setNewItem({ name: '', department: '생산팀', position: '사원', joinDate: '', totalLeave: 15 });
    };

    const handleResign = (id) => {
        if (!window.confirm('해당 직원을 퇴사 처리하시겠습니까?')) return;
        const today = new Date().toISOString().split('T')[0];
        updateEmployee(id, { status: '퇴사', resign_date: today });
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
        delivery: '납품관리',
        quality: '품질관리',
        sales: '매입매출',
        employees: '직원관리',
        equipments: '설비관리'
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">직원 관리</h2>
                    <p className="page-description">직원 입/퇴사 관리 및 접근 권한을 설정합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <UserPlus size={18} /> 직원 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={employees || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => openPermModal(row)} title="접근 권한 설정">
                            <Shield size={16} />
                        </button>
                        {row.status === '재직' && (
                            <button className="icon-btn" onClick={() => handleResign(row.id)} title="퇴사 처리">
                                <UserMinus size={16} />
                            </button>
                        )}
                    </div>
                )}
            />

            {/* Add Employee Modal */}
            <Modal title="신규 직원 등록" isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <div className="form-group">
                    <label className="form-label">이름</label>
                    <input className="form-input" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="직원 이름" />
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
                    <input className="form-input" value={newItem.position} onChange={(e) => setNewItem({ ...newItem, position: e.target.value })} placeholder="예: 사원, 대리" />
                </div>
                <div className="form-group">
                    <label className="form-label">입사일</label>
                    <input type="date" className="form-input" value={newItem.joinDate} onChange={(e) => setNewItem({ ...newItem, joinDate: e.target.value })} />
                </div>
                <div className="form-group">
                    <label className="form-label">부여 연차 (일)</label>
                    <input type="number" className="form-input" value={newItem.totalLeave} onChange={(e) => setNewItem({ ...newItem, totalLeave: parseInt(e.target.value) || 0 })} />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleSave}>등록</button>
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

            <style>{`
                .page-container { padding: 0 1rem; }
                .page-header-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .page-subtitle { font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem; }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .btn-primary { background: var(--primary); color: white; padding: 0.6rem 1.2rem; border-radius: var(--radius-md); display: flex; align-items: center; gap: 0.5rem; font-weight: 500; }
                .icon-btn { padding: 0.5rem; border-radius: var(--radius-sm); color: var(--text-muted); transition: all 0.2s; }
                .icon-btn:hover { background: var(--bg-main); color: var(--primary); }
                
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
            `}</style>
        </div>
    );
};

export default Employees;
