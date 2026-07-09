-- ============================================================
-- 포장표준관리 (Packaging Standards) 테이블
-- ============================================================
-- 아이템(제품)별 포장 표준을 기록. 동일 아이템이라도 납품처에 따라
-- 포장사양이 달라질 수 있어 여러 건 기록 가능(1:N).
--
-- ⚠️ Supabase SQL Editor에서 1회 실행하세요.
-- ============================================================

CREATE TABLE IF NOT EXISTS packaging_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,  -- 제품(아이템)
  client TEXT,                       -- 납품처 (예: 코우, 비나)
  packing_quantity NUMERIC,          -- 포장수량 (봉/단위당 EA)
  box_quantity NUMERIC,              -- 박스수량 (박스당 EA)
  box_spec TEXT,                     -- 포장박스 사양 (규격/종류)
  vinyl_color TEXT,                  -- 비닐색상
  notes TEXT,                        -- 비고
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조회 최적화 인덱스
CREATE INDEX IF NOT EXISTS idx_packaging_standards_product ON packaging_standards(product_id);
CREATE INDEX IF NOT EXISTS idx_packaging_standards_client ON packaging_standards(client);

-- RLS: 기존 PMS 패턴과 동일 (인증 사용자 전체 접근)
ALTER TABLE packaging_standards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON packaging_standards;
CREATE POLICY "Enable all access for authenticated users" ON packaging_standards
  FOR ALL USING (auth.role() = 'authenticated');

-- 확인
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'packaging_standards';
