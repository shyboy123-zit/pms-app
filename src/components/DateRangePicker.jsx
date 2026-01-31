import React, { useState } from 'react';
import { Calendar } from 'lucide-react';

const DateRangePicker = ({ onApply, initialStart = '', initialEnd = '' }) => {
    const [startDate, setStartDate] = useState(initialStart);
    const [endDate, setEndDate] = useState(initialEnd);

    const getToday = () => {
        return new Date().toISOString().split('T')[0];
    };

    const getDateOffset = (days) => {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date.toISOString().split('T')[0];
    };

    const handleQuickSelect = (type) => {
        const today = getToday();
        let start = today;
        let end = today;

        switch (type) {
            case 'today':
                start = today;
                end = today;
                break;
            case 'week':
                start = getDateOffset(-7);
                end = today;
                break;
            case 'month':
                start = getDateOffset(-30);
                end = today;
                break;
            case 'all':
                start = '';
                end = '';
                break;
            default:
                break;
        }

        setStartDate(start);
        setEndDate(end);
        onApply(start, end);
    };

    const handleApply = () => {
        onApply(startDate, endDate);
    };

    return (
        <div className="date-range-picker">
            <div className="date-inputs">
                <div className="date-input-group">
                    <label>시작일</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="form-input"
                    />
                </div>
                <span className="date-separator">~</span>
                <div className="date-input-group">
                    <label>종료일</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="form-input"
                    />
                </div>
                <button className="btn-apply" onClick={handleApply}>
                    <Calendar size={16} />
                    조회
                </button>
            </div>

            <div className="quick-select">
                <button onClick={() => handleQuickSelect('today')}>오늘</button>
                <button onClick={() => handleQuickSelect('week')}>최근 7일</button>
                <button onClick={() => handleQuickSelect('month')}>최근 30일</button>
                <button onClick={() => handleQuickSelect('all')}>전체</button>
            </div>

            <style>{`
                .date-range-picker {
                    background: white;
                    padding: 1rem;
                    border-radius: var(--radius-md);
                    border: 1px solid #e2e8f0;
                    margin-bottom: 1.5rem;
                }

                .date-inputs {
                    display: flex;
                    align-items: flex-end;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .date-input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .date-input-group label {
                    font-size: 0.85rem;
                    font-weight: 500;
                    color: var(--text-muted);
                }

                .date-separator {
                    padding-bottom: 0.5rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }

                .btn-apply {
                    background: var(--primary);
                    color: white;
                    padding: 0.6rem 1.2rem;
                    border-radius: var(--radius-md);
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    transition: all 0.2s;
                    white-space: nowrap;
                }

                .btn-apply:hover {
                    background: var(--primary-dark);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
                }

                .quick-select {
                    display: flex;
                    gap: 0.5rem;
                    flex-wrap: wrap;
                }

                .quick-select button {
                    padding: 0.5rem 1rem;
                    background: #f1f5f9;
                    color: var(--text-main);
                    border-radius: var(--radius-sm);
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }

                .quick-select button:hover {
                    background: #e2e8f0;
                    color: var(--primary);
                }
            `}</style>
        </div>
    );
};

export default DateRangePicker;
