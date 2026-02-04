import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Settings, Plus, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const InjectionConditions = () => {
    const { injectionConditions, products, addInjectionCondition, updateInjectionCondition, deleteInjectionCondition } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState(null);

    const [formData, setFormData] = useState({
        product_id: '',
        // 온도
        hopper_temp: '',
        cylinder_temp_zone1: '',
        cylinder_temp_zone2: '',
        cylinder_temp_zone3: '',
        cylinder_temp_zone4: '',
        nozzle_temp: '',
        mold_temp_fixed: '',
        mold_temp_moving: '',
        // 압력/속도/시간 (3단계)
        injection_pressure: '',
        injection_speed: '',
        injection_time: '',
        dosing_position_1: '',
        injection_pressure_2: '',
        injection_speed_2: '',
        injection_time_2: '',
        dosing_position_2: '',
        holding_pressure: '',
        holding_speed: '',
        holding_time: '',
        // 기타 설정
        back_pressure: '',
        cooling_time: '',
        cycle_time: '',
        shot_size: '',
        screw_rpm: '',
        cushion: '',
        notes: ''
    });

    const columns = [
        {
            header: '제품명',
            accessor: 'product_name',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                return product?.name || '-';
            }
        },
        {
            header: '사이클 타임',
            accessor: 'cycle_time',
            render: (row) => row.cycle_time ? `${row.cycle_time}초` : '-'
        },
        {
            header: '사출압력',
            accessor: 'injection_pressure',
            render: (row) => row.injection_pressure ? `${row.injection_pressure} kgf/cm²` : '-'
        },
        {
            header: '노즐온도',
            accessor: 'nozzle_temp',
            render: (row) => row.nozzle_temp ? `${row.nozzle_temp}°C` : '-'
        },
        {
            header: '등록일',
            accessor: 'created_at',
            render: (row) => new Date(row.created_at).toLocaleDateString('ko-KR')
        }
    ];

    const handleOpenModal = (condition = null) => {
        if (condition) {
            setEditingCondition(condition);
            setFormData(condition);
        } else {
            setEditingCondition(null);
            resetForm();
        }
        setIsModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            product_id: '',
            hopper_temp: '', cylinder_temp_zone1: '', cylinder_temp_zone2: '',
            cylinder_temp_zone3: '', cylinder_temp_zone4: '', nozzle_temp: '',
            mold_temp_fixed: '', mold_temp_moving: '',
            injection_pressure: '', injection_speed: '', injection_time: '', dosing_position_1: '',
            injection_pressure_2: '', injection_speed_2: '', injection_time_2: '', dosing_position_2: '',
            holding_pressure: '', holding_speed: '', holding_time: '',
            back_pressure: '', cooling_time: '', cycle_time: '',
            shot_size: '', screw_rpm: '', cushion: '', notes: ''
        });
    };

    const handleSave = async () => {
        if (!formData.product_id) {
            return alert('제품을 선택해주세요.');
        }

        // 중복 체크 (편집이 아닐 때만)
        if (!editingCondition) {
            const existingCondition = injectionConditions.find(c => c.product_id === formData.product_id);
            if (existingCondition) {
                return alert('해당 제품의 사출조건이 이미 등록되어 있습니다.');
            }
        }

        if (editingCondition) {
            await updateInjectionCondition(editingCondition.id, formData);
        } else {
            await addInjectionCondition(formData);
        }

        setIsModalOpen(false);
        resetForm();
        setEditingCondition(null);
    };

    const handleDelete = async (id) => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
            await deleteInjectionCondition(id);
        }
    };

    const actions = [
        {
            label: '수정',
            icon: Edit,
            onClick: (row) => handleOpenModal(row),
            className: 'btn-secondary'
        },
        {
            label: '삭제',
            icon: Trash2,
            onClick: (row) => handleDelete(row.id),
            className: 'btn-danger'
        }
    ];

    const updateField = (field, value) => {
        // Convert empty string to null for numeric fields to prevent database errors
        setFormData(prev => ({
            ...prev,
            [field]: value === '' ? null : (isNaN(parseFloat(value)) ? value : parseFloat(value))
        }));
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">사출조건표 관리</h2>
                    <p className="page-description">제품별 사출 성형 조건을 등록하고 관리합니다.</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    <Plus size={18} />
                    조건 등록
                </button>
            </div>

            <Table columns={columns} data={injectionConditions} actions={actions} />

            <Modal
                title={editingCondition ? '사출조건 수정' : '사출조건 등록'}
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                width="800px"
            >
                <div className="condition-form">
                    {/* 제품 선택 */}
                    <div className="form-section">
                        <h3 className="section-title">기본 정보</h3>
                        <div className="form-group">
                            <label className="form-label">제품 *</label>
                            <select
                                className="form-input"
                                value={formData.product_id}
                                onChange={(e) => updateField('product_id', e.target.value)}
                                disabled={editingCondition}
                            >
                                <option value="">제품 선택</option>
                                {products.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 온도 설정 */}
                    <div className="form-section">
                        <h3 className="section-title">🌡️ 온도 설정 (°C)</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">호퍼 온도</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.hopper_temp}
                                    onChange={(e) => updateField('hopper_temp', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 1</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone1}
                                    onChange={(e) => updateField('cylinder_temp_zone1', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 2</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone2}
                                    onChange={(e) => updateField('cylinder_temp_zone2', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 3</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone3}
                                    onChange={(e) => updateField('cylinder_temp_zone3', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 4</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone4}
                                    onChange={(e) => updateField('cylinder_temp_zone4', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">노즐 온도</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.nozzle_temp}
                                    onChange={(e) => updateField('nozzle_temp', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">금형 온도 (고정측)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.mold_temp_fixed}
                                    onChange={(e) => updateField('mold_temp_fixed', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">금형 온도 (가동측)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.mold_temp_moving}
                                    onChange={(e) => updateField('mold_temp_moving', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 1차 사출 */}
                    <div className="form-section stage-section">
                        <h3 className="section-title">1️⃣ 1차 사출 설정</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">1차 압력 (kgf/cm²)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.injection_pressure}
                                    onChange={(e) => updateField('injection_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">1차 속도 (mm/s)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.injection_speed}
                                    onChange={(e) => updateField('injection_speed', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">1차 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.injection_time || ''}
                                    onChange={(e) => updateField('injection_time', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">1차 계량 위치 (mm)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.dosing_position_1 || ''}
                                    onChange={(e) => updateField('dosing_position_1', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 2차 사출 */}
                    <div className="form-section stage-section">
                        <h3 className="section-title">2️⃣ 2차 사출 설정</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">2차 압력 (kgf/cm²)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.injection_pressure_2 || ''}
                                    onChange={(e) => updateField('injection_pressure_2', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">2차 속도 (mm/s)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.injection_speed_2 || ''}
                                    onChange={(e) => updateField('injection_speed_2', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">2차 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.injection_time_2 || ''}
                                    onChange={(e) => updateField('injection_time_2', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">2차 계량 위치 (mm)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.dosing_position_2 || ''}
                                    onChange={(e) => updateField('dosing_position_2', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 보압 사출 */}
                    <div className="form-section stage-section highlight">
                        <h3 className="section-title">3️⃣ 보압 설정</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">보압 압력 (kgf/cm²)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.holding_pressure}
                                    onChange={(e) => updateField('holding_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">보압 속도 (mm/s)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.holding_speed}
                                    onChange={(e) => updateField('holding_speed', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">보압 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.holding_time}
                                    onChange={(e) => updateField('holding_time', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 공통/기타 시간 및 설정 */}
                    <div className="form-section">
                        <h3 className="section-title">⚙️ 기타 설정</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">배압 (kgf/cm²)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.back_pressure}
                                    onChange={(e) => updateField('back_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">냉각 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cooling_time}
                                    onChange={(e) => updateField('cooling_time', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">사이클 타임 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cycle_time}
                                    onChange={(e) => updateField('cycle_time', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 기타 조건 */}
                    <div className="form-section">
                        <h3 className="section-title">🔧 기타 조건</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">계량 위치/Shot Size (mm/cc)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.shot_size}
                                    onChange={(e) => updateField('shot_size', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">스크류 회전수 (RPM)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.screw_rpm}
                                    onChange={(e) => updateField('screw_rpm', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">쿠션량 (mm)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cushion}
                                    onChange={(e) => updateField('cushion', e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">비고</label>
                            <textarea
                                className="form-input"
                                rows="3"
                                value={formData.notes}
                                onChange={(e) => updateField('notes', e.target.value)}
                                placeholder="특이사항이나 참고사항을 입력하세요..."
                            />
                        </div>
                    </div>

                    <div className="modal-actions">
                        <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>취소</button>
                        <button className="btn-submit" onClick={handleSave}>
                            {editingCondition ? '수정' : '등록'}
                        </button>
                    </div>
                </div>
            </Modal>

            <style>{`
                .condition-form {
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .form-section {
                    margin-bottom: 2rem;
                    padding: 1.5rem;
                .stage-section {
                    background: #f0f7ff;
                    border-left: 4px solid var(--primary);
                }
                .stage-section.highlight {
                    background: #fdf4ff;
                    border-left-color: #d946ef;
                }

                .section-title {
                    font-size: 1rem;
                    font-weight: 600;
                    margin-bottom: 1rem;
                    color: var(--text-main);
                }

                .form-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .form-group {
                    margin-bottom: 0;
                }
            `}</style>
        </div>
    );
};

export default InjectionConditions;
