import React from 'react';

const Table = ({ columns, data, actions }) => {
    return (
        <div className="table-container glass-panel">
            <table className="custom-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} style={{ width: col.width }}>{col.header}</th>
                        ))}
                        {actions && <th style={{ width: '100px' }}>관리</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, rowIdx) => (
                            <tr key={row.id || rowIdx}>
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx}>
                                        {col.render ? col.render(row) : row[col.accessor]}
                                    </td>
                                ))}
                                {actions && (
                                    <td>
                                        {actions(row)}
                                    </td>
                                )}
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={columns.length + (actions ? 1 : 0)} className="no-data">
                                데이터가 없습니다.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>

            <style>{`
        .table-container {
            overflow-x: auto;
            padding: 1rem;
        }
        
        .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.95rem;
        }

        .custom-table th {
            text-align: left;
            padding: 1rem;
            border-bottom: 2px solid var(--border);
            color: var(--text-muted);
            font-weight: 600;
        }

        .custom-table td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-main);
        }

        .custom-table tr:hover {
            background: rgba(255,255,255,0.5);
        }

        .custom-table tr:last-child td {
            border-bottom: none;
        }

        .no-data {
            text-align: center;
            padding: 2rem;
            color: var(--text-muted);
        }

        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 500;
        }
        
        .status-active { background: #d1fae5; color: #065f46; }
        .status-warning { background: #fef3c7; color: #92400e; }
        .status-danger { background: #fee2e2; color: #991b1b; }
      `}</style>
        </div>
    );
};

export default Table;
