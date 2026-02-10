import React, { useState, useMemo, useRef } from 'react';
import Modal from '../components/Modal';
import { MessageSquare, Plus, Send, Trash2, Edit, Clock, User, ChevronLeft, Search, Pin, Image as ImageIcon, X } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

const Board = () => {
    const { boardPosts, boardComments, addBoardPost, updateBoardPost, deleteBoardPost, addBoardComment, deleteBoardComment, employees, uploadImage } = useData();
    const { user } = useAuth();

    const [isWriteOpen, setIsWriteOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedPost, setSelectedPost] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState('전체');
    const [commentText, setCommentText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [viewerImage, setViewerImage] = useState(null);
    const fileInputRef = useRef(null);

    const [postForm, setPostForm] = useState({
        title: '',
        content: '',
        category: '자유게시판',
        files: []
    });

    const categories = ['전체', '공지사항', '자유게시판', '건의사항', '정보공유'];

    const getAuthorName = (authorId) => {
        if (!authorId) return '알 수 없음';
        const emp = employees.find(e => e.id === authorId);
        return emp ? emp.name : (user?.id === authorId ? (user.name || user.email) : '알 수 없음');
    };

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

    // 이미지 URL 파싱
    const parseImages = (imageUrl) => {
        if (!imageUrl) return [];
        try {
            const parsed = JSON.parse(imageUrl);
            return Array.isArray(parsed) ? parsed : [imageUrl];
        } catch {
            return imageUrl.includes(',') ? imageUrl.split(',').map(s => s.trim()) : [imageUrl];
        }
    };

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
                if (a.is_pinned && !b.is_pinned) return -1;
                if (!a.is_pinned && b.is_pinned) return 1;
                return new Date(b.created_at) - new Date(a.created_at);
            });
    }, [boardPosts, filterCategory, searchQuery]);

    const getCommentCount = (postId) => (boardComments || []).filter(c => c.post_id === postId).length;
    const getPostComments = (postId) => (boardComments || []).filter(c => c.post_id === postId).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // 파일 선택
    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length + postForm.files.length > 4) {
            alert('사진은 최대 4장까지 첨부 가능합니다.');
            return;
        }
        setPostForm(prev => ({ ...prev, files: [...prev.files, ...files] }));
        e.target.value = '';
    };

    const removeFile = (index) => {
        setPostForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
    };

    // 게시글 등록
    const handleCreatePost = async () => {
        if (!postForm.title.trim()) return alert('제목을 입력하세요');
        if (!postForm.content.trim()) return alert('내용을 입력하세요');

        setIsUploading(true);
        try {
            // 이미지 업로드
            let imageUrls = [];
            for (const file of postForm.files) {
                const url = await uploadImage(file, 'board');
                if (url) imageUrls.push(url);
            }

            await addBoardPost({
                title: postForm.title,
                content: postForm.content,
                category: postForm.category,
                author_id: user?.id || null,
                author_name: user?.name || user?.email || '익명',
                is_pinned: false,
                image_url: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null
            });

            setPostForm({ title: '', content: '', category: '자유게시판', files: [] });
            setIsWriteOpen(false);
        } catch (err) {
            console.error('게시글 등록 오류:', err);
            alert('게시글 등록에 실패했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleUpdatePost = async () => {
        if (!selectedPost) return;
        await updateBoardPost(selectedPost.id, {
            title: postForm.title,
            content: postForm.content,
            category: postForm.category
        });
        setSelectedPost({ ...selectedPost, title: postForm.title, content: postForm.content, category: postForm.category });
        setIsEditMode(false);
    };

    const handleDeletePost = async (id) => {
        if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return;
        await deleteBoardPost(id);
        setIsViewOpen(false);
        setSelectedPost(null);
    };

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

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('댓글을 삭제하시겠습니까?')) return;
        await deleteBoardComment(commentId);
    };

    const openPost = (post) => {
        setSelectedPost(post);
        setIsViewOpen(true);
        setIsEditMode(false);
        setCommentText('');
    };

    const startEdit = () => {
        setPostForm({ title: selectedPost.title, content: selectedPost.content, category: selectedPost.category, files: [] });
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

    // 이미지 그리드 렌더링 (X 스타일)
    const renderImageGrid = (images, size = 'normal') => {
        if (!images || images.length === 0) return null;
        const count = images.length;
        const maxH = size === 'small' ? '120px' : '300px';

        return (
            <div className={`img-grid img-grid-${Math.min(count, 4)}`} style={{ maxHeight: size === 'small' ? '120px' : undefined }}>
                {images.slice(0, 4).map((url, i) => (
                    <div key={i} className="img-grid-item" onClick={(e) => { e.stopPropagation(); setViewerImage(url); }}>
                        <img src={url} alt="" loading="lazy" style={{ maxHeight: maxH }} />
                        {i === 3 && count > 4 && (
                            <div className="img-grid-more">+{count - 4}</div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="page-container">
            <div className="page-header-row">
                <div>
                    <h2 className="page-subtitle">커뮤니티 게시판</h2>
                    <p className="page-description">공지사항, 자유주제 등 자유롭게 소통하는 공간입니다.</p>
                </div>
                <button className="btn-primary" onClick={() => { setPostForm({ title: '', content: '', category: '자유게시판', files: [] }); setIsWriteOpen(true); }}>
                    <Plus size={18} /> 글 작성
                </button>
            </div>

            {/* 카테고리 필터 + 검색 */}
            <div className="board-filter-section">
                <div className="board-categories">
                    {categories.map(cat => (
                        <button key={cat} className={`board-cat-btn ${filterCategory === cat ? 'active' : ''}`} onClick={() => setFilterCategory(cat)}>
                            {cat}
                            {cat !== '전체' && <span className="cat-count">{(boardPosts || []).filter(p => p.category === cat).length}</span>}
                        </button>
                    ))}
                </div>
                <div className="board-search">
                    <Search size={16} />
                    <input type="text" placeholder="검색..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="board-search-input" />
                </div>
            </div>

            {/* 게시글 목록 - 피드 스타일 */}
            <div className="board-list">
                {filteredPosts.length > 0 ? filteredPosts.map(post => {
                    const catStyle = getCategoryColor(post.category);
                    const commentCount = getCommentCount(post.id);
                    const images = parseImages(post.image_url);
                    return (
                        <div key={post.id} className={`board-item ${post.is_pinned ? 'pinned' : ''}`} onClick={() => openPost(post)}>
                            <div className="board-item-top">
                                <div className="board-author">
                                    <div className="board-avatar">{(post.author_name || '?')[0]}</div>
                                    <div>
                                        <span className="board-author-name">{post.author_name || getAuthorName(post.author_id)}</span>
                                        <span className="board-time-inline">{formatTime(post.created_at)}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {post.is_pinned && <Pin size={14} className="pin-icon" />}
                                    <span className="board-cat-tag" style={{ background: catStyle.bg, color: catStyle.color, border: `1px solid ${catStyle.border}` }}>
                                        {post.category}
                                    </span>
                                </div>
                            </div>
                            <h3 className="board-title">{post.title}</h3>
                            <p className="board-preview">{post.content?.substring(0, 200)}{post.content?.length > 200 ? '...' : ''}</p>
                            {images.length > 0 && renderImageGrid(images, 'small')}
                            <div className="board-item-footer">
                                <span className="board-comments"><MessageSquare size={14} /> {commentCount}개 댓글</span>
                                {images.length > 0 && <span className="board-img-count"><ImageIcon size={13} /> {images.length}</span>}
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
                    <textarea className="form-input" rows="6" value={postForm.content} onChange={(e) => setPostForm({ ...postForm, content: e.target.value })} placeholder="내용을 입력하세요..." style={{ resize: 'vertical', minHeight: '150px' }} />
                </div>

                {/* 사진 첨부 - X 스타일 */}
                <div className="photo-attach-section">
                    <input type="file" ref={fileInputRef} accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                    <button className="photo-attach-btn" onClick={() => fileInputRef.current?.click()} disabled={postForm.files.length >= 4}>
                        <ImageIcon size={18} />
                        사진 첨부 ({postForm.files.length}/4)
                    </button>

                    {postForm.files.length > 0 && (
                        <div className="photo-preview-grid">
                            {postForm.files.map((file, i) => (
                                <div key={i} className="photo-preview-item">
                                    <img src={URL.createObjectURL(file)} alt={`미리보기 ${i + 1}`} />
                                    <button className="photo-remove-btn" onClick={() => removeFile(i)}>
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="modal-actions">
                    <button className="btn-cancel" onClick={() => setIsWriteOpen(false)}>취소</button>
                    <button className="btn-submit" onClick={handleCreatePost} disabled={isUploading}>
                        {isUploading ? `업로드 중... (${postForm.files.length}장)` : '등록'}
                    </button>
                </div>
            </Modal>

            {/* 게시글 상세 모달 */}
            <Modal title="" isOpen={isViewOpen} onClose={() => { setIsViewOpen(false); setSelectedPost(null); setIsEditMode(false); }}>
                {selectedPost && !isEditMode ? (
                    <div className="post-view">
                        <div className="post-view-header">
                            <div className="post-view-author-row">
                                <div className="board-author">
                                    <div className="board-avatar lg">{(selectedPost.author_name || '?')[0]}</div>
                                    <div>
                                        <div className="board-author-name">{selectedPost.author_name || getAuthorName(selectedPost.author_id)}</div>
                                        <div className="board-time" style={{ marginTop: '2px' }}><Clock size={12} /> {formatTime(selectedPost.created_at)}</div>
                                    </div>
                                </div>
                                <span className="board-cat-tag" style={{ ...(() => { const s = getCategoryColor(selectedPost.category); return { background: s.bg, color: s.color, border: `1px solid ${s.border}` }; })() }}>
                                    {selectedPost.category}
                                </span>
                            </div>
                            <h2 className="post-view-title">{selectedPost.title}</h2>
                        </div>

                        <div className="post-view-content">
                            {selectedPost.content?.split('\n').map((line, i) => (
                                <p key={i}>{line || <br />}</p>
                            ))}
                        </div>

                        {/* 이미지 갤러리 */}
                        {parseImages(selectedPost.image_url).length > 0 && (
                            <div className="post-images-section">
                                {renderImageGrid(parseImages(selectedPost.image_url), 'normal')}
                            </div>
                        )}

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
                            <div className="comment-input-area">
                                <input className="comment-input" value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="댓글을 입력하세요..."
                                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }} />
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

            {/* 이미지 뷰어 */}
            {viewerImage && (
                <div className="image-viewer-overlay" onClick={() => setViewerImage(null)}>
                    <button className="image-viewer-close" onClick={() => setViewerImage(null)}><X size={24} /></button>
                    <img src={viewerImage} alt="확대 보기" className="image-viewer-img" onClick={(e) => e.stopPropagation()} />
                </div>
            )}

            <style>{`
                .board-filter-section { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
                .board-categories { display: flex; gap: 6px; flex-wrap: wrap; }
                .board-cat-btn { padding: 6px 14px; border-radius: 20px; font-size: 0.82rem; font-weight: 600; border: 2px solid #e2e8f0; background: white; color: #64748b; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 6px; }
                .board-cat-btn:hover { border-color: #4f46e5; color: #4f46e5; }
                .board-cat-btn.active { background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; border-color: #4f46e5; }
                .cat-count { font-size: 0.7rem; background: rgba(0,0,0,0.08); padding: 1px 6px; border-radius: 10px; }
                .board-cat-btn.active .cat-count { background: rgba(255,255,255,0.25); }
                .board-search { display: flex; align-items: center; gap: 8px; background: white; border: 2px solid #e2e8f0; border-radius: 10px; padding: 6px 12px; min-width: 200px; }
                .board-search-input { border: none; outline: none; font-size: 0.85rem; width: 100%; background: transparent; }

                /* 피드 스타일 목록 */
                .board-list { display: flex; flex-direction: column; gap: 12px; }
                .board-item {
                    padding: 1.25rem 1.5rem;
                    background: white;
                    border-radius: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    overflow: hidden;
                }
                .board-item:hover { border-color: #c7d2fe; box-shadow: 0 4px 12px rgba(79,70,229,0.08); transform: translateY(-1px); overflow: hidden; }
                .board-item.pinned { background: linear-gradient(135deg, #fefce8, #fff7ed); border-color: #fde68a; }

                .board-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
                .pin-icon { color: #f59e0b; flex-shrink: 0; }
                .board-cat-tag { padding: 2px 10px; border-radius: 12px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
                .board-author { display: flex; align-items: center; gap: 8px; }
                .board-author-name { font-weight: 700; font-size: 0.88rem; color: #1e293b; }
                .board-time-inline { font-size: 0.75rem; color: #94a3b8; margin-left: 6px; }
                .board-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; flex-shrink: 0; }
                .board-avatar.lg { width: 38px; height: 38px; font-size: 0.9rem; }
                .board-avatar.small { width: 22px; height: 22px; font-size: 0.65rem; }

                .board-title { font-size: 1.05rem; font-weight: 700; color: #1e293b; margin-bottom: 4px; line-height: 1.4; }
                .board-preview { font-size: 0.88rem; color: #64748b; margin-bottom: 10px; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
                .board-item-footer { display: flex; align-items: center; gap: 16px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
                .board-comments, .board-img-count { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
                .board-comments { color: #4f46e5; font-weight: 600; }
                .board-time { display: flex; align-items: center; gap: 4px; font-size: 0.78rem; color: #94a3b8; font-weight: 500; }

                /* 이미지 그리드 */
                .img-grid { display: grid; gap: 4px; border-radius: 12px; overflow: hidden; margin-top: 8px; max-width: 100%; }
                .img-grid-1 { grid-template-columns: 1fr; }
                .img-grid-2 { grid-template-columns: 1fr 1fr; }
                .img-grid-3 { grid-template-columns: 1fr 1fr; grid-template-rows: 200px 200px; }
                .img-grid-3 .img-grid-item:first-child { grid-row: span 2; }
                .img-grid-4 { grid-template-columns: 1fr 1fr; grid-template-rows: 200px 200px; }
                .img-grid-item { position: relative; cursor: pointer; overflow: hidden; background: #f1f5f9; border-radius: 8px; }
                .img-grid-1 .img-grid-item img { width: 100%; max-width: 100%; height: auto; max-height: 500px; object-fit: contain; display: block; transition: transform 0.2s; }
                .img-grid-2 .img-grid-item img, .img-grid-3 .img-grid-item img, .img-grid-4 .img-grid-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.2s; }
                .img-grid-item:hover img { transform: scale(1.03); }
                .img-grid-more { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.5rem; font-weight: 700; }

                /* 사진 첨부 버튼 */
                .photo-attach-section { margin-bottom: 1rem; }
                .photo-attach-btn {
                    display: flex; align-items: center; gap: 8px;
                    padding: 10px 18px; border-radius: 10px;
                    border: 2px dashed #c7d2fe; background: #f5f3ff;
                    color: #4f46e5; font-weight: 600; font-size: 0.88rem;
                    cursor: pointer; transition: all 0.15s; width: 100%;
                    justify-content: center;
                }
                .photo-attach-btn:hover { background: #ede9fe; border-color: #4f46e5; }
                .photo-attach-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .photo-preview-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-top: 10px; }
                .photo-preview-item { position: relative; aspect-ratio: 1; border-radius: 10px; overflow: hidden; border: 1px solid #e2e8f0; }
                .photo-preview-item img { width: 100%; height: 100%; object-fit: cover; }
                .photo-remove-btn {
                    position: absolute; top: 4px; right: 4px;
                    width: 22px; height: 22px; border-radius: 50%;
                    background: rgba(0,0,0,0.65); color: white;
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; border: none; transition: all 0.15s;
                }
                .photo-remove-btn:hover { background: #dc2626; }

                .board-empty { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 4rem; color: #94a3b8; }
                .board-empty p { font-size: 1rem; font-weight: 500; }

                /* 상세 */
                .post-view-header { margin-bottom: 1rem; }
                .post-view-author-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
                .post-view-title { font-size: 1.3rem; font-weight: 800; color: #1e293b; line-height: 1.4; }
                .post-view-content { padding: 1.25rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 1rem; line-height: 1.8; color: #334155; font-size: 0.95rem; min-height: 80px; }
                .post-view-content p { margin-bottom: 0.25rem; }
                .post-images-section { margin-bottom: 1rem; }

                .post-actions { display: flex; gap: 8px; margin-bottom: 1.25rem; justify-content: flex-end; }
                .post-action-btn { display: flex; align-items: center; gap: 4px; padding: 6px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: none; transition: all 0.15s; }
                .post-action-btn.edit { background: #eff6ff; color: #2563eb; }
                .post-action-btn.edit:hover { background: #dbeafe; }
                .post-action-btn.delete { background: #fef2f2; color: #dc2626; }
                .post-action-btn.delete:hover { background: #fee2e2; }

                .comments-section { border-top: 2px solid #e2e8f0; padding-top: 1.25rem; }
                .comments-title { display: flex; align-items: center; gap: 6px; font-size: 0.95rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; }
                .comments-list { display: flex; flex-direction: column; margin-bottom: 1rem; max-height: 300px; overflow-y: auto; }
                .comment-item { padding: 0.85rem; border-bottom: 1px solid #f1f5f9; }
                .comment-item:last-child { border-bottom: none; }
                .comment-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
                .comment-author { font-weight: 600; font-size: 0.82rem; color: #1e293b; }
                .comment-time { font-size: 0.72rem; color: #94a3b8; }
                .comment-content { font-size: 0.88rem; color: #475569; line-height: 1.5; padding-left: 30px; }
                .comment-delete { color: #94a3b8; padding: 2px; border-radius: 4px; cursor: pointer; transition: all 0.15s; background: none; border: none; }
                .comment-delete:hover { color: #dc2626; background: #fef2f2; }
                .comment-input-area { display: flex; gap: 8px; align-items: center; }
                .comment-input { flex: 1; padding: 10px 14px; border: 2px solid #e2e8f0; border-radius: 10px; font-size: 0.88rem; transition: border-color 0.15s; outline: none; }
                .comment-input:focus { border-color: #4f46e5; }
                .comment-send-btn { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #6366f1); color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; border: none; transition: all 0.15s; flex-shrink: 0; }
                .comment-send-btn:hover { opacity: 0.85; }
                .comment-send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

                /* 이미지 뷰어 오버레이 */
                .image-viewer-overlay {
                    position: fixed; inset: 0; z-index: 9999;
                    background: rgba(0,0,0,0.9);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer;
                }
                .image-viewer-close { position: absolute; top: 16px; right: 16px; color: white; background: rgba(255,255,255,0.15); border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; cursor: pointer; }
                .image-viewer-close:hover { background: rgba(255,255,255,0.3); }
                .image-viewer-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; cursor: default; object-fit: contain; }

                @media (max-width: 768px) {
                    .board-filter-section { flex-direction: column; align-items: stretch; }
                    .board-search { min-width: auto; }
                    .board-item { padding: 1rem; border-radius: 12px; }
                    .board-title { font-size: 0.95rem; }
                    .post-view-title { font-size: 1.1rem; }
                    .photo-preview-grid { grid-template-columns: repeat(2, 1fr); }
                    .img-grid-item img { min-height: 60px; }
                }
            `}</style>
        </div>
    );
};

export default Board;
