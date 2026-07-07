import React, { useState } from 'react';
import Table from '../components/Table';
import Modal from '../components/Modal';
import { Settings, Plus, Edit, Trash2 } from 'lucide-react';
import { useData } from '../context/DataContext';

const InjectionConditions = () => {
    const { injectionConditions, products, equipments, addInjectionCondition, updateInjectionCondition, deleteInjectionCondition } = useData();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState(null);

    // 필터 상태
    const [filterProduct, setFilterProduct] = useState('');
    const [filterEquipment, setFilterEquipment] = useState('');

    const [formData, setFormData] = useState({
        product_id: '',
        equipment_id: '',
        hopper_temp: null, cylinder_temp_zone1: null, cylinder_temp_zone2: null,
        cylinder_temp_zone3: null, cylinder_temp_zone4: null, nozzle_temp: null,
        mold_temp_fixed: null, mold_temp_moving: null,
        injection_pressure: null, injection_speed: null, injection_time: null, dosing_position_1: null,
        injection_pressure_2: null, injection_speed_2: null, injection_time_2: null, dosing_position_2: null,
        holding_pressure: null, holding_speed: null, holding_time: null,
        back_pressure: null, cooling_time: null, cycle_time: null,
        shot_size: null, screw_rpm: null, cushion: null,
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
            header: '호기',
            accessor: 'equipment_name',
            render: (row) => {
                const equipment = equipments.find(e => e.id === row.equipment_id);
                return equipment ? `${equipment.name}` : '-';
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
            equipment_id: '',
            hopper_temp: null, cylinder_temp_zone1: null, cylinder_temp_zone2: null,
            cylinder_temp_zone3: null, cylinder_temp_zone4: null, nozzle_temp: null,
            mold_temp_fixed: null, mold_temp_moving: null,
            injection_pressure: null, injection_speed: null, injection_time: null, dosing_position_1: null,
            injection_pressure_2: null, injection_speed_2: null, injection_time_2: null, dosing_position_2: null,
            holding_pressure: null, holding_speed: null, holding_time: null,
            back_pressure: null, cooling_time: null, cycle_time: null,
            shot_size: null, screw_rpm: null, cushion: null, notes: ''
        });
    };

    const handleSave = async () => {
        if (!formData.product_id) {
            return alert('제품을 선택해주세요.');
        }

        if (!formData.equipment_id) {
            return alert('호기를 선택해주세요.');
        }

        // 중복 체크 (편집이 아닐 때만)
        if (!editingCondition) {
            const existingCondition = injectionConditions.find(
                c => c.product_id === formData.product_id && c.equipment_id === formData.equipment_id
            );
            if (existingCondition) {
                const product = products.find(p => p.id === formData.product_id);
                const equipment = equipments.find(e => e.id === formData.equipment_id);
                return alert(`${product?.name} - ${equipment?.name}의 사출조건이 이미 등록되어 있습니다.`);
            }
        }

        // 데이터 정제: 빈 문자열을 null로 변환 (숫자 필드 오류 방지)
        const cleanedData = { ...formData };
        Object.keys(cleanedData).forEach(key => {
            if (cleanedData[key] === '') {
                cleanedData[key] = null;
            }
        });

        if (editingCondition) {
            await updateInjectionCondition(editingCondition.id, cleanedData);
        } else {
            await addInjectionCondition(cleanedData);
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

    const renderActions = (row) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="icon-btn" onClick={() => handleOpenModal(row)} title="수정">
                <Edit size={16} />
            </button>
            <button className="icon-btn" onClick={() => handleDelete(row.id)} title="삭제" style={{ color: 'var(--danger)' }}>
                <Trash2 size={16} />
            </button>
        </div>
    );

    const updateField = (field, value) => {
        setFormData(prev => {
            let newValue = value;

            // 빈 문자열 처리를 null로 일관되게 함 (DB 호환성)
            if (value === '') {
                newValue = null;
            } else if (field !== 'product_id' && field !== 'equipment_id' && field !== 'notes' && !isNaN(parseFloat(value))) {
                // 제품 ID, 호기 ID, 비고가 아닌 경우에만 숫자로 변환 시도
                // parseFloat는 UUID가 숫자로 시작할 때 오작동할 수 있으므로 주의 필요
                newValue = parseFloat(value);
            }

            return {
                ...prev,
                [field]: newValue
            };
        });
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

            {/* 필터 */}
            <div className="filter-row">
                <select
                    className="filter-select"
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                >
                    <option value="">전체 제품</option>
                    {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>

                <select
                    className="filter-select"
                    value={filterEquipment}
                    onChange={(e) => setFilterEquipment(e.target.value)}
                >
                    <option value="">전체 호기</option>
                    {equipments && equipments.map(eq => (
                        <option key={eq.id} value={eq.id}>{eq.name}</option>
                    ))}
                </select>

                {(filterProduct || filterEquipment) && (
                    <button
                        className="btn-cancel"
                        style={{ padding: '0.5rem 1rem', fontSize: '0.9rem' }}
                        onClick={() => {
                            setFilterProduct('');
                            setFilterEquipment('');
                        }}
                    >
                        필터 초기화
                    </button>
                )}
            </div>

            <Table columns={columns} data={injectionConditions.filter(row => {
                if (filterProduct && row.product_id !== filterProduct) return false;
                if (filterEquipment && row.equipment_id !== filterEquipment) return false;
                return true;
            })} actions={renderActions} pageSize={50} />

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
                        <div className="form-grid">
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
                            <div className="form-group">
                                <label className="form-label">호기 (설비) *</label>
                                <select
                                    className="form-input"
                                    value={formData.equipment_id}
                                    onChange={(e) => updateField('equipment_id', e.target.value)}
                                >
                                    <option value="">호기 선택</option>
                                    {equipments && equipments.map(eq => (
                                        <option key={eq.id} value={eq.id}>{eq.name} ({eq.eq_code})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 온도 설정 */}
                    <div className="form-section">
                        <h3 className="section-title">🌡️ 온도 설정 (°C)</h3>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">호퍼 온도</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.hopper_temp ?? ''}
                                    onChange={(e) => updateField('hopper_temp', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 1</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone1 ?? ''}
                                    onChange={(e) => updateField('cylinder_temp_zone1', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 2</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone2 ?? ''}
                                    onChange={(e) => updateField('cylinder_temp_zone2', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 3</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone3 ?? ''}
                                    onChange={(e) => updateField('cylinder_temp_zone3', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">실린더 Zone 4</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.cylinder_temp_zone4 ?? ''}
                                    onChange={(e) => updateField('cylinder_temp_zone4', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">노즐 온도</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.nozzle_temp ?? ''}
                                    onChange={(e) => updateField('nozzle_temp', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">금형 온도 (고정측)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.mold_temp_fixed ?? ''}
                                    onChange={(e) => updateField('mold_temp_fixed', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">금형 온도 (가동측)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.mold_temp_moving ?? ''}
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
                                    value={formData.injection_pressure ?? ''}
                                    onChange={(e) => updateField('injection_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">1차 속도 (mm/s)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.injection_speed ?? ''}
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
                                    value={formData.holding_pressure ?? ''}
                                    onChange={(e) => updateField('holding_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">보압 속도 (mm/s)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.holding_speed ?? ''}
                                    onChange={(e) => updateField('holding_speed', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">보압 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.holding_time ?? ''}
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
                                    value={formData.back_pressure ?? ''}
                                    onChange={(e) => updateField('back_pressure', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">냉각 시간 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cooling_time ?? ''}
                                    onChange={(e) => updateField('cooling_time', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">사이클 타임 (초)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cycle_time ?? ''}
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
                                    value={formData.shot_size ?? ''}
                                    onChange={(e) => updateField('shot_size', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">스크류 회전수 (RPM)</label>
                                <input type="number" step="0.1" className="form-input"
                                    value={formData.screw_rpm ?? ''}
                                    onChange={(e) => updateField('screw_rpm', e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">쿠션량 (mm)</label>
                                <input type="number" step="0.01" className="form-input"
                                    value={formData.cushion ?? ''}
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
                    background: #f9fafb;
                    border-radius: 8px;
                }
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
