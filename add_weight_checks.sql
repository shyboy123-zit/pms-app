-- ================================================
-- 중량 점검 (Weight Checks) — 품질관리
-- 작업중 제품 중량을 오전 10시 / 오후 2시 측정 기록하고
-- 제품 스펙(하한~상한) 대비 OK/이탈을 판정한다.
-- ================================================

-- 1) 제품 중량 스펙 (하한/상한) — 기준중량은 기존 products.product_weight 사용
ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight_spec_min DECIMAL(10, 2);

ALTER TABLE products
ADD COLUMN IF NOT EXISTS weight_spec_max DECIMAL(10, 2);

COMMENT ON COLUMN products.weight_spec_min IS '중량 스펙 하한 (g)';
COMMENT ON COLUMN products.weight_spec_max IS '중량 스펙 상한 (g)';

-- 2) 중량 측정 기록 테이블
CREATE TABLE IF NOT EXISTS weight_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    check_date DATE NOT NULL DEFAULT CURRENT_DATE,
    time_slot TEXT NOT NULL DEFAULT 'AM',          -- 'AM'(오전 10시) | 'PM'(오후 2시)
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT,                             -- 스냅샷 (제품 삭제/변경 대비)
    work_order_id UUID REFERENCES work_orders(id) ON DELETE SET NULL,
    measured_weight DECIMAL(10, 2) NOT NULL,       -- 측정 중량 (g)
    spec_target DECIMAL(10, 2),                    -- 기준중량 스냅샷 (g)
    spec_min DECIMAL(10, 2),                       -- 스펙 하한 스냅샷 (g)
    spec_max DECIMAL(10, 2),                       -- 스펙 상한 스냅샷 (g)
    result TEXT NOT NULL DEFAULT 'OK',             -- 'OK' | 'NG'(스펙 이탈)
    inspector TEXT,                                -- 측정자
    notes TEXT,                                    -- 비고
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE weight_checks IS '작업중 제품 중량 측정 기록 (오전 10시 / 오후 2시)';

-- 조회 성능용 인덱스 (날짜·제품)
CREATE INDEX IF NOT EXISTS idx_weight_checks_date ON weight_checks (check_date DESC);
CREATE INDEX IF NOT EXISTS idx_weight_checks_product ON weight_checks (product_id);

-- 3) RLS 정책 — 로그인 사용자(authenticated) 전체 CRUD 허용 (다른 테이블과 동일)
ALTER TABLE weight_checks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weight_checks_select" ON weight_checks;
CREATE POLICY "weight_checks_select" ON weight_checks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "weight_checks_insert" ON weight_checks;
CREATE POLICY "weight_checks_insert" ON weight_checks
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "weight_checks_update" ON weight_checks;
CREATE POLICY "weight_checks_update" ON weight_checks
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "weight_checks_delete" ON weight_checks;
CREATE POLICY "weight_checks_delete" ON weight_checks
  FOR DELETE TO authenticated USING (true);
