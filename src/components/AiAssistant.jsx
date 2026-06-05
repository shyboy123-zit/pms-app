import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, RotateCcw } from 'lucide-react';

// PMS AI 질문방 — 자연어로 재고/생산/매출/품질/설비를 묻고 답을 받는다.
// 서버리스 /api/assistant 가 Claude tool-calling 으로 실데이터를 조회해 답변.

const SUGGESTIONS = [
  '지금 안전재고 미달인 자재 알려줘',
  '이번 달 매출 얼마야?',
  '진행중인 작업지시 현황 보여줘',
  '점검 도래한 금형 있어?',
];

// 아주 가벼운 마크다운(**굵게**, 줄바꿈)만 렌더
function renderText(text) {
  return String(text || '').split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <strong key={j}>{seg.slice(2, -2)}</strong>
        : <React.Fragment key={j}>{seg}</React.Fragment>
    );
    return <div key={i} className="ai-line">{parts.length ? parts : ' '}</div>;
  });
}

const AiAssistant = () => {
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', content}
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages.length, loading, scrollToBottom]);

  const ask = async (q) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;
    setInput('');
    const history = messages.slice(-6);
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setLoading(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json();
      const answer = res.ok ? data.answer : `⚠️ ${data.error || '오류가 발생했습니다.'}`;
      setMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: 'assistant', content: `⚠️ 연결 오류: ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-wrap">
      <div className="ai-messages" ref={listRef}>
        {messages.length === 0 && !loading ? (
          <div className="ai-intro">
            <div className="ai-intro-icon"><Sparkles size={32} /></div>
            <h3>무엇이든 물어보세요</h3>
            <p>재고 · 원재료 · 생산 · 매출 · 품질 · 설비 데이터를 자연어로 답해드립니다.</p>
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="ai-chip" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
            <p className="ai-examples">
              예) "BJB-001 5000개 만들려면 원재료 몇 kg 필요해?" · "현재 재고로 몇 개 생산 가능?"
            </p>
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`ai-row ${m.role}`}>
              {m.role === 'assistant' && <div className="ai-avatar"><Sparkles size={16} /></div>}
              <div className="ai-bubble">{renderText(m.content)}</div>
            </div>
          ))
        )}
        {loading && (
          <div className="ai-row assistant">
            <div className="ai-avatar"><Sparkles size={16} /></div>
            <div className="ai-bubble ai-typing"><span></span><span></span><span></span></div>
          </div>
        )}
      </div>

      <div className="ai-input-bar">
        {messages.length > 0 && (
          <button className="ai-reset" onClick={() => setMessages([])} title="대화 초기화" disabled={loading}>
            <RotateCcw size={18} />
          </button>
        )}
        <textarea
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }}
          placeholder="질문을 입력하세요... (예: 이번 달 매출 얼마야?)"
          rows={1}
          disabled={loading}
        />
        <button className="ai-send" onClick={() => ask()} disabled={loading || !input.trim()}><Send size={18} /></button>
      </div>

      <style>{`
        .ai-wrap { display: flex; flex-direction: column; flex: 1; min-height: 0; }
        .ai-messages { flex: 1; overflow-y: auto; padding: 1rem 0.25rem; display: flex; flex-direction: column; gap: 14px; }

        .ai-intro { margin: auto; text-align: center; max-width: 460px; padding: 1rem; }
        .ai-intro-icon { width: 64px; height: 64px; margin: 0 auto 1rem; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md); }
        .ai-intro h3 { font-size: 1.25rem; font-weight: 800; color: var(--text-main); margin-bottom: 6px; }
        .ai-intro p { font-size: 0.9rem; color: var(--text-muted); line-height: 1.5; }
        .ai-suggest { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 1.25rem 0 0.75rem; }
        .ai-chip { padding: 8px 14px; border-radius: 18px; background: var(--primary-soft); color: var(--primary); font-size: 0.83rem; font-weight: 600; border: 1px solid var(--primary); transition: all 0.15s; }
        .ai-chip:hover { background: var(--primary); color: #fff; }
        .ai-examples { font-size: 0.76rem; color: var(--text-muted); margin-top: 0.75rem; opacity: 0.85; }

        .ai-row { display: flex; gap: 8px; max-width: 82%; }
        .ai-row.user { align-self: flex-end; flex-direction: row-reverse; }
        .ai-row.assistant { align-self: flex-start; }
        .ai-avatar { width: 30px; height: 30px; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .ai-bubble { padding: 11px 15px; border-radius: 16px; font-size: 0.92rem; line-height: 1.55; word-break: break-word; }
        .ai-row.assistant .ai-bubble { background: var(--bg-card, #fff); border: 1px solid var(--border); color: var(--text-main); border-top-left-radius: 4px; }
        .ai-row.user .ai-bubble { background: var(--gradient-primary, #4f46e5); color: #fff; border-top-right-radius: 4px; }
        .ai-line { min-height: 1.1em; }
        .ai-bubble strong { font-weight: 800; }

        .ai-typing { display: flex; gap: 4px; align-items: center; }
        .ai-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--text-muted); opacity: 0.5; animation: aiBlink 1.2s infinite; }
        .ai-typing span:nth-child(2) { animation-delay: 0.2s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes aiBlink { 0%,60%,100% { opacity: 0.25; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }

        .ai-input-bar { display: flex; align-items: flex-end; gap: 8px; padding: 0.75rem 0.25rem 0.25rem; border-top: 1px solid var(--border); }
        .ai-reset { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); background: var(--bg-subtle); flex-shrink: 0; }
        .ai-reset:hover { color: var(--primary); }
        .ai-input { flex: 1; resize: none; max-height: 120px; padding: 10px 14px; border: 2px solid var(--border); border-radius: 18px; font-size: 0.92rem; font-family: inherit; outline: none; background: var(--bg-card, #fff); color: var(--text-main); line-height: 1.4; }
        .ai-input:focus { border-color: var(--primary); }
        .ai-send { width: 42px; height: 42px; border-radius: 50%; background: var(--gradient-primary); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: var(--shadow-md); }
        .ai-send:disabled { opacity: 0.4; }

        @media (max-width: 768px) {
          .ai-row { max-width: 90%; }
        }
      `}</style>
    </div>
  );
};

export default AiAssistant;
