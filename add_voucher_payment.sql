-- ============================================================
-- vouchers 테이블에 결제 관리 컬럼 추가 (Phase 3b)
-- ============================================================
-- 미수금/미지급금 추적을 위해 결제 상태 관리 컬럼을 추가합니다.
--
-- ⚠️ Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================

-- 1. 결제 완료 금액 (부분 결제 지원)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0 CHECK (paid_amount >= 0);

-- 2. 마지막 결제일
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS paid_date DATE;

-- 3. 결제 메모 (수표/이체/현금 등 결제수단 메모)
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- 4. 결제 상태 (계산된 컬럼) — total_amount 대비 paid_amount 비교
-- PostgreSQL의 generated column으로 자동 계산 (read-only)
-- 상태 분류:
--   - '미결제' : paid_amount = 0
--   - '부분결제': 0 < paid_amount < total_amount
--   - '결제완료': paid_amount >= total_amount
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS payment_status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN COALESCE(paid_amount, 0) = 0 THEN '미결제'
      WHEN COALESCE(paid_amount, 0) >= COALESCE(total_amount, 0) THEN '결제완료'
      ELSE '부분결제'
    END
  ) STORED;

-- 5. 조회 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_vouchers_payment_status ON vouchers(payment_status);
CREATE INDEX IF NOT EXISTS idx_vouchers_client_status ON vouchers(client, payment_status);

-- 확인 쿼리
-- SELECT id, voucher_type, client, total_amount, paid_amount, payment_status, paid_date
-- FROM vouchers
-- LIMIT 10;
