-- 완제품 초과재고(상한선) 관리를 위한 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock integer DEFAULT 0;
