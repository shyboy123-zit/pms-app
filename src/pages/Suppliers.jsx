import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Plus, Edit, Trash2, Phone, Mail, Building } from 'lucide-react';
import { useData } from '../context/DataContext';

const Suppliers = () => {
    const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useData();

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newItem, setNewItem] = useState({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        business_number: '',
        main_items: '',
        notes: '',
        status: '활성'
    });

    const columns = [
        { header: '업체명', accessor: 'name' },
        { header: '담당자', accessor: 'contact_person' },
        { header: '연락처', accessor: 'phone' },
        { header: '이메일', accessor: 'email' },
        {
            header: '주요 품목', accessor: 'main_items', render: (row) => (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{row.main_items || '-'}</span>
            )
        },
        {
            header: '상태', accessor: 'status', render: (row) => (
                <span className={`status-badge ${row.status === '활성' ? 'status-good' : 'status-bad'}`}>
                    {row.status}
                </span>
            )
        }
    ];

    const handleSubmit = async () => {
        if (!newItem.name) return alert('업체명을 입력해주세요.');

        if (isEditing && editingId) {
            await updateSupplier(editingId, newItem);
            alert('거래처 정보가 수정되었습니다.');
        } else {
            await addSupplier(newItem);
            alert('신규 거래처가 등록되었습니다.');
        }
        resetForm();
    };

    const handleEdit = (item) => {
        setNewItem(item);
        setIsEditing(true);
        setEditingId(item.id);
        setIsModalOpen(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('이 거래처를 삭제하시겠습니까?')) {
            await deleteSupplier(id);
            alert('거래처가 삭제되었습니다.');
        }
    };

    const resetForm = () => {
        setIsModalOpen(false);
        setIsEditing(false);
        setEditingId(null);
        setNewItem({
            name: '',
            contact_person: '',
            phone: '',
            email: '',
            address: '',
            business_number: '',
            main_items: '',
            notes: '',
            status: '활성'
        });
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">거래처 관리</h2>
                    <p className="page-description">원자재 구매 및 외주 가공 거래처를 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
                    <Plus size={18} /> 신규 거래처 등록
                </button>
            </div>

            <Table
                columns={columns}
                data={suppliers || []}
                actions={(row) => (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="icon-btn" onClick={() => handleEdit(row)} title="수정">
                            <Edit size={16} />
                        </button>
                        <button className="icon-btn" onClick={() => handleDelete(row.id)} title="삭제" style={{ color: 'var(--danger)' }}>
                            <Trash2 size={16} />
                        </button>
                    </div>
                )}
            />

            <Modal
                title={isEditing ? "거래처 정보 수정" : "신규 거래처 등록"}
                isOpen={isModalOpen}
                onClose={resetForm}
            >
                <div className="form-group">
                    <label className="form-label">업체명 <span style={{ color: 'red' }}>*</span></label>
                    <div className="input-group">
                        <Building className="input-icon" size={18} />
                        <input
                            className="glass-input"
                            value={newItem.name}
                            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                            placeholder="업체명 (예: (주)한국케미칼)"
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                        <label className="form-label">담당자</label>
                        <input
                            className="form-input"
                            value={newItem.contact_person}
                            onChange={(e) => setNewItem({ ...newItem, contact_person: e.target.value })}
                            placeholder="담당자 이름"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">연락처</label>
                        <div className="input-group">
                            <Phone className="input-icon" size={16} />
                            <input
                                className="glass-input"
                                value={newItem.phone}
                                onChange={(e) => setNewItem({ ...newItem, phone: e.target.value })}
                                placeholder="010-0000-0000"
                            />
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">이메일</label>
                    <div className="input-group">
                        <Mail className="input-icon" size={16} />
                        <input
                            className="glass-input"
                            value={newItem.email}
                            onChange={(e) => setNewItem({ ...newItem, email: e.target.value })}
                            placeholder="example@company.com"
                        />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">주요 취급 품목</label>
                    <input
                        className="form-input"
                        value={newItem.main_items}
                        onChange={(e) => setNewItem({ ...newItem, main_items: e.target.value })}
                        placeholder="예: PP, ABS, 마스터배치"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">사업자등록번호</label>
                    <input
                        className="form-input"
                        value={newItem.business_number}
                        onChange={(e) => setNewItem({ ...newItem, business_number: e.target.value })}
                        placeholder="000-00-00000"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">주소</label>
                    <input
                        className="form-input"
                        value={newItem.address}
                        onChange={(e) => setNewItem({ ...newItem, address: e.target.value })}
                        placeholder="주소 입력"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">메모</label>
                    <textarea
                        className="form-input"
                        value={newItem.notes}
                        onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })}
                        placeholder="특이사항 메모"
                        rows="3"
                    />
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={resetForm}>취소</button>
                    <button className="btn-submit" onClick={handleSubmit}>
                        {isEditing ? '수정 완료' : '등록 완료'}
                    </button>
                </div>
            </Modal>

            <style>{`
                .page-container {
                    padding: 0 1.5rem;
                    max-width: 1600px;
                    margin: 0 auto;
                }
                .page-header-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid var(--border);
                }
                .page-subtitle {
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin-bottom: 0.25rem;
                    color: var(--text-main);
                }
                .page-description {
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }
                .status-badge {
                    padding: 0.25rem 0.6rem;
                    border-radius: 9999px;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .status-good {
                    background-color: #d1fae5;
                    color: #059669;
                }
                .status-bad {
                    background-color: #fee2e2;
                    color: #dc2626;
                }
            `}</style>
        </div>
    );
};

export default Suppliers;
