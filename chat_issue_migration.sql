-- =====================================================================
-- 채팅 "중요 이슈" 기능 — chat_messages 컬럼 추가
-- 적용: Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN
-- 안전: 기존 데이터 영향 없음 (컬럼만 추가)
-- =====================================================================

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_issue BOOLEAN DEFAULT false;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS issue_at TIMESTAMPTZ;  -- 이슈 발생일시

-- 이슈만 빠르게 조회하기 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_is_issue
  ON chat_messages(issue_at DESC) WHERE is_issue = true;
