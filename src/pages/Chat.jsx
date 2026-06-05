import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Send, Image as ImageIcon, X, Bell, BellRing, Trash2, AlertTriangle, Search, MessageSquare, Sparkles } from 'lucide-react';
import Modal from '../components/Modal';
import AiAssistant from '../components/AiAssistant';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { enablePush, notifPermission, pushSupported, triggerPush } from '../lib/push';

// 현재 시각을 datetime-local 입력값(YYYY-MM-DDTHH:MM)으로
function nowLocalInput() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const Chat = () => {
  const { user } = useAuth();
  const { uploadImage } = useData();

  const [tab, setTab] = useState('chat'); // 'chat' | 'ai'
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [perm, setPerm] = useState(notifPermission());
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(true);

  // 검색 / 이슈 필터
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [issueOnly, setIssueOnly] = useState(false);

  // 이슈 등록 모달
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [issueText, setIssueText] = useState('');
  const [issueDate, setIssueDate] = useState(nowLocalInput());
  const [savingIssue, setSavingIssue] = useState(false);

  const listRef = useRef(null);
  const fileRef = useRef(null);
  const audioCtxRef = useRef(null);

  const playBeep = useCallback(() => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      o.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.start(); o.stop(ctx.currentTime + 0.32);
    } catch { /* ignore */ }
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
      }
    });
  }, []);

  // 최초 로딩
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(500);
      if (mounted) {
        if (!error && data) setMessages(data);
        setLoading(false);
        scrollToBottom(false);
      }
    })();
    return () => { mounted = false; };
  }, [scrollToBottom]);

  // 실시간 구독
  useEffect(() => {
    const channel = supabase
      .channel('chat-room-1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new;
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        if (msg.sender_id !== user?.id) playBeep();
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, playBeep, scrollToBottom]);

  useEffect(() => { if (!search && !issueOnly) scrollToBottom(); }, [messages.length, search, issueOnly, scrollToBottom]);

  // 표시할 메시지 (검색 + 이슈필터 적용)
  const displayed = useMemo(() => {
    let arr = messages;
    if (issueOnly) arr = arr.filter((m) => m.is_issue);
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((m) =>
        (m.content || '').toLowerCase().includes(q) ||
        (m.sender_name || '').toLowerCase().includes(q)
      );
    }
    return arr;
  }, [messages, issueOnly, search]);

  const matchCount = useMemo(() => (search.trim() ? displayed.length : 0), [search, displayed.length]);

  const handleEnablePush = async () => {
    const res = await enablePush(user?.id);
    setPerm(notifPermission());
    if (!res.ok) {
      if (res.reason === 'denied') alert('알림이 차단되었습니다. 브라우저 설정에서 이 사이트의 알림을 허용해주세요.');
      else if (res.reason === 'unsupported') alert('이 브라우저는 푸시 알림을 지원하지 않습니다.');
      else if (res.reason === 'no-vapid-key') alert('서버 알림 키가 설정되지 않았습니다. 관리자에게 문의하세요.');
      else alert('알림 등록에 실패했습니다.');
    } else {
      alert('✅ 알림이 켜졌습니다! 이제 새 메시지를 폰에서 받을 수 있어요.');
    }
  };

  const handleSend = async () => {
    const content = text.trim();
    if (!content && !imageFile) return;
    if (sending) return;
    setSending(true);
    try {
      let imageUrl = null;
      if (imageFile) imageUrl = await uploadImage(imageFile);
      const senderName = user?.name || user?.email || '직원';
      const { error } = await supabase
        .from('chat_messages')
        .insert([{ sender_id: user?.id || null, sender_name: senderName, content: content || null, image_url: imageUrl }]);
      if (error) { console.error('send error:', error); alert('메시지 전송에 실패했습니다.'); }
      else {
        setText(''); setImageFile(null);
        triggerPush({ senderId: user?.id, senderName, content: content || '📷 사진' });
      }
    } finally { setSending(false); }
  };

  const handleSendIssue = async () => {
    const body = issueText.trim();
    if (!body) return alert('이슈 내용을 입력하세요.');
    if (!issueDate) return alert('발생일시를 선택하세요.');
    if (savingIssue) return;
    setSavingIssue(true);
    try {
      const senderName = user?.name || user?.email || '직원';
      const issueAtISO = new Date(issueDate).toISOString();
      const { error } = await supabase
        .from('chat_messages')
        .insert([{ sender_id: user?.id || null, sender_name: senderName, content: body, is_issue: true, issue_at: issueAtISO }]);
      if (error) {
        console.error('issue error:', error);
        alert('이슈 등록 실패: DB에 이슈 컬럼이 없을 수 있습니다(관리자 마이그레이션 필요).');
      } else {
        setIssueText(''); setIssueDate(nowLocalInput()); setIssueModalOpen(false);
        triggerPush({ senderId: user?.id, senderName, content: '⚠️ [중요 이슈] ' + body });
      }
    } finally { setSavingIssue(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 메시지를 삭제할까요?')) return;
    await supabase.from('chat_messages').delete().eq('id', id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const fmtTime = (s) => s ? new Date(s).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '';
  const fmtDate = (s) => new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  const fmtFull = (s) => s ? new Date(s).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' }) : '';

  const showDateDivider = (arr, idx) => {
    if (idx === 0) return true;
    return new Date(arr[idx].created_at).toDateString() !== new Date(arr[idx - 1].created_at).toDateString();
  };

  const isMine = (m) => m.sender_id === user?.id;

  // 검색어 하이라이트
  const highlight = (textVal) => {
    const q = search.trim();
    if (!q || !textVal) return textVal;
    const lower = textVal.toLowerCase();
    const ql = q.toLowerCase();
    const parts = [];
    let i = 0;
    while (true) {
      const j = lower.indexOf(ql, i);
      if (j === -1) { parts.push(textVal.slice(i)); break; }
      if (j > i) parts.push(textVal.slice(i, j));
      parts.push(<mark key={j} className="chat-mark">{textVal.slice(j, j + q.length)}</mark>);
      i = j + q.length;
    }
    return parts;
  };

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div className="chat-header-top">
          <div className="chat-tabs">
            <button className={`chat-tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => setTab('chat')}>
              <MessageSquare size={16} /> 전체 채팅
            </button>
            <button className={`chat-tab ${tab === 'ai' ? 'active' : ''}`} onClick={() => setTab('ai')}>
              <Sparkles size={16} /> 질문방
            </button>
          </div>
          {tab === 'chat' && (
            <div className="chat-header-actions">
              <button className={`chat-tool-btn ${searchOpen ? 'active' : ''}`} onClick={() => { setSearchOpen(o => !o); if (searchOpen) setSearch(''); }} title="대화 검색">
                <Search size={18} />
              </button>
              <button className={`chat-tool-btn ${issueOnly ? 'active warn' : ''}`} onClick={() => setIssueOnly(v => !v)} title="이슈만 보기">
                <AlertTriangle size={16} /> 이슈
              </button>
              {perm !== 'granted' && pushSupported() && (
                <button className="push-enable-btn" onClick={handleEnablePush}><Bell size={16} /> 알림 켜기</button>
              )}
              {perm === 'granted' && <span className="push-on"><BellRing size={15} /> ON</span>}
            </div>
          )}
        </div>
        {tab === 'chat' && searchOpen && (
          <div className="chat-search-row">
            <Search size={16} />
            <input autoFocus className="chat-search-input" placeholder="대화 내용·이름 검색..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
            {search.trim() && <span className="chat-search-count">{matchCount}건</span>}
            <button className="chat-search-clear" onClick={() => setSearch('')}><X size={15} /></button>
          </div>
        )}
      </div>

      {tab === 'ai' ? <AiAssistant /> : (
      <>
      <div className="chat-messages" ref={listRef}>
        {loading ? (
          <div className="chat-empty">불러오는 중...</div>
        ) : displayed.length === 0 ? (
          <div className="chat-empty">{search.trim() ? '검색 결과가 없습니다.' : issueOnly ? '등록된 이슈가 없습니다.' : '아직 메시지가 없습니다. 첫 메시지를 보내보세요!'}</div>
        ) : (
          displayed.map((m, idx) => (
            <React.Fragment key={m.id}>
              {showDateDivider(displayed, idx) && (
                <div className="chat-date-divider"><span>{fmtDate(m.created_at)}</span></div>
              )}

              {m.is_issue ? (
                // ===== 중요 이슈 카드 =====
                <div className="chat-issue-card">
                  <div className="issue-head">
                    <AlertTriangle size={16} />
                    <span className="issue-label">중요 이슈</span>
                    <span className="issue-by">{m.sender_name}</span>
                    {isMine(m) && <button className="issue-del" onClick={() => handleDelete(m.id)}><Trash2 size={13} /></button>}
                  </div>
                  <div className="issue-body">{highlight(m.content)}</div>
                  <div className="issue-meta">
                    <span>🕒 발생일시: <b>{fmtFull(m.issue_at || m.created_at)}</b></span>
                    <span className="issue-reg">등록: {fmtFull(m.created_at)}</span>
                  </div>
                </div>
              ) : (
                // ===== 일반 메시지 =====
                <div className={`chat-row ${isMine(m) ? 'mine' : 'other'}`}>
                  {!isMine(m) && <div className="chat-avatar">{(m.sender_name || '?')[0]}</div>}
                  <div className="chat-bubble-wrap">
                    {!isMine(m) && <span className="chat-name">{m.sender_name}</span>}
                    <div className="chat-bubble-line">
                      {isMine(m) && <span className="chat-time">{fmtTime(m.created_at)}</span>}
                      <div className="chat-bubble">
                        {m.image_url && <img src={m.image_url} alt="" className="chat-img" onClick={() => window.open(m.image_url, '_blank')} />}
                        {m.content && <span className="chat-text">{highlight(m.content)}</span>}
                        {isMine(m) && <button className="chat-del" onClick={() => handleDelete(m.id)}><Trash2 size={12} /></button>}
                      </div>
                      {!isMine(m) && <span className="chat-time">{fmtTime(m.created_at)}</span>}
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          ))
        )}
      </div>

      {imageFile && (
        <div className="chat-preview">
          <img src={URL.createObjectURL(imageFile)} alt="첨부" />
          <button onClick={() => setImageFile(null)}><X size={14} /></button>
        </div>
      )}

      <div className="chat-input-bar">
        <input type="file" ref={fileRef} accept="image/*" style={{ display: 'none' }}
          onChange={(e) => { if (e.target.files[0]) setImageFile(e.target.files[0]); e.target.value = ''; }} />
        <button className="chat-issue-btn" onClick={() => { setIssueDate(nowLocalInput()); setIssueModalOpen(true); }} title="중요 이슈 등록">
          <AlertTriangle size={20} />
        </button>
        <button className="chat-attach" onClick={() => fileRef.current?.click()}><ImageIcon size={20} /></button>
        <textarea className="chat-input" value={text} onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="메시지를 입력하세요..." rows={1} />
        <button className="chat-send" onClick={handleSend} disabled={sending || (!text.trim() && !imageFile)}><Send size={18} /></button>
      </div>

      {/* 중요 이슈 등록 모달 */}
      <Modal title="⚠️ 중요 이슈 등록" isOpen={issueModalOpen} onClose={() => setIssueModalOpen(false)}>
        <div className="form-group">
          <label className="form-label">이슈 발생일시</label>
          <input type="datetime-local" className="form-input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">이슈 내용</label>
          <textarea className="form-input" rows="5" value={issueText} onChange={(e) => setIssueText(e.target.value)}
            placeholder="예) 3호기 사출기 온도센서 오작동 — 생산 중단" style={{ resize: 'vertical', minHeight: '120px' }} />
        </div>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          등록 시 전 직원에게 알림이 발송되며, 채팅창에 강조 표시됩니다.
        </p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={() => setIssueModalOpen(false)}>취소</button>
          <button className="btn-submit" onClick={handleSendIssue} disabled={savingIssue}>
            {savingIssue ? '등록 중...' : '이슈 등록'}
          </button>
        </div>
      </Modal>
      </>
      )}

      <style>{`
        /* 상단 헤더(80px) + main 상하 마진(2rem) 만큼 빼서 입력바가 항상 보이게 */
        .chat-page { display: flex; flex-direction: column; height: calc(100vh - 112px); max-height: calc(100vh - 112px); min-height: 0; }
        .chat-header { padding: 0.5rem 0.25rem 0.75rem; border-bottom: 1px solid var(--border); }
        .chat-header-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .chat-tabs { display: flex; gap: 4px; background: var(--bg-subtle); padding: 4px; border-radius: 12px; border: 1px solid var(--border); }
        .chat-tab { display: flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: 9px; font-size: 0.85rem; font-weight: 700; color: var(--text-muted); transition: all 0.15s; }
        .chat-tab:hover { color: var(--primary); }
        .chat-tab.active { background: var(--bg-card, #fff); color: var(--primary); box-shadow: var(--shadow-sm); }
        .chat-title { font-size: 1.2rem; font-weight: 800; color: var(--text-main); }
        .chat-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .chat-header-actions { display: flex; align-items: center; gap: 8px; }
        .chat-tool-btn { display: flex; align-items: center; gap: 4px; padding: 7px 11px; border-radius: 18px; background: var(--bg-subtle); color: var(--text-muted); font-size: 0.8rem; font-weight: 600; border: 1px solid var(--border); }
        .chat-tool-btn:hover { color: var(--primary); }
        .chat-tool-btn.active { background: var(--primary-soft); color: var(--primary); border-color: var(--primary); }
        .chat-tool-btn.active.warn { background: #fef3c7; color: #b45309; border-color: #fcd34d; }
        .push-enable-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 20px; background: var(--gradient-primary); color: #fff; font-weight: 600; font-size: 0.82rem; box-shadow: var(--shadow-md); }
        .push-on { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #16a34a; font-weight: 600; }

        .chat-search-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; padding: 7px 12px; background: var(--bg-card,#fff); border: 2px solid var(--primary); border-radius: 12px; }
        .chat-search-input { flex: 1; border: none; outline: none; background: transparent; font-size: 0.9rem; color: var(--text-main); }
        .chat-search-count { font-size: 0.75rem; font-weight: 700; color: var(--primary); white-space: nowrap; }
        .chat-search-clear { color: var(--text-muted); display: flex; }
        .chat-mark { background: #fde047; color: #000; border-radius: 3px; padding: 0 1px; }

        .chat-messages { flex: 1; overflow-y: auto; padding: 1rem 0.25rem; display: flex; flex-direction: column; gap: 10px; }
        .chat-empty { text-align: center; color: var(--text-muted); margin: auto; font-size: 0.9rem; }

        .chat-date-divider { text-align: center; margin: 8px 0; }
        .chat-date-divider span { background: var(--bg-subtle); color: var(--text-muted); font-size: 0.72rem; padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border); }

        /* 중요 이슈 카드 */
        .chat-issue-card { align-self: stretch; background: linear-gradient(135deg,#fffbeb,#fff7ed); border: 1px solid #fcd34d; border-left: 5px solid #f59e0b; border-radius: 12px; padding: 12px 14px; box-shadow: 0 2px 8px rgba(245,158,11,0.12); }
        .issue-head { display: flex; align-items: center; gap: 6px; color: #b45309; font-weight: 800; font-size: 0.85rem; margin-bottom: 6px; }
        .issue-label { letter-spacing: -0.01em; }
        .issue-by { margin-left: auto; font-size: 0.75rem; font-weight: 600; color: #92400e; background: rgba(245,158,11,0.15); padding: 2px 8px; border-radius: 10px; }
        .issue-del { color: #b45309; display: flex; padding: 2px; }
        .issue-body { font-size: 0.95rem; color: #422006; line-height: 1.55; white-space: pre-wrap; word-break: break-word; margin-bottom: 8px; }
        .issue-meta { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 0.76rem; color: #92400e; border-top: 1px dashed #fcd34d; padding-top: 6px; }
        .issue-meta b { font-weight: 700; }
        .issue-reg { color: #b45309; opacity: 0.8; }

        .chat-row { display: flex; gap: 8px; max-width: 78%; }
        .chat-row.mine { align-self: flex-end; flex-direction: row-reverse; }
        .chat-row.other { align-self: flex-start; }
        .chat-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
        .chat-bubble-wrap { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .chat-name { font-size: 0.75rem; color: var(--text-muted); font-weight: 600; padding-left: 4px; }
        .chat-bubble-line { display: flex; align-items: flex-end; gap: 6px; }
        .chat-row.mine .chat-bubble-line { flex-direction: row; }
        .chat-bubble { position: relative; padding: 9px 13px; border-radius: 16px; font-size: 0.92rem; line-height: 1.45; word-break: break-word; white-space: pre-wrap; max-width: 100%; }
        .chat-row.other .chat-bubble { background: var(--bg-card, #fff); border: 1px solid var(--border); color: var(--text-main); border-top-left-radius: 4px; }
        .chat-row.mine .chat-bubble { background: var(--gradient-primary, #4f46e5); color: #fff; border-top-right-radius: 4px; }
        .chat-time { font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
        .chat-img { max-width: 220px; max-height: 240px; border-radius: 10px; display: block; margin-bottom: 4px; cursor: pointer; object-fit: cover; }
        .chat-del { position: absolute; top: -8px; left: -8px; width: 20px; height: 20px; border-radius: 50%; background: var(--danger, #ef4444); color: #fff; display: none; align-items: center; justify-content: center; }
        .chat-row.mine .chat-bubble:hover .chat-del { display: flex; }

        .chat-preview { position: relative; width: fit-content; margin: 6px 4px; }
        .chat-preview img { max-height: 80px; border-radius: 8px; border: 1px solid var(--border); }
        .chat-preview button { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; display: flex; align-items: center; justify-content: center; }

        .chat-input-bar { display: flex; align-items: flex-end; gap: 8px; padding: 0.75rem 0.25rem 0.25rem; border-top: 1px solid var(--border); }
        .chat-issue-btn { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #b45309; background: #fef3c7; flex-shrink: 0; }
        .chat-issue-btn:hover { background: #fde68a; }
        .chat-attach { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); background: var(--bg-subtle); flex-shrink: 0; }
        .chat-attach:hover { color: var(--primary); }
        .chat-input { flex: 1; resize: none; max-height: 120px; padding: 10px 14px; border: 2px solid var(--border); border-radius: 18px; font-size: 0.92rem; font-family: inherit; outline: none; background: var(--bg-card, #fff); color: var(--text-main); line-height: 1.4; }
        .chat-input:focus { border-color: var(--primary); }
        .chat-send { width: 42px; height: 42px; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-md); }
        .chat-send:disabled { opacity: 0.4; }

        @media (max-width: 768px) {
          .chat-page { height: calc(100vh - 92px); max-height: calc(100vh - 92px); }
          .chat-row { max-width: 88%; }
          .chat-img { max-width: 60vw; }
          .chat-header-actions { gap: 5px; }
          .chat-tool-btn { padding: 6px 9px; }
        }
      `}</style>
    </div>
  );
};

export default Chat;
