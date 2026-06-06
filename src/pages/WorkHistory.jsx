import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import { Calendar, Filter, Package, Settings } from 'lucide-react';
import { useData } from '../context/DataContext';

const WorkHistory = () => {
    const { workOrders, equipments, products, productionLogs } = useData();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');

    // 생산기록(production_logs) 기반 — 그날 "생산된" 모든 항목(완료 여부 무관)을 표시
    const filteredHistory = useMemo(() => {
        return (productionLogs || [])
            .filter(log => {
                const d = log.production_date;
                // 날짜 필터 (실제 생산일 기준)
                if (startDate && (!d || d < startDate)) return false;
                if (endDate && (!d || d > endDate)) return false;
                // 설비 필터
                if (selectedEquipment && log.equipment_id !== selectedEquipment) return false;
                // 제품 필터
                if (selectedProduct && log.product_id !== selectedProduct) return false;
                return true;
            })
            .sort((a, b) => (b.production_date || '').localeCompare(a.production_date || ''));
    }, [productionLogs, startDate, endDate, selectedEquipment, selectedProduct]);

    const columns = [
        { header: '생산일', accessor: 'production_date' },
        {
            header: '설비명',
            accessor: 'equipment_name',
            render: (row) => equipments.find(eq => eq.id === row.equipment_id)?.name || '-'
        },
        {
            header: '제품명',
            accessor: 'product_name',
            render: (row) => products.find(p => p.id === row.product_id)?.name || '-'
        },
        {
            header: '생산수량',
            accessor: 'daily_quantity',
            render: (row) => `${(row.daily_quantity || 0).toLocaleString()}개`
        },
        {
            header: '원재료 소모량',
            accessor: 'material_consumption',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                if (!product) return '-';

                const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                const totalWeightKg = (shotWeight * (row.daily_quantity || 0)) / 1000;

                if (totalWeightKg === 0) return '-';

                return (
                    <span style={{
                        fontWeight: 600,
                        color: totalWeightKg >= 1 ? '#059669' : '#64748b'
                    }} title={`제품: ${product.product_weight || 0}g, 런너: ${product.runner_weight || 0}g, 생산: ${row.daily_quantity}개`}>
                        {totalWeightKg.toFixed(2)} kg
                    </span>
                );
            }
        },
        {
            header: '작업상태',
            accessor: 'status',
            render: (row) => {
                const wo = workOrders.find(w => w.id === row.work_order_id);
                const st = wo?.status || '-';
                const cls = st === '완료' ? 'status-active' : st === '진행중' ? 'status-warning' : '';
                return <span className={`status-badge ${cls}`}>{st}</span>;
            }
        }
    ];

    const handleReset = () => {
        setStartDate('');
        setEndDate(new Date().toISOString().split('T')[0]);
        setSelectedEquipment('');
        setSelectedProduct('');
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">작업 이력 조회</h2>
                    <p className="page-description">날짜별 생산 내역을 확인합니다. (해당 날짜에 생산된 모든 작업 — 완료 여부 무관)</p>
                </div>
            </div>

            {/* 필터 영역 */}
            <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">시작일</label>
                        <input
                            type="date"
                            className="form-input"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">종료일</label>
                        <input
                            type="date"
                            className="form-input"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">설비</label>
                        <select
                            className="form-input"
                            value={selectedEquipment}
                            onChange={(e) => setSelectedEquipment(e.target.value)}
                        >
                            <option value="">전체</option>
                            {equipments.map(eq => (
                                <option key={eq.id} value={eq.id}>{eq.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">제품</label>
                        <select
                            className="form-input"
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                        >
                            <option value="">전체</option>
                            {products.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn-secondary" onClick={handleReset}>
                        <Filter size={16} />
                        초기화
                    </button>
                </div>
            </div>

            {/* 통계 */}
            <div className="stats-row">
                <div className="glass-panel simple-stat">
                    <span className="label">생산 기록</span>
                    <span className="value">{filteredHistory.length}건</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">총 생산량</span>
                    <span className="value">
                        {filteredHistory.reduce((sum, log) => sum + (log.daily_quantity || 0), 0).toLocaleString()}개
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">생산 품목수</span>
                    <span className="value">
                        {new Set(filteredHistory.map(log => log.product_id)).size}종
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">총 원재료 소모량</span>
                    <span className="value" style={{ color: '#059669' }}>
                        {filteredHistory.reduce((sum, log) => {
                            const product = products.find(p => p.id === log.product_id);
                            if (!product) return sum;
                            const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                            const totalWeightKg = (shotWeight * (log.daily_quantity || 0)) / 1000;
                            return sum + totalWeightKg;
                        }, 0).toFixed(2)} kg
                    </span>
                </div>
            </div>

            <Table
                columns={columns}
                data={filteredHistory}
            />
        </div>
    );
};

export default WorkHistory;
