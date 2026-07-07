import React, { useState, useEffect } from 'react';

const Table = ({ columns, data, actions, pageSize }) => {
    // 페이지네이션 (opt-in): pageSize가 주어지면 그 행수만 DOM에 렌더 → 대용량 테이블 성능/메모리 개선.
    // pageSize 미지정 시 기존 동작(전 행 렌더) 유지.
    const [page, setPage] = useState(1);
    const total = data.length;
    const pageCount = pageSize ? Math.max(1, Math.ceil(total / pageSize)) : 1;

    // 데이터가 바뀌어(필터 등) 현재 페이지가 범위를 벗어나면 1페이지로
    useEffect(() => {
        if (page > pageCount) setPage(1);
    }, [pageCount, page]);

    const pageData = pageSize ? data.slice((page - 1) * pageSize, page * pageSize) : data;

    return (
        <div className="table-container glass-panel">
            <table className="custom-table">
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx} style={{ width: col.width }} className={idx < 1 ? 'sticky-col' : ''} data-col-index={idx}>
                                {col.header}
                            </th>
                        ))}
                        {actions && <th style={{ width: '100px' }}>관리</th>}
                    </tr>
                </thead>
                <tbody>
                    {pageData.length > 0 ? (
                        pageData.map((row, rowIdx) => (
                            <tr key={row.id || rowIdx}>
                                {columns.map((col, colIdx) => (
                                    <td key={colIdx} className={colIdx < 1 ? 'sticky-col' : ''} data-col-index={colIdx}>
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

            {pageSize && pageCount > 1 && (
                <div className="table-pager">
                    <span className="table-pager-info">
                        총 {total.toLocaleString()}건 · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
                    </span>
                    <div className="table-pager-btns">
                        <button onClick={() => setPage(1)} disabled={page === 1}>«</button>
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>이전</button>
                        <span className="table-pager-page">{page} / {pageCount}</span>
                        <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}>다음</button>
                        <button onClick={() => setPage(pageCount)} disabled={page === pageCount}>»</button>
                    </div>
                </div>
            )}

            <style>{`
        .table-pager { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; padding: 0.75rem 0.5rem 0.25rem; }
        .table-pager-info { font-size: 0.82rem; color: var(--text-muted); }
        .table-pager-btns { display: flex; align-items: center; gap: 0.35rem; }
        .table-pager-btns button { padding: 0.35rem 0.7rem; border: 1px solid var(--border, #e2e8f0); border-radius: var(--radius-sm, 6px); background: var(--bg-card, #fff); color: var(--text-main); font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
        .table-pager-btns button:hover:not(:disabled) { background: var(--primary, #4f46e5); color: #fff; border-color: var(--primary, #4f46e5); }
        .table-pager-btns button:disabled { opacity: 0.4; cursor: default; }
        .table-pager-page { font-size: 0.82rem; font-weight: 600; padding: 0 0.4rem; min-width: 48px; text-align: center; }

        .table-container {
            overflow-x: auto;
            padding: 0.5rem;
            position: relative;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-sm);
        }

        .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.9rem;
        }

        .custom-table th {
            text-align: left;
            padding: 0.85rem 1rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            font-weight: 600;
            background: var(--bg-subtle);
            font-size: 0.78rem;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .custom-table td {
            padding: 0.9rem 1rem;
            border-bottom: 1px solid var(--border);
            color: var(--text-main);
            background: var(--bg-card);
            transition: background var(--transition-fast);
        }

        .custom-table tr:hover td {
            background: var(--bg-subtle);
        }

        .custom-table tr:last-child td {
            border-bottom: none;
        }

        .no-data {
            text-align: center;
            padding: 2rem;
            color: var(--text-subtle);
            background: var(--bg-card);
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

        /* 모바일: 1열만 고정 */
        @media (max-width: 768px) {
            .table-container {
                max-width: 100vw;
            }

            .custom-table th.sticky-col,
            .custom-table td.sticky-col {
                position: sticky;
                background: var(--bg-card);
                z-index: 10;
                box-shadow: 2px 0 4px rgba(0,0,0,0.05);
            }

            .custom-table th.sticky-col[data-col-index="0"],
            .custom-table td.sticky-col[data-col-index="0"] {
                left: 0;
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
