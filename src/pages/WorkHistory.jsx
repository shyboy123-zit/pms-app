import React, { useState, useMemo } from 'react';
import Table from '../components/Table';
import { Calendar, Filter, Package, Settings } from 'lucide-react';
import { useData } from '../context/DataContext';

const WorkHistory = () => {
    const { workOrders, equipments, products } = useData();

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedEquipment, setSelectedEquipment] = useState('');
    const [selectedProduct, setSelectedProduct] = useState('');

    // 완료된 작업지시만 필터
    const completedOrders = workOrders.filter(wo => wo.status === '완료');

    // 필터링된 작업 이력
    const filteredHistory = useMemo(() => {
        return completedOrders.filter(order => {
            // 날짜 필터
            if (startDate && order.order_date < startDate) return false;
            if (endDate && order.order_date > endDate) return false;

            // 설비 필터
            if (selectedEquipment && order.equipment_id !== selectedEquipment) return false;

            // 제품 필터
            if (selectedProduct && order.product_id !== selectedProduct) return false;

            return true;
        });
    }, [completedOrders, startDate, endDate, selectedEquipment, selectedProduct]);

    const columns = [
        { header: '지시일', accessor: 'order_date' },
        {
            header: '설비명',
            accessor: 'equipment_name',
            render: (row) => {
                const equipment = equipments.find(eq => eq.id === row.equipment_id);
                return equipment?.name || '-';
            }
        },
        {
            header: '제품명',
            accessor: 'product_name',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                return product?.name || '-';
            }
        },
        {
            header: '목표수량',
            accessor: 'target_quantity',
            render: (row) => `${row.target_quantity.toLocaleString()}개`
        },
        {
            header: '생산수량',
            accessor: 'produced_quantity',
            render: (row) => `${row.produced_quantity.toLocaleString()}개`
        },
        {
            header: '달성률',
            accessor: 'achievement',
            render: (row) => {
                const rate = row.target_quantity > 0
                    ? Math.round((row.produced_quantity / row.target_quantity) * 100)
                    : 0;
                return (
                    <span style={{
                        fontWeight: 600,
                        color: rate >= 100 ? '#10b981' : rate >= 90 ? '#f59e0b' : '#ef4444'
                    }}>
                        {rate}%
                    </span>
                );
            }
        },
        {
            header: '원재료 소모량',
            accessor: 'material_consumption',
            render: (row) => {
                const product = products.find(p => p.id === row.product_id);
                if (!product) return '-';

                const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                const totalWeightG = shotWeight * (row.produced_quantity || 0);
                const totalWeightKg = totalWeightG / 1000;

                if (totalWeightKg === 0) return '-';

                return (
                    <span style={{
                        fontWeight: 600,
                        color: totalWeightKg >= 1 ? '#059669' : '#64748b'
                    }} title={`제품: ${product.product_weight || 0}g, 런너: ${product.runner_weight || 0}g, 생산: ${row.produced_quantity}개`}>
                        {totalWeightKg.toFixed(2)} kg
                    </span>
                );
            }
        },
        {
            header: '상태',

            accessor: 'status',
            render: (row) => (
                <span className="status-badge status-active">
                    {row.status}
                </span>
            )
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
                    <p className="page-description">날짜별로 완료된 작업 내역을 확인합니다.</p>
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
                    <span className="label">총 작업</span>
                    <span className="value">{filteredHistory.length}건</span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">총 생산량</span>
                    <span className="value">
                        {filteredHistory.reduce((sum, order) => sum + order.produced_quantity, 0).toLocaleString()}개
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">평균 달성률</span>
                    <span className="value">
                        {filteredHistory.length > 0
                            ? Math.round(filteredHistory.reduce((sum, order) => {
                                const rate = order.target_quantity > 0
                                    ? (order.produced_quantity / order.target_quantity) * 100
                                    : 0;
                                return sum + rate;
                            }, 0) / filteredHistory.length)
                            : 0}%
                    </span>
                </div>
                <div className="glass-panel simple-stat">
                    <span className="label">총 원재료 소모량</span>
                    <span className="value" style={{ color: '#059669' }}>
                        {filteredHistory.reduce((sum, order) => {
                            const product = products.find(p => p.id === order.product_id);
                            if (!product) return sum;
                            const shotWeight = (product.product_weight || 0) + (product.runner_weight || 0);
                            const totalWeightKg = (shotWeight * order.produced_quantity) / 1000;
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
