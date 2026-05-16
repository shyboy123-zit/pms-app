import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { History, Filter, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';

/**
 * 감사 로그 뷰어 페이지
 * - Phase 1에서 만든 audit_log 테이블을 조회·표시
 * - 테이블별/액션별/사용자별 필터링
 * - 최근 N건 표시 + 더 보기 페이지네이션
 */

const TABLE_LABELS = {
    inventory_transactions: '입출고 거래',
    materials: '원재료',
    products: '제품',
    suppliers: '거래처',
    vouchers: '전표',
    molds: '금형',
    equipments: '설비',
    work_orders: '작업지시',
    production_logs: '일일생산',
    inspections: '품질검사',
    employees: '직원',
    purchase_requests: '구매요청',
    notifications: '알림',
    injection_conditions: '사출조건',
    mold_history: '금형이력',
    equipment_history: '설비이력',
    material_usage: '원재료 사용'
};

const ACTION_LABELS = {
    INSERT: { label: '등록', color: '#059669', bg: '#d1fae5' },
    UPDATE: { label: '수정', color: '#2563eb', bg: '#dbeafe' },
    DELETE: { label: '삭제', color: '#dc2626', bg: '#fee2e2' }
};

const PAGE_SIZE = 50;

const AuditLog = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filterTable, setFilterTable] = useState('all');
    const [filterAction, setFilterAction] = useState('all');
    const [filterUser, setFilterUser] = useState('all');
    const [filterDays, setFilterDays] = useState(7);
    const [expandedId, setExpandedId] = useState(null);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    const loadLogs = async () => {
        setLoading(true);
        setError('');
        try {
            const fromDate = new Date();
            fromDate.setDate(fromDate.getDate() - filterDays);
            const fromIso = fromDate.toISOString();

            let query = supabase
                .from('audit_log')
                .select('*', { count: 'exact' })
                .gte('created_at', fromIso)
                .order('created_at', { ascending: false });

            if (filterTable !== 'all') query = query.eq('table_name', filterTable);
            if (filterAction !== 'all') query = query.eq('action', filterAction);
            if (filterUser !== 'all') query = query.eq('changed_by_name', filterUser);

            query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            const { data, error: err, count } = await query;
            if (err) throw err;
            setLogs(data || []);
            setTotalCount(count || 0);
        } catch (e) {
            console.error('audit_log 조회 실패:', e);
            setError(e?.message || '조회 실패. audit_log 테이블이 생성되어 있는지 확인하세요.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLogs(); }, [filterTable, filterAction, filterUser, filterDays, page]);

    const uniqueUsers = useMemo(() => {
        const set = new Set(logs.map(l => l.changed_by_name).filter(Boolean));
        return Array.from(set).sort();
    }, [logs]);

    const formatTime = (iso) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = (now - d) / 1000;
        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}일 전`;
        return d.toLocaleString('ko-KR', { hour12: false });
    };

    const formatFullTime = (iso) => {
        return new Date(iso).toLocaleString('ko-KR', { hour12: false });
    };

    // 변경 필드 요약
    const summarizeChanges = (log) => {
        if (log.action === 'INSERT') {
            const item = log.new_data || {};
            // 자주 쓰는 필드 우선
            const display = item.item_name || item.name || item.product_code || item.code || item.order_code || item.id;
            return display ? `신규 등록: ${display}` : '신규 등록';
        }
        if (log.action === 'DELETE') {
            const item = log.old_data || {};
            const display = item.item_name || item.name || item.product_code || item.code || item.order_code || item.id;
            return display ? `삭제: ${display}` : '삭제';
        }
        if (log.action === 'UPDATE' && log.old_data && log.new_data) {
            const changedKeys = [];
            const skip = new Set(['updated_at', 'created_at', 'id']);
            for (const k of Object.keys(log.new_data)) {
                if (skip.has(k)) continue;
                if (JSON.stringify(log.old_data[k]) !== JSON.stringify(log.new_data[k])) {
                    changedKeys.push(k);
                }
            }
            if (changedKeys.length === 0) return '변경사항 없음 (메타데이터만 갱신)';
            return `변경 필드: ${changedKeys.slice(0, 5).join(', ')}${changedKeys.length > 5 ? ` 외 ${changedKeys.length - 5}개` : ''}`;
        }
        return log.reason || '';
    };

    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    return (
        <div className="audit-log-page">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle"><History size={22} /> 감사 로그</h2>
                    <p className="page-description">시스템의 모든 데이터 변경 이력을 확인할 수 있습니다.</p>
                </div>
                <div className="period-display">
                    최근 <strong>{filterDays}</strong>일 / 총 <strong>{totalCount.toLocaleString()}</strong>건
                </div>
            </div>

            {/* 필터 */}
            <div className="filter-bar">
                <div className="filter-group">
                    <label><Filter size={14} /> 기간</label>
                    <select value={filterDays} onChange={(e) => { setFilterDays(Number(e.target.value)); setPage(0); }}>
                        <option value={1}>오늘</option>
                        <option value={7}>최근 7일</option>
                        <option value={30}>최근 30일</option>
                        <option value={90}>최근 90일</option>
                        <option value={365}>최근 1년</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>대상 테이블</label>
                    <select value={filterTable} onChange={(e) => { setFilterTable(e.target.value); setPage(0); }}>
                        <option value="all">전체</option>
                        {Object.entries(TABLE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                <div className="filter-group">
                    <label>액션</label>
                    <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setPage(0); }}>
                        <option value="all">전체</option>
                        <option value="INSERT">등록</option>
                        <option value="UPDATE">수정</option>
                        <option value="DELETE">삭제</option>
                    </select>
                </div>
                <div className="filter-group">
                    <label>작업자</label>
                    <select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); setPage(0); }}>
                        <option value="all">전체</option>
                        {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                </div>
            </div>

            {error && (
                <div className="error-banner">
                    <AlertCircle size={18} />
                    <div>
                        <strong>조회 실패</strong>
                        <p>{error}</p>
                        <p className="hint">Supabase에 audit_log 테이블이 없으면 audit_log_schema.sql을 실행해주세요.</p>
                    </div>
                </div>
            )}

            {/* 로그 목록 */}
            <div className="log-list">
                {loading ? (
                    <div className="loading-msg">불러오는 중...</div>
                ) : logs.length === 0 ? (
                    <div className="empty-msg">조건에 맞는 변경 이력이 없습니다.</div>
                ) : (
                    logs.map(log => {
                        const action = ACTION_LABELS[log.action] || { label: log.action, color: '#64748b', bg: '#f1f5f9' };
                        const isExpanded = expandedId === log.id;
                        return (
                            <div key={log.id} className={`log-item ${isExpanded ? 'expanded' : ''}`}>
                                <div className="log-row" onClick={() => setExpandedId(isExpanded ? null : log.id)}>
                                    <div className="log-time" title={formatFullTime(log.created_at)}>
                                        {formatTime(log.created_at)}
                                    </div>
                                    <span className="action-badge" style={{ background: action.bg, color: action.color }}>
                                        {action.label}
                                    </span>
                                    <span className="table-badge">
                                        {TABLE_LABELS[log.table_name] || log.table_name}
                                    </span>
                                    <div className="log-summary">
                                        {summarizeChanges(log)}
                                    </div>
                                    <div className="log-user">{log.changed_by_name || '시스템'}</div>
                                    <div className="expand-icon">
                                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="log-details">
                                        <div className="detail-meta">
                                            <span><strong>시각:</strong> {formatFullTime(log.created_at)}</span>
                                            <span><strong>레코드 ID:</strong> {log.record_id || '-'}</span>
                                            <span><strong>컨텍스트:</strong> {log.context || '-'}</span>
                                            {log.reason && <span><strong>사유:</strong> {log.reason}</span>}
                                        </div>

                                        {log.action === 'UPDATE' && log.old_data && log.new_data && (
                                            <div className="diff-view">
                                                <h4>변경 내역</h4>
                                                <table>
                                                    <thead>
                                                        <tr>
                                                            <th>필드</th>
                                                            <th>변경 전</th>
                                                            <th>변경 후</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {Object.keys(log.new_data).filter(k => !['updated_at', 'created_at', 'id'].includes(k)).map(k => {
                                                            const oldV = log.old_data[k];
                                                            const newV = log.new_data[k];
                                                            if (JSON.stringify(oldV) === JSON.stringify(newV)) return null;
                                                            return (
                                                                <tr key={k}>
                                                                    <td className="field-key">{k}</td>
                                                                    <td className="old-value">{String(oldV ?? '(없음)')}</td>
                                                                    <td className="new-value">{String(newV ?? '(없음)')}</td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}

                                        {(log.action === 'INSERT' || log.action === 'DELETE') && (
                                            <div className="raw-data">
                                                <h4>{log.action === 'INSERT' ? '등록된 데이터' : '삭제된 데이터'}</h4>
                                                <pre>{JSON.stringify(log.action === 'INSERT' ? log.new_data : log.old_data, null, 2)}</pre>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
                <div className="pagination">
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>← 이전</button>
                    <span>페이지 {page + 1} / {totalPages}</span>
                    <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>다음 →</button>
                </div>
            )}

            <style>{`
                .audit-log-page { padding: 0 1rem; }
                .page-header-row {
                    display: flex; justify-content: space-between; align-items: flex-end;
                    margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);
                }
                .page-subtitle {
                    display: flex; align-items: center; gap: 0.5rem;
                    font-size: 1.5rem; font-weight: 800; margin-bottom: 0.25rem;
                    background: var(--gradient-primary); -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent; background-clip: text;
                    letter-spacing: -0.02em;
                }
                .page-description { color: var(--text-muted); font-size: 0.9rem; }
                .period-display { font-size: 0.85rem; color: var(--text-muted); }
                .period-display strong { color: var(--primary); font-weight: 700; }

                .filter-bar {
                    display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem;
                    padding: 1rem; background: var(--bg-card); border: 1px solid var(--border);
                    border-radius: var(--radius-md); box-shadow: var(--shadow-sm);
                }
                .filter-group { display: flex; flex-direction: column; gap: 0.25rem; min-width: 140px; }
                .filter-group label {
                    display: flex; align-items: center; gap: 4px;
                    font-size: 0.75rem; color: var(--text-muted); font-weight: 600;
                }
                .filter-group select {
                    padding: 0.45rem 0.65rem; border: 1px solid var(--border);
                    border-radius: var(--radius-sm); background: var(--bg-elevated);
                    color: var(--text-main); font-size: 0.85rem; cursor: pointer;
                    transition: all var(--transition-base);
                }
                .filter-group select:hover { border-color: var(--border-strong); }
                .filter-group select:focus { outline: none; border-color: var(--primary); box-shadow: var(--shadow-focus); }

                .error-banner {
                    display: flex; gap: 0.75rem; align-items: flex-start;
                    background: var(--danger-soft); color: var(--danger);
                    padding: 1rem 1.25rem; border-radius: var(--radius-md);
                    border-left: 4px solid var(--danger); margin-bottom: 1rem;
                }
                .error-banner p { margin: 0.25rem 0; font-size: 0.85rem; }
                .error-banner .hint { color: var(--text-muted); font-size: 0.75rem; }

                .log-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .log-item {
                    background: var(--bg-card); border: 1px solid var(--border);
                    border-radius: var(--radius-md); overflow: hidden;
                    transition: all var(--transition-base);
                }
                .log-item:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); }
                .log-item.expanded { box-shadow: var(--shadow-md); }

                .log-row {
                    display: grid; grid-template-columns: 90px 60px 110px 1fr 100px 24px;
                    align-items: center; gap: 0.75rem;
                    padding: 0.8rem 1rem; cursor: pointer;
                }
                .log-time { font-size: 0.78rem; color: var(--text-muted); }
                .action-badge {
                    padding: 0.2rem 0.55rem; border-radius: 9px; font-size: 0.72rem; font-weight: 700;
                    text-align: center;
                }
                .table-badge {
                    padding: 0.2rem 0.5rem; border-radius: 9px; font-size: 0.72rem; font-weight: 600;
                    background: var(--primary-soft); color: var(--primary);
                    text-align: center; white-space: nowrap;
                }
                .log-summary { font-size: 0.88rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                .log-user { font-size: 0.78rem; color: var(--text-muted); text-align: right; white-space: nowrap; }
                .expand-icon { color: var(--text-subtle); display: flex; align-items: center; justify-content: center; }

                .log-details {
                    padding: 1rem 1.25rem; background: var(--bg-subtle);
                    border-top: 1px solid var(--border);
                }
                .detail-meta {
                    display: flex; flex-wrap: wrap; gap: 1rem;
                    font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.85rem;
                }
                .detail-meta strong { color: var(--text-main); margin-right: 4px; }

                .diff-view h4, .raw-data h4 {
                    font-size: 0.85rem; font-weight: 700; color: var(--text-main);
                    margin-bottom: 0.5rem;
                }
                .diff-view table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
                .diff-view th {
                    text-align: left; padding: 0.5rem 0.65rem; background: var(--bg-card);
                    color: var(--text-muted); font-weight: 600; font-size: 0.72rem;
                    border-bottom: 1px solid var(--border);
                }
                .diff-view td {
                    padding: 0.55rem 0.65rem; border-bottom: 1px solid var(--border);
                    vertical-align: top; word-break: break-all;
                }
                .field-key { font-family: monospace; color: var(--primary); font-weight: 600; }
                .old-value { color: var(--danger); background: var(--danger-soft); }
                .new-value { color: var(--success); background: var(--success-soft); }

                .raw-data pre {
                    background: var(--bg-card); border: 1px solid var(--border);
                    padding: 0.85rem; border-radius: var(--radius-sm);
                    font-size: 0.78rem; overflow-x: auto; color: var(--text-main);
                    font-family: 'Menlo', 'Consolas', monospace;
                }

                .loading-msg, .empty-msg {
                    padding: 3rem; text-align: center; color: var(--text-subtle);
                    background: var(--bg-card); border: 1px solid var(--border);
                    border-radius: var(--radius-md);
                }

                .pagination {
                    display: flex; justify-content: center; align-items: center; gap: 1rem;
                    margin-top: 1.25rem; padding: 1rem;
                }
                .pagination button {
                    padding: 0.5rem 1rem; border: 1px solid var(--border);
                    background: var(--bg-card); color: var(--text-main);
                    border-radius: var(--radius-sm); font-weight: 600; cursor: pointer;
                    transition: all var(--transition-base);
                }
                .pagination button:hover:not(:disabled) {
                    border-color: var(--primary); color: var(--primary);
                    background: var(--primary-soft);
                }
                .pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
                .pagination span { font-size: 0.85rem; color: var(--text-muted); }

                @media (max-width: 768px) {
                    .log-row {
                        grid-template-columns: 1fr;
                        gap: 0.4rem;
                    }
                    .filter-group { min-width: 120px; flex: 1; }
                }
            `}</style>
        </div>
    );
};

export default AuditLog;
