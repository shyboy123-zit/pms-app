import React, { useState, useEffect, useMemo } from 'react';
import { Search, ExternalLink, Filter, RefreshCw, Calendar, Building2, MapPin, Tag, ChevronDown, ChevronUp, AlertCircle, Bookmark, BookmarkCheck } from 'lucide-react';

const GovernmentSupport = () => {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [regionFilter, setRegionFilter] = useState('전체');
    const [categoryFilter, setCategoryFilter] = useState('전체');
    const [expandedId, setExpandedId] = useState(null);
    const [bookmarks, setBookmarks] = useState(() => {
        try { return JSON.parse(localStorage.getItem('gov_bookmarks') || '[]'); } catch { return []; }
    });
    const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);
    const [lastFetched, setLastFetched] = useState(null);

    // 기업마당 API (Vercel 서버리스 프록시)
    const fetchPrograms = async () => {
        setLoading(true);
        setError(null);

        try {
            // Vercel 서버리스 함수를 통한 API 호출 (CORS 우회)
            const fetchFromBizinfo = async (hashtag, region) => {
                const params = new URLSearchParams({
                    searchCnt: '50',
                    pageUnit: '50',
                    pageIndex: '1'
                });
                if (hashtag) params.append('hashtags', hashtag);

                // 1차: Vercel 서버리스 프록시
                let data = null;
                try {
                    const res = await fetch(`/api/bizinfo?${params.toString()}`);
                    if (res.ok) {
                        data = await res.json();
                    }
                } catch (e) {
                    console.warn('서버리스 프록시 실패, CORS 프록시로 전환:', e);
                }

                // 2차: CORS 프록시 폴백
                if (!data || data.error) {
                    try {
                        const corsProxies = [
                            'https://api.allorigins.win/raw?url=',
                            'https://corsproxy.io/?url='
                        ];
                        for (const proxy of corsProxies) {
                            try {
                                const bizUrl = `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?dataType=json&${params.toString()}`;
                                const res = await fetch(proxy + encodeURIComponent(bizUrl));
                                if (res.ok) {
                                    const text = await res.text();
                                    data = JSON.parse(text);
                                    break;
                                }
                            } catch { continue; }
                        }
                    } catch { /* 모든 프록시 실패 */ }
                }

                if (data?.jsonArray) {
                    return data.jsonArray.map(item => ({
                        id: item.pblancId || item.inqireCo || Math.random().toString(36).substr(2, 9),
                        title: item.pblancNm || '',
                        organization: item.jrsdInsttNm || '',
                        category: item.bsnsSumryCn || item.pldirSportRealmLclasCodeNm || '',
                        region: region || detectRegion(item.jrsdInsttNm || '', item.pblancNm || ''),
                        startDate: item.reqstBeginEndDe?.split('~')[0]?.trim() || '',
                        endDate: item.reqstBeginEndDe?.split('~')[1]?.trim() || '',
                        dateRange: item.reqstBeginEndDe || '',
                        url: item.pblancUrl || `https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/view.do?pblancId=${item.pblancId}`,
                        views: item.inqireCo || 0,
                        source: '기업마당'
                    }));
                }
                return [];
            };

            // 경남/김해 관련 키워드로도 검색
            const results = await Promise.allSettled([
                fetchFromBizinfo('', '전국'),
                fetchFromBizinfo('경남', '경남'),
                fetchFromBizinfo('김해', '김해'),
                fetchFromBizinfo('경상남도', '경남'),
                fetchFromBizinfo('중소기업', '전국')
            ]);

            const allPrograms = [];
            const seen = new Set();

            results.forEach(result => {
                if (result.status === 'fulfilled' && Array.isArray(result.value)) {
                    result.value.forEach(p => {
                        const key = p.title + p.organization;
                        if (!seen.has(key)) {
                            seen.add(key);
                            allPrograms.push(p);
                        }
                    });
                }
            });

            if (allPrograms.length === 0) {
                // 데모 데이터 + 안내
                setPrograms(getSamplePrograms());
                setError('API 연결이 제한되어 샘플 데이터를 표시합니다. 기업마당 사이트에서 직접 확인해주세요.');
            } else {
                setPrograms(allPrograms);
            }

            setLastFetched(new Date());
        } catch (err) {
            console.error('지원사업 조회 실패:', err);
            setPrograms(getSamplePrograms());
            setError('API 연결이 제한되어 샘플 데이터를 표시합니다. 아래 바로가기 링크를 통해 직접 확인해주세요.');
            setLastFetched(new Date());
        } finally {
            setLoading(false);
        }
    };

    const detectRegion = (org, title) => {
        const text = org + title;
        if (text.includes('김해')) return '김해';
        if (text.includes('경남') || text.includes('경상남도')) return '경남';
        if (text.includes('부산')) return '부산';
        if (text.includes('전국') || text.includes('중소벤처기업부') || text.includes('산업통상자원부') || text.includes('고용노동부')) return '전국';
        return '전국';
    };

    const getSamplePrograms = () => [
        { id: 's1', title: '2026년 중소기업 스마트공장 지원사업', organization: '중소벤처기업부', category: '기술/R&D', region: '전국', dateRange: '2026-01-15 ~ 2026-03-15', url: 'https://www.bizinfo.go.kr', views: 1240, source: '기업마당' },
        { id: 's2', title: '2026년 경남 중소기업 혁신역량 강화사업', organization: '경상남도', category: '경영/사업화', region: '경남', dateRange: '2026-02-01 ~ 2026-03-31', url: 'https://www.bizinfo.go.kr', views: 856, source: '기업마당' },
        { id: 's3', title: '2026년 김해시 소상공인 경영안정 자금지원', organization: '김해시청', category: '금융/세제', region: '김해', dateRange: '2026-01-20 ~ 2026-06-30', url: 'https://www.gimhae.go.kr', views: 432, source: '김해시' },
        { id: 's4', title: '수출바우처 지원사업', organization: '중소벤처기업부', category: '수출/판로', region: '전국', dateRange: '2026-01-02 ~ 2026-12-31', url: 'https://www.bizinfo.go.kr', views: 2150, source: '기업마당' },
        { id: 's5', title: '2026년 경남 청년 취업 지원사업', organization: '경상남도', category: '인력/고용', region: '경남', dateRange: '2026-03-01 ~ 2026-05-31', url: 'https://www.bizinfo.go.kr', views: 670, source: '기업마당' },
        { id: 's6', title: '2026년 내일채움공제 (중소기업 핵심인력 성과보상)', organization: '중소벤처기업부', category: '인력/고용', region: '전국', dateRange: '연중 상시', url: 'https://www.sbcplan.or.kr', views: 3200, source: '기업마당' },
        { id: 's7', title: '2026년 김해시 기업육성 지원금', organization: '김해시청', category: '금융/세제', region: '김해', dateRange: '2026-02-10 ~ 2026-04-30', url: 'https://www.gimhae.go.kr', views: 310, source: '김해시' },
        { id: 's8', title: '2026년 중소기업 정책자금 (운전/시설)', organization: '중소벤처기업부', category: '금융/세제', region: '전국', dateRange: '2026-01-02 ~ 예산 소진 시', url: 'https://www.kosmes.or.kr', views: 5100, source: '기업마당' },
        { id: 's9', title: '경남 산업단지 입주기업 지원사업', organization: '경상남도', category: '기술/R&D', region: '경남', dateRange: '2026-02-15 ~ 2026-04-15', url: 'https://www.bizinfo.go.kr', views: 490, source: '기업마당' },
        { id: 's10', title: '2026년 고용유지지원금', organization: '고용노동부', category: '인력/고용', region: '전국', dateRange: '연중 상시', url: 'https://www.ei.go.kr', views: 4200, source: '기업마당' },
        { id: 's11', title: '2026년 경남 산학협력 기술개발사업', organization: '경상남도 경제혁신과', category: '기술/R&D', region: '경남', dateRange: '2026-03-01 ~ 2026-04-30', url: 'https://www.bizinfo.go.kr', views: 380, source: '기업마당' },
        { id: 's12', title: '2026년 김해시 일자리 창출 장려금', organization: '김해시 경제교통국', category: '인력/고용', region: '김해', dateRange: '2026-01-10 ~ 2026-12-31', url: 'https://www.gimhae.go.kr', views: 295, source: '김해시' },
    ];

    useEffect(() => {
        fetchPrograms();
    }, []);

    useEffect(() => {
        localStorage.setItem('gov_bookmarks', JSON.stringify(bookmarks));
    }, [bookmarks]);

    const toggleBookmark = (id) => {
        setBookmarks(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);
    };

    const categories = useMemo(() => {
        const cats = new Set(programs.map(p => p.category).filter(Boolean));
        return ['전체', ...Array.from(cats).sort()];
    }, [programs]);

    const regions = ['전체', '전국', '경남', '김해'];

    const filteredPrograms = useMemo(() => {
        return programs.filter(p => {
            if (showBookmarksOnly && !bookmarks.includes(p.id)) return false;
            if (regionFilter !== '전체' && p.region !== regionFilter) return false;
            if (categoryFilter !== '전체' && p.category !== categoryFilter) return false;
            if (searchTerm) {
                const s = searchTerm.toLowerCase();
                return (p.title?.toLowerCase().includes(s) || p.organization?.toLowerCase().includes(s) || p.category?.toLowerCase().includes(s));
            }
            return true;
        });
    }, [programs, regionFilter, categoryFilter, searchTerm, showBookmarksOnly, bookmarks]);

    const regionStats = useMemo(() => ({
        total: programs.length,
        national: programs.filter(p => p.region === '전국').length,
        gyeongnam: programs.filter(p => p.region === '경남').length,
        gimhae: programs.filter(p => p.region === '김해').length
    }), [programs]);

    const quickLinks = [
        { label: '기업마당', url: 'https://www.bizinfo.go.kr', desc: '국가 지원사업 통합 포털', color: '#4f46e5' },
        { label: '경남 기업지원', url: 'https://www.gyeongnam.go.kr/economy/index.gyeong', desc: '경상남도 기업지원 정보', color: '#0891b2' },
        { label: '김해시', url: 'https://www.gimhae.go.kr', desc: '김해시 지원사업 공고', color: '#059669' },
        { label: 'K-스타트업', url: 'https://www.k-startup.go.kr', desc: '창업진흥원 지원사업', color: '#d946ef' },
        { label: '중진공', url: 'https://www.kosmes.or.kr', desc: '정책자금 / 수출바우처', color: '#ea580c' },
        { label: '소상공인마당', url: 'https://www.sbiz.or.kr', desc: '소상공인 지원정책', color: '#ca8a04' }
    ];

    const getRegionBadge = (region) => {
        const colors = {
            '전국': { bg: '#eef2ff', color: '#4f46e5', border: '#c7d2fe' },
            '경남': { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
            '김해': { bg: '#fef3c7', color: '#d97706', border: '#fde68a' },
            '부산': { bg: '#fce7f3', color: '#db2777', border: '#fbcfe8' }
        };
        const c = colors[region] || colors['전국'];
        return (
            <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '3px',
                padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 600,
                background: c.bg, color: c.color, border: `1px solid ${c.border}`
            }}>
                <MapPin size={10} /> {region}
            </span>
        );
    };

    return (
        <div style={{ padding: '0 1rem' }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>국가 지원사업 조회</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        국가 · 경남 · 김해시 지원사업 공고를 한눈에 확인합니다.
                    </p>
                </div>
                <button onClick={fetchPrograms} disabled={loading}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '0.6rem 1.2rem', borderRadius: '10px', border: 'none',
                        background: 'var(--primary)', color: 'white', fontWeight: 600,
                        cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
                        opacity: loading ? 0.7 : 1
                    }}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    {loading ? '조회 중...' : '새로고침'}
                </button>
            </div>

            {/* 통계 카드 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '1.5rem' }}>
                {[
                    { label: '전체', count: regionStats.total, icon: '📊', color: '#6366f1', bg: '#eef2ff' },
                    { label: '국가 (전국)', count: regionStats.national, icon: '🇰🇷', color: '#4f46e5', bg: '#e0e7ff' },
                    { label: '경남', count: regionStats.gyeongnam, icon: '🏛️', color: '#059669', bg: '#ecfdf5' },
                    { label: '김해시', count: regionStats.gimhae, icon: '🏢', color: '#d97706', bg: '#fef3c7' }
                ].map(stat => (
                    <div key={stat.label} onClick={() => setRegionFilter(stat.label === '전체' ? '전체' : stat.label === '국가 (전국)' ? '전국' : stat.label)}
                        style={{
                            background: 'var(--card)', borderRadius: '14px', padding: '16px 18px',
                            border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.2s',
                            boxShadow: regionFilter === (stat.label === '전체' ? '전체' : stat.label === '국가 (전국)' ? '전국' : stat.label) ? `0 0 0 2px ${stat.color}` : 'none'
                        }}>
                        <div style={{ fontSize: '1.1rem', marginBottom: '6px' }}>{stat.icon}</div>
                        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: stat.color }}>{stat.count}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>{stat.label}</div>
                    </div>
                ))}
            </div>

            {/* 바로가기 */}
            <div style={{
                background: 'var(--card)', borderRadius: '14px', padding: '16px 18px',
                border: '1px solid var(--border)', marginBottom: '1.5rem'
            }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', color: 'var(--text-secondary)' }}>
                    🔗 지원사업 바로가기
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {quickLinks.map(link => (
                        <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '5px',
                                padding: '6px 12px', borderRadius: '8px', textDecoration: 'none',
                                fontSize: '0.78rem', fontWeight: 600, transition: 'all 0.2s',
                                background: link.color + '12', color: link.color, border: `1px solid ${link.color}30`
                            }}
                            title={link.desc}>
                            <ExternalLink size={12} /> {link.label}
                        </a>
                    ))}
                </div>
            </div>

            {/* 필터 & 검색 */}
            <div style={{
                display: 'flex', gap: '10px', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center'
            }}>
                <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="사업명, 기관명으로 검색..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px',
                            border: '1px solid var(--border)', background: 'var(--card)',
                            color: 'var(--text)', fontSize: '0.85rem', outline: 'none'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {regions.map(r => (
                        <button key={r} onClick={() => setRegionFilter(r)}
                            style={{
                                padding: '8px 14px', borderRadius: '8px', border: 'none',
                                cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                                background: regionFilter === r ? '#4f46e5' : 'var(--card)',
                                color: regionFilter === r ? 'white' : 'var(--text-muted)',
                                transition: 'all 0.2s',
                                border: `1px solid ${regionFilter === r ? '#4f46e5' : 'var(--border)'}`
                            }}>
                            {r}
                        </button>
                    ))}
                </div>

                <button onClick={() => setShowBookmarksOnly(!showBookmarksOnly)}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '4px',
                        padding: '8px 14px', borderRadius: '8px', border: 'none',
                        cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem',
                        background: showBookmarksOnly ? '#f59e0b' : 'var(--card)',
                        color: showBookmarksOnly ? 'white' : 'var(--text-muted)',
                        border: `1px solid ${showBookmarksOnly ? '#f59e0b' : 'var(--border)'}`
                    }}>
                    <BookmarkCheck size={14} /> 즐겨찾기 ({bookmarks.length})
                </button>

                {categories.length > 2 && (
                    <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
                        style={{
                            padding: '8px 12px', borderRadius: '8px',
                            border: '1px solid var(--border)', background: 'var(--card)',
                            color: 'var(--text)', fontSize: '0.8rem', cursor: 'pointer'
                        }}>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                )}
            </div>

            {/* 오류 메시지 */}
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 16px', borderRadius: '10px', marginBottom: '1rem',
                    background: '#fef3c7', color: '#92400e', fontSize: '0.82rem', fontWeight: 500,
                    border: '1px solid #fde68a'
                }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* 결과 수 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    총 <strong style={{ color: 'var(--primary)' }}>{filteredPrograms.length}</strong>건
                    {lastFetched && <span> · {lastFetched.toLocaleTimeString('ko-KR')} 기준</span>}
                </span>
            </div>

            {/* 프로그램 리스트 */}
            {loading ? (
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '60px 0', color: 'var(--text-muted)'
                }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid var(--border)', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>지원사업 정보를 불러오고 있습니다...</div>
                </div>
            ) : filteredPrograms.length === 0 ? (
                <div style={{
                    textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)'
                }}>
                    <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>조건에 맞는 지원사업이 없습니다.</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>필터 조건을 변경해보세요.</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {filteredPrograms.map(program => (
                        <div key={program.id}
                            style={{
                                background: 'var(--card)', borderRadius: '12px',
                                border: `1px solid ${expandedId === program.id ? 'var(--primary)' : 'var(--border)'}`,
                                overflow: 'hidden', transition: 'all 0.2s'
                            }}>
                            {/* 카드 헤더 */}
                            <div
                                onClick={() => setExpandedId(expandedId === program.id ? null : program.id)}
                                style={{
                                    padding: '14px 16px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '12px'
                                }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                        {getRegionBadge(program.region)}
                                        {program.category && (
                                            <span style={{
                                                padding: '2px 8px', borderRadius: '12px', fontSize: '0.72rem',
                                                background: '#f1f5f9', color: '#64748b', fontWeight: 500
                                            }}>
                                                {program.category}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                                        {program.title}
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <Building2 size={11} /> {program.organization}
                                        </span>
                                        {program.dateRange && (
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                <Calendar size={11} /> {program.dateRange}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button onClick={(e) => { e.stopPropagation(); toggleBookmark(program.id); }}
                                        style={{
                                            padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                                            background: bookmarks.includes(program.id) ? '#fef3c7' : 'transparent',
                                            color: bookmarks.includes(program.id) ? '#f59e0b' : 'var(--text-muted)',
                                            transition: 'all 0.2s'
                                        }}>
                                        {bookmarks.includes(program.id) ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                                    </button>
                                    {expandedId === program.id ? <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />}
                                </div>
                            </div>

                            {/* 확장 영역 */}
                            {expandedId === program.id && (
                                <div style={{
                                    padding: '0 16px 14px', borderTop: '1px solid var(--border)',
                                    paddingTop: '14px'
                                }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px', fontSize: '0.82rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>주관 기관</span>
                                            <div style={{ fontWeight: 600, marginTop: '2px' }}>{program.organization}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>신청 기간</span>
                                            <div style={{ fontWeight: 600, marginTop: '2px' }}>{program.dateRange || '-'}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>분야</span>
                                            <div style={{ fontWeight: 600, marginTop: '2px' }}>{program.category || '-'}</div>
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>출처</span>
                                            <div style={{ fontWeight: 600, marginTop: '2px' }}>{program.source}</div>
                                        </div>
                                    </div>

                                    <a href={program.url} target="_blank" rel="noopener noreferrer"
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 16px', borderRadius: '8px',
                                            background: 'var(--primary)', color: 'white',
                                            textDecoration: 'none', fontSize: '0.82rem', fontWeight: 600,
                                            transition: 'all 0.2s'
                                        }}>
                                        <ExternalLink size={14} /> 상세보기 (원문)
                                    </a>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .spin { animation: spin 1s linear infinite; }
            `}</style>
        </div>
    );
};

export default GovernmentSupport;
