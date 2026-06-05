import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Image as ImageIcon, X, Bell, BellRing, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { enablePush, notifPermission, pushSupported, triggerPush } from '../lib/push';

const Chat = () => {
  const { user } = useAuth();
  const { uploadImage } = useData();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [perm, setPerm] = useState(notifPermission());
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading] = useState(true);

  const listRef = useRef(null);
  const fileRef = useRef(null);
  const audioCtxRef = useRef(null);

  // 인앱 알림음 (간단한 비프)
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

  // 최초 메시지 로딩
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(300);
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
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev; // 중복 방지
          return [...prev, msg];
        });
        if (msg.sender_id !== user?.id) playBeep();
        scrollToBottom();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_messages' }, (payload) => {
        setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, playBeep, scrollToBottom]);

  useEffect(() => { scrollToBottom(); }, [messages.length, scrollToBottom]);

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
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
      }

      const senderName = user?.name || user?.email || '직원';
      const { error } = await supabase
        .from('chat_messages')
        .insert([{ sender_id: user?.id || null, sender_name: senderName, content: content || null, image_url: imageUrl }]);

      if (error) {
        console.error('send error:', error);
        alert('메시지 전송에 실패했습니다.');
      } else {
        setText('');
        setImageFile(null);
        // 폰 푸시 발송 (앱 닫혀 있는 직원에게)
        triggerPush({ senderId: user?.id, senderName, content: content || '📷 사진' });
      }
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 메시지를 삭제할까요?')) return;
    await supabase.from('chat_messages').delete().eq('id', id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const fmtTime = (s) => {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };
  const fmtDate = (s) => {
    const d = new Date(s);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  // 날짜 구분선 판단
  const showDateDivider = (idx) => {
    if (idx === 0) return true;
    const cur = new Date(messages[idx].created_at).toDateString();
    const prev = new Date(messages[idx - 1].created_at).toDateString();
    return cur !== prev;
  };

  const isMine = (m) => m.sender_id === user?.id;

  return (
    <div className="chat-page">
      <div className="chat-header">
        <div>
          <h2 className="chat-title">💬 직원 채팅방</h2>
          <p className="chat-sub">전 직원 단체방 · 실시간</p>
        </div>
        {perm !== 'granted' && pushSupported() && (
          <button className="push-enable-btn" onClick={handleEnablePush}>
            <Bell size={16} /> 알림 켜기
          </button>
        )}
        {perm === 'granted' && (
          <span className="push-on"><BellRing size={15} /> 알림 ON</span>
        )}
      </div>

      <div className="chat-messages" ref={listRef}>
        {loading ? (
          <div className="chat-empty">불러오는 중...</div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">아직 메시지가 없습니다. 첫 메시지를 보내보세요!</div>
        ) : (
          messages.map((m, idx) => (
            <React.Fragment key={m.id}>
              {showDateDivider(idx) && (
                <div className="chat-date-divider"><span>{fmtDate(m.created_at)}</span></div>
              )}
              <div className={`chat-row ${isMine(m) ? 'mine' : 'other'}`}>
                {!isMine(m) && <div className="chat-avatar">{(m.sender_name || '?')[0]}</div>}
                <div className="chat-bubble-wrap">
                  {!isMine(m) && <span className="chat-name">{m.sender_name}</span>}
                  <div className="chat-bubble-line">
                    {isMine(m) && <span className="chat-time">{fmtTime(m.created_at)}</span>}
                    <div className="chat-bubble">
                      {m.image_url && (
                        <img src={m.image_url} alt="" className="chat-img" onClick={() => window.open(m.image_url, '_blank')} />
                      )}
                      {m.content && <span className="chat-text">{m.content}</span>}
                      {isMine(m) && (
                        <button className="chat-del" onClick={() => handleDelete(m.id)}><Trash2 size={12} /></button>
                      )}
                    </div>
                    {!isMine(m) && <span className="chat-time">{fmtTime(m.created_at)}</span>}
                  </div>
                </div>
              </div>
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
        <button className="chat-attach" onClick={() => fileRef.current?.click()}><ImageIcon size={20} /></button>
        <textarea
          className="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="메시지를 입력하세요..."
          rows={1}
        />
        <button className="chat-send" onClick={handleSend} disabled={sending || (!text.trim() && !imageFile)}>
          <Send size={18} />
        </button>
      </div>

      <style>{`
        .chat-page { display: flex; flex-direction: column; height: calc(100vh - 2rem); max-height: calc(100vh - 2rem); }
        .chat-header { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.25rem 1rem; border-bottom: 1px solid var(--border); }
        .chat-title { font-size: 1.2rem; font-weight: 800; color: var(--text-main); }
        .chat-sub { font-size: 0.78rem; color: var(--text-muted); margin-top: 2px; }
        .push-enable-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 20px; background: var(--gradient-primary); color: #fff; font-weight: 600; font-size: 0.82rem; box-shadow: var(--shadow-md); }
        .push-on { display: flex; align-items: center; gap: 5px; font-size: 0.78rem; color: #16a34a; font-weight: 600; }

        .chat-messages { flex: 1; overflow-y: auto; padding: 1rem 0.25rem; display: flex; flex-direction: column; gap: 10px; }
        .chat-empty { text-align: center; color: var(--text-muted); margin: auto; font-size: 0.9rem; }

        .chat-date-divider { text-align: center; margin: 8px 0; }
        .chat-date-divider span { background: var(--bg-subtle); color: var(--text-muted); font-size: 0.72rem; padding: 4px 12px; border-radius: 12px; border: 1px solid var(--border); }

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
        .chat-text { }
        .chat-time { font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
        .chat-img { max-width: 220px; max-height: 240px; border-radius: 10px; display: block; margin-bottom: 4px; cursor: pointer; object-fit: cover; }
        .chat-del { position: absolute; top: -8px; left: -8px; width: 20px; height: 20px; border-radius: 50%; background: var(--danger, #ef4444); color: #fff; display: none; align-items: center; justify-content: center; }
        .chat-row.mine .chat-bubble:hover .chat-del { display: flex; }

        .chat-preview { position: relative; width: fit-content; margin: 6px 4px; }
        .chat-preview img { max-height: 80px; border-radius: 8px; border: 1px solid var(--border); }
        .chat-preview button { position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: rgba(0,0,0,0.7); color: #fff; display: flex; align-items: center; justify-content: center; }

        .chat-input-bar { display: flex; align-items: flex-end; gap: 8px; padding: 0.75rem 0.25rem 0.25rem; border-top: 1px solid var(--border); }
        .chat-attach { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); background: var(--bg-subtle); flex-shrink: 0; }
        .chat-attach:hover { color: var(--primary); }
        .chat-input { flex: 1; resize: none; max-height: 120px; padding: 10px 14px; border: 2px solid var(--border); border-radius: 18px; font-size: 0.92rem; font-family: inherit; outline: none; background: var(--bg-card, #fff); color: var(--text-main); line-height: 1.4; }
        .chat-input:focus { border-color: var(--primary); }
        .chat-send { width: 42px; height: 42px; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-md); }
        .chat-send:disabled { opacity: 0.4; }

        @media (max-width: 768px) {
          .chat-page { height: calc(100vh - 1rem); }
          .chat-row { max-width: 88%; }
          .chat-img { max-width: 60vw; }
        }
      `}</style>
    </div>
  );
};

export default Chat;
