-- ============================================================
-- 감사 로그 (Audit Log) 테이블
-- ============================================================
-- 모든 주요 데이터 변경(INSERT/UPDATE/DELETE)을 자동으로 기록합니다.
-- 누가, 언제, 어떤 데이터를, 어떻게 바꿨는지 추적 가능.
--
-- ⚠️ Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,                              -- 변경된 테이블 이름 (예: 'inventory_transactions')
  record_id TEXT,                                        -- 변경된 레코드의 PK (문자열로 저장 — uuid/bigint 모두 호환)
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,                                        -- 변경 전 데이터 (UPDATE/DELETE 시)
  new_data JSONB,                                        -- 변경 후 데이터 (INSERT/UPDATE 시)
  changed_by_id UUID,                                    -- 작업자 auth_user_id (employees.auth_user_id와 매칭)
  changed_by_name TEXT,                                  -- 작업자 표시명 (employees.name 스냅샷)
  reason TEXT,                                           -- 변경 사유 (재고조정 등 일부 액션에서 명시)
  context TEXT,                                          -- 변경이 일어난 화면/플로우 (예: 'inventory:batch_in')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 (조회 성능)
CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(changed_by_id);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at DESC);

-- RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_authenticated" ON audit_log;
CREATE POLICY "audit_log_select_authenticated" ON audit_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_log_insert_authenticated" ON audit_log;
CREATE POLICY "audit_log_insert_authenticated" ON audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 감사 로그는 수정/삭제 불가 (무결성 보장)
-- UPDATE/DELETE 정책은 의도적으로 생성하지 않음
