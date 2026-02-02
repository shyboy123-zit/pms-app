import React from 'react';

const Table = ({ columns, data, actions }) => {
    return (
        <div className="table-container glass-panel">
            <table className="custom-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} style={{ width: col.width }} className={idx < 3 ? 'sticky-col' : ''} data-col-index={idx}>
                                {col.header}
                            </th>
                        ))}
                        {actions && <th style={{ width: '100px' }}>관리</th>}
                    </tr>
                </thead>
                <tbody>
                    {data.length > 0 ? (
                        data.map((row, rowIdx) => (
                            <tr key={row.id || rowIdx}>
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} className={colIdx < 3 ? 'sticky-col' : ''} data-col-index={colIdx}>
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
            position: relative;
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
            background: rgba(255, 255, 255, 0.9);
        }

        .custom-table td {
            padding: 1rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-main);
            background: white;
        }

        .custom-table tr:hover td {
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

        /* 모바일: 1~3열 고정 */
        @media (max-width: 768px) {
            .table-container {
                max-width: 100vw;
            }

            .custom-table th.sticky-col,
            .custom-table td.sticky-col {
                position: sticky;
                background: rgba(255, 255, 255, 0.98);
                z-index: 10;
                box-shadow: 2px 0 4px rgba(0,0,0,0.05);
            }

            .custom-table th.sticky-col[data-col-index="0"],
            .custom-table td.sticky-col[data-col-index="0"] {
                left: 0;
            }

            .custom-table th.sticky-col[data-col-index="1"],
            .custom-table td.sticky-col[data-col-index="1"] {
                left: 100px;
            }

            .custom-table th.sticky-col[data-col-index="2"],
            .custom-table td.sticky-col[data-col-index="2"] {
                left: 200px;
            }

            .custom-table th,
            .custom-table td {
                min-width: 100px;
                white-space: nowrap;
            }
        }
      `}</style>
        </div>
    );
};

export default Table;
