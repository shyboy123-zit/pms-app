-- 제품별 신재(virgin) 비율(%) — 분쇄(regrind)는 100 - virgin_ratio
-- 50 = 신재:분쇄 = 1:1 (기본), 100 = 신재만 사용
-- Supabase SQL Editor에서 실행하세요
ALTER TABLE products ADD COLUMN IF NOT EXISTS virgin_ratio integer DEFAULT 50;
