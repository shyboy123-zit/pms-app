import React, { useState, useMemo } from 'react';
import Modal from '../components/Modal';
import { MessageSquare, Plus, Send, Trash2, Edit, Clock, User, ChevronLeft, Search, Pin } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const Board = () => {
    const { boardPosts, boardComments, addBoardPost, updateBoardPost, deleteBoardPost, addBoardComment, deleteBoardComment, employees } = useData();
    const { user } = useAuth();

    const [isWriteOpen, setIsWriteOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('전체');
    const [commentText, setCommentText] = useState('');

    const [postForm, setPostForm] = useState({
        title: '',
        content: '',
        category: '자유게시판'
    });

    const categories = ['전체', '공지사항', '자유게시판', '건의사항', '정보공유'];

    // 작성자 이름 찾기
    const getAuthorName = (authorId) => {
        if (!authorId) return '알 수 없음';
        const emp = employees.find(e => e.id === authorId);
        return emp ? emp.name : (user?.id === authorId ? (user.name || user.email) : '알 수 없음');
    };

    // 시간 포맷
    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);

        if (minutes < 1) return '방금 전';
        if (minutes < 60) return `${minutes}분 전`;
        if (hours < 24) return `${hours}시간 전`;
        if (days < 7) return `${days}일 전`;
        return date.toLocaleDateString('ko-KR');
    };

    // 필터링된 게시글
    const filteredPosts = useMemo(() => {
        return (boardPosts || [])
            .filter(p => {
                const categoryMatch = filterCategory === '전체' || p.category === filterCategory;
                const searchMatch = !searchQuery ||
                    p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    p.content?.toLowerCase().includes(searchQuery.toLowerCase());
                return categoryMatch && searchMatch;
            })
            .sort((a, b) => {
                // 공지사항 우선 + 핀 고정
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
    }, [boardPosts, filterCategory, searchQuery]);

    // 게시글의 댓글 수
    const getCommentCount = (postId) => {
        return (boardComments || []).filter(c => c.post_id === postId).length;
    };

    // 게시글의 댓글 목록
    const getPostComments = (postId) => {
        return (boardComments || [])
            .filter(c => c.post_id === postId)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    };

    // 게시글 등록
    const handleCreatePost = async () => {
        if (!postForm.title.trim()) return alert('제목을 입력하세요');
        if (!postForm.content.trim()) return alert('내용을 입력하세요');

        await addBoardPost({
            title: postForm.title,
            content: postForm.content,
            category: postForm.category,
            author_id: user?.id || null,
            author_name: user?.name || user?.email || '익명',
            is_pinned: false
        });

        setPostForm({ title: '', content: '', category: '자유게시판' });
        setIsWriteOpen(false);
    };

    // 게시글 수정
    const handleUpdatePost = async () => {
        if (!selectedPost) return;
        await updateBoardPost(selectedPost.id, {
            title: postForm.title,
            content: postForm.content,
            category: postForm.category
        });
        setSelectedPost({ ...selectedPost, ...postForm });
        setIsEditMode(false);
    };

    // 게시글 삭제
    const handleDeletePost = async (id) => {
        if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
        await deleteBoardPost(id);
        setIsViewOpen(false);
        setSelectedPost(null);
    };

    // 댓글 등록
    const handleAddComment = async () => {
        if (!commentText.trim() || !selectedPost) return;

        await addBoardComment({
            post_id: selectedPost.id,
            content: commentText,
            author_id: user?.id || null,
            author_name: user?.name || user?.email || '익명'
        });

        setCommentText('');
    };

    // 댓글 삭제
    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
        await deleteBoardComment(commentId);
    };

    // 게시글 열기
    const openPost = (post) => {
        setSelectedPost(post);
        setIsViewOpen(true);
        setIsEditMode(false);
        setCommentText('');
    };

    // 수정 모드
    const startEdit = () => {
        setPostForm({
            title: selectedPost.title,
            content: selectedPost.content,
            category: selectedPost.category
        });
        setIsEditMode(true);
    };

    const isAuthor = (authorId) => user?.id === authorId;
    const isAdmin = user?.position === '관리자' || user?.position === '대표';

    const getCategoryColor = (cat) => {
        switch (cat) {
            case '공지사항': return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
            case '자유게시판': return { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
            case '건의사항': return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
            case '정보공유': return { bg: '#fefce8', color: '#ca8a04', border: '#fde68a' };
            default: return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
        }
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">커뮤니티 게시판</h2>
                    <p className="page-description">공지사항, 자유주제 등 자유롭게 소통하는 공간입니다.</p>
                </div>
                <button className="btn-primary" onClick={() => { setPostForm({ title: '', content: '', category: '자유게시판' }); setIsWriteOpen(true); }}>
                    <Plus size={18} /> 글 작성
                </button>
            </div>

            {/* 카테고리 필터 + 검색 */}
            <div className="board-filter-section">
                <div className="board-categories">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            className={`board-cat-btn ${filterCategory === cat ? 'active' : ''}`}
                            onClick={() => setFilterCategory(cat)}
                        >
                            {cat}
                            {cat !== '전체' && (
                                <span className="cat-count">
                                    {(boardPosts || []).filter(p => p.category === cat).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                <div className="board-search">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="board-search-input"
                    />
                </div>
            </div>

            {/* 게시글 목록 */}
            <div className="board-list">
                {filteredPosts.length > 0 ? filteredPosts.map(post => {
                    const catStyle = getCategoryColor(post.category);
                    const commentCount = getCommentCount(post.id);
                    return (
                        <div key={post.id} className={`board-item ${post.is_pinned ? 'pinned' : ''}`} onClick={() => openPost(post)}>
                            <div className="board-item-top">
                                {post.is_pinned && <Pin size={14} className="pin-icon" />}
                                <span className="board-cat-tag" style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                                    {post.category}
                                </span>
                                <h3 className="board-title">{post.title}</h3>
                            </div>
                            <p className="board-preview">{post.content?.substring(0, 120)}{post.content?.length > 120 ? '...' : ''}</p>
                            <div className="board-item-meta">
                                <div className="board-author">
                                    <div className="board-avatar">{(post.author_name || '?')[0]}</div>
                                    <span>{post.author_name || getAuthorName(post.author_id)}</span>
                                </div>
                                <div className="board-meta-right">
                                    <span className="board-time"><Clock size={12} /> {formatTime(post.created_at)}</span>
                                    <span className="board-comments"><MessageSquare size={12} /> {commentCount}</span>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="board-empty">
                        <MessageSquare size={48} color="#cbd5e1" />
                        <p>게시글이 없습니다</p>
                        <button className="btn-primary" onClick={() => setIsWriteOpen(true)}>첫 글 작성하기</button>
                    </div>
                )}
            </div>

            {/* 글 작성 모달 */}
            <Modal title="글 작성" isOpen={isWriteOpen} onClose={() => setIsWriteOpen(false)}>
                <div className="form-group">
                    <label className="form-label">카테고리</label>
                    <select className="form-input" value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}>
                        <option value="자유게시판">자유게시판</option>
                        <option value="공지사항">공지사항</option>
                        <option value="건의사항">건의사항</option>
                        <option value="정보공유">정보공유</option>
                    </select>
                </div>
                <div className="form-group">
                    <label className="form-label">제목</label>
                    <input className="form-input" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} placeholder="제목을 입력하세요" />
                </div>
                <div className="form-group">
                    <label className="form-label">내용</label>
                    <textarea className="form-input" rows="8" value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} placeholder="내용을 입력하세요..." style={{ resize: 'vertical', minHeight: '200px' }} />
                </div>
                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsWriteOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleCreatePost}>등록</button>
                </div>
            </Modal>

            {/* 게시글 상세 모달 */}
            <Modal title="" isOpen={isViewOpen} onClose={() => { setIsViewOpen(false); setSelectedPost(null); setIsEditMode(false); }}>
                {selectedPost && !isEditMode ? (
                    <div className="post-view">
                        <div className="post-view-header">
                            <span className="board-cat-tag" style={{ ...(() => { const s = getCategoryColor(selectedPost.category); return { background: s.bg, color: s.color, border: `1px solid ${s.border}` }; })() }}>
                                {selectedPost.category}
                            </span>
                            <h2 className="post-view-title">{selectedPost.title}</h2>
                            <div className="post-view-meta">
                                <div className="board-author">
                                    <div className="board-avatar">{(selectedPost.author_name || '?')[0]}</div>
                                    <span>{selectedPost.author_name || getAuthorName(selectedPost.author_id)}</span>
                                </div>
                                <span className="board-time"><Clock size={12} /> {formatTime(selectedPost.created_at)}</span>
                            </div>
                        </div>

                        <div className="post-view-content">
                            {selectedPost.content?.split('\n').map((line, i) => (
                                <p key={i}>{line || <br />}</p>
                            ))}
                        </div>

                        {(isAuthor(selectedPost.author_id) || isAdmin) && (
                            <div className="post-actions">
                                <button className="post-action-btn edit" onClick={startEdit}><Edit size={14} /> 수정</button>
                                <button className="post-action-btn delete" onClick={() => handleDeletePost(selectedPost.id)}><Trash2 size={14} /> 삭제</button>
                            </div>
                        )}

                        {/* 댓글 영역 */}
                        <div className="comments-section">
                            <h4 className="comments-title">
                                <MessageSquare size={16} /> 댓글 {getPostComments(selectedPost.id).length}개
                            </h4>

                            <div className="comments-list">
                                {getPostComments(selectedPost.id).map(comment => (
                                    <div key={comment.id} className="comment-item">
                                        <div className="comment-header">
                                            <div className="board-author">
                                                <div className="board-avatar small">{(comment.author_name || '?')[0]}</div>
                                                <span className="comment-author">{comment.author_name || getAuthorName(comment.author_id)}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span className="comment-time">{formatTime(comment.created_at)}</span>
                                                {(isAuthor(comment.author_id) || isAdmin) && (
                                                    <button className="comment-delete" onClick={() => handleDeleteComment(comment.id)}>
                                                        <Trash2 size={12} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <p className="comment-content">{comment.content}</p>
                                    </div>
                                ))}
                            </div>

                            {/* 댓글 입력 */}
                            <div className="comment-input-area">
                                <input
                                    className="comment-input"
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    placeholder="댓글을 입력하세요..."
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                />
                                <button className="comment-send-btn" onClick={handleAddComment} disabled={!commentText.trim()}>
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ) : selectedPost && isEditMode ? (
                    <div className="post-edit">
                        <div className="form-group">
                            <label className="form-label">카테고리</label>
                            <select className="form-input" value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}>
                                <option value="자유게시판">자유게시판</option>
                                <option value="공지사항">공지사항</option>
                                <option value="건의사항">건의사항</option>
                                <option value="정보공유">정보공유</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">제목</label>
                            <input className="form-input" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label className="form-label">내용</label>
                            <textarea className="form-input" rows="8" value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} style={{ resize: 'vertical', minHeight: '200px' }} />
                        </div>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsEditMode(false)}>취소</button>
                            <button className="btn-submit" onClick={handleUpdatePost}>수정 저장</button>
                        </div>
                    </div>
                ) : null}
            </Modal>

            <style>{`
                .board-filter-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    flex-wrap: wrap;
                }
                .board-categories {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .board-cat-btn {
                    padding: 6px 14px;
                    border-radius: 20px;
                    font-size: 0.82rem;
                    font-weight: 600;
                    border: 2px solid #e2e8f0;
                    background: white;
                    color: #64748b;
                    cursor: pointer;
                    transition: all 0.15s;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .board-cat-btn:hover { border-color: #4f46e5; color: #4f46e5; }
                .board-cat-btn.active {
                    background: linear-gradient(135deg, #4f46e5, #6366f1);
                    color: white;
                    border-color: #4f46e5;
                }
                .cat-count {
                    font-size: 0.7rem;
                    background: rgba(0,0,0,0.08);
                    padding: 1px 6px;
                    border-radius: 10px;
                }
                .board-cat-btn.active .cat-count {
                    background: rgba(255,255,255,0.25);
                }
                .board-search {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    background: white;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    padding: 6px 12px;
                    min-width: 200px;
                }
                .board-search-input {
                    border: none;
                    outline: none;
                    font-size: 0.85rem;
                    width: 100%;
                    background: transparent;
                }

                .board-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }
                .board-item {
                    padding: 1.25rem 1.5rem;
                    background: white;
                    border-bottom: 1px solid #f1f5f9;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .board-item:first-child { border-radius: 12px 12px 0 0; }
                .board-item:last-child { border-radius: 0 0 12px 12px; border-bottom: none; }
                .board-item:only-child { border-radius: 12px; }
                .board-item:hover { background: #fafbff; }
                .board-item.pinned {
                    background: linear-gradient(135deg, #fefce8 0%, #fff7ed 100%);
                    border-left: 4px solid #f59e0b;
                }

                .board-item-top {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 6px;
                }
                .pin-icon { color: #f59e0b; flex-shrink: 0; }
                .board-cat-tag {
                    padding: 2px 10px;
                    border-radius: 12px;
                    font-size: 0.72rem;
                    font-weight: 700;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .board-title {
                    font-size: 1rem;
                    font-weight: 700;
                    color: #1e293b;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .board-preview {
                    font-size: 0.85rem;
                    color: #64748b;
                    margin-bottom: 10px;
                    line-height: 1.5;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
                .board-item-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .board-author {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .board-avatar {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #4f46e5, #7c3aed);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.72rem;
                    font-weight: 700;
                    flex-shrink: 0;
                }
                .board-avatar.small { width: 22px; height: 22px; font-size: 0.65rem; }
                .board-meta-right {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .board-time, .board-comments {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.78rem;
                    color: #94a3b8;
                    font-weight: 500;
                }
                .board-comments { color: #4f46e5; font-weight: 600; }

                .board-empty {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1rem;
                    padding: 4rem;
                    color: #94a3b8;
                }
                .board-empty p { font-size: 1rem; font-weight: 500; }

                /* 게시글 상세 */
                .post-view-header { margin-bottom: 1.5rem; }
                .post-view-title {
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 10px 0;
                    line-height: 1.4;
                }
                .post-view-meta {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .post-view-content {
                    padding: 1.5rem;
                    background: #f8fafc;
                    border-radius: 10px;
                    border: 1px solid #e2e8f0;
                    margin-bottom: 1rem;
                    line-height: 1.8;
                    color: #334155;
                    font-size: 0.95rem;
                    min-height: 100px;
                }
                .post-view-content p { margin-bottom: 0.25rem; }

                .post-actions {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 1.5rem;
                    justify-content: flex-end;
                }
                .post-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 14px;
                    border-radius: 8px;
                    font-size: 0.8rem;
                    font-weight: 600;
                    cursor: pointer;
                    border: none;
                    transition: all 0.15s;
                }
                .post-action-btn.edit { background: #eff6ff; color: #2563eb; }
                .post-action-btn.edit:hover { background: #dbeafe; }
                .post-action-btn.delete { background: #fef2f2; color: #dc2626; }
                .post-action-btn.delete:hover { background: #fee2e2; }

                /* 댓글 */
                .comments-section {
                    border-top: 2px solid #e2e8f0;
                    padding-top: 1.25rem;
                }
                .comments-title {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 1rem;
                }
                .comments-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                    margin-bottom: 1rem;
                    max-height: 300px;
                    overflow-y: auto;
                }
                .comment-item {
                    padding: 0.85rem;
                    border-bottom: 1px solid #f1f5f9;
                }
                .comment-item:last-child { border-bottom: none; }
                .comment-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .comment-author {
                    font-weight: 600;
                    font-size: 0.82rem;
                    color: #1e293b;
                }
                .comment-time {
                    font-size: 0.72rem;
                    color: #94a3b8;
                }
                .comment-content {
                    font-size: 0.88rem;
                    color: #475569;
                    line-height: 1.5;
                    padding-left: 28px;
                }
                .comment-delete {
                    color: #94a3b8;
                    padding: 2px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                    background: none;
                    border: none;
                }
                .comment-delete:hover { color: #dc2626; background: #fef2f2; }

                .comment-input-area {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                }
                .comment-input {
                    flex: 1;
                    padding: 10px 14px;
                    border: 2px solid #e2e8f0;
                    border-radius: 10px;
                    font-size: 0.88rem;
                    transition: border-color 0.15s;
                    outline: none;
                }
                .comment-input:focus { border-color: #4f46e5; }
                .comment-send-btn {
                    width: 40px;
                    height: 40px;
                    border-radius: 10px;
                    background: linear-gradient(135deg, #4f46e5, #6366f1);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    border: none;
                    transition: all 0.15s;
                    flex-shrink: 0;
                }
                .comment-send-btn:hover { opacity: 0.85; }
                .comment-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                @media (max-width: 768px) {
                    .board-filter-section { flex-direction: column; align-items: stretch; }
                    .board-search { min-width: auto; }
                    .board-item { padding: 1rem; }
                    .board-title { font-size: 0.92rem; }
                    .post-view-title { font-size: 1.1rem; }
                }
            `}</style>
        </div>
    );
};

export default Board;
