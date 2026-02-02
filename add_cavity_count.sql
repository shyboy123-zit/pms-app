-- ================================================
-- Products 테이블에 Cavity 수 컬럼 추가
-- ================================================

-- Cavity 수 (1 Shot에 나오는 제품 개수)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS cavity_count INTEGER DEFAULT 1;

-- 컬럼 설명
COMMENT ON COLUMN products.cavity_count IS '금형의 Cavity 수 (1 Shot당 생산 개수)';

-- 예시: 2-Cavity 금형이면 cavity_count = 2
