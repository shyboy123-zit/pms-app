-- =====================================================================
-- 직원 실시간 채팅방 + Web Push 알림 스키마
-- 적용: Supabase 대시보드 > SQL Editor 에 붙여넣고 RUN
-- 안전: 기존 테이블/데이터에 영향 없음 (신규 테이블만 추가)
-- =====================================================================

-- 1) 채팅 메시지 (전체 단톡방 1개 구조 — room_id 불필요)
CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID REFERENCES employees(id) ON DELETE SET NULL,
  sender_name TEXT NOT NULL,
  content     TEXT,
  image_url   TEXT,                       -- 사진 첨부(선택)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- 2) 사용자별 마지막 읽음 시각 (안읽음 뱃지용)
CREATE TABLE IF NOT EXISTS chat_reads (
  user_id      UUID PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) Web Push 구독 정보 (폰 푸시 발송 대상)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES employees(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,        -- 브라우저 푸시 엔드포인트
  p256dh     TEXT NOT NULL,               -- 암호화 키
  auth       TEXT NOT NULL,               -- 인증 시크릿
  user_agent TEXT,                        -- 기기 식별(디버그용)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- =====================================================================
-- Realtime 활성화 (카톡처럼 즉시 반영)
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;

-- =====================================================================
-- RLS (Row Level Security)
-- =====================================================================
ALTER TABLE chat_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_reads         ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 로그인한 직원은 모든 채팅 메시지 조회 가능 (전체 단톡방)
DROP POLICY IF EXISTS "chat read for authenticated" ON chat_messages;
CREATE POLICY "chat read for authenticated"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (true);

-- 로그인한 직원은 메시지 작성 가능 (본인 명의)
DROP POLICY IF EXISTS "chat insert for authenticated" ON chat_messages;
CREATE POLICY "chat insert for authenticated"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 본인 메시지 삭제 가능
DROP POLICY IF EXISTS "chat delete own" ON chat_messages;
CREATE POLICY "chat delete own"
  ON chat_messages FOR DELETE
  TO authenticated
  USING (sender_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

-- chat_reads: 본인 것만 읽기/쓰기
DROP POLICY IF EXISTS "reads own" ON chat_reads;
CREATE POLICY "reads own"
  ON chat_reads FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()));

-- push_subscriptions: 본인 구독만 관리. (발송은 서버리스 service_role 키로 전체 조회)
DROP POLICY IF EXISTS "push own" ON push_subscriptions;
CREATE POLICY "push own"
  ON push_subscriptions FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()))
  WITH CHECK (user_id IN (SELECT id FROM employees WHERE auth_user_id = auth.uid()));
